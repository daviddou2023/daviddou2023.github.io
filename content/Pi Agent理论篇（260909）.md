# Pi Agent理论篇（260829-260909）

https://www.dgzhuya.com/modules/ch03-agent-loop#44-%E5%86%85%E6%A0%B8--%E6%AD%A5%E9%AA%A4bstreamassistantresponse--%E8%B0%83-llm

---

# 第一章：Pi Agent简介

---

## 一、定义

---

Pi 是一款极简、可扩展的终端编码 Agent 外壳，下面是对这句极简定义的几点说明：

- **“编码 Agent”** — 它能读懂你的代码库，写代码、改代码、跑命令

- **“终端外壳”** — 它住在终端里，没有 GUI，没有 IDE 插件，输出写进终端回滚缓冲区。

- **“极简”** — 核心四个内置工具（read / write / edit / bash）和三个辅助工具：grep / find / ls。它刻意不构建 MCP、子 Agent、计划模式、权限弹窗、后台 bash

- **“可扩展”** — 极简核心之上的缺失功能，通过 TypeScript 扩展、技能、Pi Package 来补充

---

## 二、分层package结构图

---

![Image](assets/images/e091a17d91/image-01.png)

这四个核心包中，`pi-ai` 在底层作为模型的抽象层，`agent-core` 在中层负责最核心的`agent loop`，`coding-agent `在顶层负责用户需求和业务对接，pi-tui 是平行的 UI 层不依赖任何 AI 包。`pi-ai / pi-agent-core / pi-coding-agent` 构成一条**三层堆栈，其中**每层可独立使用，`pi-tui` 是一个**正交的 UI 库**，与 Agent 体系完全解耦。

除了三层架构外，Pi Agent还支持四种运行模式：

![Image](assets/images/e091a17d91/image-02.png)

## 三、不同视角审视 Pi Agent

### 1、作为日常编码 Agent

对于习惯了使用claude code和codex用户第一次见到Pi Agent时候一定都会有下面的疑问：

- 为什么系统提示词只有约 1,000 个 token？因为”该说什么”应该由用户决定，不该被框架预判

- 为什么只内置 4 个工具（read / write / edit / bash）？因为更多内置工具 = 更多不可改变的约束

- 为什么没有 MCP / 计划模式 / 子 Agent / 待办？因为这些都是可集成可扩展的东西，Pi 把这个选择权留给用户——想用什么模式，就用扩展自己按需去搭

社区观察者 Pasquale 把这个分野说得最锋利：

> “像 Claude Code 和 Codex CLI 这类工具，优化的是’在精心打磨的环境里尽快拿到第一次成功’…… Pi 把优先级挪到了’对工具的所有权’上。它不给你计划模式，它给你**构造一个完全按你心意行事的计划模式所需的构建块**。”
> 
> 

Pi 没有 MCP、没有计划模式、没有子 Agent、没有 loop 模式。但是 Pi有**五根杠杆让用户**来把它塑形成想要的形状——前四根用于自己用，第五根用于把成果分享出去。**这五根杠杆本身才是 Pi 真正的能力所在**：极简的核心 + 强大的杠杆，让你拿到的是”一个能长成任何形状的 Agent”，而不是”一个被开发者决定了长成什么形状的 Agent”。

#### （1）五个能力杠杆：

- **扩展（Extensions）——最被低估、也是最强的一根杠杆**

扩展是 TypeScript 文件，会被 Pi 自动加载、还支持热重载（改一个扩展文件，正在跑的会话立即生效，不用重启）。这个杠杆赋予了**编码 Agent 自己改自己的能力**。不同于商业agent写死功能，Pi支持用户按需修改、

- **技能（Skills）——按需加载的能力包**

技能是”指令 + 工具”打包在一起的，采用**渐进式披露**——只在被调用时才进上下文，平时不占一个 token。

技能和扩展的关系可以这样理解：扩展是给 Agent **加新能力**（加新工具、加新命令、加新模式），技能是给 Agent **加新知识**（“遇到 X 任务该怎么做”）。两者可以叠加——一个扩展可以注册若干技能，一个技能也可以调用扩展提供的工具。

- **提示词模板（Prompt Templates）——可复用的工作流**

针对重复性任务的可复用 markdown 模板。通过写一个模板把重复性任务的指令固化下来，需要时可通过斜杠命令一键加载。

- **主题（Themes）——可实时重载的 TUI 皮肤**

TUI 的图形主题。在会话进行中切换，立即生效。

- **Pi 包（Pi Packages）——把上面四样打包分发**

扩展、技能、模板、主题都可以打包成一个 Pi 包，从 npm 或 git 安装：

```Python
pi install npm:@foo/pi-tools
# 或者直接从 git 仓库
pi install git:github.com/user/repo
```

这套模型和开发者每天都在用的包管理器高度相似。将写好的扩展发到 npm 上，全世界任何 Pi 用户一行命令就能装上。

虽然Pi的极简配置是它的优势，但是要想真正做到“麻雀虽小，五脏俱全”，作为一个日常编码工具其默认配置下也需要经得起测试。

Pi 在 TerminalBench 基准测试中排名第二，使用 Claude Opus 4.5 时仅次于 Terminus——尽管它没有 MCP 支持、没有子 Agent、没有计划模式、没有后台 bash、没有内置待办。这一结果表明一件事：极简的取向没牺牲能力，那些可扩展的功能对一个能干的 Agent 来说并不是必需品。

#### （2）靠谱的默认配置：

- **上下文极度干净**

这是 Pi 区别于已有agent的最大差异。对比 Claude Code 的数万 token，Pi的系统提示词 + 工具定义加起来不到 1,000 个 token。上下文窗口是 Agent 最稀缺的资源——固定指令占得越少，留给你的代码、项目上下文的空间就越多。Pi 所有 prompt 源码公开可见，你甚至可以用 `SYSTEM.md` 文件把整个系统提示词替换掉。

- **Agent行为透明**

你能看到模型收到的每一条消息、每一次工具调用的完整输入输出、跨会话的完整成本追踪、会话的 HTML/JSON 导出。在 Pi 里没有agent决策黑箱。

- **模型切换灵活自由**

Pi 支持 35 个 KnownProvider（Anthropic、OpenAI、Google、Azure、Bedrock、Mistral、Groq、Cerebras、xAI、Hugging Face、Kimi、MiniMax、OpenRouter、Ollama、DeepSeek 等等）。更重要的是支持用 `/model` 或 `Ctrl+L`**会话中途切换模型**。比如用 Claude 做复杂推理、切到 MiniMax 做简单文本处理省钱。

- **树状会话：走错路就分叉**

Pi 把会话存成**树结构**（DAG，有向无环图），而不是线性日志。`/tree` 跳到任意历史消息，所有分支活在同一个文件里。调试时尤其有用——你可以在同一个起点尝试三种不同的修复方案，不必担心无法回溯。

- **YOLO 模式与安全哲学**

Pi 默认 YOLO——Agent 不经审批弹窗直接执行动作。Pi的开发者认为基于审批的安全措施会让用户疲劳，如果用户确实需要审批流程，约 50 行扩展代码可以自己实现。



### 2、作为Agent架构和代码的学习范例

很多 Agent 框架动辄几万行代码，光是搞清楚启动流程就要读几十个文件。Pi 的核心循环只有几百行，但是“麻雀虽小，五脏俱全”，设计质量一点都不”简陋”。

这意味着学习者可以在有限的时间内真正”读完”一个高质量 Agent 的全部核心代码。

Pi的设计理念非常巧妙，它提供了一种减法哲学的思路。

看一个”什么都做了”的框架，你只能学到”他们做了什么”。看一个刻意什么都不做（what we didn't build）的框架，你才能学到”做 Agent 到底需要什么”。

当对手在罗列功能，Pi 在罗列舍弃。每一次舍弃背后，都有清晰的工程理由：

![Image](assets/images/e091a17d91/image-03.png)

### 3、作为可以独立复用的 SDK构建自己的agent

OpenClaw 等项目已经在生产环境中使用 Pi 的 SDK，把每一个 Agent 实例跑在 Pi 上。Pi Package 可以通过 npm 或 git 分发，生态正在形成。

pi的分层设计理念构成了一个三层堆栈结构，另外附有一个侧库 pi-ui，每一层都可以单独复用，为开发者构建自己的agent提供了天然的SDK。

---

# 第二章：三层架构 —— Pi 项目的骨骼

---

这是工程的目录结构：

```Python
repo/
├── packages/
│   ├── ai/              ← @earendil-works/pi-ai
│   ├── agent/           ← @earendil-works/pi-agent-core
│   ├── coding-agent/    ← @earendil-works/pi-coding-agent
│   ├── orchestrator/    ← @earendil-works/pi-orchestrator（实验性，多 Agent 编排）
│   └── tui/             ← @earendil-works/pi-tui
├── package.json         ← 根配置，npm workspaces
└── tsconfig.json
```

在packages目录下面是最核心的包，下面将分别来进行讲解。

---

## 一、分层结构

---

### 1、pi-ai ——**怎么用一套代码调用不同的 LLM？**

它的 `package.json` 里写了这么一行描述：

> *“Unified LLM API with automatic model discovery and provider configuration”（统一 LLM API，支持自动模型发现和提供商配置）*
> 
> 

具体来说，它做了三件事：

1. **定义统一的类型**：不管你用 OpenAI、Anthropic、Google 还是 AWS Bedrock，消息格式都是一样的——`UserMessage`、`AssistantMessage`、`ToolResultMessage`，模型定义都是 `Model<TApi>`

2. **统一流式调用**：所有提供商的调用方式统一成一个 `streamSimple()` 函数，返回一个 `AssistantMessageEventStream`（可以逐 token 读取的流）

3. **适配 30+ 提供商**：支持从 OpenAI、Claude、Gemini 到 DeepSeek、Groq、小米等 30 多个提供商，每个提供商一个适配器文件

概括来讲，它只管一件事：**把 LLM API 的差异抹平，对外暴露一套统一的接口**。

### 2、pi-agent-core ——**怎么让 LLM 反复思考和行动？**

它的 `package.json` 描述是：

> *“General-purpose agent with transport abstraction, state management, and attachment support”（通用 Agent 框架，支持传输抽象、状态管理和附件支持）*
> 
> 

关键词是 **“general-purpose”（通用的）**。这个包不知道自己在做编程 Agent、客服 Agent 还是任何具体领域的 Agent。它只知道：

- 怎么维护对话状态（`AgentState`）

- 怎么跑一个”调用 LLM → 执行工具 → 再调用 LLM”的循环（`agentLoop`）

- 怎么在循环过程中发出事件，让外部知道发生了什么（`AgentEvent`）

- 怎么管理会话历史、做上下文压缩（`Session`、`compact`）

它不关心具体做什么事，正如名称中的core指的是agent运行过程中核心的环节与流程。只关心”怎么把一个 Agent 跑起来”。

### 3、pi-coding-agent —— **怎么做一个编程助手？**

它的 `package.json` 描述是：

> *“Coding agent CLI with read, bash, edit, write tools and session management”（编程 Agent CLI，提供读、执行、编辑、写工具和会话管理）*
> 
> 

这一层是最”厚”的——上百个源文件，比前两层加起来还多。因为它知道所有具体的事：

- 7 个编程工具（read、bash、edit、write、grep、find、ls）怎么实现

- 扩展系统怎么加载和运行

- 会话怎么持久化到磁盘

- CLI 怎么解析参数、怎么在终端渲染输出

- 认证信息怎么存储

一个简单的入口，背后是一整条启动链路：

![Image](assets/images/e091a17d91/image-04.png)

### 4、pi-tui —— 如何把agent的工作流程展示给用户看

这个包和agent如何工作没有关系，只负责展示效果：

- **pi-tui**：终端 UI 库，负责在终端里渲染 Markdown、代码高亮、差分显示。它的依赖里**没有任何 AI 相关的包**——运行时仅 `marked`（Markdown 渲染）+ `get-east-asian-width`（东亚字符宽度计算）；`chalk`、`@xterm/headless` 在 devDependencies，不打包进运行时

### 5、pi-orchestrator（实验性）——  **怎么让多个 coding-agent 协同工作？**

它的核心由几个文件组成：

- `supervisor.ts` —— 监控者，管理子 Agent 的生命周期

- `rpc-process.ts` —— 基于 RPC 的进程间通信

- `radius.ts` —— 编排范围/边界控制

- `serve.ts` / `storage.ts` —— 服务暴露与状态持久化

注意它的定位：它**依赖 ****`pi-coding-agent`**，站在 coding-agent 之上，本身不实现任何 Agent 内核逻辑（循环、状态、压缩仍由 agent-core 提供）。它只是把若干个 coding-agent 实例”编”起来，让它们可以分工、通信、被监督。

所谓的分层就是，底层永远不知道上层的存在——pi-ai 的代码里没有任何一个 import 指向 pi-agent-core 或 pi-coding-agent；orchestrator 也不会反向渗透到 coding-agent 内部。这就是分层的真正规则：不是限制引用层级，而是控制依赖方向必须单向向上。需要注意的是三层不是必须的，层数取决于你的复杂度；但依赖方向控制是必须的。

---

## 二、类型在层间的传递

---

![Image](assets/images/e091a17d91/image-05.png)

用化学做类比类别在层间的传递。pi-ai 定义了”原子”，属于最基础的类型，pi-agent-core 把原子组合成”分子”，属于 Agent 专用类型，pi-coding-agent 再把分子组合成”材料”，属于业务专用类型。



### 第一层：pi-ai 定义原子

```TypeScript
// packages/ai/src/types.ts（节选）
// 最基础的消息类型——所有 LLM 都认的格式
type Message = UserMessage | AssistantMessage | ToolResultMessage

// 模型定义——描述一个 LLM 的全部信息
interface Model<TApi> {
    id: string           // 如 "claude-sonnet-4-6"
    name: string
    api: TApi            // 如 "anthropic-messages"
    contextWindow: number // 如 200000
    // ... 更多字段
}

// 工具定义——描述一个工具的 schema
interface Tool<TSchema> {
    name: string
    description: string
    parameters: TSchema
}
```

这三个类型——`Message`、`Model`、`Tool`——就是整个 Pi 系统的原子。任何包只要和 LLM 打交道，都必须用到它们。

### 第二层：pi-agent-core 把原子组合成分子

```TypeScript
// packages/agent/src/types.ts（节选）
import type {
    Message, Model, Tool, ImageContent, ...
} from "@earendil-works/pi-ai";

// 扩展消息：除了标准 LLM 消息，还可以有自定义消息
type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages]

// 扩展工具：除了 schema，还有参数预处理、执行函数和执行模式（types.ts:371-394）
interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
    label: string                                    // 显示名称
    prepareArguments?: (args: unknown) => Static<TParameters>   // 参数预处理
    execute: (toolCallId: string, params, signal?: AbortSignal, onUpdate?: AgentToolUpdateCallback<TDetails>) => Promise<AgentToolResult<TDetails>>
    executionMode?: ToolExecutionMode                 // "sequential" | "parallel"
}
```

注意两件事：

1. **`AgentMessage`**** 是 ****`Message`**** 的超集**。`Message` 是只有三种标准消息（User/Assistant/ToolResult），`AgentMessage` 在此基础上加入了自定义消息`CustomAgentMessages`（如压缩摘要、分支信息等）。用 TypeScript 的联合类型（`|`）实现扩展，而不是修改原来的类型定义。

2. **`AgentTool`**** 继承了 ****`Tool`**。底层的 `Tool` 只知道”工具叫什么、参数是什么”，只需要给LLM提供信息，上层的 `AgentTool` 加上了”怎么执行、串行还是并行”，这是 Agent 循环需要知道的信息。

### 第三层：pi-coding-agent 把分子组合成材料

到了 coding-agent 层，类型变成了具体的业务定义：

```TypeScript
// packages/coding-agent/src/core/extensions/types.ts:435-482（节选）
// 工具定义（产品视角）——完整接口有 10+ 个字段，下面列出关键字段
// 注意：ToolDefinition 在 TypeScript 层面是独立 interface 重新声明，
// 与 AgentTool 是"结构兼容"而非用 extends 继承（详见 types.ts:435）
interface ToolDefinition<TParams extends TSchema, TDetails = unknown, TState = any> {
    name: string
    label: string                         // UI 展示名
    description: string
    promptSnippet?: string                // 自动拼到 system prompt 的工具片段
    promptGuidelines?: string[]           // 工具使用守则
    parameters: TParams
    renderShell?: "default" | "self"      // 渲染模式
    prepareArguments?: (args: unknown) => Static<TParams>   // 参数预处理钩子
    executionMode?: ToolExecutionMode     // 并行/串行
    execute: (toolCallId, params, signal, onUpdate, ctx: ExtensionContext) => Promise<AgentToolResult<TDetails>>  // 签名扩展：比 AgentTool.execute 多 ctx 参数
    renderCall?: ...                      // 自定义调用渲染
    // ... 还有渲染器、UI 组件等业务属性
}

// 扩展定义（运行时聚合体，types.ts:1585-1595）
interface Extension {
    path: string                                       // 扩展路径
    resolvedPath: string                               // 解析后的绝对路径
    sourceInfo: SourceInfo                             // 来源信息
    handlers: Map<string, HandlerFn[]>                 // 各类处理器
    tools: Map<string, RegisteredTool>                 // 注册的工具（Map，非 Record）
    messageRenderers: Map<string, MessageRenderer>     // 消息渲染器
    commands: Map<string, RegisteredCommand>           // 注册的命令（Map，非 Record）
    flags: Map<string, ExtensionFlag>                  // 扩展标志
    shortcuts: Map<KeyId, ExtensionShortcut>           // 快捷键绑定
}
```

每一层只关心自己该关心的事，通过继承或组合在上层类型的基础上扩展。

---

