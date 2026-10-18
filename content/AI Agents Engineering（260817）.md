# 二、AI Agents Engineering（260817）

### 1、组成部分

![Image](assets/images/30752cf4c5/image-01.png)

这些复杂的任务通常需要获取LLM知识库之外的外部工具和信息。

we refer to an agent as an LLM-powered system designed to take actions and solve complex tasks autonomously. Unlike traditional LLMs, AI agents go beyond simple text generation. They are equipped with additional capabilities, including:

- **Planning and reflection:** AI agents can analyze a problem, break it down into steps, and adjust their approach based on new information.

- **Tool access:** They can interact with external tools and resources, such as databases, APIs, and software applications, to gather information and execute actions.

- **Memory:** AI agents can store and retrieve information, allowing them to learn from past experiences and make more informed decisions.

#### （1）Planning: The Brain of the Agent

现代的LLM大脑应该具备以下功能：

- 通过cot-reasoning进行问题分解

- 对过去的行动和信息进行自我反思

- 为未来决策进行适应性学习

- 对当前进展进行批判性分析

虽然目前的LLM规划能力并不完美，但对于任务完成至关重要。如果没有强大的规划能力，智能体就无法有效地自动化复杂任务，这便违背了其主要目的。

#### （2）Tool Utilization: Extending the Agent's Capabilities

一个设计精良的智能体不仅需要能够使用各种工具，还需要了解何时以及如何恰当地使用这些工具。常用工具包括：

- 代码编译器和执行环境

- 网络搜索和抓取工具

- 数学计算

- 图像生成系统

这些工具使智能体能够执行其计划的动作，将抽象的策略转化为具体的成果。LLM对工具选择和时机的理解能力对于有效处理复杂任务至关重要。

#### （3）Memory Systems: Retaining and Utilizing Information

Short-term (Working) Memory

- 缓冲即时上下文

- 支持in-context learning

- 足以完成大多数任务

- 有助于在迭代过程中保持连续性

Long-term Memory

- 通过外部向量存储实现

- 快速检索历史信息

- 对完成未来任务很有价值



### 2、AI workflow VS AI Agents

Agentic systems 可以被分为两类：

#### （1）AI Workflows

AI 工作流是指通过**预定义的代码路径**来协调 LLM 和工具的系统。这些系统遵循结构化的操作顺序，并具有明确的控制流。

在以下场景中使用 AI 工作流： 

- 任务定义明确、需求清晰 

- 需要可预测性和一致性的场景 

- 需要对执行流程进行明确控制的任务 

- 可靠性至关重要的生产系统

常用的AI工作流模式有下面几种：

##### Pattern 1: Prompt Chaining

将复杂的任务分解为连续的 LLM 调用，其中每一步的输出都会传递给下一步。

![Image](assets/images/30752cf4c5/image-02.png)

上图演示了AI Workflow生成文档。接收到用户的chat message之后，先调用GPT-4.1-mini生成一个初始的概要，然后进行一个“Set Grade”的模块进行打分，如果通过了，就使用 GPT-4o 扩展大纲部分，然后完善和润色最终文档。如果没通过，继续通过一个名为“Edit Fields”的模块，以便在继续之前进行手动调整，从而确保在整个多阶段文档创建过程中进行质量控制。

##### Pattern 2: Routing

路由把需求分发给不同的LLM chains和agents。

![Image](assets/images/30752cf4c5/image-03.png)

上图展示了一个智能客服工作流。接收到用户问题时候，通过Query Classifier内置的GPT-4.1-mini对问题进行分类，并进行格式化的输出分类结果，然后该分类结果通过“Route by Type”模块进行分发。

##### Pattern 3: Parallelization

多个独立的LLM操作并行进行以提高效率。

![Image](assets/images/30752cf4c5/image-04.png)



#### （2）AI Agents

AI 代理是一种系统，其中 LLM **动态地指导**自己的流程和工具使用，并对其完成任务的方式保持自主控制。

