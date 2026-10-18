# KV cache（261013）

https://zhuanlan.zhihu.com/p/2016843212178882587

https://yiwen-cai.github.io/notes/llm-inference/kv-cache-optimization-survey/#%E6%A0%B8%E5%BF%83%E5%85%AC%E5%BC%8F

https://muma378.github.io/%E6%B7%B1%E5%85%A5%E7%90%86%E8%A7%A3KVCache

## 一. 从 transformer的attention开始

在 LLM的推理过程中，KV Cache是决定吞吐量和时延的核心机制之一。

回顾一下Attention的公式：

![文章配图](assets/images/kv-cache/image-01.png)

我们说过表达式中的 Q、K、V 并不是三个固定的向量或者矩阵，他们是 WQ 、WK 和 WV 三个矩阵和输入token的 embedding E 构成的序列 X 的相乘的结果。这里面包含的计算步骤可以拆分成：

> Q=WQ∗X
> 
> K=WK∗X
> 
> V=WV∗X
> 
> 

Transformer 的 decoder 过程就是对 Xt={E1,E2...Et}  不断执行上述过程以生成下一个 token ，再将新生成的 token的 embedding 加入后的 Xt+1 重新执行。

我们可以看到，对于步骤 1、2、4，完全可以省略掉 矩阵和 {E1,E2...Et} 相乘的过程，而只计算 W∗Et+1 即可。

对于attention的矩阵计算过程，可以用下面的图来表示：

![文章配图](assets/images/kv-cache/image-02.png)

https://muma378.github.io/images/kvcache/kvcache-explained.gif

然后我们再来看KV cache的数学推导：

对于单层，单头的KV cache：

![文章配图](assets/images/kv-cache/image-03.png)

对于整个模型的KV cache：

![文章配图](assets/images/kv-cache/image-04.png)

我们以 LLaMA-2 70B 为例，做一个具体的内存占用计算：

![文章配图](assets/images/kv-cache/image-05.png)

而 LLaMA-2 70B [模型权重](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E6%A8%A1%E5%9E%8B%E6%9D%83%E9%87%8D&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLmqKHlnovmnYPph40iLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.k8NfGqm_UY8qXMmJBr4yoQKaizE8j0CqouEgE788_KE&zhida_source=entity)本身（FP16）约为 140 GB。这意味着：

- **单条长序列请求的 KV Cache 就可能占用几十 GB 显存**

- **批量并发时（batch_size=32），KV Cache 可超过模型权重本身**

与模型权重不同，KV Cache 有几个让它格外难处理的特点：

**动态增长**：每生成一个 token，KV Cache 就增长一块。这意味着很难在请求开始前就为它分配好内存。

**请求间差异巨大**：不同请求可能生成 10 个 token，也可能生成 10000 个 token。如果按最大长度[预分配](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E9%A2%84%E5%88%86%E9%85%8D&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLpooTliIbphY0iLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.0GUflXD4N8bwqhWNe47Bi69sedPcucPCNNnuQb6h6pY&zhida_source=entity)，内存浪费严重；如果[动态分配](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E5%8A%A8%E6%80%81%E5%88%86%E9%85%8D&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLliqjmgIHliIbphY0iLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.WrzsGEznztiWMs-xqo2UK133_nim-_fDESx_xLmRFf0&zhida_source=entity)，又容易产生碎片。

**批处理复杂性**：在一个 batch 中，不同请求处于不同的生成阶段，KV Cache 长度各不相同，难以高效地打包成规则[张量](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E5%BC%A0%E9%87%8F&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLlvKDph48iLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.ygabnLjPYIY53UZwKJDqkf4aY18vR3Kgpuyhcee-Xhg&zhida_source=entity)。

这些问题在 vLLM 论文中有详细分析，实验数据显示，在朴素实现下，KV Cache 内存碎片导致的浪费可以高达 **60-80%** 的[可用显存](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E5%8F%AF%E7%94%A8%E6%98%BE%E5%AD%98&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLlj6_nlKjmmL7lrZgiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.xdhKYDzq7GJ39W1eA02z74VoFnSR2uW1vsHtySdcq9E&zhida_source=entity)。



> 为什么不缓存 Query？
> 
> 这是一个值得思考的问题。理论上 Query 也可以缓存，但没有意义：
> 
> - 在生成第  步时，我们只需要当前 token 的  来做注意力查询
> 
> - 历史位置  的 Query 在当前步骤中不会再被用到（因果注意力只向前看）
> 
> - Query 不参与后续步骤的计算，缓存它只会浪费内存
> 
> Key 和 Value 则不同：每次生成新 token，当前的  都需要与**所有**历史 token 的  做注意力，所以缓存 、 是有实际收益的。
> 
> 



## 二. PD分离