## 三、Pi的分层设计的工程经验

---

从 Pi 的分层设计里，我提炼出三个在你自己的 Agent 项目中可以复用的方法。

### 方法 1：“依赖漏斗”分层法

**（i）是什么**：设计包结构时，先画依赖箭头。底层是不知道上层的，中间层是知道底层但不知道顶层业务的，顶层是知道一切的。

**（ii）怎么做**：

1. 把代码里”完全不依赖外部知识”的部分放底层

2. 把”依赖底层但不知道具体业务”的部分放中间层

3. 把找出知道用户业务需求的部分放顶层

4. 检查：如果有任何高层的东西被底层 import，说明分层有问题

**（iii）怎么验证**：从上到下进行验证，如果去掉上一层，这一层还能跑通吗？如果能，依赖方向正确。如果不能，上层的东西泄漏到了下层。

### 方法 2：“类型递进扩展”模式

**（i）是什么**：底层定义最小的类型接口，上层通过联合类型（`|`）和继承（`extends`）来扩展，而不是修改底层类型。

**（ii）怎么做**：

1. 底层定义原子类型（如 `Tool = { name, description, parameters }`）

2. 中间层用继承扩展（如 `AgentTool extends Tool`，加上 `execute` 字段）

3. 顶层再叠加业务属性（如 `ToolDefinition`，加上渲染器）

4. 每一层只加自己关心的事，不改底层

**（iii）好处**：底层可以独立发布和复用。别人可以只引用你的底层类型，不引入整个 Agent 框架。

### 方法 3：“可独立使用”测试

**（i）是什么**：每层设计完后，做一个简单测试——去掉上层，这一层还能不能正常工作？

对于Pi 的三层都能通过这个测试：

- 去掉 pi-agent-core 和 pi-coding-agent，pi-ai 可以独立调用 LLM

- 去掉 pi-coding-agent，pi-ai + pi-agent-core 可以跑一个自定义 Agent

- 三层全用，就是一个完整的编程助手

**（ii）怎么做**：在你的 `package.json` 里，试着暂时移除上层的依赖，看看底层包的编译和测试还能不能通过。如果报错了，说明你的底层泄漏了对上层的依赖，说明分层有问题。

---

# 第三章：Agent Loop —— 让模型转动起来的引擎

---

Agent真正的生命力来自循环。在聊 Agent Loop 之前，我们先退一步，看看”使用大模型”这件事本身有几种模式。这对理解”为什么需要agent loop”至关重要。

---

## 一、使用大模型的不同模式

---

### 模式 1：直接调用

直接问LLM，让它直接返回结果。

流程也是非常的简单：用户输入 → 构建提示词 → 调模型 → 模型输出 → 展示结果

```JavaScript
const response = await llm.chat({
  messages: [
    { role: "system", content: "你是一个翻译助手" },
    { role: "user", content: "把这段代码翻译成 Python" },
  ],
});
console.log(response.content);
```

核心工作在于如何构建提示词。提示词写得好，结果就好。一次调用，一次输出，没有循环。



### 模式 2：Workflow

当任务变复杂，一次性调用LLM很难得到满意结果。于是你把大任务拆成多步，每步调一次模型，步骤之间由你的代码控制流转，这就是工作流模式。

![Image](assets/images/e091a17d91/image-06.png)

每一步模型只负责自己的那份工作，只是workflow中的一环。而真正的任务决策权在开发者手中，同时对于调用模型的结果开发者也有决策权决定是否过关。



### 模式 3：Agent Loop 

Agent loop模式和前两种模式最大的区别就是agent loop中把决策权完全交给了agent。

![Image](assets/images/e091a17d91/image-07.png)





深入源码之前，有两个概念必须分清楚。它们经常被混用，但在 Pi 的代码里，每个都有精确的含义。

---

## 二、Trace和Turn概念辨析

---

### 1、Turn（一个轮次）

一个 Turn 的定义非常精确：**一次模型调用 + 这次调用触发的所有工具执行。**

![Image](assets/images/e091a17d91/image-08.png)

每个 Turn 由一对 `turn_start` 和 `turn_end` 事件包裹。一个 Turn 只有一次模型调用。 

```Java
while (hasMoreToolCalls || ...) {
    if (!firstTurn) emit(turn_start);    // ← 新 Turn 开始

    处理 pendingMessages
    streamAssistantResponse()             // ← 一次模型调用
    检查 stopReason
    executeToolCalls()                    // ← 执行这个 Turn 触发的一批工具
    emit(turn_end);                       // ← 这个 Turn 结束

    prepareNextTurn / shouldStopAfterTurn / 检查 steering
}
```

### 2、Trace（一次完整运行）

一个 Trace 是从用户按下回车、到 Agent 彻底停下来、发出 `agent_end` 事件的**整个过程**。一个 Trace 包含多个 Turn。

![Image](assets/images/e091a17d91/image-09.png)

用一张图把trace和turn画在一起：

![Image](assets/images/e091a17d91/image-10.png)

---

## 三、一条 message 的完整数据流

---

你输入了”帮我读一下 src/main.ts”并按下回车，你的输入变成**消息（Message）**；Loop 调用模型（Model）**来思考；模型要求的操作用**工具（Tool）**完成；每一步通过**事件（Event）通知外部。驱动这四者反复运转的机制就是**Agent Loop**。

![Image](assets/images/e091a17d91/image-11.png)



但是需要注意的是模型本身并不知道什么时候停止循环，模型只是个 token 预测器。`stopReason` 这个字段虽然挂在模型的返回值上，但它的值来自**两个不同的地方**：

（i）模型 API 真正返回的三种：

（ii）框架的流式层注入的两种：

Loop 实际上只关心一个指标：**模型输出里有没有工具调用**。这是因为人类为它配置了约定：

> *如果模型一次输出中没有工具调用，就认为本轮不需要更多操作，循环可以停了。*
> 
> 



那既然我们追求最大程度的智能化，为什么不让代码更智能地判断”任务完成”？ 因为这正是 Agent 和 Workflow 的本质区别。Workflow 知道流程有几步，可以用代码判断进度。但 Agent 模式下，你不知道模型要读几个文件、改几处代码——你唯一能稳定依赖的信号就是：输出里有没有工具调用**。** 这既是局限，也是优雅。

![Image](assets/images/e091a17d91/image-12.png)

---

## 四、源码详解：基础 Loop 与 coding-agent 的叠加设计

---

第三部分给出了消息怎么流动、stopReason 怎么驱动循环、什么时候停。这一节深入代码，回答”怎么做到的”上面那些事情。

最简单的 Agent Loop 其实极其简短。剥掉所有产品特性，一个能用的 Agent Loop 只需要这些：

```JavaScript
// 最简 Agent Loop（伪代码）
async function simpleLoop(messages, model, tools) {
    while (true) {
        // ① 调模型
        const response = await callModel(model, messages, tools);
        messages.push(response);

        // ② 没有工具调用 → 结束
        if (response.stopReason !== "toolUse") {
            return messages;
        }

        // ③ 有工具调用 → 执行，把结果喂回去
        for (const toolCall of response.toolCalls) {
            const result = await executeTool(toolCall);
            messages.push(result);
        }
    }
}
```

Pi 的 coding-agent 是一个**交互式编程助手**——用户在终端里跟它对话，它可能要读好几个文件、改代码、跑测试。这种产品场景比”最简 Loop”多出了真实的需求：

这些叠加设计都是 coding-agent 的**功能选择**，不是 Agent 的通用法则。需要根据你真实的需求选择。

![Image](assets/images/e091a17d91/image-13.png)

### 1、入口：runAgentLoop() 

你按下回车后，调用链是：`Agent.prompt()` → `runPromptMessages()` → `runAgentLoop()`。停在入口：

```JavaScript
// agent-loop.ts:95-118
async function runAgentLoop(
    prompts: AgentMessage[],     // 你的消息
    context: AgentContext,       // 当前对话上下文（快照副本）
    config: AgentLoopConfig,     // 循环配置（模型、钩子、队列回调）
    emit: AgentEventSink,        // 事件发射器
    signal?: AbortSignal,        // 中止信号
    streamFn?: StreamFn,         // 流式函数（可替换）
): Promise<AgentMessage[]>
```

有三个参数比较重要：

- **`prompts`** — 用户的输入消息已经被包装成了标准格式：

```Python
[{
  role: "user",
  content: [{ type: "text", text: "帮我读一下 src/main.ts" }],
  timestamp: 1748000000000
}]
```

- **`context`** — 对话上下文快照。注意是**副本**（`agent.ts:414-420` 的 `createContextSnapshot()` 创建），Loop 运行期间对 context 的修改不会影响 Agent 类的原始状态：

```YAML
{
  systemPrompt: "You are a helpful coding assistant...",
  messages: [ /* 之前的对话历史 */ ],
  tools: [
    { name: "read", description: "...", parameters: Type.Object({...}), execute: ... },
    { name: "bash", description: "...", parameters: Type.Object({...}), execute: ... },
  ]
}
```

- **`config`** — Loop 的行为配置。这里有一组关键钩子：

```JavaScript
{
  model: Model,                    // 用哪个 LLM
  convertToLlm: Function,          // AgentMessage[] → Message[] 转换
  transformContext?: Function,      // 调 LLM 前的上下文预处理（如压缩）
  getSteeringMessages?: Function,   // 获取"紧急插队"消息
  getFollowUpMessages?: Function,   // 获取"追加任务"消息
  shouldStopAfterTurn?: Function,   // 每轮结束后是否该停
  beforeToolCall?: Function,        // 工具执行前钩子
  afterToolCall?: Function,         // 工具执行后钩子
  toolExecution: "parallel",        // 工具执行模式
}
```

入口函数只做了三步准备：

![Image](assets/images/e091a17d91/image-14.png)

数据变化：

```Python
入口前：
  context.messages = [user1, asst1, toolResult1]    ← 之前的对话
  newMessages = []

入口后：
  context.messages = [user1, asst1, toolResult1, user2]  ← 你的消息被追加
  newMessages = [user2]                                   ← 收集器开始记录
```

### 2、runLoop() 的骨架：先看内核，再看叠加

#### 2.1 内核：内层循环

如果只保留最简 Loop 的逻辑，`runLoop` 长这样：

```Java
// 只保留内核的 runLoop（伪代码）
while (hasMoreToolCalls) {
    // 步骤 B：调 LLM
    // 步骤 C：检查 stopReason → error/aborted 就退出
    // 步骤 D：执行工具
    // 步骤 E：emit turn_end
}
// 结束 → emit agent_end
```

#### 2.2 叠加：coding-agent 加了两层外壳

但 coding-agent 作为交互式编程助手，需要在内核外面加两样东西：

**叠加 1：steering 消息注入**

内层循环开头 + 每圈结尾各检查一次有没有信息注入。用户在 Agent 工作时输入了新指令——这些消息不能等当前任务跑完，得在下一圈开头紧急注入。所以内层循环条件多了一个 `pendingMessages.length > 0`。

**叠加 2：外层 followUp 循环**

followUp循环包在整个内层循环外面。Agent 自然停了之后，系统可能还想追加任务。外层循环让这些追加任务在**同一个 Trace 内**继续跑，不需要重新启动一个新的 Loop。

把内核和两层叠加拼起来，才是完整的 `runLoop` 骨架：

```JavaScript
async function runLoop(currentContext, newMessages, config, signal, emit, streamFn) {

    // ① 首次 steering 检查（在进入内层循环之前！）
    let pendingMessages = (await config.getSteeringMessages?.()) || [];

    // ========== 叠加2：外层followUp循环 ==========
    while (true) {
        let hasMoreToolCalls = true;
        let firstTurn = true;  // 首轮跳过 turn_start（入口已发）

        // ========== 内核 + 叠加1：内层循环 ==========
        while (hasMoreToolCalls || pendingMessages.length > 0) {
            //                                    ↑ 叠加1：steering 消息也驱动循环

            if (!firstTurn) {
                emit({ type: "turn_start" });
            }
            firstTurn = false;

            // 步骤 A：注入 pendingMessages（steering 消息）← 叠加1
            // 步骤 B：调 LLM → streamAssistantResponse()  ← 内核
            // 步骤 C：检查 stopReason                      ← 内核
            // 步骤 D：执行工具                              ← 内核
            // 步骤 E：emit turn_end                         ← 内核
            // 步骤 F：prepareNextTurn → shouldStopAfterTurn ← 叠加（钩子）
            //         → 再次检查 steering                    ← 叠加1
        }

        // ========== 内层循环结束 ==========
        // 步骤G ：叠加2：检查 followUp 队列
        const followUpMessages = (await config.getFollowUpMessages?.()) || [];
        if (followUpMessages.length > 0) {
            pendingMessages = followUpMessages;
            continue;  // 回到外层循环顶部，内层循环重开
        }

        break;  // 两个队列都空，真正退出
    }
}
```



### 3、runLoop()的代码实现

#### 3.1 【叠加1 · 步骤A】steering 消息注入

***什么是 steering？**** 这是 coding-agent 的一个交互功能。想象你让 Agent 帮你正在执行一个任务。这时候你突然想到一个补充——你希望这条指令能****插队****，而不是等 Agent 把当前任务做完再说。*

steering 就是这个”插队”机制。用户在 Agent 工作期间输入的新指令，会被放进 steering 队列。每圈内层循环开头，Loop 先检查这个队列，把紧急消息注入到当前对话中：

```Python
if (pendingMessages.length > 0) {
    for (const message of pendingMessages) {
        await emit({ type: "message_start", message });
        await emit({ type: "message_end", message });
        currentContext.messages.push(message);
        newMessages.push(message);
    }
    pendingMessages = [];  // 消费完毕，清空
}
```

pendingMessages 的第一个来源是 `runLoop` 一进来就执行的首次 steering 检查（`agent-loop.ts:167`）。为什么要在进入循环**之前**就检查？因为用户在等待 LLM 首次响应时可能又输入了内容——这时候消息已经从外部排队了，但循环还没开始，如果不提前取出来，这批消息就漏掉了。

#### 3.2 【内核 · 步骤B】streamAssistantResponse() — 调 LLM

这是整个 Loop 内容最多的的一步——把消息发给模型、拿回流式响应。分为四个阶段。

##### 阶段 A：上下文预处理（可选）

```Python
let messages = context.messages;
if (config.transformContext) {
    messages = await config.transformContext(messages, signal);
}
```

如果配置了 `transformContext`（如压缩算法），在此预处理消息。不配置就跳过。

##### 阶段 B：AgentMessage → Message 转换（两层消息的边界）

```Python
const llmMessages = await config.convertToLlm(messages);
```

这是出于agent和LLM之间的区别设计的。要理解它为什么存在，得先知道”两层消息”的设计。

Agent 内部维护对话历史时，需要记录的不只是”用户说了什么、AI 回了什么”——它还需要记录**自己的内部状态**。比如 coding-agent 会记录：上下文被压缩过（`CompactionSummaryMessage`）、Bash 命令的执行详情（`BashExecutionMessage`）、分支切换的记录（`BranchSummaryMessage`）。这些是 Agent 自己用的”内部语言”，**LLM 根本不认识这些消息类型**——它只认三种标准消息：`UserMessage`、`AssistantMessage`、`ToolResultMessage`。

`convertToLlm` 就是站在这个边界上的**翻译官**：把 Agent 的内部语言翻译成 LLM 能理解的协议。默认实现就是一个 `.filter()`——只保留三种标准消息：

```JavaScript
function defaultConvertToLlm(messages: AgentMessage[]): Message[] {
    return messages.filter(
        (message) => message.role === "user"
                  || message.role === "assistant"
                  || message.role === "toolResult",
    );
}
```

![Image](assets/images/e091a17d91/image-15.png)

##### 阶段 C：构建 Context 并调用模型

```JavaScript
const llmContext: Context = {
    systemPrompt: context.systemPrompt,
    messages: llmMessages,
    tools: context.tools,
};

const streamFunction = streamFn || streamSimple;
const resolvedApiKey =
    (config.getApiKey ? await config.getApiKey(config.model.provider) : undefined)
    || config.apiKey;

const response = await streamFunction(config.model, llmContext, {
    ...config,
    apiKey: resolvedApiKey,
    signal,
});
```

**构建 Context 是这一步的主线。** 注意 `llmContext` 是一个**全新对象**，每圈内层循环都重建一次。它由三部分组成：

- **`systemPrompt`** —— 直接复用 Agent 上下文里的系统提示词，告诉模型”你是谁、该遵守什么规则”

- **`messages`** —— 就是上一步 `convertToLlm` 过滤后的 `llmMessages`，只含 LLM 认识的三种标准消息

- **`tools`** —— 工具列表（带 schema 定义），让模型知道”这次有哪些工具可以调”

注意一个细节：`llmContext.tools = context.tools` 是**引用赋值**——每圈虽然包了个新的 wrapper 对象，但 `tools` 数组本身是同一份引用，`systemPrompt` 同理。只有 `messages` 真的在增长（每圈追加新的 ToolResultMessage）。

那为什么还要每圈重建 `llmContext` 这个 wrapper？因为有的 Turn 确实会改这三者里的某一个：`prepareNextTurn` 钩子可能换过模型或改过 systemPrompt，扩展系统可能动态注册新工具。重建 wrapper 的成本可以忽略（一个 JS 对象），但能保证不会因为共享引用导致难以追踪的状态污染。

