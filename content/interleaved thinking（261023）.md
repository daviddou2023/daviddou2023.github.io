# interleaved thinking（261023）

https://blog.csdn.net/C7211BA/article/details/155599835

https://docs.siliconflow.com/cn/userguide/guides/interleaved-thinking

https://www.cnblogs.com/sdcb/p/19475203/20251203-interleaved-thinking

## 一、引言

对于一个复杂的编程任务，模型在第一步通过思维链决定了代码架构，并调用了read_file工具。如果我们在第二轮对话中把这个思维链丢弃了，模型就像失忆了一样，它只看到了自己发出的read_file命令，却忘了之前为什么要这么做，以及原本计划下一步做什么。结果就是模型只能被迫重新推理，甚至做出与上一步逻辑相悖的决策。

这就凸显出了上一轮思维链回传到下一轮的输入中的重要性，但是很多人直觉上认为：回传思维链相同于把input token变多了，肯定模型成本会增加而且推理也会变慢。但是这种思考方式忽略了cache命中的原理。

在支持prompt cache的计费体系下，缓存命中的token价格仅为未命中的1/10s甚至更低。

而思维链（推理过程）通常位于工具调用的前面。如果我们回传完整的user -> reasoning -> tool call整个序列作为上下前缀，极易触发prompt cache命中。

这也就意味着回传思维链，虽然token变多了，但是因为缓存命中率大幅提升，实际推理速度反而更快，综合成本反而更低。反之，如果删掉了思维链，模型可能会因为上下文断裂而不得不输出更多的token来找补逻辑。

## 二、发展历程

### 2.1 anthropic 先驱

当整个行业还在摸索如何处理推理模型的思维链时，Anthropic 在 **2025 年 2 月**发布的 **Claude 3.7 Sonnet** 中，率先展示了什么是“原生支持”的交错思考。

在 Anthropic 的 Messages API 中，思维链不再是附属品，而是 `extended thinking` 协议的核心。它**强制要求**回传思维链，并且引入了 `signature` 字段进行防篡改签名。



![Image](assets/images/e4202434af/image-01.png)

这种设计非常清晰、严谨。以至于后来的 MiniMax 和 DeepSeek V3.2 甚至在其官方文档中宣布支持 Anthropic Messages API 格式。这从侧面证明了该协议在设计上的优越性——它是目前做 Agent 对话和多步工具调用体验最好的协议，简单、纯粹，是名副其实的先驱。



### **2.2 MiniMax M2：从标签视觉到协议补丁**

到了 2025 年下半年，国产厂商开始尝试用更直接的方式解决问题。

**2025 年 10 月**发布的 **MiniMax M2** 借鉴了 DeepSeek R1 早期的视觉标签概念，并将其强化为一种交错思考协议。它允许模型通过 `<think>` 标签输出思考过程，并要求用户在下一轮对话中将这些 `<think>` 内容按原样回传（Interleaved）。虽然也支持拆分字段，但其核心逻辑是在现有文本流中嵌入标签。这相当于给 Chat Completions API 打了一个“文本级”的补丁，虽然解决了问题，但处理字符串解析总是显得不够优雅。

![Image](assets/images/e4202434af/image-02.png)

MiniMax M2 的 Interleaved Thinking 技术，本质是为大模型  Agent 引入了一种类人的问题解决机制——不是靠一次完美规划，而是通过持续感知、动态调整、累积认知来应对复杂现实任务。它不仅是工程技巧，更是一种推理范式的升级，标志着 AI 从“静态问答”走向“动态智能体”的重要一步。



### **2.3 DeepSeek V3.2 的突破：完美的 API 补丁**

而在 2025 年年底，**DeepSeek V3.2** 的出现为这场混战带来了新的曙光。

在 **2025 年 12 月**的更新中，它没有破坏 Chat Completions API 的基本结构，而是允许在**输入端**（Messages 数组）中直接包含 `reasoning_content` 字段。

![Image](assets/images/e4202434af/image-03.png)

这是一个极其聪明的“协议级补丁”。输入和输出字段高度一致，对现有生态侵入性最小。



## 三、总结

![Image](assets/images/e4202434af/image-04.png)

Interleaved Thinking 对 Agent 至关重要：它指在显式推理（reasoning）与工具调用（tool use）之间交替进行，并把推理结果持续带入后续步骤。这一过程能显著提升在长程任务中的规划能力、自我修正能力与可靠性。

在实践中，它将冗长、重度依赖工具的任务转化为稳定的 “计划→行动→反思” 循环，减少状态漂移与重复性错误，同时确保每一步行动都基于最新证据（evidence）。Interleaved Thinking 同时提升了可调试性：通过推理过程的快照让故障变得可解释与可恢复，并通过复用假设、约束与部分结论（而不是重新推导每个步骤）从而提高样本效率。

为获得最佳效果，与其在一开始完成所有思考，不如将思考与工具反馈交错进行，保持思维链的连贯性，使其在多轮交互中不断累积。

