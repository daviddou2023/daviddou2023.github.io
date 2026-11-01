# 从Transformer和Attention机制到LLM（261101）

https://zhuanlan.zhihu.com/p/1890055336762799315

https://blog.bytebytego.com/p/how-transformers-architecture-powers

https://poloclub.github.io/transformer-explainer/

https://blog.csdn.net/BigTress/article/details/159086949

https://zhuanlan.zhihu.com/p/2030062805299283887

自从Transformer架构横空出世，到LLM蓬勃发展，我们意识到Transformer是LLM得以发展的驱动力之一，那么Transformer是如何为LLM奠定基础的，从Transformer最初用于文本翻译到后来用于大模型文本生成，这其中又有怎样的不同？本文将从输入文本到下一个 Token，解析LLM生成文本的全流程，以及这其中涉及的Transformer架构。

先从系统的角度看，大模型本质上在做的事情，是根据已有的输入token，预测下一个输出token。

注意这里说的输入输出的东西都是token。token并不是词（word），而是词元，是大模型内部处理文本时候使用的最小单元，比如“transformers”这个单词（word），在大模型内部被分为“tarnsform”和“ers”这两个词元，具体怎么把输入的单词句子分成不同的token，这和模型内部的分词器有关，最常见的分词器是BPE（Byte Pair Encoding），BPE的思想也非常简单——出现频率最高的字符对优先合并。

有了token之后，模型内部通过transformer架构进行处理，但是大模型本质上是个概率系统，最终并不直接输出下一个token，而是会输出候选token的不同概率，这些概率再由不同的采样方法决定最终输出的是哪个token。



以上描述的就是大模型自回归推理范式：模型每一步根据已生成的 token 序列，预测下一个 token 的概率分布，采样出一个 token，把它追加到序列末尾，再进入下一步。如此循环，直到遇到停止条件。而大模型根据用户query回答问题就是自回归推理的一个具体场景。

大模型自回归推理通常分为两个工程阶段，prefill和decode在单次请求内部是串行执行的，但是在真实推理服务中可以跨请求并行。

- Prefill 对输入 prompt 中未命中缓存的部分做一次前向计算：输入序列的多个 token 位置可以并行处理，计算并填充各层 KV Cache，并在最后一个位置产出 logits，用于采样第一个输出 token。Prefill 通常是计算密集型的。

- Decode 则是自回归生成循环：每步以上一步采样出的 token 为输入，读取并追加 KV Cache，计算下一个 token 的 logits 并采样；每个请求每步只生成一个 token，直到遇到停止条件。Decode 通常是显存带宽密集型的。

一次回答生成，包含多个自回归步。一次“生成用户 query 的回答”的完整推理过程通常是：

> Prefill：并行处理输入（query + 上下文，扣除缓存命中部分），建立 KV Cache，产出第一个输出 token 的 logits
> Decode：自回归循环，每步生成一个 token，直到回答结束
> 
> 

![Image](assets/images/fab9063b3f/image-01.png)



整个从用户输入自然语言的问题，到模型输出自然语言的回答流程如下图：

![Image](assets/images/fab9063b3f/image-02.png)

接下来将结合例子对每个环节做尽可能详细地解释。

---

## 一、分词

在用户输入进来query时，

```Plain Text
user: 解释一下 Attention
```

此时大模型处理的并不只有这个query，还有系统提示词，历史消息等，这些内容要和query一起按照模板进行上下文的拼装：

```Plain Text
<bos><system>你是助手</system><user>解释一下 transformers</user><assistant>
```

这个前处理的过程将文本压成了一条线性的序列，后续所有操作都是围绕这个序列展开的

分词就是将输入的文本序列切分为大模型内部可以处理的最小单元（token）。

> 为什么要使用大模型要把输入的文本分词成token呢？直接处理一个一个单词不可以吗？
> 
> 这里有两个主要原因：
> 
> - 词表爆炸：英文有数十万个单词，中文汉字又有多种组合，如果一个单词一个单词处理，那所需要维护的词表是巨大的，同时所需要的内存空间也是巨大的，而分词成一个一个token，仅需要几万个基础的token组成的词表，通过token之间的灵活组合就可以拼凑出几乎所有的单词和句子。
> 
> - 未知词：网络上每天都有新的词语产生，如果遇到词表里没有的词，那么模型无法处理，而通过基础的token就可以进行组合出新的词语。
> 
> 

