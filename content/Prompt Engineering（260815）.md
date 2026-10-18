# Prompt Engineering（260815）

## 一、Prompt Engineering（260815）

https://www.promptingguide.ai/techniques/cot

https://www.youtube.com/watch?v=tiolhsOAjf8

### 1、zero-shot prompting

用于和模型交互的提示词不会包含任何例子或者演示。Instruction tuning被用来改进zero-shot learning，RLHF（基于人类反馈的强化学习）被用来扩展Instruction tuning，其中模型与人类偏好一致。

### 2、few-shot prompting

面对更复杂的任务时候，zero-shot的表现不好。few-shot prompting 可以用来提供in-context learning，在prompt中提供演示，为后续模型生成提供了示例，以引导模型获得更好的性能。对于不同复杂度的任务，我们可以提供k-shot prompting。但是面对需要多步推理的任务，即使给出示例，，模型也不能很好的表现。

### 3、CoT prompting

![Image](assets/images/5df0f1f665/image-01.png)

通过中间推理过程实现复杂推理能力，可以和few-shot prompting相结合，在足够大的模型中，甚至只需要更少的few-shot就可以实现推理，这是能力的涌现。

![Image](assets/images/5df0f1f665/image-02.png)

更流行的是zero-shot-coT，只需要在原始提示词中加一句话“Let's think step by step”，特别适应于没有过多的示例给大模型参考。

当使用带有demonstrations的coT，需要人为制作很多有效的demonstrations，Auto-coT可以通过LLM和“Let's think step by step”来生成高效的demonstrations的coT，但是最终生成的coT仍会有错误，因此要保证采样的多样性。

https://github.com/amazon-science/auto-cot

Auto-coT有两个阶段：

（1）question clustering：将给定数据集中的问题分为几类

- 使用 **Sentence-BERT**将文本问题编码为高维向量，

- 使用K-means等聚类算法将这些高维向量划分为k个cluster，

- 对于每一个cluster，算法会计算簇内所有问题到cluster center的距离并升序排序，

（2）demonstration sampling：从每一个类中选一个代表性的问题用zero-shot-coT和启发式算法生成它的推理链

- 距离cluster center最近的问题就是整个cluster的代表

- 将选中的问题给LLM，并在提示词中加入“Let's think step by step”，让LLM生成一段包含推理过程和最终答案的内容

- 使用启发式算法来进行过滤，如果生成的内容过关了则被摘录下来，如果没过关则重新选择距离cluster center第二近的再来一次。

最终，这 $k$ 个来自于不同簇、且生成质量合格的问答对，就会被拼接在一起，成为后续进行 Few-Shot CoT 推理的模板

![Image](assets/images/5df0f1f665/image-03.png)

### 4、meta prompting

强调信息的格式和形式而非内容的本身。

- 结构导向：重视problems和solution的form和pattern而非内容本身

- 语法-focused：使用syntax作为预期回答的引导模板

- Abstract examples：使用abstract examples作为框架

- 用途广泛：适用于各种领域，能够为各种问题提供结构化的应对措施

- 类别方法：强调提示中各组成部分的分类和排列逻辑

和few-shot prompting的区别就是few-shot prompting强调内容驱动，meta prompting强调结构导向

![Image](assets/images/5df0f1f665/image-04.png)

Meta prompting默认LLM了解所要解决的问题的内在知识，因此LLM推广到其他任务时候使用meta prompting可以提高其性能，但是对于更新颖和独特的问题，其性能可能会下降

### 5、self-consistency

https://arxiv.org/pdf/2203.11171

人类的一个显著特点是人们的思维方式各不相同，即使对于一个有着最终确切答案的推理问题，不同的人也会有不同的reasoning path，self-consistency就是利用了这一点。

由于语言模型并非完美的推理器，因此该模型也可能产生错误的推理路径或在某个推理步骤中犯错（例如，在输出 2 中），但这样的解决方案不太可能得出相同的答案。因此我们假设，即使推理过程各不相同，正确的推理过程在最终答案上的一致性也往往高于错误的推理过程。

![Image](assets/images/5df0f1f665/image-05.png)

（1）使用cot prompting构建LLM

（2）把cot的greedy decode替换为从LLM的decoder中采样获得多样性的推理路径