把推理的过程分为prefill（填充）和decoding（解码）两个过程并不是天然产生的，是随着 KV cache技术的产生和对LLM应用的服务提供商SLO要求而出现的。

首先，如果没有 KV cache, prefill 和 decoding都是将embeddings送到模型里面去进行一系列的矩阵运算并产生下一个token,这两个过程对于资源的要求也没有任何差别。但是因为KV cache,decoding阶段不再需要对所有token重新进行计算，资源消耗也由计算密集型变成了内存密集型。

其次，LLM应用常常强调 TTFT（首次令牌时间）和 TPOP（每个令牌输出的时间）两个指标，对于不同类型的应用侧重可能略有不同，比如聊天机器人和总结文献，前者两个指标都会看重，而后者TTFT意义不大。这两个指标对应的阶段正是prefill和decoding,所以如何提高这两个指标也变成了对这两个阶段如何进行优化。

[Distserve: Disaggregating prefill and decoding for goodputoptimized large language model serving](https://arxiv.org/abs/2401.09670) 这篇论文提出了分离PD， 来解决上述的两个问题。

下面这张图也展示了如果将 Prefill 和 Decode 放在一个实例中会相互干扰导致吞吐率下降。

![文章配图](assets/images/kv-cache/image-06.png)

看起来 prefill 和 decoding 相互干扰导致了吞吐量的下降，所以只要把这两个阶段分开就可以了吗？不尽然，分离PD 需要考虑的问题依然不少。

首先是通信开销，其次是将一个LLM实例拆成两个之后，原来对LLM serving使用的一些优化策略依然需要对新的实例应用。

总结下来，这两个阶段：

- Prefill（预填充）阶段：并行处理输入 prompt，一次性计算所有输入 token 的 KV，填充 KV Cache。这个阶段是计算密集型（compute-bound）。

- Decode（解码）阶段：逐 token 生成，每步只处理一个 token，但需要读取全部 KV Cache（不需要重新计算K和V）。这个阶段是[内存带宽](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E5%86%85%E5%AD%98%E5%B8%A6%E5%AE%BD&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLlhoXlrZjluKblrr0iLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.6Aoz6PT6CKZEH_ymhxeAd-26Wqt05qlNCdoGl-mHAXk&zhida_source=entity)密集型（memory-bound）。

在 Decode 阶段，GPU 的算力（FLOPS）大部分是空闲的，瓶颈在于把 KV Cache 从显存搬到计算单元的带宽。这就是为什么优化 KV Cache 的内存布局和访问模式，比单纯提升算力更重要。

> 一句话：**Prefill builds the cache; Decode consumes and extends the cache.**
> 
> 

![文章配图](assets/images/kv-cache/image-07.png)



## 三. PagedAttention：像操作系统一样管理显存

vLLM 于 2023 年提出的 PagedAttention 是 KV Cache 管理领域最重要的工程突破之一。它的核心灵感来自操作系统的[**虚拟内存**](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E8%99%9A%E6%8B%9F%E5%86%85%E5%AD%98&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLomZrmi5_lhoXlrZgiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.pBLfbP710Pnu9zaMwTce-t1NadnO-nWLDqscEDtWPIY&zhida_source=entity)**分页（virtual memory paging）**机制。

![文章配图](assets/images/kv-cache/image-08.png)



在传统操作系统中，[物理内存](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E7%89%A9%E7%90%86%E5%86%85%E5%AD%98&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLniannkIblhoXlrZgiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.AkJBJ7BKMLV2bmqSV606NZzuy7zU_SfGUt0s45MLBEo&zhida_source=entity)被切分成固定大小的”页”（page），进程的虚拟地址空间通过页表（page table）映射到物理内存页。进程不需要占用连续的物理内存，内存分配和回收都以页为单位，极大减少了碎片。

PagedAttention 把同样的思想搬到 GPU [显存管理](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E6%98%BE%E5%AD%98%E7%AE%A1%E7%90%86&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLmmL7lrZjnrqHnkIYiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.KIAswDwk5NJ9Y3dj4q90Y3QJRqen0HH8TvRLQi16LaQ&zhida_source=entity)：

- 把 KV Cache 的显存切分成固定大小的 **Block**（块），每个块存储固定数量 token 的 KV

- 为每个请求维护一个 **Block Table**（块表），记录该请求的 KV Cache 分布在哪些[物理块](https://zhida.zhihu.com/search?content_id=271534792&content_type=Article&match_order=1&q=%E7%89%A9%E7%90%86%E5%9D%97&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTIwNTE0NDIsInEiOiLniannkIblnZciLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzE1MzQ3OTIsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.nhE3svmCJ4spOYM8Q2Y7NT7ZT7OsaOqDnGirp6c_sg8&zhida_source=entity)上

- 物理块不需要连续，通过块表索引即可找到对应数据