输入的文本序列被分成了下面的token：

```Plain Text
["<bos>", "<system>", "你是", "助手", ..., "transform", "ers", ..., "<assistant>"]
```

那为什么这么个分法呢？这和内部的BPE（Byte Pair Encoding）算法有关，BPE分词器在构建时候，核心思想很简单，出现频率最高的相邻字符对优先合并。所以不把 transformers 分成 [“ transformer”, “s”]，就是因为“transform”这个字符串出现频率比transformer高。

训练好的五万到十万的词汇表中，每个唯一的token会被分配唯一的一个token ID。因为后续要跟数字打交道，总不能一直带着token，这一步相当于做了一个映射，反正词汇表不变，最后输出token ID时候再从词汇表中解映射出对应的token即可。

```Python
[1, 523, 8912, 17, ..., 42]
```

---

## 二、嵌入

### 2.1 词嵌入

尽管现在一连串的token ID已经比文本更适合机器处理，但它本质上仍然只是离散标签，本身并不能直接参与矩阵运算。模型真正需要的是连续向量表示，因此会根据每个 `token_id` 去 `embedding` 参数表里查出对应的一行向量。

![Image](assets/images/fab9063b3f/image-03.png)



从工程角度看，`embedding` 可以理解成一个大型查表操作：索引是 `token` 编号，结果是一段[高维向量](https://zhida.zhihu.com/search?content_id=273533889&content_type=Article&match_order=1&q=%E9%AB%98%E7%BB%B4%E5%90%91%E9%87%8F&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTM2ODkwODIsInEiOiLpq5jnu7TlkJHph48iLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzM1MzM4ODksImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.egbEMDLlKfgg80-NN4UtJIUkxggXjpJEPd8EWO35GEo&zhida_source=entity)。列数就是维度，那为什么需要一个高维的向量而不是一个一维的向量呢？

比如我们要对猫进行分类，如果只从品种这一个维度来分，会得到同一品种不同的猫，这时候需要再规定一个分类标准来进行更细的分类。随着分类标准的增加，猫的分类矩阵的维度也在增加。同理对于embedding而言，我们的目的是把token ID映射为一个向量，这个向量尽可能全面地表征这个token，这就是机器和人的区别，机器不懂语义，只能从数学角度来理解，维度越多所携带的语义信息越丰富。尽可能地保证不同的词之间总能区分开来。


![Image](assets/images/fab9063b3f/image-04.png)

而**嵌入矩阵（Embedding Table）本身也是巨大的，比如词表 15 万，隐藏层维度 4096 → 矩阵大小 ****`150,000 × 4,096`****。**矩阵里的数字初始是随机的。在训练过程中，通过反向传播不断更新，使得语义相近的词（如“猫”和“狗”），它们的向量在空间中的距离（余弦相似度）更近。**训练完成后**，矩阵参数固定，推理时直接查表使用。

这一步我们假设我们得到了一个`(N, d_model)` 为`(16, 64)`的矩阵 X

![Image](assets/images/fab9063b3f/image-05.png)



### 2.2 位置编码

为什么需要位置编码呢？

从直观上来看，“我吃鱼”和“鱼吃我”是两个不同的概念，但是这两句在Transformer内部计算注意力矩阵时候，每个token只关注自己所在的一行：

```Python
我：-0.31-0.420.60-0.770.460.581.160.63-0.16-0.77-0.95-0.15
吃：1.300.47-1.01-0.382.82-0.05-0.141.60-0.210.130.921.13
鱼：-0.710.040.060.55-0.510.130.68-0.73-0.041.27-0.01-2.32
```

```Python
鱼：-0.710.040.060.55-0.510.130.68-0.73-0.041.27-0.01-2.32
吃：1.300.47-1.01-0.382.82-0.05-0.141.60-0.210.130.921.13
我：-0.31-0.420.60-0.770.460.581.160.63-0.16-0.77-0.95-0.15
```

这两句话最终得到的注意力矩阵是完全相同的，因此模型无法进行区分，所以我们要通过某种手段使得即使token完全相同，但是也能够携带位置信息进行区分。

位置编码的目标很简单：让模型知道每个 token 在序列中的位置。最直观的做法，是给每个位置准备一个[位置向量](https://zhida.zhihu.com/search?content_id=273533889&content_type=Article&match_order=1&q=%E4%BD%8D%E7%BD%AE%E5%90%91%E9%87%8F&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTM2ODkwODIsInEiOiLkvY3nva7lkJHph48iLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzM1MzM4ODksImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.1aSyUMHh1YnJfPzHCZzegsrEeeGHF70-O-l8THVn47A&zhida_source=entity) [`position_ids`](https://zhida.zhihu.com/search?content_id=273533889&content_type=Article&match_order=1&q=position_ids&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTM2ODkwODIsInEiOiJwb3NpdGlvbl9pZHMiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzM1MzM4ODksImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.7LP4PDT5FJoZd9P8ptOdq9ndc1X3zTz-EqQEHGTKxaA&zhida_source=entity)，然后与 `token` 的 `embedding` 相加。这样即使 `token` 内容相同，只要出现在不同位置，送入后续层的输入也会不同。但这样有一个坏处, 原本的 `embedding` 向量, 与 `position_ids` 相加后, 原本的语义内容就被破坏了。

所以如今很多模型更常用的是 `RoPE`，也就是[旋转位置编码](https://zhida.zhihu.com/search?content_id=273533889&content_type=Article&match_order=1&q=%E6%97%8B%E8%BD%AC%E4%BD%8D%E7%BD%AE%E7%BC%96%E7%A0%81&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTM2ODkwODIsInEiOiLml4vovazkvY3nva7nvJbnoIEiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNzM1MzM4ODksImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.tfYZA276kqeLB9GjX_-ZsT3ESdZlczXyNw-kMNDyI7o&zhida_source=entity)。它不是直接把位置信息加到输入向量上，而是先计算 `Attention` 要用的 `Q` 和 `K`，再对它们施加与位置相关的变换。这样模型在比较两个位置相关性时，既能感知内容，也能感知相对位置关系。

![Image](assets/images/fab9063b3f/image-06.png)

![Image](assets/images/fab9063b3f/image-07.png)

位置编码方式有三个大方向：绝对位置编码、相对位置编码和旋转位置编码：

|编码方式|核心思想|实现方式|典型模型|外推能力|
|---|---|---|---|---|
|**绝对位置编码**|为每个位置赋予唯一向量，加到词嵌入上|正弦/余弦函数 或 可学习嵌入|Transformer, BERT, GPT|正弦函数可外推，可学习嵌入不可外推|
|**相对位置编码**|在注意力计算中引入相对位置偏置|可学习的相对嵌入或函数|Transformer-XL, Shaw et al.|通常可处理任意长序列|
|**旋转位置编码**|通过旋转矩阵使内积包含相对位置|对 Query/Key 进行二维旋转|LLaMA, PaLM, GPT-NeoX|良好外推性|

---

## 三、Transformer

标准的 Transformer 分为 **Encoder（编码器）** 和 **Decoder（解码器）**，但现代大模型（如 GPT, Llama）大多采用 **Decoder-only** 架构。

### 3.1 标准的 Transformer架构

![Image](assets/images/fab9063b3f/image-08.png)

> https://poloclub.github.io/transformer-explainer/
> 
> 可以详细理解Transformer各个参数和组成结构
> 
> 

#### 3.1.1 输入层

- **Tokenization**：将文本切分为 Token（如 BPE, WordPiece）。

- **Embedding**：将 Token 映射为稠密向量。

- **Position Embedding**：注入位置信息。

#### 3.1.2 Encoder

![Image](assets/images/fab9063b3f/image-09.png)

- **Self-Attention**：自注意力使得序列中的某个token能够与其他同序列中的其他token进行交互。

- **Feed-Forward Network (FFN)**：两个线性层中间加激活函数（GELU/ReLU），对每个位置独立处理，增加非线性能力。

- **Multi-Head attention：**每个head都有自己的投影矩阵，每个head专注于不同的语义方面，最终多个头输出的向量拼接，再通过线性变换合成一个头，用于后续输入，这样可以让模型从多角度理解语言，并将信息融合成一个更加丰富的表达。

![Image](assets/images/fab9063b3f/image-10.jpg)

#### 3.1.3 Decoder

- **Masked Self-Attention (Causal Mask)**：使用上三角矩阵掩码，确保位置 t 只能看到0到t 的词，不能看到未来。这是自回归生成的基础。

- **Cross-Attention**（仅 Encoder-Decoder 架构有）：Decoder 的 Q 来自上一步输出，K, V 来自 Encoder 输出。



![Image](assets/images/fab9063b3f/image-11.jpg)

#### 3.1.4 输出层

- **Linear Projection**：将隐藏层向量映射到词表大小 (Vocab Size)。

- **Softmax**：计算下一个 Token 的概率分布。

## 3.2 为什么LLM首选decoder-only

LLM 的核心能力是 **Chat（对话）** 和 **Completion（续写）**。Decoder 结构天然带有 Causal Mask（因果掩码），强制模型只能利用过去的信息预测未来，这完美契合“生成”任务。

Encoder-Decoder 架构虽然也能做生成，但它的优势在于“理解源序列 + 生成目标序列”（如翻译），对于单纯的对话任务，Encoder 部分显得冗余。

在推理效率方面，decoder-only在推理阶段，每一个新生成的token，只需要计算一次attention，由于结构统一，KV cache也非常同意实现。而 Encoder-Decoder 推理时需要先跑一遍 Encoder 编码 Prompt，再跑 Decoder。虽然也可以缓存，但架构更复杂，显存管理更麻烦。

在扩展性上，业界经验表明（如 GPT-3, Chinchilla 论文），在同样的参数量和数据量下，**Decoder-only 架构在通用语言任务上的扩展性更好**。

在训练数据的利用上，Encoder-Decoder 通常需要构造“输入 - 输出”对（例如把一句话的前半段当输入，后半段当输出），数据处理相对麻烦一些。而Decoder可以直接在原始文本上进行训练。

## 3.3 self-attention 和 cross-attention

在语言模型中，我们一般用的是 Self-Attention。也就是说，每个词既是 Query，又参与构成 K 和 V，这就实现了“从整个上下文中提取信息”以辅助自身理解。在预测“!”后的词时，“!”作为 Query，同时也参与自身的 K 和 V 计算，这是完全允许的。通过 Mask 操作，确保模型不会提前看到未来词。

而在 Encoder-Decoder 模型（比如[机器翻译](https://zhida.zhihu.com/search?content_id=255804934&content_type=Article&match_order=1&q=%E6%9C%BA%E5%99%A8%E7%BF%BB%E8%AF%91&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTM2ODkwODEsInEiOiLmnLrlmajnv7vor5EiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNTU4MDQ5MzQsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.KqO3lX29OL_jk9mSLMAzFGtAVGXgZcwPjFFWdKri-oI&zhida_source=entity)）中，Cross-Attention 是核心模块。举例来说，源语言是英文，目标语言是中文，当 Decoder 要生成中文中的“模型”时，它的 Query 向量来自于 Decoder 当前状态，而 Key/Value 则来自 Encoder 编码的英文句子。这就像你在写摘要（生成）时，反复查看原文（输入）的某些地方以获取信息，Q 和 K/V 来自不同来源，信息[交叉流动](https://zhida.zhihu.com/search?content_id=255804934&content_type=Article&match_order=1&q=%E4%BA%A4%E5%8F%89%E6%B5%81%E5%8A%A8&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTM2ODkwODEsInEiOiLkuqTlj4nmtYHliqgiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNTU4MDQ5MzQsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.pwkCN6J3b4CWwnOiwsvAQ8MRUrzk2A-4cfX8aJuEfXA&zhida_source=entity)。

总的来说，Self-Attention 强调“我在理解我自己”，而 Cross-Attention 强调“我要从另一个[语义空间](https://zhida.zhihu.com/search?content_id=255804934&content_type=Article&match_order=2&q=%E8%AF%AD%E4%B9%89%E7%A9%BA%E9%97%B4&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTM2ODkwODEsInEiOiLor63kuYnnqbrpl7QiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNTU4MDQ5MzQsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MiwiemRfdG9rZW4iOm51bGx9.Qs3b1ezxVHqynWppzOD6pFHxt-rAxM0kKcsL8my4qQM&zhida_source=entity)查资料”。

---

## 四、最终内容生成

### 4.1 采样策略

模型输出的是概率，选哪个词决定了生成的质量。

|采样策略|规则 (如何选择下一个词)|参数/核心机制|优点|缺点/注意事项|
|---|---|---|---|---|
|**1. 贪婪搜索**|永远选择当前概率最大的那个词（Top-1）|无|计算简单、输出最确定|容易陷入重复循环，文本枯燥，缺乏创造性（如“的的的的...”）|
|**2. 随机采样**|严格按照模型输出的原始概率分布进行随机抽取|无|引入了随机性，能产生变化|可能抽到极低概率的“乱码”或无意义词汇|
|**3. 温度采样**|在 Softmax 计算前，将 Logits 除以温度系数 $T$|**T \< 1**：分布更尖锐（保守、确定）\<br>**T = 1**：原始分布\<br>**T > 1**：分布更平滑（随机、有创造性）|调节模型输出发散程度的最基础手段|需要根据任务类型手动调节参数 $T$|
|**4. Top-K 采样**|截断采样池，只在概率最高的 $K$ 个候选词中采样|**K值**（如 K=50）|有效过滤低概率的垃圾词，避免乱码|固定 $K$ 值不够灵活。若分布很尖锐，$K$ 偏大易引入垃圾词；若分布很平缓，$K$ 偏小易限制多样性|
|**5. Top-P 采样**|动态确定采样池：按概率从高到低累加，直到总和达到阈值 $P$，只在这个动态集合中采样|**P值**（如 P=0.9）\<br>*(例：前 3 个词概率和达 0.9 就选这 3 个；前 100 个才达 0.9 就选这 100 个)*|**最常用**。比 Top-K 更灵活，能自适应概率分布形态，兼顾确定性与多样性|阈值 $P$ 设置过高可能引入低质量词，设置过低则退化为类似贪婪搜索|

### 4.2 生成停止条件

生成不会无限进行下去，通常由以下条件触发停止：

- 预测出结束符 (EOS Token) 

原理：模型在训练时学习了 \<eos> (End of Sequence) token。当模型认为“话说完了”，它会预测出这个 token。

一旦生成 \<eos>，系统立即截断，不再继续。

- 达到最大长度限制 (Max Tokens / Max Length) 

原理：为了防止模型死循环、节省算力或控制成本，系统会设置一个硬上限。

如果生成了 2048 个 Token 还没出现 \<eos>，强制切断。

---



总结下来：

当用户输入一句话后，系统首先进行前处理：将系统提示词、历史对话和当前输入等按模型要求拼接成完整文本。随后，Tokenizer 将其切分为 token 并映射为 token_id 序列，这些编号再经过 Embedding 并结合位置信息，最终形成进入模型的输入向量表示。

接下来进入 Prefill 阶段。已有的整段上下文会并行穿过多层 Transformer：在每一层中，模型生成对应位置的 Q/K/V，通过 Attention 聚合历史信息，再经 FFN 或 MoE 加工表示。随着层数推进，各个位置的表示不断更新，最终计算出当前末尾位置的隐藏状态，同时建立起后续生成所需的首批 KV Cache。Prefill 结束时，模型产出第一轮可供采样的 logits。首 token 往往更慢，正是因为真正开始生成前，已有的所有上下文必须先完整走完一遍主链路。

随后进入 Decode 阶段。此时每一轮只处理一个新位置：模型先形成当前步的输入向量与位置信息，在每一层中生成新的 Q/K/V，读取历史 KV Cache 完成 Attention，再通过 FFN 或 MoE。当前轮新算出的 K/V 会被写回缓存，供下一轮复用。经过多层计算后，当前位置得到最新的隐藏状态，并映射为 logits，最终通过温度调节、Softmax 和采样策略选出本轮的新 token_id。

这个新 token_id 会分两路：一方面通过 Detokenize 转成用户可见的文本片段；另一方面接回上下文，成为下一轮 Decode 的输入。于是，同一条链路在 Decode 阶段不断循环：读取历史、计算新位置、产出新 token、更新历史，直到生成停止符或达到长度上限，整段回复才宣告结束。

![Image](assets/images/fab9063b3f/image-12.png)