**这会不会破坏 prompt cache？** 不会。Anthropic 的 prompt cache 是**内容寻址**的——它看的是发过去的字节，不是请求的 identity。每次发的是新对象还是旧对象无所谓，只要 `system + tools` 的字节不变，cache 就命中。Pi 在 [anthropic-messages.ts](https://github.com/earendil-works/pi/blob/main/packages/ai/src/api/anthropic-messages.ts) 里显式在**三个位置**打 `cache_control: { type: "ephemeral" }` 标记：

第三条尤其精妙：cache breakpoint 不是固定在第一条消息上，而是固定在**最新的一条 user message **。这样旧前缀继续命中、新追加的内容被写入，整个对话历史都享受 cache 收益。命中链路大致是：

```Python
Turn 1: 写入 [system + tools] → 写入 [messages §1]
Turn 2: 命中 [system + tools] → 命中 [messages §1] → 写入 [messages §2]
Turn 3: 命中 [system + tools] → 命中 [messages §1+§2] → 写入 [messages §3]
```

还有个容易误解的点：**tools 不是被塞到 messages 末尾**。Anthropic API 协议里 `tools` 是独立的顶层字段（位置在 messages 之前），这个协议设计本身就考虑了 cache——稳定的 tools 在前、变动的 messages 在后，prefix 越长越省。

OpenAI 体系走的是另一条路（[openai-completions.ts:554](https://github.com/earendil-works/pi/blob/main/packages/ai/src/api/openai-completions.ts#L554)）：`prompt_cache_key: sessionId`，OpenAI 后端按 session 自动匹配前缀。DeepSeek、Qwen 等通过 `cacheControlFormat: "anthropic"` 兼容字段，也能复用 Anthropic 风格的 cache_control 标记（[L593](https://github.com/earendil-works/pi/blob/main/packages/ai/src/api/openai-completions.ts#L593) 的 `applyAnthropicCacheControl`）。

##### 阶段 D：流式处理响应 —— 原地替换的妙用

`streamFunction` 返回的是 `AssistantMessageEventStream`——一个异步迭代器。这步有一个很精巧的设计：

```Go
for await (const event of response) {
    switch (event.type) {
        case "start":
            // 拿到一个"空壳"消息，直接 push 到 context
            partialMessage = event.partial;
            context.messages.push(partialMessage);
            emit({ type: "message_start", ... });
            break;

        case "text_delta":       // 文本增量
        case "toolcall_delta":   // 工具调用增量
        case "thinking_delta":   // 思考增量
            partialMessage = event.partial;            // 更新后的部分消息
            context.messages[last] = partialMessage;    // ★ 原地替换！
            emit({ type: "message_update", ... });      // UI 收到增量更新
            break;

        case "done":
        case "error":
            finalMessage = await response.result();
            context.messages[last] = finalMessage;       // ★ 用最终完整消息替换
            emit({ type: "message_end", ... });
            return finalMessage;
    }
}
```

为什么要先 push 空壳再原地替换？注意”原地替换”的意思——不是往 `context.messages` 数组里 push 新条目，而是**用新内容覆盖最后一条**（`context.messages[last] = partialMessage`）。这样 context 的消息数量不变，但最后一条消息的内容在”长大”。

为了UI 能实时展示。如果等全部响应完成才 push 到 context，用户在 LLM 思考的几秒里盯着空白屏幕。通过”先放空壳、逐 token 替换”，UI 通过 `message_update` 事件拿到最新部分消息，能做到逐字渲染。

![Image](assets/images/e091a17d91/image-16.png)

#### 3.3 【内核 · 步骤C】检查 stopReason

拿到 `AssistantMessage` 后，立即做一次硬停止判断：

```Python
// agent-loop.ts:196-200
if (message.stopReason === "error" || message.stopReason === "aborted") {
    await emit({ type: "turn_end", message, toolResults: [] });
    await emit({ type: "agent_end", messages: newMessages });
    return;   // ← 直接退出整个 runLoop，不检查 followUp
}
```

`error` 和 `aborted` 是”硬停止”——立即发 turn_end + agent_end，直接 return。连工具都不执行，连 followUp 也不用检查。这是一种 fail fast 策略：既然模型调用本身就失败了（网络异常或用户中止），继续跑没有任何意义。

#### 3.4 【内核 · 步骤D】executeToolCalls() — 执行工具

模型返回的 `AssistantMessage.content` 里，可能有多个 `type === "toolCall"` 的块（模型一口气要求了多个操作）。先过滤出来：

```Python
const toolCalls = message.content.filter((c) => c.type === "toolCall");
```

然后决定这批工具**并行还是串行**执行：

```Python
if (config.toolExecution === "sequential" || hasSequentialToolCall) {
    return executeToolCallsSequential(...);   // 串行
}
return executeToolCallsParallel(...);         // 并行
```

**“一票否决”策略**：只要这批工具中有**任何一个**声明了 `executionMode: "sequential"`，整批都串行。采用如此保守的策略是因为判断”哪些工具会冲突”很难。每个工具内部可能会涉及到不同的函数对不同的文件进行读写，这都会产生冲突。

两种执行模式的内部结构：

![Image](assets/images/e091a17d91/image-17.png)

注意并行模式的精妙之处：**准备阶段始终顺序**（因为验证和权限检查不能并行——万一 B 被拦截了，C 就不应该执行），**只有实际执行并行**。

每个工具的结果被包装成 `ToolResultMessage`，追加到 `context` 和 `newMessages`：

```YAML
工具执行后：
  context.messages = [..., user2, assistantMessage, {
    role: "toolResult", toolCallId: "toolu_01", toolName: "read",
    content: [{ text: "文件内容..." }], isError: false
  }]
```

**terminate 机制**：工具可以在返回结果中设置 `terminate: true`，表示”我觉得不该继续了”。但 Loop 不会因为某一个工具喊停就停，**必须这批工具的全部结果都设置了 terminate 才真正退出。**



#### 3.5 【内核+叠加 · 步骤E\~F】turn_end + 钩子 + 再次检查 steering

Turn 的调模型 + 执行工具的步骤做完了，接下来是收尾。收尾分四步，其中前两步是内核，后两步是 coding-agent 叠加的扩展点：

```JavaScript
// ① emit turn_end —— 通知外部"这一轮结束了"（内核）
await emit({ type: "turn_end", message, toolResults });

// ② prepareNextTurn —— 给外部一个机会"改装"下一轮（叠加）
// 返回值可包含 context / model / thinkingLevel 三者之一的覆盖
const nextTurnSnapshot = await config.prepareNextTurn?.({...});
if (nextTurnSnapshot) {
    currentContext = nextTurnSnapshot.context ?? currentContext;
    config.model = nextTurnSnapshot.model ?? config.model;
    // thinkingLevel 也在此处覆盖（详见 agent-loop.ts 中 prepareNextTurn 处理逻辑）
}

// ③ shouldStopAfterTurn —— 外部判断是否该停了（叠加）
if (await config.shouldStopAfterTurn?.({...})) {
    await emit({ type: "agent_end", messages: newMessages });
    return;
}

// ④ 再次检查 steering —— 有没有新的紧急消息？（叠加1）
pendingMessages = (await config.getSteeringMessages?.()) || [];
```

**`prepareNextTurn`** 在每个 turn_end 之后、下一轮开始前被调用，允许外部**动态切换下一轮的配置**。具体例子：

![Image](assets/images/e091a17d91/image-18.png)

除了换模型，它还能换 `context`（比如注入新的上下文信息）和 `thinkingLevel`（思考强度）。返回 `undefined` 表示”什么都不换，按原配置继续”。

**`shouldStopAfterTurn`** —— 外部注入的停止判断。coding-agent 层会用它来检查上下文窗口是否快满了（快满了就停下来触发压缩），或者是否达到了最大 Turn 数限制。

**再次检查 steering** —— 一圈内层循环结束，再看看 steering 队列有没有新积攒的紧急消息。如果有，下一圈继续跑。



#### 3.6  回到循环顶部

工具执行完且收尾结束，代码回到内层 while 循环的条件判断。前面已经详细讲了 `hasMoreToolCalls` 由 `toolCalls 数组长度 > 0 && !terminate` 驱动，不再调用工具且所有的工具都有terminate标识。这里看代码如何实现：

typescript复制

```Plain Text
while (hasMoreToolCalls || pendingMessages.length > 0)
```

两个条件任一为 true 就继续。`hasMoreToolCalls` 由模型输出里有没有 toolCall 块（且未全部 terminate）决定（内核），`pendingMessages` 由 steering 队列决定）。两个都为 false 时，代表不会再调用工具了且没有steering进来的消息，内层循环退出。

#### 3.7 【叠加2 · 步骤G】外层循环：followUp 的续命机制

内层循环退出了代表没有工具要执行，也没有紧急消息。但 coding-agent 的设计是：此时检查一下 外层循环`getFollowUpMessages()`，看看系统有没有追加任务：

```JavaScript
const followUpMessages = (await config.getFollowUpMessages?.()) || [];
if (followUpMessages.length > 0) {
    pendingMessages = followUpMessages;   // 塞进 pending，触发新 Turn
    continue;                              // 回到外层循环顶部
}
break;  // 两个队列都空了，真正退出
```

如果有 followUp 消息，它们被塞进 `pendingMessages`，`continue` 回到外层循环顶部，内层循环检测到 `pendingMessages` 不为空，**在同一个 Trace 内**继续跑。这比重新启动一个新的 `runAgentLoop()` 要好，主要体现在连续性：同一个 `newMessages` 数组、同一个事件序列，不需要额外合并。

外层循环followUp不是必须的，如果你做的是简单 Agent，外层循环是多余的——内层循环退出后直接 `break` + `emit agent_end` 就行了。



#### 3.8 steering vs followUp：一张表看清两种干预

![Image](assets/images/e091a17d91/image-19.png)

本章出现了两种”外部消息注入”机制。虽然 已经分别介绍过，但放在一起对比更能看清它们的差异：

## 五、总结：Loop 的四条核心设计

回顾从按下回车到 Agent 完成的整段旅程：

### 1、ReAct 循环模式

Loop 的本质是 Reason（模型思考）→ Act（执行工具）→ Observe（观察结果）→ Reason（再次思考）的循环。模型的输出内容决定”该调什么工具”——这是 Agent 区别于 Workflow 的核心。但”什么时候停”不是模型的决策，而是我们人类定义的规则：**模型不再输出工具调用时，就认为本轮结束。**

### 2、stopReason 驱动机制

整个循环由一个字段驱动：`stopReason`。但实际驱动循环的不是 stopReason 本身，而是模型输出里有没有 toolCall 块且未全部 terminate——`"有 toolCall"` = 继续转；没有 toolCall 或全部 terminate = 准备停。这是 Agent 架构的核心设计原则——把决策外包给模型输出模式，代码只做最简单的信号判断。

### 3、内核 + 叠加的架构思路

Agent Loop 的内核极其简短——十几行代码就能实现一个能用的循环。Pi 的 coding-agent 在内核上叠加了 steering（紧急插队）、followUp（任务追加）、prepareNextTurn（动态切模型）、shouldStopAfterTurn（安全阀）等设计。**内核是所有 Agent 的通用法则，叠加是产品功能的按需选择。** 做自己的 Agent 时，先搭内核，再按场景加叠加。

---

# 第四章：模型调用 —— 一行代码驾驭多个模型

---

Agent Loop 的完整运转过程其中最关键的一步是”调用模型”——Loop 把消息发给 LLM，拿到回复，根据回复决定继续还是停止。

```Python
const stream = streamSimple(model, context, options);
```

虽然只有一行代码，但如果打开 `packages/ai/src/api/` 目录，会发现里面有几十个文件、10 种 API 翻译器（含 1 个 images 专用），每个都上千行代码。**一行调用的简洁背后，是整个 AI 抽象层的精心设计。**

这一章就来拆开这一行代码：Pi 怎么做到用同一个接口调用 30 多个不同的模型？如果你想接入一个新模型，需要做什么？

我们看一个最简单的例子。假设用户对 Agent 说了一句话：

> *“帮我读一下 main.ts”*
> 
> 

这条消息在 Pi 内部是采用统一格式存的：

```Python
{ role: "user", content: "帮我读一下 main.ts", timestamp: 1748697600000 }
```

要把这条消息发给不同模型，就必须转换为不同模型要求的格式。同样是这一句话，四个 Provider 要求的格式完全不同：

- **Anthropic（Claude）**——消息内容必须是数组，每项带 `type` 字段：

```Python
{ role: "user", content: [{ type: "text", text: "帮我读一下 main.ts" }] }
```

- **OpenAI（GPT）**——格式看起来差不多，但字段语义有细微差异（比如工具结果消息的处理方式完全不同）：

```Python
{ role: "user", content: "帮我读一下 main.ts" }
// 但如果消息里包含工具结果，OpenAI 要求单独的 { role: "tool" } 消息，
// 而 Anthropic 把工具结果合并到 user 消息里
```

- **Google（Gemini）**——字段名从 `content` 变成了 `parts`，结构更扁平：

```Python
{ role: "user", parts: [{ text: "帮我读一下 main.ts" }] }
```

- **Bedrock（AWS）**——在 AWS 自己的结构上又包了一层：

```Python
{ role: "user", content: [{ text: "帮我读一下 main.ts" }] }
```

![Image](assets/images/e091a17d91/image-20.png)

## 一、给provider做封装，通过三层架构实现

Agent Loop 只有一行 `streamSimple(model, context)`，它不可能为每个 Provider 写一套不同的逻辑。那它怎么应对这么多差异？一个直觉的答案：给所有 Provider 做一层封装，让他们输入输出都一样。

Pi 的方案是把这件事拆成三层，每层有明确的分工：

![Image](assets/images/e091a17d91/image-21.png)

可以用一个一个国际翻译公司类比：

- **第一层（前台）**：客户进门，前台问”你要翻译什么语言？“，然后查通讯录找到对应的翻译员，把工作派给他

- **第二层（标准报告模板）**：不管翻译员翻译的是法语、日语还是阿拉伯语，最终交出来的报告都必须用公司统一的格式——封面、正文、审签栏，格式固定

- **第三层（翻译员们）**：每个翻译员精通一种语言，内部怎么翻译是他们的事，但输出必须符合第二层的标准格式

**关键点：前台（第一层）和翻译员（第三层）之间靠标准报告（第二层）连接。前台不需要懂外语，翻译员不需要懂公司流程。**

![Image](assets/images/e091a17d91/image-22.png)

### 第一层：统一入口

入口函数是 `stream()`，代码极其简单：

```JavaScript
// compat.ts
export function stream(model, context, options?) {
  const provider = resolveApiProvider(model.api);  // 查表：这个model该找谁？
  return provider.stream(model, context, options);  // 把工作派给翻译器
}
```

只有两步工作：**查表，派活。** `model.api` 是一个字符串（如 `"anthropic-messages"`），系统启动时已经把所有翻译器注册进了一个哈希表。

这个哈希表长这样：

```Java
const BUILTIN_APIS = [
  ["anthropic-messages",       anthropicMessagesApi()],      // Claude 的翻译器
  ["openai-completions",       openAICompletionsApi()],      // GPT 的翻译器
  ["google-generative-ai",     googleGenerativeAIApi()],     // Gemini 的翻译器
  ["bedrock-converse-stream",   bedrockConverseStreamApi()], // Bedrock 的翻译器
  // ... 还有 5 个
];
```

`model.api` 的值就是 key——拿 key 查表，找到翻译器，调用它。整个入口层不处理任何业务逻辑，哈希表充当路由映射的角色。

### 第二层：事件协议

翻译器把请求发给模型后，模型会流式返回内容。第二层约定了一套统一的输出格式。

Pi 规定：不管底层是哪家模型，翻译器都必须输出**统一的事件流**，事件类型一共 12 种

并不需要记住全部 12 种。只需要理解模式：模型回复的内容分三类（文字、思考、工具调用），每类都有”开始→逐字增量→结束”三步，再加上流开始和流结束两个信号。这可以保证agent做到逐字渲染。

![Image](assets/images/e091a17d91/image-23.png)

还有一个重要约定：每个事件都携带 `partial: AssistantMessage`——当前消息的完整快照。每次收到事件，用 `partial` 覆盖 context 中最后一条消息，不用自己拼接增量。



### 第三层：翻译器

翻译器是真正干活的角色。每个翻译器对应一种 API（如 Anthropic、OpenAI），负责把统一格式翻译成该 Provider 的私有格式，再把响应翻译回统一事件。

所有翻译器都遵循同一个 5 步工作流程：

![Image](assets/images/e091a17d91/image-24.png)

### StreamFunction：翻译器的”入职要求”

前面说的三层架构要运转起来，有一个前提：**所有翻译器必须遵守同一套规则。** Pi 用一个 TypeScript 类型来定义这套规则——它叫 `StreamFunction`，是整个抽象层的最高要求：

```TypeScript
export type StreamFunction<TApi extends Api, TOptions> = (
  model: Model<TApi>,       // 用哪个模型
  context: Context,         // 对话上下文（系统提示 + 消息 + 工具）
  options?: TOptions,       // 可选配置（思考级别、缓存等）
) => AssistantMessageEventStream;  // ← 必须返回统一事件流
```

这个签名定义了三条规则：

1. **输入相同**：所有翻译器接受同样的三个参数（model、context、options）

2. **输出相同**：必须返回 `AssistantMessageEventStream`——不管底层是原始 SSE 还是 SDK 流，对外都是这个类型

3. **错误不抛异常**：API 调用失败时，不发 `throw`，而是发一个 `{ type: "error" }` 事件

第 3 条呼应了第 3 章的”永不抛出”原则。回忆一下：第 3 章说的 `stopReason: "error"` 和 `"aborted"` 不是模型返回的，而是**翻译器的 catch 块在异常时注入的**。具体来说，翻译器把异常信息包装成一个 `error` 事件，推进事件流里。Agent Loop 收到后用同一套机制处理成功和失败，循环永远不会被异常打断。

有了 StreamFunction 这套规则，第一层可以放心地把工作派给任何翻译器——因为它们保证了同样的输入格式、同样的输出格式、同样的错误处理方式。

---

## 二、怎么用：从调用到接入新模型

---

### 场景一：调用模型

Agent Loop 实际调用的不是 `stream()`，而是 `streamSimple()`。

`stream()` 是底层入口——它只做”查表 + 派活”，不管思考级别翻译。`streamSimple()` 是在 `stream()` 之上包了一层便捷功能——自动处理思考级别（ThinkingLevel）翻译、自动调整 token 上限等。简单说：

- **`stream()`**：最底层，什么便利功能都没有。

- **`streamSimple()`**：帮你处理好思考级别等翻译工作，是实际开发中常用的入口

Agent Loop 使用 `streamSimple()` 的典型代码：

```C++
const stream = streamSimple(model, context, { reasoning: "high" });
//                                          ↑ 告诉它"用高级别思考"
//                                            streamSimple 会自动翻译成各 Provider 的具体参数

for await (const event of stream) {
  // 事件会按顺序到达：
  // start → thinking_start/delta/end → text_start/delta/end → done
  switch (event.type) {
    case "text_delta":
      // 文字增量，显示到终端
      break;
    case "toolcall_end":
      // 模型要调工具，拿到完整的工具调用信息
      break;
    case "done":
      // 本轮模型调用结束，看 stopReason 决定是否继续循环
      break;
    case "error":
      // 出错了（网络超时、API错误等），errorReason 是 "error" 或 "aborted"
      break;
  }
}
```

**Agent Loop 不需要关心底层是哪个模型。** 不管 model 是 Claude、GPT 还是 Gemini，`streamSimple` 返回的都是同一种事件流。

### 场景二：接入一个新模型

需要自己按照provider封装的三层架构来编写，最核心的工作就是如何写一个设配的翻译器。

1、写一个翻译器（对应第三层）

翻译器的本质就是一个符合 `StreamFunction` 签名的函数。你要做的是：

- 把 Pi 的统一消息格式，翻译成你的模型的 API 格式（请求方向）

- 把你的模型返回的流式响应，翻译成 Pi 的 12 种统一事件（响应方向）

- 出了异常不要 throw，而是 push 一个 `error` 事件

这一步是工作量最大的——你需要读你的模型的 API 文档，搞清楚它的消息格式、流式协议、错误码。

2、注册翻译器（对应第一层）



```Python
registerApiProvider({
  api: "your-model-api",           // 给你的翻译器起个名字
  stream: yourStreamFunction,       // 你写的翻译器
  streamSimple: yourSimpleFunction, // 便捷版本
});
```

这一步就是往哈希表里加一条记录。系统启动后，第一层的 `resolveApiProvider()` 就能查到你的翻译器。

3、配置模型信息

```C++
const yourModel: Model = {
  id: "your-model-id",
  api: "your-model-api",     // ← 指向第 2 步注册的名字
  provider: "your-provider",
  baseUrl: "https://api.your-model.com",
  // ... 其他元数据（上下文窗口大小、是否支持思考等）
};
```

这一步告诉系统”有这样一个模型存在”。`api: "your-model-api"`字段指向第 2 步注册的名字，第一层就是靠这个字段查表路由的。

---

## 三、翻译器内部：SSE 解析与思考模式

---

### 1、流式传输

模型回复是流式的，但不同模式如何流式输出是不同的：

- **OpenAI** 的 SDK 封装得很好。你调用 `client.chat.completions.create()`，它直接返回一个结构化的 chunk 流。每个 chunk 里的 `choices[0].delta` 就是解析好的数据，拿来就能用。

- **Anthropic** 返回的是原始的 SSE（Server-Sent Events）文本流。需要自己逐行读 `event:` 和 `data:` 字段，自己做 JSON 解析（还包含容错处理——有些 chunk 的 JSON 可能不完整）。

为什么不用统一 SDK？ 因为不是所有 Provider 都有成熟的 SDK。有些 SDK 不支持流式，有些不支持自定义事件。Pi 的策略是——有 SDK 就用（OpenAI、Google），没 SDK 就自己解析（Anthropic）。但不管内部怎么实现，最终都翻译成统一的 12 种事件。

### 2、思考模式

不同 Provider 对”让模型深度思考”这件事，概念和参数完全不同：

```Go
// Anthropic：给一个 token 预算，让模型在这个预算内思考
params.thinking = { type: "enabled", budget_tokens: 16384 };

// OpenAI：给一个努力程度（low/medium/high）
params.reasoning_effort = "high";

// Google：用 thinkingConfig 配置
config.thinkingConfig = { includeThoughts: true, thinkingLevel: "high" };
```

Pi 定义了一套统一的思考级别枚举：

![Image](assets/images/e091a17d91/image-25.png)

---

## 四、缓存控制与错误处理

---

### 1、缓存控制：让模型”算更少”

Agent 对话是”有状态的”——每轮都把之前的完整历史发给模型。如果你和 Agent 聊了 50 轮，每轮都重新计算前 49 轮的内容。缓存就是告诉模型服务器：“这些内容没变，别重新算了。”

但”怎么标记”各 Provider 不同：Anthropic 在消息块上追加 `cache_control` 标记，Bedrock 插入独立的 `cachePoint` 节点。

Pi 把缓存控制抽象成三个语义级别：

```Python
type CacheRetention = "none" | "short" | "long";
```

这里有个值得停下来想一下的对比：同样是”告诉服务器这段内容不变”，四家给出了**四种完全不同的协议设计**——

- **Anthropic 的做法像”贴便签”**：在原有的内容块上附加一个 `cache_control` 字段。内容还是那些内容，只是多了一个”这段不变”的标签

- **Bedrock 的做法像”插路标”**：在消息流的特定位置插入一个**独立的、不含业务数据**的 cachePoint 对象。它不依附在任何内容上，自己就是一个占位

- **OpenAI 原生的做法像”按会员卡号查记录”**：你压根不打标记，只是每次请求带一个 `prompt_cache_key`（Pi 用 sessionId 当 key），OpenAI 后端自己识别前缀重合度

- **OpenAI 兼容厂商的做法最朴素**：直接抄 Anthropic 的便签协议（`cacheControlFormat: "anthropic"`），所以 Pi 用同一套 `applyAnthropicCacheControl` 函数处理它们

我们讨论过”Pi 为什么每圈重建 llmContext 但不会破坏 cache”——答案就在这张表里。`cacheRetention` 一旦设定，整个 Trace 内每圈都用同样的策略打同样的标记（system/tools 内容不变，user message 是 rolling）。Anthropic 后端按内容字节做 prefix 匹配，命中就是命中，跟”你是第几圈调用”无关。

**为什么 Anthropic 选三个特定位置打点？** 不是随便选的——`system + tools` 是整条 Trace 内最稳定的前缀，`最后一条 user message` 是 rolling 的”截止线”。Anthropic 规定每个请求最多 4 个 cache breakpoint，这三个位置覆盖了”完全不变 + 最近滚动”两段，是收益最大化又不超限额的最优解。

缓存的经济价值很高：缓存命中的 token 按缓存读取价计费，通常是正常输入价的 1/10。一个 200K token 的对话历史，缓存后能省约 90% 的输入成本。

### 2、错误处理：编码到流里，不打断循环

所有翻译器的错误处理都遵循同一个模式：

```Go
try {
  // ... 正常流程：构建请求、发送、解析响应
  stream.push({ type: "done", reason: output.stopReason, message: output });
} catch (error) {
  // 错误不抛出，而是编码到流中
  output.stopReason = options?.signal?.aborted ? "aborted" : "error";
  output.errorMessage = error.message;
  stream.push({ type: "error", reason: output.stopReason, error: output });
}
```

**这就是第 3 章说的 ****`stopReason: "error"`**** 和 ****`"aborted"`**** 的注入点。** 模型 API 本身不会返回这两个值——它们是翻译器的 catch 块在异常时设置的。可能是网络超时、可能是 API Key 过期、可能是用户主动取消。不管什么原因，异常都被包装成事件，Agent Loop 收到后可以重试、降级、或报告给用户，循环不停。

还有一个隐蔽的问题：**上下文溢出**。有时候请求没报错，但模型返回空输出——因为输入 token 太多被服务端静默截断了。Pi 有一个 `isContextOverflow()` 函数做三重检测（错误消息模式匹配、token 数对比、输出为零+length停止），把不同 Provider 的各种溢出表现统一捕获。



## 五、设计经验

1. **“协议 > 实现”设计法。** Pi 没有设计一个 `BaseProvider` 抽象类让所有翻译器继承，而是定义了一套事件协议（12 种事件）和一个函数签名（`StreamFunction`）。因为翻译器之间几乎没有共同点——继承需要找共同代码，但 Anthropic 和 Google 在”发消息”这件事上连字段名都不一样。协议只约定”输入什么、输出什么”，不管中间怎么处理。

2. **“统一枚举 + 映射表”策略。** ThinkingLevel 是统一枚举（5 级），ThinkingLevelMap 让每个 Model 自带翻译表。上层说 `"high"`，底层自己查表。比”取所有 Provider 的交集”灵活，也比”暴露各 Provider 的原生参数”简洁（上层不需要知道 20 种参数名）。

3. **“语义统一，实现分散”。** `cacheRetention`（none/short/long）是语义接口——上层说”我要长期缓存”，不管底层是打标记还是插节点。语义接口描述”做什么”，机制接口描述”怎么做”。



# 第五章：工具系统 —— Agent 的手脚是怎么被管住的

在agent loop调用工具时，比如调用read工具，模型的回复会出现这样一条指令：

```JSON
{ "type": "toolCall", "id": "call_abc123", "name": "read", "arguments": { "path": "src/main.ts" } }
```

从这条指令到文件内容回到模型面前，中间经历了什么？Pi 用一条**五步管道**来解决这些问题：参数预处理 → Schema 验证 → 权限拦截 → 工具执行 → 结果后处理。

但在讲管道之前，得先搞清楚一个更基础的问题：Pi 的**工具到底是怎么定义的？**

## 一、三层类型：为什么”一个工具”要分三层来定义？

### 第一层：Tool——一张”名片”

打开 `packages/ai/src/types.ts`，有工具的最底层定义：

```TypeScript
// packages/ai/src/types.ts:433-437
export interface Tool<TParameters extends TSchema = TSchema> {
    name: string;            // 工具名，如 "read"、"bash"
    description: string;     // 给 LLM 看的工具描述
    parameters: TParameters; // 参数的 JSON Schema（用 TypeBox 定义）
}
```

这个接口在 `pi-ai` 层。它唯一关心的事情是：**怎么把工具的信息告诉模型。** 

在这个层面，工具只是**一张名片**。能描述自己，但不能执行任何操作。

### 第二层：AgentTool——加上了”执行能力”

Agent Loop 要执行工具调用，光有名片不够。它需要知道**怎么执行**这个工具、这个工具**能不能并行执行**、参数格式要不要**预处理**。

于是 `pi-agent-core` 层在 Tool 基础上扩展了 `AgentTool`：

```TypeScript
// packages/agent/src/types.ts:371-394
export interface AgentTool<TParameters, TDetails>
    extends Tool<TParameters>          // 继承 Tool 的三个字段
{
    label: string;                     // 给人看的标签（不同于给 LLM 的 description）
    prepareArguments?: (args: unknown) => Static<TParameters>;  // 兼容性垫片
    execute: (                         // 执行函数
        toolCallId: string,
        params: Static<TParameters>,
        signal?: AbortSignal,
        onUpdate?: AgentToolUpdateCallback<TDetails>,
    ) => Promise<AgentToolResult<TDetails>>;
    executionMode?: "sequential" | "parallel";  // 执行模式
}
```

从 Tool 到 AgentTool，新增了 4 个字段。每个都有明确用途：

- **`label`**：模型看到的是 `name`（“read”），UI 看到的是 `label`（“读取文件”）

- **`prepareArguments`**：兼容层，处理不同模型输出的参数

- **`execute`**：真正干活的函数——模型说”读文件”，这个函数去读

- **`executionMode`**：标记这个工具能否和其他工具并行执行

### 第三层：ToolDefinition——产品层再加东西

到了 `pi-coding-agent` 层（产品运行层），工具还需要更多能力：自定义渲染（read 工具在终端里怎么显示？edit 工具怎么展示 diff？）、提示词注入（有些工具需要在系统提示词里加一段使用指南）。

于是出现了第三层 `ToolDefinition`。它的 `execute` 函数比 `AgentTool` 多了一个参数——`ctx: ExtensionContext`，让工具执行时可以访问当前会话状态：

```Python
AgentTool.execute:     (toolCallId, params, signal, onUpdate) => ...
ToolDefinition.execute: (toolCallId, params, signal, onUpdate, ctx) => ...
                                                                   ^^^
                                                    多了 ExtensionContext（会话上下文）
```

Agent Loop 只认识 `AgentTool`，但产品层的工具都是 `ToolDefinition`。谁来把 ToolDefinition 变成 AgentTool？

只需要一个包装器函数 `wrapToolDefinition`：

```JavaScript
// packages/coding-agent/src/core/tools/tool-definition-wrapper.ts
export function wrapToolDefinition(definition, ctxFactory?) {
    return {
        name: definition.name,
        label: definition.label,
        description: definition.description,
        parameters: definition.parameters,
        prepareArguments: definition.prepareArguments,
        executionMode: definition.executionMode,
        // 关键：重写 execute，通过闭包注入 ExtensionContext
        execute: (toolCallId, params, signal, onUpdate) =>
            definition.execute(toolCallId, params, signal, onUpdate, ctxFactory?.()),
    };
}
```

包装器通过闭包捕获了 `ctxFactory`，在调用时动态创建 `ExtensionContext` 并注入第 5 个参数。**Agent Loop 执行时候是****`execute`****，永远不知道 ExtensionContext 的存在。**

## 二、五步管道：工具调用的实际流程

![Image](assets/images/e091a17d91/image-26.png)

最简单的处理方式：找到 read 工具 → 读文件 → 把内容塞进 ToolResultMessage → 结束。这样的思路其实很直观

但模型的输出并不总是规规矩矩的：

- **参数格式不对**：Edit 工具期望 `edits` 是一个数组，但某些模型会把数组序列化成字符串 `"[{...}]"` 传过来

- **参数类型错误**：Read 工具的 `path` 参数是 string，但模型可能传个数字 `12345`

- **危险操作**：模型要求执行 `rm -rf /`，你的 Agent 真的去执行吗？

这些问题意味着”直接调函数”是不够的。你需要在执行前加几道关卡。

### 第 1 步：prepareArguments——兼容性垫片

不同模型的 API 在序列化工具参数时有微妙的差异。`prepareArguments` 就是为这些差异准备的兼容层。

比如 Edit 工具期望 `edits` 是数组：

```SQL
// 模型实际传来的（某些模型把 JSON 数组序列化成了字符串）
{ edits: "[{\"oldText\":\"hello\",\"newText\":\"world\"}]" }

// 经过 prepareArguments 处理后
{ edits: [{ oldText: "hello", newText: "world" }] }
```

### 第 2 步：validateToolArguments——Schema 验证

经过预处理后，参数还要过一道 TypeBox 的运行时类型检查。比如 `path` 定义为 string，但模型传了 number：

验证错误会被 `prepareToolCall` 的 try-catch 捕获，生成一个错误 ToolResultMessage。**工具永远不会收到类型错误的参数。**

### 第 3 步：beforeToolCall——前置钩子（可阻止执行）

参数验证通过后，在执行之前，产品层还有一次拦截机会。`beforeToolCall` 是一个回调函数，可以检查命令是否危险：

即使工具被阻止，结果仍然是一条正常的 `ToolResultMessage`，只是 `isError: true`。模型会看到这条错误消息，知道命令被拒绝了，然后决定下一步怎么做（换一个命令，或者跟用户解释为什么不能执行）。**整个过程不会抛异常，不会打断循环。**

### 第 4 步：tool.execute——实际执行

前 3 步都通过后，工具的 `execute` 函数被真正调用。回头看一下它的签名：

```Python
execute: (toolCallId, params, signal, onUpdate) => Promise<AgentToolResult>
```

四个参数——`toolCallId` 是这次调用的 ID，`params` 是验证过的参数，`signal` 是用于取消的 AbortSignal（用户按 Ctrl+C 时触发）。第四个 `onUpdate` 解决的是长任务的进度感知问题。

具体来说，onUpdata参数让工具能向用户实时汇报进度。假设 Bash 工具要跑一个 30 秒的命令——如果只有”开始执行”和”执行完成”两个时刻能向外界报告，用户在这 30 秒里只能盯着加载动画。`onUpdate` 让工具能**边执行边向外推消息**：Bash 工具每 100ms 推送一次当前的终端输出，Grep 工具每找到一批匹配就推送一次，Read 工具读取大文件时可以分段报告进度。这些推送被包装成 `tool_execution_update` 事件，最终流向 UI。

但有个问题需要处理。工具的 `execute` 是异步函数，它 `return` 之后，内部可能还有没结束的异步操作——比如 Bash 工具的子进程在主命令返回后还在异步打印最后几行日志。如果这些延迟回调还往 `onUpdate` 推数据，就会污染一个**已经结束**的工具调用，让 UI 上下文错乱。Pi 用一个 `acceptingUpdates` 标志位解决：`execute` 一旦返回（或抛异常），立即把标志位关掉，之后所有 `onUpdate` 调用一律静默丢弃。这是工程上的防御性细节，不复杂，但必须要有。

### 第 5 步：afterToolCall——后置钩子（可修改结果）

工具执行完毕后，产品层还有一次修改结果的机会。`afterToolCall` 可以做这些事情：

### 管道的终点：ToolResultMessage

五步走完，不管中间出了什么状况，最终产物都是一条 `ToolResultMessage`：

```YAML
{
    role: "toolResult",
    toolCallId: "call_abc123",      // 关联到原始 ToolCall
    toolName: "read",
    content: [{ type: "text", text: "1│ import { Agent }..." }],
    details: { language: "typescript" },  // 给 UI 的元数据
    isError: false,                  // 是否为错误结果
    timestamp: 1700000000000,
}
```

这条消息会被追加到对话历史中，在下一轮循环里作为上下文发给模型。

所有错误最终都变成了同一种东西：一条 `isError: true` 的 ToolResultMessage。 模型看到错误消息，知道出错了，然后自己决定怎么处理。

## 三、工具调用的串行与并行

![Image](assets/images/e091a17d91/image-27.png)

Agent Loop 的内层循环中，模型的一次回复可能包含多个 ToolCall：

```Python
assistantMessage.content = [
    { type: "text", text: "我来查一下文件" },
    { type: "toolCall", id: "call_1", name: "read", arguments: {path: "a.ts"} },
    { type: "toolCall", id: "call_2", name: "grep", arguments: {pattern: "TODO"} },
    { type: "toolCall", id: "call_3", name: "find", arguments: {pattern: "*.test.ts"} },
]
```

三个 ToolCall，都是只读操作，直觉告诉我们应该并行执行，但是如果三个 ToolCall 中有两个是 edit（修改同一个文件），并行执行就会互相覆盖。因此 Pi 需要一种机制来判断”哪些工具能并行，哪些必须串行”。

Pi 的策略很简单——**只要有一个工具标记为 sequential，整个批次都串行执行**：

```JavaScript
// 检查是否有串行工具
const hasSequentialToolCall = toolCalls.some(
    (tc) => tools?.find((t) => t.name === tc.name)?.executionMode === "sequential",
);

// 有串行工具 → 整批串行；没有 → 并行
if (config.toolExecution === "sequential" || hasSequentialToolCall) {
    return executeToolCallsSequential(...);
}
return executeToolCallsParallel(...);
```

为什么不是只串行冲突的工具，而是将整个批次的工具都串行呢？因为”哪些工具会冲突”很难精确判断，Pi 选择了更保守的策略：**宁可多等，不可出错。**

## 四、永不抛出：工具出错也是一条消息

回看整个五步管道，工具调用的每一步都可能出错。但你会发现一个惊人的规律：不管哪一步出错，最终产物都是同一种东西——一条 `isError: true` 的 ToolResultMessage。

其中最关键的一层在 `executePreparedToolCall()`——它包住了 `tool.execute()` 这个最容易出错的环节：

```JavaScript
// packages/agent/src/agent-loop.ts:628-669
async function executePreparedToolCall(prepared, signal, emit) {
    const updateEvents: Promise<void>[] = [];
    let acceptingUpdates = true;          // 工具 Promise settle 后关闭

    try {
        const result = await prepared.tool.execute(
            prepared.toolCall.id,
            prepared.args,
            signal,
            (partialResult) => {
                if (!acceptingUpdates) return;     // settle 后的孤儿回调直接忽略
                updateEvents.push(/* ... 发 tool_execution_update ... */);
            },
        );
        acceptingUpdates = false;
        await Promise.all(updateEvents);
        return { result, isError: false };

    } catch (error) {
        acceptingUpdates = false;
        // 关键：先等所有进度事件发完，再把异常编码成消息
        await Promise.all(updateEvents);
        return {
            result: createErrorToolResult(
                error instanceof Error ? error.message : String(error)
            ),
            isError: true,
        };
    } finally {
        acceptingUpdates = false;          // 兜底：无论如何都关闭闸门
    }
}
```

这段代码做了三件事，每一件都对应一个工程上的关键决策：

- 异常被 catch，不穿透。`tool.execute()` 抛什么异常都会被这里的 catch 接住。

- 异常被”翻译”成正常结果。catch 块里调用 `createErrorToolResult(error.message)`，把异常对象转成一个 `AgentToolResult`，只是 `content` 里装的是错误描述文本。从这一刻起，它就不再是”异常”，而是”一条带错误标记的消息”。

- 进度事件先发完，再编码错误。catch 块里的 `await Promise.all(updateEvents)` 保证工具执行过程中已经发出的 `tool_execution_update` 事件全部送达后，才发出错消息，避免乱序。

异常和消息的区别不在于”内容是什么”，而在于**接收者是谁**。异常的接收者是调用栈（外层框架），它会打断循环；消息的接收者是模型，它会消化错误然后继续。Pi 选择了把异常翻译成消息，让”工具出错”成为模型可见的、可处理的正常信息流。



异常抛出去给外层统一处理不也行吗？为什么要费劲翻译成一条”长得像正常结果”的消息？

答案的核心是：**让模型自己决定下一步，比框架替它决定更好。**

在不同场景下，**正确的下一步动作都不同，而且只有模型有足够的上下文判断该走哪条路**。框架不知道”文件不存在”是因为路径写错了还是因为应该换个文件；模型知道——它知道自己刚才想干什么，知道项目的文件结构（前面的 read/grep 结果都在对话历史里），知道用户的真实意图。

如果框架直接抛异常打断循环，等于放弃了模型的所有自我纠错能力——用户只能在 Agent 崩溃后手动重启。但如果把错误编码成消息发给模型，模型就有机会**自己决策出补救方案**。这是 Agent 比传统脚本程序更”智能”的关键之一：错误不会终止流程，而是成为下一步决策的输入。

**所以，Pi 的工具错误处理哲学可以总结成一句：错误信息是给模型的反馈，不是给框架的终止信号。**

而且错误描述越具体，模型纠错能力越强

在Pi源码的工具内部把错误描述写得很具体：

**Read 工具**（`read.ts:275`）——越界时附上文件总行数：

```Python
if (startLine >= allLines.length) {
    throw new Error(`Offset ${offset} is beyond end of file (${allLines.length} lines total)`);
}
```

**Edit 工具**（`edit.ts:330`）——附上文件路径和原始错误：

```Python
throw new Error(`Could not edit file: ${path}. ${errorMessage}.`);
```

**Bash 工具**（`bash.ts:390-407`）——这段是教科书级别的”主动识别 + 重新包装”：

```JavaScript
} catch (err) {
    const snapshot = await finishOutput();              // 先把已经输出的内容固定下来
    const { text } = formatOutput(snapshot, "");
    if (err instanceof Error && err.message === "aborted") {
        throw new Error(appendStatus(text, "Command aborted"));
        //                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
        //                  重新包装：附上"中止前的输出" + "中止状态"
    }
    if (err instanceof Error && err.message.startsWith("timeout:")) {
        const timeoutSecs = err.message.split(":")[1];
        throw new Error(appendStatus(text, `Command timed out after ${timeoutSecs} seconds`));
    }
    if (exitCode !== 0 && exitCode !== null) {
        throw new Error(appendStatus(outputText, `Command exited with code ${exitCode}`));
    }
    throw err;    // ← 关键：识别不了的异常，原样抛出，交给框架兜底
}
```

注意 Bash 的策略——它**主动识别**已知的错误类型（中止、超时、非零退出码），每种都用 `appendStatus(text, ...)` 把”已经输出的内容”和”具体原因”打包成新的 Error。只有遇到实在识别不了的异常，才 `throw err` 原样抛出。

![Image](assets/images/e091a17d91/image-28.png)

借鉴 Bash 工具的写法，自定义工具的 `execute` 应该长这样：

```JavaScript
execute: async (id, params, signal, onUpdate) => {
    try {
        // ... 业务逻辑
        return { content: [...], details: {...} };
    } catch (err) {
        // 第 1 步：识别已知错误类型，重新包装成具体描述
        if (err instanceof MyKnownErrorA) {
            throw new Error(`具体的描述A：${err.message}。建议的修复方法...`);
        }
        if (err instanceof MyKnownErrorB) {
            throw new Error(`具体的描述B：${err.message}。可能的原因...`);
        }
        // 第 2 步：实在识别不了的异常，原样抛出，让框架兜底
        throw err;
    }
}
```

一句话总结：

工具执行出错时，Pi 不抛异常打断循环，而是把错误编码成一条 `isError: true` 的 ToolResultMessage 发给模型。这里的关键是**两层分工**：工具内部尽量识别已知错误，包装成”为什么错、怎么改”的具体描述（参考 Bash 工具的 try-catch）；框架兜底层只在工具没识别出来时接管，把 `error.message` 原样透传给模型。模型拿到具体的错误信息后，自己决定下一步——重试、换路径、向用户解释。这就是为什么 Pi 的 Agent Loop 能在工具频繁失败的真实场景下保持稳定运行。

## 五、方法论提炼

回顾整个工具系统，有四个设计模式值得在自己的 Agent 项目中复用：

- **分层接口递进法**：基础层只管”能描述”（Tool），运行时层加”能执行”（AgentTool），产品层加”能展示和扩展”（ToolDefinition）。通过包装器桥接层间差异。

- **管道+钩子模式**：核心流程是一条管道（prepare → validate → execute），管道前后各有一个钩子（before/after），可以拦截或修改。管道内的每一步出错都不抛异常，统一编码为正常消息回传给model。

- **错误即消息原则**：工具执行的每一步出错，都统一编码成一条 `isError: true` 的 ToolResultMessage 发给模型。模型自己根据错误信息决定下一步。即便未知异常也用 `String(error)` 兜底成消息，绝不让原始异常穿透打断 Agent Loop。

- **Operations 抽象法**：工具不直接调用系统 API，而是通过最小化的 Operations 接口间接调用。测试可以 Mock，远程可以 SSH，不改工具代码。

回到开场的问题：“当模型说’读取这个文件’，到底发生了什么？”

现在你有完整答案了：

![Image](assets/images/e091a17d91/image-29.png)



工具不是简单的函数调用，而是一条受控管道。参数验证挡住垃圾数据，钩子拦截住危险操作，Operations 抽象让同一份代码既能本地跑也能远程跑。所有工具错误——从参数验证失败到 execute 抛出的未知异常——都被翻译成一条 `isError: true` 的 ToolResultMessage 发给模型，让模型自己决定下一步，循环永远不会因为工具出错而崩。

---

# 第六章：消息系统 —— Agent 的记忆如何组织与传递

---

消息到底是什么？它的数据结构长什么样？Agent 内部的消息和发给模型的消息一样吗？

这一章讲 Pi 消息系统最核心的设计——**两层消息**：Agent 内部用丰富的格式自由表达，到了 LLM 边界翻译回严格的标准格式。

你在 Pi 的终端里输入了一条 Bash 命令 `!ls -la`，回车执行。命令跑完了，输出了一堆文件列表。

这条命令的信息，在 Pi 内部会变成一条 **BashExecutionMessage**——它有 `command` 字段记录命令原文、`output` 字段记录输出内容、`exitCode` 字段记录退出码。这些结构化字段让 UI 可以用专用渲染器漂亮地展示终端输出。

但是当 Agent Loop 准备调用 LLM 时，LLM 的 API 根本不认识 `BashExecutionMessage`。它只认识三种消息格式：`user`（用户说的）、`assistant`（AI 回的）、`toolResult`（工具返回的）。BashExecutionMessage 不属于这三种中的任何一种。

那这条消息是怎么被 LLM 看到的？中间经历了什么变化？我们将追踪`BashExecutionMessage`从诞生到LLM 看到他。

## 第一层：LLM 认识的消息只有三种

LLM 能理解的消息格式，在 Pi 里叫做 **Message** 类型，定义在最底层的 `packages/ai/src/types.ts` 里。

它只有三个成员：

```Python
Message 联合类型（LLM 标准格式）
│
├── UserMessage        ← 用户说的话 / 发的图片
├── AssistantMessage   ← LLM 的回复（含思考、工具调用）
└── ToolResultMessage  ← 工具执行后的结果
```

- **UserMessage**

用户输入：

```Python
{
    role: "user",
    content: string | (TextContent | ImageContent)[],  // 纯文本或内容块数组
    timestamp: number                                    // Unix 毫秒时间戳
}
```

content 可以是一个纯字符串，也可以是一个内容块数组。这意味着用户消息既能发文字，也能发图片。

- **AssistantMessage**

LLM 的回复：

```TypeScript
{
    role: "assistant",
    content: (TextContent | ThinkingContent | ToolCall)[],  // 三种内容块
    api: Api,                   // 使用的 API 类型（如 "anthropic-messages"）
    provider: ProviderId,       // 提供商（如 "anthropic"）
    model: string,              // 模型名（如 "claude-sonnet-4-6"）
    usage: Usage,               // token 用量统计
    stopReason: StopReason,     // 停止原因（第3章讲过的5种值）
    errorMessage?: string,      // 错误信息
    timestamp: number
}
```

这里最值得关注的是 content 字段——它不是字符串，而是一个**内容块数组**，可以包含三种东西：

```Python
AssistantMessage 的 content 内容块
│
├── TextContent       ← 普通文本
│     { type: "text", text: "..." }
│
├── ThinkingContent   ← 思考过程（第3章讲过，模型"在想"但不直接告诉用户的部分）
│     { type: "thinking", thinking: "..." }
│
└── ToolCall          ← 工具调用（第5章讲过，触发五步管道的入口）
      { type: "toolCall", id: "...", name: "read", arguments: { path: "..." } }
```

- **ToolResultMessage**

五步管道工具执行的结果：

```TypeScript
{
    role: "toolResult",
    toolCallId: string,                             // 对应哪个 ToolCall
    toolName: string,                               // 工具名
    content: (TextContent | ImageContent)[],        // 结果内容
    details?: TDetails,                             // 结构化详情（给 UI 看的）
    isError: boolean,                               // 是否执行失败（第5章的"永不抛出"产物）
    timestamp: number
}
```

ToolResultMessage 通过 `toolCallId` 字段和 AssistantMessage 里的 ToolCall 对应起来。第 3 章提到的”工具结果必须精准关联回调用请求”就是靠这个字段。`details` 字段携带结构化信息给 UI 渲染用，LLM 通常不需要看这个字段。

把这三种消息串起来，一个典型的对话片段长这样：



![Image](assets/images/e091a17d91/image-30.png)

执行了 `!ls -la`，Pi 内部需要记录这次执行的信息后，这里其实藏着一个更普遍的问题：**Agent 内部除了”LLM 对话”这件事，还有大量功能性数据要管理**——Bash 命令的执行记录、上下文被压缩后的摘要、Git 分支切换的记录、用户上传的附件元信息……

**Pi 的解法是：允许应用自定义消息类型。** `pi-agent-core` 在 AgentMessage 联合类型里预留了一个扩展点（叫 `CustomAgentMessages`，下一节会展开它的实现原理），应用通过 TypeScript 的声明合并往里加自己的消息类型。每个应用只注册自己需要的——核心包零依赖，应用层全栈类型安全。

以 pi 自带的 coding-agent 为例，它在 [packages/coding-agent/src/core/messages.ts](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/messages.ts) 里定义了 4 种自定义消息：

```Python
coding-agent 的自定义消息类型
│
├── BashExecutionMessage       ← Bash 命令执行记录
├── CustomMessage              ← 扩展注入的通用消息
├── BranchSummaryMessage       ← 分支切换时的摘要
└── CompactionSummaryMessage   ← 上下文压缩后的摘要
```

每种都有自己的结构化字段。以 BashExecutionMessage 为例：

```TypeScript
{
    role: "bashExecution",
    command: string,          // 命令原文："ls -la"
    output: string,           // 输出内容："file1.txt\nfile2.txt\n..."
    exitCode: number | undefined,  // 退出码：0
    cancelled: boolean,       // 是否被取消
    truncated: boolean,       // 输出是否被截断
    fullOutputPath?: string,  // 截断时的完整输出文件路径
    timestamp: number,
    excludeFromContext?: boolean  // 是否排除在 LLM 上下文之外
}
```

**自定义消息不只是”翻译给 LLM 用的中间格式”那么简单，它本身带来了三个独立的能力**：

- **UI 专用渲染**。UI 根据 `role` 字段做分派——`bashExecution` 用终端样式渲染、`compactionSummary` 用摘要卡片渲染，命令、输出、退出码各占一行，互不干扰。如果没有自定义消息，UI 只能拿到一段扁平文本，所有渲染花样都得退回到”全是大段文字”。

- **持久化恢复**。session 文件存的是完整的结构化数据。下次启动 Agent 时，UI 能精确还原上次的渲染状态——退出码仍然有颜色、命令仍然高亮、截断标识仍然在。如果只存翻译后的扁平文本，这些信息重启后就永久丢失了。

- **精细化可见性控制**。因为自定义消息有自己的 `role`，可以在 `convertToLlm` 翻译时做特殊处理——比如给它加一个 `excludeFromContext = true` 字段，LLM 就完全看不到这条消息，但 UI 照常渲染。**标准消息做不到这一点**——一旦进了 `messages` 数组，convertToLlm 就一定会翻译它发给 LLM，没有”对 UI 可见但对 LLM 不可见”的余地。

但这里有个根本性的问题：**Message 联合类型是封闭的——只有 UserMessage、AssistantMessage、ToolResultMessage 三种。** 这 4 种自定义消息不属于 Message 类型。那它们怎么被 Agent 系统接受并处理的？

## 第二层：AgentMessage —— 内富外严的双层设计

Pi 消息系统采用内层丰富、外层严格的两层设计。

![Image](assets/images/e091a17d91/image-31.png)

`CustomAgentMessages` 这个接口：

```Python
export interface CustomAgentMessages {
    // Empty by default - apps extend via declaration merging
    // 默认为空 - 应用通过声明合并扩展
}
```

注意：**这个接口在核心包（pi-agent-core）里是空的。** 核心包完全不知道有什么 BashExecutionMessage、CompactionSummaryMessage 这些东西。它只提供了一个”插槽”，让应用层往里插。

应用层怎么”插”？靠 TypeScript 的**声明合并**（Declaration Merging）。coding-agent 通过 `declare module` 语法把自己的 4 种消息类型”注入”进去：

```Python
declare module "@earendil-works/pi-agent-core" {
    interface CustomAgentMessages {
        bashExecution: BashExecutionMessage;
        custom: CustomMessage;
        branchSummary: BranchSummaryMessage;
        compactionSummary: CompactionSummaryMessage;
    }
}
```

这段代码的效果是：**编译器自动把这 4 种类型加入 AgentMessage 联合类型。** 以后在 coding-agent 项目里，`AgentMessage` 就变成了 7 种消息的联合（3 种标准 + 4 种自定义），TypeScript 会帮你做完整的类型检查。

**为什么不直接用继承或者泛型？** 因为继承需要修改基类——你改不了 `pi-agent-core` 包。泛型需要到处传参数——每个用到 `AgentMessage` 的函数签名都要加泛型参数。声明合并的好处是：**核心包完全不知道扩展的存在（零依赖），扩展包却能获得完整的类型安全。**



## convertToLlm —— 一切自定义消息终将变成 UserMessage

**在调用 LLM 之前的最后一刻需要做一次翻译。** 这个翻译器就是 `convertToLlm` 函数。

![Image](assets/images/e091a17d91/image-32.png)

`convertToLlm` 核心逻辑是一个 switch 语句，按 `role` 字段分派处理：

transformContext 和 convertToLlm 是分开的。

![Image](assets/images/e091a17d91/image-33.png)

- **transformContext** 处理的是 **AgentMessage 级别的操作**：裁剪太旧的消息、注入外部上下文、触发压缩算法。它处理前后都是 `AgentMessage[]`，类型不变。

- **convertToLlm** 处理的是 **跨类型翻译**：把 AgentMessage 翻译成 Message。处理前是 `AgentMessage[]`，处理后是 `Message[]`，类型变了。

## 过滤机制：有些消息 LLM 不该看

有些情况下，消息应该只给 UI 看、不给 LLM 看。

Pi 的 Bash 工具有个功能：当你用 `!!` 前缀执行命令时（比如 `!!secret_cmd`），这条命令的执行结果对 LLM 不可见。

实现方式非常简单——BashExecutionMessage 有一个 `excludeFromContext` 字段。在 convertToLlm 里，检查这个字段：

```Python
case "bashExecution":
    if (m.excludeFromContext) {
        return undefined;   // 直接返回 undefined，后续被 filter 掉
    }
    // ... 否则正常转换
```

综合以上分析，Pi 的消息系统其实有三种可见性级别：

# 第七章：事件驱动 —— Agent 的神经系统

前六章里，有一个东西反复出现但我们始终没深入——**事件**。

我们始终没回答：事件到底是怎么从 Agent 内部传到外部的？谁在监听？为什么 Agent 发完事件后对一类监听器”等”，对另一类”不等”？

**本章最重要的一句话：Pi 有两套并行的监听机制——****`session.subscribe`****（只读观察，Agent 不等你）和扩展系统的 ****`pi.on`****（能拦截、能改写，Agent 会等你）。** 它们共享同一批事件源，但”Agent 等不等你的 listener”是两者最根本的分水岭。



## 一：事件系统的必要性

Agent 运行过程中不断产生”发生了某事”的快照——消息开始了、消息更新了、工具开始执行了——然后把这些快照推给所有关心它的人。

考虑这样一个场景，假设你要给 Agent 加一个”工具调用日志”功能：每次调工具时打印一行 `[LOG] 调用了 read，参数：main.ts`。

如果不用事件系统，需要改 Agent 源码，在 `tool.execute()` 前后各加一行 `console.log`。然后 Pi 更新了，当 merge 上游代码时发现冲突——你加的日志和上游新增的逻辑撞在一起了。

而如果使用事件系统，则不需要修改agent源码：

```Python
session.subscribe((event) => {
    if (event.type === "tool_execution_end") {
        console.log(`[LOG] 调用了 ${event.toolName}，结果：${event.isError ? "失败" : "成功"}`);
    }
});

```

这就是事件驱动最核心的价值：**把”发生了什么”和”谁关心什么”彻底分离。** Agent 只管发事件，它不知道也不关心谁在听。用编程术语说，事件驱动实现的是**发布-订阅模式**。

而且 Pi 有一个关键特点：**它有两条订阅管道**，而且两条的能力很不一样。

## 二、两条管道的全貌：从事件源到两类监听器

### 2.1 事件源：10 种 AgentEvent

Agent 内核层定义了 10 种 `AgentEvent`。这是两条订阅管道共用的数据源。

![Image](assets/images/e091a17d91/image-34.png)

```YAML
export type AgentEvent =
  // 第1层：Agent 生命周期（整个运行）
  | { type: "agent_start" }
  | { type: "agent_end"; messages: AgentMessage[] }

  // 第2层：Turn 生命周期（一轮模型调用 + 工具执行）
  | { type: "turn_start" }
  | { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }

  // 第3层：Message 生命周期（一条消息）
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
  | { type: "message_end"; message: AgentMessage }

  // 第4层：Tool Execution 生命周期（一次工具执行）
  | { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
  | { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
  | { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };
```

### 2.2 两条管道：subscribe 与扩展 pi.on

#### **管道 A：****`session.subscribe`**

在**外部脚本**里注册监听器（Web 服务器、CLI 工具）。拿到 `session` 对象后调 `session.subscribe(listener)`，事件就会流进 listener。

它的特点是**只能看，不能改**——listener 没有返回值（或者说返回了也被丢弃），Agent 不会因为监听器的接入而改变任何行为。典型用途：流式渲染、打日志、把事件转发给浏览器。

#### **管道 B：扩展系统的 ****`pi.on`**

把代码写进一个**扩展**，在里面调 `pi.on("事件名", handler)`。handler 带返回值，Agent 会读。

它的特点是**能改** Agent 的行为——handler 可以返回 `{ block: true }` 拦掉一次工具调用，可以返回新的消息列表改写给 LLM 的上下文。典型用途：安全策略、审计、注入动态信息。

两条管道最关键的差别不在返回值，而在 Agent 等不等管道返回值：

- 管道 A 的 listener，Agent **不等**。通知完就继续，listener 返回什么 Agent 都不读。源码里这行不带 `await`，而且 `_emit` 本身就是个同步函数：

```Python
this._emit(event);                        // subscribe：同步调用，返回值丢弃
```

然后来看具体的代码：

```JavaScript
// 注册：传入一个 listener，返回一个注销函数
const unsubscribe = session.subscribe((event, signal) => {
    if (event.type === "message_update") {
        process.stdout.write(event.assistantMessageEvent.delta);   // 流式打字
    }
});

// 不用了就调注销函数
unsubscribe();
```

listener 的签名是关键：

```Python
type AgentSessionEventListener = (event: AgentSessionEvent) => void;
//                            注意返回值：void ↑↑↑↑
```

重点是**返回值是 ****`void`**——就算你在 listener 里 `return { block: true }`，Agent 也不读、不用。

agent不等session.subscribe的返回值，所以管道A适合跑那些不打扰agent同时又比较重的活，比如写日志、推 SSE、更新外部状态。除此之外，还需要注意因为不等，async 监听器里的错误不会冒泡到 Agent。

如果你在 async 监听器里 `await` 一个会失败的操作，无法报告给agent错在哪里。所以需要**在 async 监听器里自己 try-catch来捕获异常**。

管道 A 收到的是 `AgentSessionEvent`，它比内核 10 种事件多出几个**事件，这几个事件反映的是**产品层做了某件事（压缩、重试、排队等）。内核根本不知道这些概念，所以它们只出现在产品层。

大致有个印象就行，遇到具体场景再查：

管道 A **收不到**管道 B 独占的 5 个决策点（`input`/`before_agent_start`/`context`/`tool_call`/`tool_result`），当要存的数据来自这五个决策点，只能走管道B。

- 管道 B 的 handler，Agent 会**等它返回**。因为 Agent 要读返回值才能决定下一步。源码里这行带 `await`：

```Python
await this._emitExtensionEvent(event);   // 扩展：等handler返回，Agent 要读 handler 的返回值
```

管道 B 的能力远超管道 A——它能拦截工具、改写上下文、替换系统提示词。这些能力的源头，是 SDK 在关键决策点**停下来等扩展的返回值。总结一下什么时候用管道B：有“干预”类需求，需要改变agent行为的场景**

管道 B 的代码写在**扩展**里——一个接收 `pi` 对象的工厂函数：

```JavaScript
// 一个扩展：框架启动时调它，把遥控器 pi 传进来
function myGuardExtension(pi) {
    // 用 pi.on 盯住"工具调用前"这个事件
    pi.on("tool_call", async (event, ctx) => {
        if (event.toolName === "delete_table") {
            return { block: true, reason: "生产环境禁止删除操作" };   // ← 有返回值，能拦
        }
        return undefined;   // 放行
    });
}
```

挂载通过 `DefaultResourceLoader` 的 `extensionFactories`：

```JavaScript
const loader = new DefaultResourceLoader({
    cwd: process.cwd(),
    agentDir: getAgentDir(),
    extensionFactories: [myGuardExtension],   // ← 你的扩展塞这儿
});
await loader.reload();

const { session } = await createAgentSession({ /* ..., */ resourceLoader: loader });
```

注意两个关键点：

- handler 有返回值（`return { block: true }`）

- handler 多一个 `ctx` 参数——扩展上下文，能力比管道 A 的 `event + signal` 强。

管道 B 的注册实现极简。`pi.on` 做的事就是往一个 Map 里塞 handler：

```Thrift
// loader.ts —— createExtensionAPI 里
on(event: string, handler: HandlerFn): void {
    runtime.assertActive();
    const list = extension.handlers.get(event) ?? [];   // 取出该事件的 handler 列表
    list.push(handler);                                  // 塞进去
    extension.handlers.set(event, list);                 // 放回
},
```

每个扩展对象内部有一个 `handlers: Map<事件名, handler[]>`。`pi.on("tool_call", h)` 就是在 `"tool_call"` 这个 key 下追加 `h`。派发时遍历这个 Map。



`extensionRunner` 有两类派发方法，对应”通知型”和”决策型”事件——但两类都 await handler：

- 路径 1：通知型 `emit()`（runner.ts:796）——处理 `message_update`、`turn_start` 等只读事件：

```JavaScript
async emit(event): Promise<...> {
    const ctx = this.createContext();
    for (const ext of this.extensions) {                  // 遍历扩展
        const handlers = ext.handlers.get(event.type);
        if (!handlers || handlers.length === 0) continue;
        for (const handler of handlers) {
            try {
                await handler(event, ctx);                // ★ await 每个 handler
                // 通知型事件：不读返回值（session_before_* 例外，读 cancel）
            } catch (err) {                               // ★ try-catch 隔离
                this.emitError({ extensionPath: ext.path, event: event.type, error: ... });
            }
        }
    }
}
```

特征：串行 await、try-catch 隔离、忽略返回值。注意即便忽略返回值，仍然 await



- 路径 2：决策型 `emitToolCall()`（runner.ts:927）——处理 `tool_call` 拦截：

```JavaScript
async emitToolCall(event): Promise<ToolCallEventResult | undefined> {
    const ctx = this.createContext();
    let result: ToolCallEventResult | undefined;
    for (const ext of this.extensions) {
        const handlers = ext.handlers.get("tool_call");
        if (!handlers || handlers.length === 0) continue;
        for (const handler of handlers) {
            const handlerResult = await handler(event, ctx);   // ★ await + 读返回值
            if (handlerResult) {
                result = handlerResult;
                if (result.block) {
                    return result;                              // ★ block 立即短路
                }
            }
            // 注意：这里没有 try-catch！这是刻意的 fail-closed 设计——
            // 扩展在 tool_call 里崩了，宁可拦掉工具也不放行（安全优先）
        }
    }
    return result;
}
```

特征：**await + 读返回值 + ****`block`**** 短路 + 无 try-catch**。tool_call 是所有派发方法里唯一不包 try-catch 的——扩展抛错会冒泡，导致这次工具调用被 block



- 路径 3：链式 transform 型——还有一批决策事件走”链式 transform”，每个 handler 接收上一个的输出继续改。

这批方法和 `emitToolCall` 一样 await + 读返回值，但**都包 try-catch**（错误转发 emitError）。



管道B handler 签名 `(event, ctx)` 里的 `ctx` 是 `ExtensionContext`，能力远强于管道 A 的 `event + signal`：

```TypeScript
interface ExtensionContext {
    ui: ExtensionUIContext;                  // select/confirm/input/notify 等 UI 能力
    mode: "tui" | "rpc" | "json" | "print";  // 当前运行模式
    cwd: string;                             // 工作目录
    sessionManager: ReadonlySessionManager;  // ★ 只读！能读历史但不能直接写
    modelRegistry: ModelRegistry;            // 模型注册表
    model: Model<any> | undefined;           // 当前模型
    thinkingLevel: ThinkingLevel | undefined;
    signal: AbortSignal | undefined;         // 中断信号
    abort(): void;                           // 主动中断
    isIdle(): boolean;                       // Agent 是否空闲
    compact(options?): void;                 // 触发上下文压缩
    getSystemPrompt(): string;               // 读系统提示词
    // ... 还有 getContextUsage / hasPendingMessages / shutdown 等
}
```









![Image](assets/images/e091a17d91/image-35.png)

## 三、小结

事件驱动架构的真优势不是”通知机制”（那只是管道 A），而是**开放扩展机制**——尤其是管道 B，它让第三方在不碰内核源码的前提下，能拦截、能改写、能干预。两条管道合起来，才构成 Pi 完整的事件驱动。

Pi 的事件系统有一条核心分叉：**Agent 对扩展等、对 subscribe 不等**。这个差别决定了两条管道的全部行为。

- **管道 A（****`session.subscribe`****）** —— Agent 不等你的监听器，返回值丢弃。所以你只能观察（渲染、日志、转发），改不了 Agent 的行为。它轻量、注册简单，适合在外部脚本里用。async 监听器的错误不会被 Agent 捕获，要自己 try-catch。

- **管道 B（扩展 ****`pi.on`****）** —— Agent 等你的 handler 返回，读返回值。所以你能干预 Agent 的下一步：拦工具、改上下文、换提示词。它还独占 5 个决策点事件（`input`/`before_agent_start`/`context`/`tool_call`/`tool_result`），管道 A 收不到。写法上是把代码塞进扩展、挂到 loader。扩展 handler 的异常多数被框架隔离（单个扩展崩了不连累别人），但 `tool_call` 是例外——它不隔离，扩展出错就拦掉工具（fail-closed：宁可错杀，不放行危险操作）。

判断用哪条管道，只问一句：**你的代码要不要改变 Agent 的行为**——要，写扩展走管道 B（Agent 会等你）；不要，`subscribe` 走管道 A（Agent 不等你）。

---

# 第八章：上下文工程 —— 让有限窗口装下无限对话

---

第 6 章讲消息系统时我们说过：Agent 内部用 7 种 `AgentMessage` 自由表达，但调用 LLM 之前会经过一道 `convertToLlm` 翻译边界，翻译成 3 种标准 `Message`。第 7 章讲事件驱动时又提到：`agent_end` 事件之后会触发”上下文检查”。

这两件事背后其实藏着同一个核心问题——**LLM 的上下文窗口是固定的，但 coding-agent 的对话会无限增长**。

把一个 coding-agent 一次会话的所有”信息源”列出来：

```Plain Text
一次会话送进 LLM 的内容
├── 系统提示词（工具说明、guidelines、pi 文档路径）
├── 项目上下文文件（CLAUDE.md / AGENTS.md，可能多层嵌套）
├── Skills 列表（每个 skill 一段描述）
├── 工具定义（每个工具的 JSON schema）
├── 对话历史（每一轮 user / assistant / toolResult）
│   ├── 用户输入
│   ├── LLM 回复（含 thinking、toolCall）
│   └── 工具结果（read 文件、bash 输出、grep 命中……）
└── 当前轮的新输入
```

LLM 的窗口超了直接报错 `prompt is too long`，对话中断。上下文工程（Context Engineering） 就是应对这个问题的工程 discipline：在内容送入 LLM 之前，多层裁剪、过滤、压缩、组织，让有限的窗口装下”对当前任务最有价值的信息”。

## 一、总览

Pi的上下文工程分布在两个环节：

![Image](assets/images/e091a17d91/image-36.png)

## 二、输入侧 ①：工具输出截断（truncateHead / truncateTail）

最朴素的解法是”按字符数截断”。但这会产生三个新问题：

1. **截断的位置不对**——bash 报错通常在末尾，截尾才是有用的；文件读取通常开头更重要，截头才对

2. **切断多字节字符**——直接按字节切，会把一个 emoji 切成两个无效码元

3. **单行就超限**——比如 `grep` 命中一行 100KB 的压缩 JS，怎么切？

Pi 用一套**双重限制 + 边界安全**的算法解决这三个问题，实现全在 [`truncate.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/truncate.ts)。

Pi 给所有工具输出默认定义了两个上限常量（源码在 `truncate.ts:11-13`）：

- **行数上限**：`DEFAULT_MAX_LINES = 2000`

- **字节上限**：`DEFAULT_MAX_BYTES = 50 * 1024`（50KB）

- **grep 单行长度上限**：`GREP_MAX_LINE_LENGTH = 500`

任何工具输出都按”**最多 2000 行**”或”**最多 50KB**”裁剪，**哪个先触发就用哪个**。

从哪头裁是另一个问题，pi采用双重策略，`truncateHead vs truncateTail`，核心差异只是遍历方向：

![Image](assets/images/e091a17d91/image-37.png)

字节级截断最阴险的 bug 是切坏多字节字符。一个 emoji 😀 在 UTF-8 里是 4 个字节，如果你在第 2 个字节切一刀，剩下两个字节会变成无效字符 `�`。

Pi 用 `truncateStringToBytesFromEnd`（`truncate.ts:295`）解决——**逐字符地累加字节数**，遇到”加这一个字符就超字节预算”就停。代码里专门处理了代理对（surrogate pair）的情况：遇到一个字符是 4 字节 emoji 时，会把它当成不可分割的整体，要么完整保留，要么完全不要。

另外 `replaceUnpairedSurrogates`（**注意**：此函数仅在 `agent` 包 `truncate.ts:82` 存在；`coding-agent` 包的 truncate.ts 简化了实现，直接用 `Buffer.byteLength + slice`，未保留该函数）会处理一种边角情况：输入本身就损坏（含未配对代理），用 `�` 替换掉，避免后续编码炸掉。这些都是字节边界上的”细活”，不显眼但必要。

截断本身是有损的，但 Pi 不会偷偷干。`TruncationResult` 结构（`truncate.ts:15-38`）记录了完整的元信息——是否截断（`truncated`）、被什么限制触发（`truncatedBy: "lines" | "bytes" | null`）、原始行数/字节数（`totalLines` / `totalBytes`）、输出行数/字节数（`outputLines` / `outputBytes`）、最后一行是否部分截断（`lastLinePartial`）等等。

bash 工具据此在输出末尾追加一行提示（`bash.ts:362-374`）：

```Plain Text
[Showing lines 6501-8500 of 8500. Full output: /tmp/pi-bash-xxx.log]
```

这行字**也会进 LLM 上下文**——告诉模型”如果你想看完整输出，去 read 这个文件”。这是截断机制的”逃生通道”：默认截断省 token，需要时 LLM 自己拉完整内容。

> ***流式输出补充****：bash 命令是流式输出的（stdout 一行一行吐，可能持续几分钟）。Pi 有个 *[*`OutputAccumulator`*](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/output-accumulator.ts)* 类负责实时收集、控制内存、把超限内容写到临时文件——但最终截断仍然走上面这套 **`truncateTail`** 算法。流式累积本身是工程实现细节，不属于”上下文工程”的核心机制，这里不展开，需要深挖的读者直接看源码。*
> 
> 

## 三、输入侧 ②：系统提示词动态组装

Pi 的方案在 [`system-prompt.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/system-prompt.ts) 和 [`resource-loader.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/resource-loader.ts) 里——核心是两件事：**多层 CLAUDE.md 递归** + **Skills 懒加载**。

### 多级上下文文件：从当前目录向上递归

Pi 在每个目录下找 `AGENTS.md` 或 `CLAUDE.md`（大小写都试），然后从 `cwd` 向上递归到根目录，**把沿途所有目录的规范文件全部合并**。

![Image](assets/images/e091a17d91/image-38.png)

为什么向上递归？因为现代项目常常是 monorepo 嵌套结构：

```Plain Text
/myorg
├── CLAUDE.md          ← 全组织规范（通用）
└── teams
    └── teamA
        ├── CLAUDE.md  ← 团队 A 规范（细化）
        └── projects
            └── app1
                ├── CLAUDE.md  ← 项目规范（最具体）
                └── src/       ← cwd 在这里
```

在 `src/` 目录启动 Agent，会向上找到 3 个 `CLAUDE.md`，**按”从外到内”的顺序合并**——祖先目录的规范在前面（最通用），项目目录的规范在后面（最具体）。这让 LLM 像读一本分层规范手册，先读总则再读细则。

除了向上递归，还有**全局上下文**——从 `agentDir`（用户主目录下的 `.pi` 配置目录）读取一份。找到了上下文文件，`buildSystemPrompt`（`system-prompt.ts:154-161`）用 XML 标签包装：

```XML
<project_context>

Project-specific instructions and guidelines:

<project_instructions path="/myorg/CLAUDE.md">
全组织规范：所有项目使用 TypeScript strict 模式...
</project_instructions>

<project_instructions path="/myorg/teams/teamA/projects/app1/CLAUDE.md">
本项目使用 pnpm，测试用 vitest...
</project_instructions>

</project_context>
```

为什么用 XML 而不是 Markdown？

1. **XML 边界明确**——`</project_instructions>` 是清晰的结束标记，LLM 不会把规范和外部指令混淆

2. **带 path 属性**——LLM 看到内容来自哪个文件，能区分”组织级规范”和”项目级规范”的优先级

### Skills 懒加载：列表进 prompt，内容按需读

传统上下文工程是”**推**”模式：系统决定给 LLM 看什么，一股脑塞进 system prompt。

Pi 的 Skills 是”**拉**”模式：系统只给一个清单（轻量），LLM 根据当前任务**主动调用 read 工具**拉取需要的 skill 全文。

每个 skill 是一个 `SKILL.md` 文件，可能几千字。如果把所有 skill 全文塞进系统提示词，token 开销巨大且大部分用不上。

Pi 的方案是 `formatSkillsForPrompt`（`skills.ts:335-361`）：

![Image](assets/images/e091a17d91/image-39.png)

最终的system prompt长这样：

```XML
<available_skills>
  <skill>
    <name>test-setup</name>
    <description>How to run tests for this project</description>
    <location>/path/to/skills/test-setup/SKILL.md</location>
  </skill>
</available_skills>
```

把上面所有元素串起来，`buildSystemPrompt` 生成的完整提示词结构是：

![Image](assets/images/e091a17d91/image-40.png)

## 四、历史侧 ③：Compaction

Compaction 是 Pi 的核心压缩算法——**把旧消息变成结构化摘要**，用摘要替代原始消息，腾出空间但保留关键信息。

这部分放在第九章详细讲：

- **触发条件**：`shouldCompact` 用 `contextWindow - reserveTokens` 作为阈值

- **切割点算法**：`findCutPoint` 从后往前累积 token，排除 toolResult

- **结构化摘要**：6 section 模板（Goal / Constraints / Progress / Key Decisions / Next Steps / Critical Context）

- **增量更新**：多次压缩时用 `UPDATE_SUMMARIZATION_PROMPT` 在旧摘要基础上更新

- **文件跟踪**：摘要末尾附加 `<read-files>` 和 `<modified-files>` 列表

- **极端情况**：Turn 分割与 turnPrefix 摘要

## 五、历史侧 ④：分支摘要（Branch Summarization）

Compaction 解决的是”线性对话过长”。但 Pi 还有一个独特特性——**会话树**：用户可以从某个历史节点”分叉”出新对话。

这种结构带来一个新的上下文工程问题：用户切换分支时，旧分支上的探索成果不能丢。

但是又不能直接把整个旧分支接进上下文，因为太占空间了。

Pi 的解法是 [`branch-summarization.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/harness/compaction/branch-summarization.ts)——**给被放弃的分支生成摘要，注入新分支的上下文**。

### LCA 算法：找”分叉点”

第一步是确定”被放弃的分支包含哪些内容”。这需要找两个叶子节点的**最近公共祖先（Lowest Common Ancestor, LCA）**——也就是两个分支开始分叉的那个节点。

`collectEntriesForBranchSummary`（`branch-summarization.ts:67-96`）的逻辑用通俗的话讲就三步：

![Image](assets/images/e091a17d91/image-41.png)

### 摘要生成：复用 Compaction 的工具

收集到 entries 后，`generateBranchSummary`（`branch-summarization.ts:199-261`）用 LLM 生成摘要。它复用了 Compaction 的几件底层工具：

- **`convertToLlm`**——把消息翻译成 LLM 格式

- **`serializeConversation`**——把消息序列化成对话文本

- **`SUMMARIZATION_SYSTEM_PROMPT`**——共享的系统提示词

`BRANCH_SUMMARY_PROMPT`（`branch-summarization.ts:169-196`）和 Compaction 的 `SUMMARIZATION_PROMPT` 高度相似——但只有 **5 section**（Goal / Constraints / Progress / Key Decisions / Next Steps），**没有 Critical Context**（Compaction 才有这一节，所以 Compaction 是 6 section）。差异主要在两点：

- **差异 1：上下文前言不同**

```Python
// 这段前言精准描述了语义——"用户探索了一个不同的分支，然后回到这里"
// LLM 看到这句，知道这不是"主线历史"，而是"另一条线的探索记录"
// 对待方式会更轻量（当作参考，而不是主线）
const BRANCH_SUMMARY_PREAMBLE =
    `The user explored a different conversation branch before returning here.\nSummary of that exploration:\n\n`;
```

- **差异2：maxTokens 更小**

Compaction 的 maxTokens 是 `min(0.8 × reserveTokens, model.maxTokens)`——可能上万 token。但 Branch Summary 的 maxTokens 写死成 `2048`（`branch-summarization.ts:234`）。

### 摘要的注入：成为 BranchSummaryMessage

生成的摘要包上 `BRANCH_SUMMARY_PREAMBLE` 前言和 `<read-files>` / `<modified-files>` 标签，存为 `BranchSummaryMessage`。下次 buildSessionContext 时，它出现在新分支的上下文开头：

```Markdown
The following is a summary of a branch that this conversation came back from:

<summary>
The user explored a different conversation branch before returning here.
Summary of that exploration:

## Goal
Try approach A (PostgreSQL triggers)

## Progress
### Done
- [x] Read schema.ts, identified trigger points

### Blocked
- [x] Performance test showed 3x slowdown — abandoned this approach

## Key Decisions
- **Abandon triggers**: Too slow for high-throughput tables

<read-files>
schema.ts
benchmark/trigger-bench.ts
</read-files>
</summary>
```

## 六、一次工具调用经过的所有上下文处理

![Image](assets/images/e091a17d91/image-42.png)

每一层都是”对 LLM 看到的东西”的一次塑形，每一层都过滤/塑形一部分内容，最后送进 LLM 的才是”对当前任务最有价值的信息”。

---

# 第九章：上下文压缩 —— 当对话太长怎么办

---

agent的上下文窗口是有限资源，如果不采取一些处理办法，上下文窗口满了API 会报错：“prompt is too long”。对话被迫中断。

![Image](assets/images/e091a17d91/image-43.png)

Pi 的解法是**压缩（Compaction）**：把旧消息变成一段结构化摘要，用摘要替代原始消息。这样既腾出了空间，又保留了关键信息。

要先建立一个核心时序的认知——**压缩不是在对话进行中触发的，而是在两轮对话之间发生的**：

![Image](assets/images/e091a17d91/image-44.png)



## 一、压缩的触发机制

压缩不是随便触发的，它有一个明确的判断条件：

```Python
function shouldCompact(contextTokens, contextWindow, settings): boolean {
    if (!settings.enabled) return false;
    return contextTokens > contextWindow - settings.reserveTokens;
}
```

怎么知道当前有多少 token？精确计算需要用 tokenizer，但不同模型的 tokenizer 不同，而且计算开销大。Pi 用了一个简单粗暴的方法：

```JavaScript
// 实际签名（compaction.ts:256-296）：estimateTokens(message: AgentMessage): number
// 对每个 message 取其文本字符数 chars，然后 return Math.ceil(chars / 4)
function estimateTokens(message: AgentMessage): number {
    let chars = 0;
    // ...按 message.role 分别累加 text/thinking/toolCall/command/output/summary 的字符数
    return Math.ceil(chars / 4);  // chars / 4
}
```

## 二、在哪进行切割

![Image](assets/images/e091a17d91/image-45.png)

LLM 的对话历史有严格的结构约束。比如 `ToolResult` 消息必须紧跟在触发它的 `AssistantMessage`（含 ToolCall）之后。如果你把 ToolCall 留在”保留区”、把 ToolResult 切到”压缩区”，模型会看到”我调用了 read 工具，但结果在哪？“。

所以切割点必须是**有效切割点，要保障切割后**不会破坏消息对的位置。

理解切割点要抓住一个关键——**切点是保留区的起点**

![Image](assets/images/e091a17d91/image-46.png)

这个 user 开头的完整 Turn 全部保留。被压缩的是 user **之前**的消息。所以在 user 后切**是最安全的选择**——天然保证 Turn 完整，因为 user 后面跟着的 assistant 和 toolResult 都会跟着进保留区。

确定有效切割点后，从哪里切？Pi 的策略是**从后往前累积**（[findCutPoint L392-454](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/compaction/compaction.ts#L392)）：

因为**最近的上下文最重要**。模型需要知道”刚才做了什么""刚才读了什么文件""用户最新说了什么”。往回走直到累积够 20,000 token，确保保留足够的近期上下文。

```JavaScript
function findCutPoint(entries, keepRecentTokens) {
    const cutPoints = findValidCutPoints(entries);  // 排除 toolResult

    let accumulated = 0;
    for (let i = entries.length - 1; i >= 0; i--) {
        accumulated += estimateTokens(entries[i]);
        if (accumulated >= keepRecentTokens) {
            // 找到第一个 >= i 的有效切割点
            return 第一个 >= i 的 cutPoint;
        }
    }
    return 最早的 cutPoint;  // 全部需要压缩
}
```

user 切点和 assistant 切点都合法。但两者性质不同——

- **user 切点**：天然保证 Turn 完整（user 后面的 assistant + toolResult 跟着进保留区）

- **assistant 切点**：**会切断 Turn**——这个 assistant 对应的 user 在压缩区，自己却在保留区

既然 assistant 切点会切断 Turn，为什么不允许只切 user？这样不就完全避免 split turn 了吗？

```Python
entry:  1     2      3      4      5     6      7     8
       usr   ass   tool   ass   tool   ass   tool   ass
                                          ↑
                                    向后累积到这里 token 预算用完
```

假设向后累积到 entry 6 时累积量刚好达到 `keepRecentTokens`（20K）。这时要找一个”在 6 之后或等于 6”的合法切点：

- 如果**只允许 user 切点**：最近的 user 是 entry 1——意味着保留区从 entry 1 开始，要保留 entry 1-8 共 8 个 entry。但 token 预算可能只够保留 2-3 个 entry。**压缩失败**——根本压不动。

- 如果**允许 assistant 切点**：选 entry 6 作为切点，保留区只有 entry 6-8 共 3 个 entry，**精确控制 token 量**。

Pi 选择了后者——**优先保证压缩能生效**，然后用 turnPrefix 摘要弥补 Turn 完整性的损失。

![Image](assets/images/e091a17d91/image-47.png)



注意主摘要和 turnPrefix 摘要的分工不同：

- **主摘要**覆盖的是被压缩的”完整历史”（多个完整 Turn）→ 用 6 section 结构化格式

- **turnPrefix 摘要**覆盖的是被切断的”半个 Turn”（user 在主摘要里、assistant 在保留区）→ 用更轻量的 3 段格式（Original Request / Early Progress / Context for Suffix）

两份摘要合并后存储在同一个 CompactionEntry 里，下一轮 buildSessionContext 时一起注入。LLM 看到的是一份完整的”压缩前发生了什么 + 半个 Turn 的前缀”。



## 三、切掉的部分做结构化摘要

所谓的结构化摘要当然不是随便让LLM写摘要，而是要求它填一个固定格式的表格——6 个 section：

```Markdown
## Goal                    ← 用户最初要做什么
## Constraints & Preferences  ← 有什么约束
## Progress                ← 做了什么（Done / In Progress / Blocked）
## Key Decisions           ← 关键决策
## Next Steps              ← 下一步做什么
## Critical Context        ← 不能忘记的关键信息
```

相比于自由文本更容易I遗漏信息，固定 section 强制 LLM 覆盖每个维度，减少遗漏。

生成摘要的过程是：先把消息序列化成文本，然后调用 LLM 生成摘要。

![Image](assets/images/e091a17d91/image-48.png)

如果一个长对话被压缩了多次（第一次压缩第 1-30 轮，第二次压缩第 31-50 轮），第二次压缩时会传入上一次的摘要作为 `previousSummary`：



![Image](assets/images/e091a17d91/image-49.png)

这让 LLM 做的是**更新而非重写**——已有的 Goal/Constraints 保留，新增的 Progress 追加。比每次从零开始写摘要更稳定。

对于编码 Agent 来说，“改了哪些文件”是至关重要的信息。Pi 的摘要里还维护一个文件跟踪列表：

```Plain Text
<read-files>
src/auth.ts
src/utils/hash.ts
</read-files>

<modified-files>
src/auth.ts
</modified-files>
```

这些列表跨压缩累积——第二次压缩时，`previousSummary` 里的文件列表会被合并进新的摘要。这样即使经过了多轮压缩，Agent 仍然知道整个会话过程中读过哪些文件、改过哪些文件。

压缩完成后，结果怎么影响后续的 Agent 运行？

每次压缩产生一个 `CompactionEntry`，它存储在 Session Tree 上

```Go
{
    type: "compaction",
    summary: "## Goal\nFix auth.ts...\n## Progress\n...",   // 摘要文本
    tokensBefore: 185000,              // 压缩前 token 数（用于诊断和审计）
    firstKeptEntryId: "e30",           // 保留的起始 entry id（重建上下文时从这开始）
    details: {                         // 文件操作跟踪（来自 extractFileOperations）
        readFiles: ["src/auth.ts", "src/utils/hash.ts"],
        modifiedFiles: ["src/auth.ts"],
    },
    // ... 含 id/parentId/timestamp 等 SessionEntryBase 字段
}
```

下次 Agent 运行时，`buildSessionContext()` 会根据 CompactionEntry 重建上下文：

```Plain Text
重建后的上下文：
├── CompactionSummaryMessage（role: "compactionSummary"）
│     content = 摘要文本
│     （第6章讲过：convertToLlm 把它翻译成 UserMessage）
│
├── 保留的原始消息（entry 30 之后的消息）
│     ├── UserMessage: "继续修复"
│     ├── AssistantMessage: ...
│     └── ...
│
└── （新的消息会在运行中追加）
```



`CompactionSummaryMessage` 是 coding-agent 的自定义消息类型，`convertToLlm` 会把它翻译成 `<summary>` 标签包裹的 UserMessage。LLM 看到的是：“The conversation history before this point was compacted into the following summary: …”

**对 LLM 来说，之前的几十轮对话变成了一个摘要。** 它不知道原始消息的细节，但它知道目标、进度、决策和文件操作记录——这对继续工作来说通常够用了。

自动压缩嵌入在 AgentSession 的 `agent_end` 事件处理中（第 7 章讲过事件系统）：

```Plain Text
Agent 运行结束（agent_end 事件）
    │
    ▼
检查 shouldCompact()？
    │
    ├── 不需要 → 结束
    │
    └── 需要 → 执行压缩
         ├── findCutPoint → 找切割点
         ├── 序列化 + LLM 调用 → 生成摘要
         ├── 追加 CompactionEntry 到 Session Tree
         └── 下次运行时 buildSessionContext 使用压缩后的上下文
```

压缩过程会发出两种事件（第 7 章讲过的 Session 层扩展事件）：

- `compaction_start`（reason: “manual” | “threshold” | “overflow”）

- `compaction_end`（携带压缩结果或错误信息）

UI 可以订阅这些事件来显示”正在压缩上下文…”的进度提示。

## 四、压缩全链路

![Image](assets/images/e091a17d91/image-50.png)

Pi 的压缩算法有三个值得i学习的设计思路：

### 向后遍历 + 合法切点：保护最重要的东西

`findCutPoint` **从最新消息往回走**，直到累积够 `keepRecentTokens`（默认 20K）。这种”逆向”思路背后的判断是：**最近的上下文最重要。**

切点排除 `toolResult` 是因为协议约束——toolResult 必须紧跟 toolCall，否则模型会”调了工具但找不到结果”。这是个不可妥协的硬约束。

### 结构化摘要：用固定模板对冲llm的自由发挥

`SUMMARIZATION_PROMPT` 强制 LLM 填 6 个固定 section：Goal / Constraints \& Preferences / Progress（含三个子项：Done / In Progress / **Blocked**）/ Key Decisions / Next Steps / Critical Context。其中 Progress 的 Blocked 子项专门记录”卡住的事”——LLM 在新一轮里看到这条，可以优先尝试解锁。

如果采用自由文本摘要有一个失败模式：LLM 容易被”有趣的内容”吸引，花大篇幅描述某个技术细节，**忘了记录用户的核心需求**。固定 section 强制 LLM 在每个维度上至少扫一遍，把”易遗漏”变成”必须填”。

加上增量更新（`UPDATE_SUMMARIZATION_PROMPT`）——多次压缩时新摘要是在旧摘要基础上更新，不是从零重写。这避免了”每次压缩摘要漂移一点”的累积误差。

### 文件跟踪累积：编码 Agent 的领域特定知识

`extractFileOperations` 从两个来源累积文件列表：第10章：会话管理 —— 对话的存储、恢复与分叉

1. 上一次压缩的 `details.readFiles` / `modifiedFiles`

2. 这次被压缩的消息里所有工具调用涉及的文件（read 工具 → readFiles，edit/write 工具 → modifiedFiles）

最终用 `formatFileOperations` 把这两个列表以 `<read-files>...</read-files>` 和 `<modified-files>...</modified-files>` 标签附加到摘要末尾。

为什么单独跟踪文件？因为对编码 Agent 来说，“**改过哪些文件**”是至关重要的元信息——比”对话里讨论过什么”更精确、更可验证。LLM 看到这个列表，知道哪些文件已经被项目触碰过，避免重复读、避免覆盖他人改动。这是一种”领域知识嵌入到通用机制”的做法——压缩算法本身是通用的，但通过 `details` 字段承载领域特定信息。

---

# 第十章：会话管理 —— 对话的存储、恢复与分叉

---

第 9 章讲压缩算法时，反复提到一个概念——Session Tree。压缩结果（CompactionEntry）存在 Session Tree 上，`buildSessionContext()` 从 Session Tree 构建 LLM 需要的上下文。

在搞懂session tree到底是什么之间，要先弄明白一个更基础的问题——**会话数据到底怎么存？**

会话数据存在哪，第一反应可能是 `mysql / postgres `这种关系型数据库，但是 Pi 的 coding-agent **没有走这条路**。它选了**本地 JSONL 文件**——每个会话一个 `.jsonl` 文件，存在用户本地磁盘的项目目录下。一行一个 entry，纯文本。

这样的选择与coding-agent的产品定位息息相关：

- **单用户、本地运行**：coding-agent 是 CLI 工具，跑在用户自己的机器上，没有”多用户并发""跨机器查询”的需求，数据库那套并发/索引/事务全是过度设计

- **会话跟项目走**：`cd /project-a` 时打开项目 a 的会话历史，`cd /project-b` 时打开项目 b 的——每个项目的 `.pi/sessions/` 目录就是那个项目的对话档案

- **零依赖、零运维**：不需要装 mysql，不需要起服务，开箱即用

- **可读、可调试**：JSONL 是纯文本，可以 `cat` / `grep` / 用编辑器直接打开看，调试时一目了然

除此之外，agent-core 层提供了一个 `SessionStorage` 接口（`harness/types.ts:440`），让其他应用可以自己实现数据库版本。agent-core 自带两个实现：`JsonlSessionStorage`（文件）和 `InMemorySessionStorage`（内存，测试用）。

会话数据怎么存，第一反应可能是线性数组，但是使用线性数组存储无法满足对话回退，对话分支，对话重试这些操作，Pi 的答案是 **Session Tree**——把对话历史组织成一棵**只追加、不修改、不删除**的树。回退/分支不是”删数据”，而是”移动一个指针”。

## 一、Session tree 的构建

我们用一个具体场景：**调试一个认证 bug，来展示session tree具体是怎么构建的：**

设想你打开 Pi agent，运行下面八个操作：

```YAML
步骤 1: 切换到 Claude 4.6 模型（你想用更聪明的模型）
步骤 2: 你问 "auth.ts 里 salt 验证为什么失败？"
步骤 3: Agent 决定调 read 工具读 auth.ts
步骤 4: read 工具返回 auth.ts 的内容
步骤 5: Agent 分析后回复 "问题在 23 行，salt 没编码"
步骤 6: 你不太满意这个回答，回退到步骤 2 重来
步骤 7: 你换思路问 "先看 hash 函数的实现"
步骤 8: Agent 调 grep + read 给出新的分析
```

### 第 1 步：切换模型，第一个节点上树

会话启动时，文件第一行是 Session Header（不是树节点，是文件元信息）。然后你切换模型，产生第一个真正的树节点 `ModelChangeEntry`：

```Python
e1: ModelChangeEntry
    parentId: null（根节点）
    payload: { model: "claude-sonnet-4-6" }
```

### 第 2 步：用户提问，UserMessage 节点上树

你输入”auth.ts 里 salt 验证为什么失败？“，产生第二个节点 `MessageEntry`：

```YAML
e2: MessageEntry
    parentId: e1
    message:
      role: "user"
      content: [{ type: "text", text: "auth.ts 里 salt 验证为什么失败？" }]
```

### 第 3 步：Agent 调 read 工具，AssistantMessage 节点上树

Agent 决定先读文件，产生一个含 ToolCall 的 AssistantMessage：

```YAML
e3: MessageEntry
    parentId: e2
    message:
      role: "assistant"
      content: [
        { type: "text", text: "让我读一下 auth.ts" },
        { type: "toolCall", id: "call_001", name: "read",
          arguments: { path: "src/auth.ts" } }
      ]
      stopReason: "toolUse"
```

需要注意的是，这一条 AssistantMessage **同时包含文本和工具调用**——它们放在同一个 content 数组里，是同一个节点。

### 第 4 步：read 工具返回结果，ToolResult 节点上树

工具执行完，产生一个 ToolResult 消息节点：

```YAML
e4: MessageEntry
    parentId: e3
    message:
      role: "toolResult"
      toolCallId: "call_001"     ← 关联到 e3 里的 ToolCall
      content: [{ type: "text", text: "export function verifySalt(s) { ... }" }]
      isError: false
```

注意 `toolCallId` 字段——它把这条 ToolResult 和触发它的 ToolCall 关联起来。这是第 5 章讲过的”工具结果必须精准关联回调用请求”在数据层的体现。

### 第 5 步：Agent 给出分析，又一个 AssistantMessage

Agent 看到文件内容后回复分析：

```YAML
e5: MessageEntry
    parentId: e4
    message:
      role: "assistant"
      content: [{ type: "text", text: "问题在 23 行，salt 没编码" }]
      stopReason: "stop"
```

到现在为止，5 步操作产生了 5 个节点，全部挂在一条直线上——这就是”主分支”：

```Python
e1 (model_change)
 └── e2 (user: "salt 验证为什么失败?")
      └── e3 (assistant: read auth.ts)
           └── e4 (toolResult: auth.ts 内容)
                └── e5 (assistant: "问题在 23 行")
                      ↑
                    leafId
```

### 第 6 步：回退——关键转折

你对”e5:问题在 23 行”这个分析不太满意，想换个思路。这时你执行**回退**——但**没有删除任何节点**：

```Plain Text
branch(branchFromId: "e2"): void {
    this.leafId = "e2";   // 只改这一行
}
```

回退后session tree 长这样：

```Plain Text
e1 (model_change)
 └── e2 (user: "salt 验证为什么失败?")
      ├── e3 (assistant: read auth.ts)        ← 旧分支还在
      │    └── e4 (toolResult)                     数据完整保留
      │         └── e5 (assistant: "问题在 23 行")
      │
      ↑ leafId 现在指回 e2
```

**e3、e4、e5 一个都没删**——它们还在树上，只是不在”当前路径”上。这就是 append-only 的核心：**回退不是删数据，是移动指针**。

### 第 7 步：换思路重新问——新分支自然长出

你从 e2 这条岔路口换了一个问题，产生新节点e6：

```YAML
e6: MessageEntry
    parentId: e2   ← 跟 e3 共享同一个父！
    message:
      role: "user"
      content: [{ type: "text", text: "先看 hash 函数的实现" }]
```

e6 的 `parentId` 也是 `e2`，跟 e3 一样。这是分支的本质：**两个节点共享同一个 parent，就是树上的两个分支**。

```Plain Text
e1 (model_change)
 └── e2 (user: "salt 验证为什么失败?")
      ├── e3 (assistant: read auth.ts)
      │    └── e4 (toolResult)
      │         └── e5 (assistant: "问题在 23 行")
      │
      └── e6 (user: "先看 hash 函数")    ← 新分支起点
            ↑
          leafId
```

### 第 8 步：新分支继续长

Agent 在新分支上调 grep + read 工具，产生 3 个新节点（assistant + toolResult + assistant）：

```Python
e1 (model_change)
 └── e2 (user: "salt 验证为什么失败?")
      ├── e3 (assistant: read auth.ts)
      │    └── e4 (toolResult)
      │         └── e5 (assistant: "问题在 23 行")
      │
      └── e6 (user: "先看 hash 函数")
           └── e7 (assistant: grep hash)
                └── e8 (toolResult: grep 结果)
                     └── e9 (assistant: 新分析)
                           ↑
                         leafId
```

## 二、树上节点

AssistantMessage，在 .jsonl 文件里是这样一行：

```JSON
{
  "type": "message",
  "id": "e3",
  "parentId": "e2",
  "timestamp": "2026-07-03T10:23:45.000Z",
  "message": {
    "role": "assistant",
    "content": [
      { "type": "text", "text": "让我读一下 auth.ts" },
      { "type": "toolCall", "id": "call_001", "name": "read",
        "arguments": { "path": "src/auth.ts" } }
    ],
    "model": "claude-sonnet-4-6",
    "stopReason": "toolUse",
    "usage": { "input": 1250, "output": 80 }
  }
}
```

读这串 JSON 你就明白了 Session Tree 的全部精髓：

Pi 一共定义了 9 种 Entry 类型。看起来多，其实**按”对 LLM 调用的影响”分三组**就清晰了：

![Image](assets/images/e091a17d91/image-51.png)

**第一组：进 LLM 上下文（4 种）**

这 4 种最终会变成 messages 数组里的一项，发给 LLM 看到：

**第二组：影响后续 LLM 调用（2 种）**

这 2 种不产生消息，但改变后续 LLM 调用的参数：

**第三组：纯元数据，不影响 LLM（3 种）**

这 3 种既不产生消息、也不改 LLM 参数，纯粹是给 UI 或扩展用的：

## 三、从树到 LLM 上下文：buildSessionContext

树长好了，但 **LLM 不认识树**。LLM 的 API 只接受一个**线性 messages 数组**（第 6 章讲过：user / assistant / toolResult 三种）。所以每次调用 LLM 之前，要把树”压扁”成数组。这就是 `buildSessionContext()` 的工作。

### 第一步：路径遍历——从 leaf 往回走到 root

回到我们的例子，当前 leafId 是 e9。`buildSessionContext` 先从 e9 往回走到根，收集路径上的所有 entry：

```JavaScript
const path: SessionEntry[] = [];
let current = byId.get(leafId);   // e9
while (current) {
    path.push(current);   // 先按 leaf → root 顺序收集
    current = current.parentId ? byId.get(current.parentId) : undefined;
}
path.reverse();           // 反转为 root → leaf 顺序
```

走完之后，path 数组（从 root 到 leaf 的顺序）是：

```Python
[e1, e2, e6, e7, e8, e9]
```

### 第二步：按类型分派处理

路径上的每个 entry，按类型决定怎么处理：

```Python
e1 (model_change)   → 更新状态变量 model = "claude-sonnet-4-6"，不进 messages
e2 (user message)   → 推入 messages 数组
e6 (user message)   → 推入 messages 数组
e7 (assistant + ToolCall) → 推入 messages 数组
e8 (toolResult)     → 推入 messages 数组
e9 (assistant)      → 推入 messages 数组
```

最后构建出来的 messages 数组长这样：

```JSON
[
  { role: "user", content: "auth.ts 里 salt 验证为什么失败?" },        // e2
  { role: "user", content: "先看 hash 函数的实现" },                    // e6
  { role: "assistant", content: [{ text: ... }, { toolCall: grep ...}] }, // e7
  { role: "toolResult", toolCallId: "call_002", content: ... },        // e8
  { role: "assistant", content: [{ text: "新分析..." }] }              // e9
]
```

## 四、JSONL 持久化的具体细节

### 格式：一行一个 Entry

第 2 节那个会话，最终在磁盘上的 .jsonl 文件长这样（每行一个 entry，紧凑显示）：

```JSON
{"type":"session","version":3,"id":"UUIDv7","cwd":"/project","timestamp":"2026-07-03T10:00:00Z"}
{"type":"model_change","id":"e1","parentId":null,"provider":"anthropic","modelId":"claude-sonnet-4-6","timestamp":"2026-07-03T10:00:05Z"}
{"type":"message","id":"e2","parentId":"e1","message":{"role":"user","content":[{"type":"text","text":"auth.ts 里 salt 验证为什么失败?"}]},"timestamp":"2026-07-03T10:23:00Z"}
{"type":"message","id":"e3","parentId":"e2","message":{"role":"assistant","content":[{"type":"text","text":"让我读一下 auth.ts"},{"type":"toolCall","id":"call_001","name":"read","arguments":{"path":"src/auth.ts"}}],"stopReason":"toolUse"},"timestamp":"2026-07-03T10:23:30Z"}
{"type":"message","id":"e4","parentId":"e3","message":{"role":"toolResult","toolCallId":"call_001","content":[{"type":"text","text":"export function verifySalt(s) { ... }"}],"isError":false},"timestamp":"2026-07-03T10:23:31Z"}
{"type":"message","id":"e5","parentId":"e4","message":{"role":"assistant","content":[{"type":"text","text":"问题在 23 行，salt 没编码"}],"stopReason":"stop"},"timestamp":"2026-07-03T10:24:00Z"}
{"type":"message","id":"e6","parentId":"e2","message":{"role":"user","content":[{"type":"text","text":"先看 hash 函数的实现"}]},"timestamp":"2026-07-03T10:30:00Z"}
{"type":"message","id":"e7","parentId":"e6",...}
```

**几个值得注意的细节**：

1. **e6 的 parentId 是 e2**——通过这个字段就能在文件里看出”这里有个分支”。用 `grep '"parentId":"e2"'` 就能找到所有从 e2 长出来的子节点

2. **timestamp 是 ISO 字符串**——人类可读，调试时一眼看出顺序

3. **id 是 8 位短 UUID**（如 `a1b2c3d4`）——比完整 UUID 省空间，会话内冲突概率足够低

**为什么用 JSONL 而不是单个 JSON？** 因为 JSONL 是**行级追加**的——新 Entry 直接 `appendFileSync` 到文件末尾，不需要读入-修改-重写整个文件。这和 append-only 树的设计完美契合：树只追加不修改，文件也只追加不重写。

有一个写入策略细节：**首次 assistant 消息到达前，写入会延迟**。具体规则分四种情况：

为什么要这套复杂逻辑？为了避免”有问无答”的半截对话残留——用户问了一句但 Agent 没回（网络断了、API 报错了），如果立即把每条用户消息都写盘，下次打开会话时就会看到一条孤零零的用户消息悬在那儿，没有对应回复。延迟到首次 assistant 消息到达再批量写入，保证落盘的对话至少有一对完整的 user-assistant 往返。

之后所有 entry 都立即 append——首次 flush 后这个机制就不再起作用，因为已经”上了轨道”。

虽然日常追加用 `appendFileSync`，但有两种情况会触发全文件重写（`writeFileSync`）：

- **创建分支副本**：克隆会话到新 .jsonl 文件时，需要把当前路径上的所有 entry 复制过去

- **修复损坏的会话文件**：发现文件格式异常时，重新规范地写一遍

重写不破坏 append-only 原则——重写产生的是新文件或新格式，原历史数据完整保留在重写后的内容里。





