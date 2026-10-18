# 三、Context Engineering（260818）

https://www.promptingguide.ai/guides/context-engineering-guide

https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents

https://zhangtielei.com/posts/blog-context-engineering.html

---

### 1、Context Engineering 产生的背景

---

近年来，人们对于AI 的发展趋于成熟与客观。能否在生产环境落地并稳定运行成为检验一项技术的核心标准。在很多现实场景中，当前所谓的AI落地，都采取了较为保守的做法。很多自称AI Agent的系统，其实都没有那么agentic。很多情况下，在现有的业务流程代码中，穿插着调用一两次LLM，仅此而已。对于这种简单的情形，只要在调用的局部把LLM所需的prompt提前设计好、调试好，系统就可以上生产环境了。换句话说，这类prompt的设计是相对确定性的 (deterministic) 。但是，在更复杂、更高自主性的Agent系统中，对于prompt的管理就没有这么简单了。



具备高度自主性的Agent，一般来说是由agent loop驱动的运行模式。

![Image](assets/images/0235daef54/image-01.png)

在每一个循环迭代中，Agent借助LLM动态决策，自动调用适当的工具，存取恰当的记忆，向着任务目标不断前进，最终完成原始任务。然而，这种agent loop的运行模式，直接拿到企业生产环境中却很难长时间稳定运行。



> 根据工程师Dex Horthy在他的大作《12-Factor Agents》中的描述[1]，这种所谓的「tool calling loop」在连续运行10\~20轮次之后一般就会进入非常混乱的状态，导致LLM再也无法从中恢复。
> 
> Dex Horthy质疑道，即使你通过努力调试让你的Agent在90%的情况下都运行正确，这还是远远达不到“足以交付给客户使用”的标准。
> 
> 



所以说，Context Engineering产生的第一个背景就是，AI落地需求迫切，但是Agent在生产环境的表现差强人意。大部分的原因是系统送给LLM的上下文 (Context) 不够准确导致Agent无法长时间稳定运行。

至于Agent执行会失败的具体技术原因，更进一步拆解的话，可以归结为两个方面：

- 第一，模型本身不够好或者参数不够，即使有了正确的context还是生成了错误结果。

- 第二，模型没有被传递恰当的上下文。

在实际中，上述第二个原因占大多数。这第二个原因，又可以细分成两类：

- 上下文不充分，缺失必要的信息 。

- 上下文的格式不够好，即使所有信息都提到了，但是信息量不足。

---

Context Engineering产生的第二个背景，来源于LLM具有天然的不确定性以及访问web和外部工具带来的context的不确定性。LLM的底层运行原理是基于概率统计的预测下一个token，而概率是充满不确定性的。在模型训练完成之后要部署的生产运行环境中，只能通过精细地调整Context来「间接地」引导它的行为。



资深的AI从业者Nate Jones把Context Engineering大体分成两部分：

