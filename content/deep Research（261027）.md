# deep Research（261027）

https://zhuanlan.zhihu.com/p/26560000573

https://zhuanlan.zhihu.com/p/1957046286172784061

## 一、背景与演进

OpenAI 在 2024 年 9 月发布的 `o1-preview`，它引入了推理时计算（test-time compute）的概念，并逐渐改变了行业观点。推理时计算指的是在推理阶段（LLM 生成输出的阶段）使用更多计算资源，而不是在预训练或后训练阶段。众所周知的例子包括思维链（Chain-of-Thought，CoT）推理和 [`"Wait"`](https://github.com/simplescaling/s1?tab=readme-ov-file#vllm-with-budget-forcing)[ 注入](https://github.com/simplescaling/s1?tab=readme-ov-file#vllm-with-budget-forcing)（即预算强制），这使模型能够进行更广泛的内部深思熟虑，比如评估多个潜在答案、进行更深入的规划，并在得出最终回答之前进行自我反思。

这种推理时计算概念和推理模型教育用户接受[延迟满足](https://en.wikipedia.org/wiki/Delayed_gratification)——用较长的等待时间换取更高质量、可立即行动的结果，就像斯坦福棉花糖实验中，能够抵制立即吃掉一个棉花糖以获得之后两个棉花糖的孩子表现出更好的长期结果。Deepseek-r1 进一步强化了这种用户体验，不管喜欢与否，大多数用户都已经接受了这一点。

这标志着与经典搜索要求的重大转变，在过去，如果无法在 200ms 内响应就会导致你的解决方案失败。在 2025 年，经验丰富的搜索开发者和 RAG 工程师优先考虑 top-1 精确率和召回率而不是延迟，用户已经习惯了较长的处理时间——只要他们能看到系统在 `<thinking>`。

### 1.1 传统RAG的局限

尽管LLMs在通用任务中表现卓越，但是其知识受限于**训练时的静态参数记忆，**难以应对动态或者专业领域任务。

![Image](assets/images/bf07542214/image-01.png)

检索增强生成（RAG）被提出以弥补这一缺陷：通过从外部知识库中检索相关文档，并将其作为上下文输入LLM进行生成。

传统的RAG包括从离线到在线的过程：

- 离线文档处理：文档解析、长文档分片、文本/段落/块等多级别摘要、embedding 入库

- 在线检索生成：前置意图识别/问题改写/工具调用、多路检索和rerank排序、LLM生成答案。

然而，传统RAG存在根本性的局限：

- 模型仅被动消费用户输入的检索结果，缺乏主动探索能力

- 通常为“检索 -> 生成”单轮流程，无法支持多跳推理

- 无法显式任务分解与策略制定



### 1.2 Deep Search演进

随着LLMs具备规划、工具使用、反思推理等智能体能力，**研究范式正在从被动检索转向主动、目标驱动的交互**，也就是 agentic search。

![Image](assets/images/bf07542214/image-02.png)

DeepSearcher 架构 是一个闭环的智能系统：`多源数据 -> 查询拆解 -> 智能路由 -> 向量检索 -> LLM反思评估 -> (如果信息不足) 生成新查询继续检索 -> (如果信息充足) 聚合总结 -> 生成报告`

![Image](assets/images/bf07542214/image-03.png)

相比于传统RAG，主要有下面几点的改进：

#### 1.2.1 查询理解与拆解

传统RAG通常直接将用户的原始query作为检索词，面对复杂、多意图的问题时，检索召回率低。

deepsearch在检索前加入了LLM对原始query进行理解和拆解，转化为多个sub query，这样可以将用户宏大的问题拆解为多个细粒度的检索方向，大幅提升后续检索的准确度。

#### 1.2.2 多源数据接入和路由分发

传统RAG往往只针对单一类型的数据源（比如企业文档），缺乏对异构数据的整合能力。

deepsearch增加了顶部的data ingestion模块，整合了`Internal docs`（内部文档）、`Crawled web pages`（爬虫网页）、`Structured data`（结构化数据）、`Streaming data`（流式数据），支持多模态多来源的数据统一接入；中间的 `Collection router`（集合路由器）充当智能路由，根据子查询的意图将其精准路由到目标数据库（图中标记为 `milvus` 向量数据库）中对应的 Collection（集合）里，避免在全库中盲目检索。

#### 1.2.3 引入自我反思和循环检索

传统RAG是单次的“检索 -> 生成”，如果第一次检索到的内容不足以回答问题，模型就会产生幻觉或者给出片面的答案。

deepsearch引入了类似agent的“规划-执行-反思”循环（reasoning loop）：

- 经过 `Semantic search`（语义搜索）后，流程并没有直接走向生成，而是进入反思节点。LLM 会评估当前检索到的信息是否足以回答问题。

- 如果存在空白（`Yes, generate new queries`），箭头会指回上方的 `Sub query`，生成新的子查询继续检索。这种多跳（Multi-hop）检索机制极大地提高了复杂问题的解决率。

#### 1.2.4 动态的上下文聚合与重写

传统的RAG简单地将所有检索到的chunk堆砌在prompt中，容易导致上下文超长、注意力分散（lost in the middle）以及信息冗余。

deepsearch在生成最终报告前，对多轮检索收集到的信息进行整合、重写和总结：

- 反思节点的 `No` 分支指向的 `append/rewrite and summarize`（追加/重写与总结）模块。

- 结合 LLM，系统会剔除冗余信息，融合多源信息，形成条理清晰的上下文，最终输出为 `Final report`（最终报告），而不是简单的拼凑回答。

通过这套架构，Deep Search 把“被动的一次性查找”变成了“主动的、带有探索性质的深度研究”。

但是deep search仍不足以完成需要综合分析与结构化输出的复杂研究任务。



### 1.3 Deep Research

为此，Deep Research 被提出，其核心在于将信息探索与结构化分析、多部推理生成相结合，实现从数据溯源、可信、综合性报告的最终输出。

![Image](assets/images/bf07542214/image-04.png)

其中有三大核心角色：

![Image](assets/images/bf07542214/image-05.png)

执行流程如下：


![Image](assets/images/bf07542214/image-06.png)

Deep Search 通常专注于解决特定、明确的问题（即“找什么”），主要是一个信息检索与聚合的闭环；而 Deep Research 则需要模拟人类研究员的工作方式，解决开放式、复杂的课题（即“研究什么”），它是一个项目规划、执行与知识生产的完整流程。

主要与有以下四个方面的核心改进：

#### 1.3.1 引入全局战略规划能力（planning）

deepsearch通常直接基于用户的query进行拆解，缺乏全局视野。而deep research系统在开始检索前，会先进行结构化、可学习的知识规划，制定研究大纲和策略。

#### 1.3.2 动态预制柱的提问机制（quesion developing）

deepsearch的提问/查询往往受限于最初的prompt拆解，虽然也有反思，但是主要目的是填补信息空白。

而deep research则是能够根据研究计划的推进和当前获取的信息，动态开发新问题，这种提问是受监督学习（supervision driven）和奖励优化（reward optimized）驱动的，像真实研究员那样不断追问“我接下来要调查什么”

#### 1.3.3 多工具融合的深度网络探索（web exploration）

Deep search主要是依赖内部向量数据库的语义搜索，环境相对封闭。

而deep research面对开放的互联网，系统具备强大的web探索能力，不仅能调用api，还能操作真实的浏览器访问网页；并且探索过程是迭代的（iterative search），探索得到的发现会反馈给提问模块，形成循环

#### 1.3.4 具备学术规范的报告生成（report generation）

Deep search 通常只是简单拼接信息并生成一段文本总结。

而deep research最终输出的是专业级的研究报告。这不仅要求内容全面，更强调结构化控制（structure control）和事实完整性溯源（factual integrity），确保逻辑严密且内容真实可查。

## 二、deep research 核心模块

![Image](assets/images/bf07542214/image-07.png)

### 2.1 planning：规划

Planning是deep research中的第一阶段和基础环节，其作用是将`用户意图转化为可执行的步骤，例如子问题的提出和信源的检索`

- 代表工作

### 2.2 Question Developing：查询生成优化

![Image](assets/images/bf07542214/image-08.png)

优化范式分类

### 2.3 Web Exploration：网页探索的两种范式

![Image](assets/images/bf07542214/image-09.png)

两种主流方式：

### 2.4 Report Generation：结构控制与事实一致性

![Image](assets/images/bf07542214/image-10.png)

核心挑战：

## 三、deep research [RL优化范式](https://zhida.zhihu.com/search?content_id=263752626&content_type=Article&match_order=1&q=RL%E4%BC%98%E5%8C%96%E8%8C%83%E5%BC%8F&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTMyNjUxNTYsInEiOiJSTOS8mOWMluiMg-W8jyIsInpoaWRhX3NvdXJjZSI6ImVudGl0eSIsImNvbnRlbnRfaWQiOjI2Mzc1MjYyNiwiY29udGVudF90eXBlIjoiQXJ0aWNsZSIsIm1hdGNoX29yZGVyIjoxLCJ6ZF90b2tlbiI6bnVsbH0.FQ57Kedygk8Hef_hLC7aM_EnSUS2xWm_SZ1u7wTqPyY&zhida_source=entity)

### 3.1 传统方法的局限

### 3.2 [奖励函数](https://zhida.zhihu.com/search?content_id=263752626&content_type=Article&match_order=1&q=%E5%A5%96%E5%8A%B1%E5%87%BD%E6%95%B0&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTMyNjUxNTYsInEiOiLlpZblirHlh73mlbAiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNjM3NTI2MjYsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.kQ6LXLt3xHSUtQ7zb82Gd-N1OqJB4yYNgUsIATiXTzM&zhida_source=entity)设计与信用分配（Reward Design）

奖励函数的设计是RL成功的关键。主流奖励类型包括：

- Outcome：最终答案的正确性（如EM, F1）。

- Format：推理格式和工具调用的合规性。

- Retrieval_Necessity/Quality：衡量检索行为的必要性和质量

主流奖励类型：

### 3.3 [多智能体](https://zhida.zhihu.com/search?content_id=263752626&content_type=Article&match_order=1&q=%E5%A4%9A%E6%99%BA%E8%83%BD%E4%BD%93&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTMyNjUxNTYsInEiOiLlpJrmmbrog73kvZMiLCJ6aGlkYV9zb3VyY2UiOiJlbnRpdHkiLCJjb250ZW50X2lkIjoyNjM3NTI2MjYsImNvbnRlbnRfdHlwZSI6IkFydGljbGUiLCJtYXRjaF9vcmRlciI6MSwiemRfdG9rZW4iOm51bGx9.MKWHYvJIOlH_QefHvB5dQSJehPH2uDwo2NqlJO0BgBc&zhida_source=entity)强化学习（[MARL](https://zhida.zhihu.com/search?content_id=263752626&content_type=Article&match_order=1&q=MARL&zd_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ6aGlkYV9zZXJ2ZXIiLCJleHAiOjE3OTMyNjUxNTYsInEiOiJNQVJMIiwiemhpZGFfc291cmNlIjoiZW50aXR5IiwiY29udGVudF9pZCI6MjYzNzUyNjI2LCJjb250ZW50X3R5cGUiOiJBcnRpY2xlIiwibWF0Y2hfb3JkZXIiOjEsInpkX3Rva2VuIjpudWxsfQ.ZrRt4yRFwYhRNvbLFFukydUAkNYiPebAVeJvsqaMYgw&zhida_source=entity)）

当多个模块（如Query Rewriter、Reranker、Answerer）均可训练时，可采用多智能体RL。

多智能体训练策略



