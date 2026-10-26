# cross-encoder（261026）

https://medium.com/@kakumar1611/the-illustrated-guide-to-cross-encoders-from-deep-to-shallow-2a23a8630016

https://www.cnblogs.com/wanger-sjtu/p/18227082

## 一、引言

交叉编码器（Cross-encoder）是一种神经网络架构，用于将查询-文档对一起处理以计算相关性评分。与传统嵌入模型（Bi-encoder）分开处理查询和文档不同，交叉编码器允许两个序列中的所有token之间进行充分的自注意力交互，从而直接输出相关性评分。

![Image](assets/images/a2d0ccc46e/image-01.png)

Bi-encoder和Cross-encoder是在自然语言理解任务模型的两种不同方法，在信息检索和相似性搜索二者的使用更为广泛，RAG的pipe line中这两个模块作为提升检索精度的模块更是备受瞩目。

![Image](assets/images/a2d0ccc46e/image-02.png)

在RAG应用中，cross-encoder 通常作为 rerankers 进行部署，采用两阶段检索过程。首先，快速向量检索（Bi-encoder）检索了更广泛的潜在相关文档集。然后cross-encoder仔细检查这些候选词，以确定LLM真正相关的候选词。这种混合方法结合了二者的优点——矢量搜索的速度和 cross-encoder分析的精确性。



## 二、工作机理

![Image](assets/images/a2d0ccc46e/image-03.png)

Query tokens和 document tokens被聚合到了一起，二者可以直接关联。其中 [CLS] 和 [SEP] 有助于模型理解序列机构

可以进行精确匹配（"neural" -> "neural"），也可以进行语义匹配（"networks" -> "learn"）。

同时还需要考虑的一个工程问题是处理能力和性能之间的权衡，在固定延迟预算的条件下，可以选择：

- 用深度模型处理更少的文件

- 用浅模型处理更多文件

从传统的cross-encoder和浅编码器之间的关键区别在于其架构：

![Image](assets/images/a2d0ccc46e/image-04.png)