主要特征包括： 动态决策 自主选择和使用工具 推理和反思能力 自主执行任务

在以下场景中使用AI Agents：

- 具有可变执行路径的开放式任务；

- 步骤数量难以预先确定的复杂场景；

- 需要自适应推理的任务；

- 灵活性比可预测性更重要的场景。

##### **Example: Task Planning Agent**

User asks "Add a meeting with John tomorrow at 2 PM"

![Image](assets/images/30752cf4c5/image-05.png)

当收到message时候，中转到Task Planner路由，然后不像AI Workflow，Task Planner Agent可以独立决定使用哪些工具，何时使用，极大增强了灵活度。

#### （3）Function Calling

函数调用（也称为工具调用）是现代基于 LLM 的代理的核心功能之一。

LLM 收到需要超出其训练数据的信息或操作的查询时，可以决定调用外部函数来检索该信息或执行该操作。

比如你问AI Agent“北京现在的天气如何？”，LLM本身不能回答这个问题因为他没有查询实时天气的能力，但是有了Tool Calling之后，LLM可以识别到需要他来调用weather API，使用正确的参数（在本例中为城市“巴黎”）生成适当的函数调用，然后使用返回的数据来生成响应。

正是这种能力将基本的 LLM 从文本生成器转变为能够与现实世界交互的强大agent

![Image](assets/images/30752cf4c5/image-06.png)

基于LLM的智能体依靠两个关键能力来解决复杂任务：工具调用和推理。这些能力使得智能体能够利用外部工具进行增强、连接到MCP（模型上下文协议）服务器并访问知识库。

- 用户查询：用户向智能体发送请求（例如，“巴黎天气如何？”）。

- 上下文组装：系统消息、工具定义和用户消息组合起来，形成完整的上下文，并发送给模型。

- 工具决策：LLM 分析上下文，确定是否需要调用工具。如果需要，它会输出一个结构化的响应，指示要调用哪个工具以及使用哪些参数。

- 工具执行：开发人员的代码接收到工具调用请求，并执行实际的功能（例如，调用天气 API）。

- 观测：工具返回其结果，这些结果在智能体术语中被称为“观测值”。

- 响应生成：观测值连同所有先前的消息一起返回给模型，使其能够生成最终响应。

关键在于，该模型始终保持对对话中所有事件的完整上下文感知。正是这种上下文感知能力，使得智能体能够就下一步行动以及如何将工具结果融入最终响应做出明智的决策。



工具定义通常包含以下内容：

- 名称：函数的清晰标识符

- 描述：解释工具的功能以及何时使用它，当有多种工具可用时，清晰明确的描述对于模型选择正确的工具就显得尤为重要。

- 参数：函数接受的输入，包括它们的类型和描述



```JSON
tools = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location. Use this when the user asks about weather conditions in a specific city or region.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA"
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "The temperature unit to use"
                    }
                },
                "required": ["location"]
            }
        }
    }
]
```

构建人工智能代理时，你不可避免地会遇到代理行为不符合预期的情况。例如，它可能调用了错误的工具、传递了错误的参数，或者本应调用某个工具却未能调用。这时，理解函数调用的内部机制就显得至关重要了。对于n8n这种工作流程自动化工具，可以启用“Return Intermediate Steps”功能，以查看幕后发生的具体情况。

```JSON
{
  "intermediateSteps": [
    {
      "action": {
        "tool": "web_search",
        "toolInput": {
          "query": "OpenAI latest announcements 2025"
        }
      },
      "observation": "1. OpenAI announces new reasoning model... 2. GPT-5 rumors surface..."
    },
    {
      "action": {
        "tool": "update_task_status",
        "toolInput": {
          "taskId": "search_1",
          "status": "completed"
        }
      },
      "observation": "Task updated successfully"
    }
  ]
}
```

这种可见性对于调试至关重要。如果您的代理程序产生错误结果，您可以逐步追踪，找出出错之处。