第一部分 (占小部分)，称为**deterministic context**。这部分指的是我们直接发送给LLM的上下文，包括指令、规则、上传的文档等等，总之它们是可以确定性地进行控制的 (deterministically control）。

第二部分 (占大部分) ，称为**probabilistic context**。这部分指的是，当LLM需要访问web以及外部工具的时候，会不可避免地将大量不确定的信息引入到LLM的上下文窗口。典型地，Deep Research就是属于这一类的技术。在这种情况下，我们能直接控制的上下文内容，只占整个上下文窗口的很小一部分（相反，来自web搜索和工具返回的内容，占据了上下文窗口的大部分）。因此，针对probabilistic context这一部分的上下文，你就很难像针对deterministic context那样，对prompt进行精细控制 。

---

Context Engineering产生的第三个背景是上下文管理的复杂性，上下文管理不是一个简单的代码模块，而是一项复杂的系统工程。

有一篇来自Google的论文[4]，明确定义了一个称为**充分上下文** (sufficient context) 的概念。这篇研究发现，即使有了充分上下文，LLM仍然可能会产生幻觉；而令人惊奇的是，即使上下文不充分，LLM有时候也能给出正确的输出。这印证了上下文管理的复杂性。

总之，鉴于以上背景，AI从业者们提出了Context Engineering的概念，将它作为一项系统工程来对待。就像LangChain的官方blog所提到的：

> As such, context engineering is becoming **the most important skill** an AI engineer can develop.
> 
> 

---

### 2、Context Engineering 的定义

---

在context engineering 这个概念出现之前，很多AI工程师已经注意到了LLM上下文管理的重要性，并设想了很多方案来解决或缓解。



第一个定义，来自于LangChain的官方blog：

> Context engineering is building dynamic systems to provide the right information and tools in the right format such that the LLM can plausibly accomplish the task.
> 
> 

这个定义除了动态性，还强调了context来源的丰富性以及格式的正确性，其中特别提到了对工具调用信息的提供。

第二个定义，来自于Anthropic的文档：

> Context engineering refers to the set of strategies for curating and maintaining the optimal set of tokens (information) during LLM inference, including all the other information that may land there outside of the prompts.
> 
> 

这是Anthropic对于context定义的延伸：

> Context refers to the set of tokens included when sampling from a large-language model (LLM)
> 
> The engineering problem at hand is optimizing the utility of those tokens against the inherent constraints of LLMs in order to consistently achieve a desired outcome.
> 
> 

这个定义指出了上下文本质是从LLM中采样时包含的一系列tokens，而context engineering就是要在LLM约束下（窗口长度资源等）优化这些有限的token来持续实现预期的效果。

第三个定义，也是目前最简洁、同时内涵也最广的一个定义，来自于Dex Horthy，就是下面这张图：

![Image](assets/images/0235daef54/image-02.png)

这个定义阐明了跟AI开发相关的大部分工作，都是围绕着如何把上下文窗口填充正确来进行的。

---

### 3、Context Engineering 必要性

---

有研究揭示了上下文腐烂（context rot）的概念：随着上下文窗口中tokens数量的增加，模型从上下文中准确回忆信息的能力会下降。

> As the number of tokens in the context window increases, the model’s ability to accurately recall information from that context decreases.
> 
> 

> https://www.trychroma.com/research/context-rot
> 
> 

![Image](assets/images/0235daef54/image-03.png)

尽管这种衰减效果对于不同的模型不同，但是适用于所有模型 ，因此必须将context Window视为边际收益递减的有限资源。

我们人类在在面对复杂繁琐的工作时候，会失去注意力或感到困惑，与人类一样，LLM 的工作记忆容量有限，它们在解析大量上下文时会使用“注意力预算（attention budget）”。

这种注意力稀缺性源于LLM的架构限制。LLM基于Transformer架构，该架构允许每个词元关注整个上下文中的所有其他词元。这导致n个词元之间存在n²个成对关系。

随着上下文长度的增加，模型捕捉这些成对关系的能力会变得捉襟见肘，从而在上下文大小和注意力集中之间造成一种自然的紧张关系。

从这个角度出发，context engineering 有了明确的约束和边界，变成了如何使用有限的资源实现最佳的性能的工程功能。

---

### 4、Context Engineering的实际意义

---

鉴于 LLM 受到有限的"attention budget"的限制，良好的上下文工程意味着找到尽可能小的高信息量的标记集，以最大限度地提高某些期望结果的可能性。

> Our overall guidance across the different components of context (system prompts, tools, examples, message history, etc) is to be thoughtful and keep your context informative, yet tight.
> 
> 

Anthropic提到的对上下文各个组成部分的总体指导原则是：要深思熟虑，保持上下文信息丰富且简洁明了。

这一指导原则在不同context要素中的有着以下的意义：

---

#### （1）system prompts

---

> System prompts should be extremely clear and use simple, direct language that presents ideas at the *right altitude** *for the agent.
> 
> The optimal altitude strikes a balance: specific enough to guide behavior effectively, yet flexible enough to provide the model with strong heuristics to guide behavior.
> 
> 

最佳高度应达到一种平衡：既要足够具体以有效地指导行为，又要足够灵活以向模型提供强大的启发式方法来指导行为。

![Image](assets/images/0235daef54/image-04.png)

在真实的工程中如何寻求这种平衡呢？最好先使用最佳模型测试一个最小的prompt，看看它在你的任务上表现如何，然后根据表现的不足，适当增加prompt复杂度添加清晰的说明和示例来改进性能。

---

#### （2）Tools

---

工具使智能体能够与其环境互动，并在工作过程中获取新的、额外的上下文信息。工具必须能够提高效率，这体现在两个方面：一是返回token-efficient的信息，二是鼓励agent采取高效的行为。

与精心设计的代码库类似，工具也应具备自包含性、容错性强，并且其预期用途清晰明确。同样，输入参数也应具有描述性、无歧义，并能充分发挥模型的固有优势。

我们看到最常见的故障模式之一是工具集臃肿，涵盖的功能过多，或者导致在使用哪个工具时出现模糊的决策点。如果人类工程师都无法明确指出在特定情况下应该使用哪种工具，就不能指望人工智能代理做得更好。

---

### 5、Context retrieval and agentic search

---

如今，许多ai原生应用都采用某种形式的基于嵌入的预推理时间检索，以便为智能体提供重要的上下文信息，供其进行推理。

随着该领域向更具自主性的方法过渡，claude团队利用“即时”上下文策略来增强这些检索系统。Claude code可以编写有针对性的查询，存储结果，并利用 Bash 命令（如 head 和 tail）来分析大量数据，而无需将完整的数据对象加载到上下文中。这种方法反映了人类的认知：我们通常不会记住整个信息库，而是引入外部组织和索引系统，如文件系统、收件箱和书签，以便按需检索相关信息。



让智能体自主地导航和检索数据，还能实现渐进式信息披露——换句话说，智能体可以通过探索逐步发现相关的上下文。每次交互都会产生上下文信息，为下一步决策提供依据：文件大小暗示复杂性；命名规则暗示用途；时间戳可以作为相关性的参考。智能体可以逐层构建理解，仅在工作内存中保留必要信息，并利用笔记策略来增强信息的持久性。这种自我管理的上下文窗口使智能体能够专注于相关的信息子集，而不是被冗长但可能无关的信息淹没。



在某些情况下，智能体可能会采用混合策略：预先检索一些数据以提高速度，然后根据自身判断进行进一步的自主探索。自主程度的“合适”界限取决于具体任务。Claude Code 就是一个采用这种混合模型的智能体：[CLAUDE.md](http://claude.md/)文件会被预先简单地放入上下文中，而像 glob 和 grep 这样的基本工具则允许它导航环境并即时检索文件，从而有效地绕过了过时的索引和复杂的语法树等问题。

混合策略可能更适合内容动态性较低的场景，例如法律或金融领域。随着模型能力的提升，智能体设计将朝着让智能模型自主行动的方向发展，并逐步减少人工干预。

---

### 6、Context engineering for long-horizon tasks

---

长周期任务要求智能体在一系列actions中保持连贯性、上下文关联性和目标导向行为，即使actions数量超过了LLM的上下文窗口。等待更大的上下文窗口似乎是一种显而易见的策略。但这并没有从根源上解决问题，未来各种大小的上下文窗口都可能受到上下文污染和信息相关性问题的影响。为了使智能体能够在更长的时间范围内高效工作，有一些上下文污染限制的技术：compaction、structured note-taking和multi-agent architecture。

---

#### （1）compaction

---

压缩是指将接近上下文窗口上限的对话进行内容概括，然后用概括后的内容重新创建一个新的上下文窗口。压缩通常是上下文工程中提升长期连贯性的首要手段。其核心在于以高保真度的方式提炼上下文窗口的内容，从而使智能体能够在性能损失最小的情况下继续运行。



例如，在 Claude Code 中通过将消息历史记录传递给模型来实现这一点，以汇总和压缩最关键的细节。该模型保留了架构决策、未解决的错误和实现细节，同时丢弃了冗余的工具输出或消息。然后，代理可以使用这个压缩后的上下文以及最近访问的五个文件继续执行任务。

压缩的艺术在于选择保留哪些信息，舍弃哪些信息，因为过度压缩会导致丢失一些微妙但至关重要的上下文信息，而这些信息的重要性往往在后续处理中才会显现。对于实现压缩系统的工程师，Anthropic 建议在处理复杂的代理轨迹时，仔细调整提示信息。首先，最大化召回率，确保压缩提示信息能够捕捉到轨迹中的所有相关信息，然后通过迭代优化，去除冗余内容，从而提高精确度。

清除工具调用和结果就是一个很容易实现的compaction例子，因为深度历史里的原始工具调用和原始返回结果，大部分场景没必要持续保留在上下文，应当做清理；模型已经在当时利用过这份原始数据，后续一般不需要重读 raw 结果。

---

#### （2）structured note-taking

---

结构化笔记，或称智能体记忆（agentic memory），是一种让智能体定期记录笔记并将其存储在上下文窗口之外的记忆中的技术。这些笔记会在稍后被调回上下文窗口。

这种策略以最小的开销提供持久内存。就像 Claude Code 创建待办事项列表，或者自定义agent维护 NOTES.md 文件一样，这种简单的模式使代理能够跟踪复杂任务的进度，并保留关键的上下文和依赖关系，否则这些信息会在数十次工具调用中丢失。

---

#### （3）multi-agent architectures

---

子代理架构提供了另一种绕过上下文限制的方法。与其让一个代理尝试维护整个项目的状态，不如让专门的子代理在清晰的上下文窗口中处理特定的任务。主代理负责协调高层计划，而子代理则执行深入的技术工作或使用工具查找相关信息。每个子代理可能进行广泛的探索，使用数万个或更多tokens，但最终只返回其工作的精简摘要（通常包含 1000 到 2000 个tokens）。

这种方法实现了职责分离——详细的搜索上下文被隔离在子智能体内部，而主智能体则专注于结果的综合和分析。这种模式在处理复杂的研究任务时，相比单智能体系统展现出了显著的性能提升。



选择哪种方法取决于任务的特点。例如：

- Compaction可以保持需要大量来回沟通的任务的对话流畅性；

- Structured note-taking 对于设定明确目标的迭代开发非常有效；

- Multi-agent architecture 能够处理复杂的研究和分析，并行探索能够带来丰厚的回报。

即使模型不断改进，在长时间的交互中保持一致性的挑战仍然是构建更有效智能体的核心。

---

### 7、Context Engineering与Prompt Engineering的区别

---

> At Anthropic, we view context engineering as the natural progression of prompt engineering.
> 
> 



![Image](assets/images/0235daef54/image-05.png)

与编写prompt的离散任务不同，上下文工程是迭代的，每次我们决定将什么传递给模型时，都会进行内容整理（curation）阶段。

如果用一句话来概括Context Engineering与Prompt Engineering的区别，那就是：前者是一个系统工程，后者是一种局部单点突破，而且有时候只是一种短期的trick。

细分来看，Context Engineering与Prompt Engineering的区别可以从不同的角度来阐述。

---

#### （1）全局和局部的关系

---

Prompt Engineering可以认为是Context Engineering的一个子集。Context Engineering包含了所有对组装正确的上下文起到关键作用的技术组件。为了从大量文档内容中选出跟当前任务更相关的数据，就需要retrieve技术（RAG）；为了向模型传达长期记忆和短期记忆，就需要memory工程；为了更好地决策未来，就需要把当前状态以及历史信息传达给模型；另外，还需要一系列的错误处理、恢复、以及guardrails机制。所有这些，都属于Context Engineering的范畴。

---

#### （2）动态与静态的关系

---

Prompt Engineering解决一次性的prompt设计问题，一般来说由工程师手工编辑prompt，并提前写入程序代码或配置中；而Context Engineering解决的是Agent系统在长时间运行过程中的context组装问题。prompt是由系统来根据程序的执行情况动态组装的。程序在组装prompt时会考虑多种信息来源，包括web搜索结果、工具调用结果、LLM的决策输出等等。

---

#### （3）上下文中的信息来源不同

---

在传统Prompt Engineering中，上下文窗口主要由工程师提前设计好的prompt填充。一般会分成system prompt、few-shot examples、message history、instruction等几部分，内容相对比较固定、可控。而当语境扩大到Context Engineering时，组装上下文所需要的信息来源就非常丰富了，至少包括：

- 静态的prompt及instruction。

- RAG返回的片段。

- web搜索返回的页面内容。

- 对于工具候选集合的描述。

- 工具调用的历史结果。

- 长期记忆及短期记忆。

- 程序运行的其他历史轨迹信息。

- 出错信息。

- 系统执行过程中通过human-in-the-loop获取到的用户反馈。

- 等等。

### 8、Context Engineering 实操

在n8n上，构建的AI Workflow。

![Image](assets/images/0235daef54/image-06.png)



第一个Search Planner agent负责根据用户查询生成搜索计划，其完整的system prompt设计如下：

```SQL
You are an expert research planner. Your task is to break down a complex research query (delimited by <user_query></user_query>) into specific search subtasks, each focusing on a different aspect or source type.
        
The current date and time is: {{ $now.toISO() }}

For each subtask, provide:
1. A unique string ID for the subtask (e.g., 'subtask_1', 'news_update')
2. A specific search query that focuses on one aspect of the main query
3. The source type to search (web, news, academic, specialized)
4. Time period relevance (today, last week, recent, past_year, all_time)
5. Domain focus if applicable (technology, science, health, etc.)
6. Priority level (1-highest to 5-lowest)
        
All fields (id, query, source_type, time_period, domain_focus, priority) are required for each subtask, except time_period and domain_focus which can be null if not applicable.
        
Create 2 subtasks that together will provide comprehensive coverage of the topic. Focus on different aspects, perspectives, or sources of information.

Each substask will include the following information:

id: str
query: str
source_type: str  # e.g., "web", "news", "academic", "specialized"
time_period: Optional[str] = None  # e.g., "today", "last week", "recent", "past_year", "all_time"
domain_focus: Optional[str] = None  # e.g., "technology", "science", "health"
priority: int  # 1 (highest) to 5 (lowest)

After obtaining the above subtasks information, you will add two extra fields. Those correspond to start_date and end_date. Infer this information given the current date and the time_period selected. start_date and end_date should use the format as in the example below:

"start_date": "2024-06-03T06:00:00.000Z",
"end_date": "2024-06-11T05:59:59.999Z",
```

主要包含一些几个部分：

---

#### （1）Instructions

---

```Python
You are an expert research planner. Your task is to break down a complex research query (delimited by <user_query></user_query>) into specific search subtasks, each focusing on a different aspect or source type.
```

Instructions是是提供给系统的高级指令，用于指示系统具体该做什么。很多初学者止步于此，仅仅给LLM提供这些prompts。通过对比上面已经提供了完整的提示信息，应该能理解我们需要为系统提供多少额外的上下文信息，才能使其按预期运行。这就是context engineering的意义所在；它能让系统更清楚地了解问题的范围以及我们究竟想要它做什么。

---

#### （2）User Input

---

```Python
<user_query> What's the latest dev news from OpenAI? </user_query>
```

User input通常不会直接出现在prompt中，但是上面是它的格式，我们使用分隔符可以避免混淆，并明确用户输入的内容以及我们希望系统生成的内容。

---

#### **（3）Structured Inputs and Outputs**

---

```SQL
For each subtask, provide:
1. A unique string ID for the subtask (e.g., 'subtask_1', 'news_update')
2. A specific search query that focuses on one aspect of the main query
3. The source type to search (web, news, academic, specialized)
4. Time period relevance (today, last week, recent, past_year, all_time)
5. Domain focus if applicable (technology, science, health, etc.)
6. Priority level (1-highest to 5-lowest)
        
All fields (id, query, source_type, time_period, domain_focus, priority) are required for each subtask, except time_period and domain_focus which can be null if not applicable.
        
Create 2 subtasks that together will provide comprehensive coverage of the topic. Focus on different aspects, perspectives, or sources of information.
```

以上是格式化输入，通过列出我希望planning agent生成的必要信息清单，并在结尾的括号中提供一些示例，以便更好地指导数据生成过程。比如第六点如果你不告诉它使用1-5优先级，模型可能会使用1-10优先级。

```SQL
Each substask will include the following information:

id: str
query: str
source_type: str  # e.g., "web", "news", "academic", "specialized"
time_period: Optional[str] = None  # e.g., "today", "last week", "recent", "past_year", "all_time"
domain_focus: Optional[str] = None  # e.g., "technology", "science", "health"
priority: int  # 1 (highest) to 5 (lowest)
```

以上是期望的输出。除此之外，在 n8n 内部，你还可以使用工具输出解析器。

---

#### （4）**Tools**

---

我们使用 n8n 构建代理，因此很容易将当前日期和时间添加到上下文中。

```Python
The current date and time is: {{ $now.toISO() }}
```

这是一个简单易用的函数，在 n8n 中被调用，但通常会将其构建为一个专用工具，以帮助实现更动态的功能。

---

#### （5）Date and Time

---

对于搜索类的agent和工具，日期和时间是系统的重要上下文信息；否则，对于需要知道当前日期和时间的查询，系统往往无法很好地运行。

```Python
"start_date": "2024-06-03T06:00:00.000Z","end_date": "2024-06-11T05:59:59.999Z",
```

---

#### （6）**RAG \& Memory**

---

如果用户之前已经使用过类似的查询，可以将这些结果存储在向量存储中，并对其进行搜索，从而避免再次搜索并创建新的子查询集，因为每次调用 LLM API 都会增加延迟和成本。

---

#### （7）**States \& Historical Context**

---

该项目的一个重要部分是优化结果以生成最终报告。在很多情况下，agent系统在最终的整合环节可能需要修改全部或部分查询、子任务，以及可能从网络搜索 API 获取的数据。这意味着系统需要多次访问之前的状态以及系统的所有历史上下文。因此agent需要能够访问子任务的状态、修改记录（如有）、工作流中每个agent的历史结果等上下文信息。

---

#### （8）etc.

---

context compression, context management techniques, context safety, and evaluating context effectiveness

---

### 9、小结

---

Context Engineering并不是某一种具体的技术，而更像是一种思想或观念。它也暗含了工程师们对于未来技术趋势的一种判断。

正如Dex Horthy提到的：

> Even as models support longer and longer context windows, you’ll ALWAYS get better results with a small, focused prompt and context.
> 
> 



LLM的长上下文窗口缓解了Agent开发的很多问题，但这远不是解决方案的全部。Context Engineering的概念就告诉我们，下一步我们不应该一味地追求模型提供更长的上下文窗口，而是应该追求更聪明的上下文管理机制。

同时，在Agent时代，RAG技术也远远没有式微。在Context Engineering的技术框架下，它正在焕发新的活力。AI应用开发在本质上可以看成是，从海量信息中找到恰当的有效信息，最终适配到LLM的上下文窗口上。为了让这个漏斗工作得更高效，你需要检索、过滤、排序。你需要一套完整的Context Engineering工程架构。