（3）在众多推理路径中选择最一致的答案进行汇总，通过剔除抽样推理路径来确定最优解，从而在最终答案集中找到最一致的答案。

自洽性只能应用于最终答案来自固定答案集的问题，但原则上，如果可以在多代之间定义一个良好的一致性度量，例如，两个答案是否一致或相互矛盾，则这种方法可以扩展到开放文本生成问题。

### 6、generated knowledge prompting

https://arxiv.org/pdf/2110.08387

https://github.com/liujch1998/GKP

LLM 不断改进，其中一项流行的技术是能够整合知识或信息，以帮助模型做出更准确的预测。

从语言模型中生成有用的知识，然后将该知识作为输入提示与问题连接起来。

![Image](assets/images/5df0f1f665/image-06.png)

（1）使用few-shot从语言模型生成和问题相关的知识陈述

（2）使用第二个语言模型对每个知识陈述进行预测，然后选择置信度最高的预测

### 7、prompt chaining

将一个复杂的任务分解为一系列小的，相连的子任务，一个prompt的输出作为下一个prompt的输入，从而将prompt生成转化为一连串的链式操作。这种模块化的流水线式方法提高了准确性，减少了幻觉，并让你能够对最终结果进行精细控制。

在构建基于 LLM 的对话助手以及改进应用程序的个性化和用户体验时，prompt chaining特别有用。

以Document QA为例，如果设计两个不同的提示，第一个提示负责提取相关的引文来回答问题，第二个提示则以引文和原始文档作为输入来回答给定的问题，这将很有帮助。

![Image](assets/images/5df0f1f665/image-07.png)



![Image](assets/images/5df0f1f665/image-08.png)

![Image](assets/images/5df0f1f665/image-09.png)

![Image](assets/images/5df0f1f665/image-10.png)

![Image](assets/images/5df0f1f665/image-11.png)



### 8、tree of thoughts

对于解决需要探索或者战略性前瞻性的任务，ToT一般化了CoT，并鼓励基于thoughts的探索，将其作为语言模型解决一般问题的中间环节。

ToT 维护着一个思维树，其中thoughts代表连贯的语言序列，这些序列是解决问题的中间步骤。该方法能让LM评估经过深思熟虑的推理解决问题的中间过程中的thoughts的改进。

LM 生成和评估想法的能力与搜索算法（例如广度优先搜索和深度优先搜索）相结合，从而能够通过前瞻和回溯对想法进行系统探索。

![Image](assets/images/5df0f1f665/image-12.png)

使用 ToT 时，不同的任务需要定义候选人数和思路/步骤数。

![Image](assets/images/5df0f1f665/image-13.png)

### 9、Retrieval Augmented Generation（RAG）

对于更复杂、知识密集型的任务，可以构建基于语言模型的系统，该系统访问外部知识源来完成任务。这样可以提高事实一致性，提高生成响应的可靠性，并有助于缓解“幻觉”问题。

RAG 接收输入，并根据来源（例如维基百科）检索一组相关/支持性文档。这些文档与原始输入提示连接起来作为上下文，并输入到文本生成器中，最终生成输出。这使得 RAG 能够适应事实可能随时间变化的情况。RAG 允许语言模型绕过重新训练，从而能够访问最新信息，并通过基于检索的生成方式生成可靠的输出。

![Image](assets/images/5df0f1f665/image-14.png)

### 10、Automatic Reasoning and Tool-use (ART)

https://arxiv.org/pdf/2303.09014

它利用冻结的大型语言模型（LLM）自动生成中间的逐步推理程序。它从任务库中选择少量示例，并在需要时暂停生成过程，调用计算器或搜索引擎等外部工具。

ART 的工作原理如下： 

- 给定一个新任务，它会从任务库中选择多步骤推理和工具使用的示例。 

- 在测试阶段，每当调用外部工具时，它都会暂停生成，并在恢复生成之前整合外部工具的输出。

![Image](assets/images/5df0f1f665/image-15.png)

从任务库中选择相关任务的分解（A），

从工具库中选择和使用工具并结合 LLM 生成（B），

为新任务自动生成多步骤分解，人类可以选择性地编辑分解（例如，更正和编辑代码）以提高性能（C）。

