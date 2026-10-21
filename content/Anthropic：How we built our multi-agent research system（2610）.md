# Anthropic：How we built our multi-agent research system（2610）

https://www.anthropic.com/research/multi-agent-research-system

https://arthurchiao.art/blog/built-multi-agent-research-system-zh/

## 一、引言

### 概念解释

本文中所涉及到的agent指的是在一个代码循环（while(){ }）中自主选择和使用工具（Tools）的大语言模型。

本文中的multi-agent system由多个以上的agent组成（具体又分为lead agent和 sub agent），协同完成一项复杂任务。

而标题中的research则是指的开放式问题的探索（搜索），无法提前预测所有步骤，因为research 的过程本质上是开放动态且路径依赖的。

人类在进行research时候也是摸着石头过河，根据每个阶段的发现来决定自己接下来要做的事情。

agent模仿的就是人类的行为，模型在每一轮迭代后有了新的发现（observation），根据这些中间结果来决定下一步的方向。

### Multi-agent system的必要性

搜索的本质是信息的压缩：从海量的语料中提炼关键信息，自然而然搜索的性能指标就是如何更快更好地提炼出这些信息。

从人类的进化史上来看，双拳难敌四手，虽然单个人的智力在逐步提升，但是人类社会的群体智能和协调能力在指数增长，这得益于人类集体的贡献而非少数个人。agent也是类似的，当单个agent的智能达到某个阈值无法突破，寻求agent的群体智能顺水推舟，因此multi-agent系统就成为提升性能的关键方式：

- 多个subagent 并行运行，各自拥有独立的上下文窗口，探索同一个问题的不同方面，最后将最重要的信息压缩给lead agent.

- 每个sub-agent可以使用不同的Tool和提示词，有不同的探索轨迹，从而减少路径依赖，实现深入而独立的研究。

![Image](assets/images/2986a612a3/image-01.jpg)

anthropic的内部评估表明：

- Multi-agent research系统尤其擅长广度优先查询，即同时追踪多个独立方向

- 以 Lead Agent 用 Claude Opus 4、sub-agents 用 Claude Sonnet 4 的 Multi-Agent 系统，比使用 Claude Opus 4 的 Agent 性能高出 90.2%。

### multi-agent系统的缺点

（1）token消耗量巨大。

multi-agent系统之所以有效，主要在于他们花了足够的token来解决问题。anthropic的结果数据表明，跟聊天交互消耗的token相比，agent token消耗是4倍，而multi-agent的消耗是15倍。

（2）某些需要agent 共享上下文或者agent之间存在大量依赖关系的领域，目前不适合 multi-agent系统

multi-agent系统擅长涉及高度并行化、信息超出单一上下文窗口并且与众多复杂tool交互的高价值任务。



## 二、架构概览

### orchestrator-worker架构

![Image](assets/images/2986a612a3/image-02.png)

当用户提交查询后，lead agent对其进行分析，制定策略，并生成subagent同时探索不同方面，sub agent通过迭代使用搜索工具收集信息，就搜索结果返回给lead agent, lead agent对这些信息进行汇总，生成最终答案。

### 工作流

![Image](assets/images/2986a612a3/image-03.png)

上图是Multi-Agent Research 系统的完整工作流。

核心点：

- Lead researcher 会将计划保存到memory做持久化，因为如果上下文超过 200k tokens就会被截断，持久化是很重要的备份。

- 每个subagent独立执行搜索及，使用 interleaved thinking评估 tool 的返回结果,并将发现返回给 lead researcher

- Lead researcher综合这些结果并决定是否需要进一步研究——如果需要，它可以创建更多的subagent或者优化其策略

- 一旦收集到足够的信息，系统退出循环，并将所有发现传递给citation agent, 后者处理引用问题。

## 三、面向multi-agent 的提示词工程

multi-agent系统与单 agent系统存在关键差异，包括协调复杂性迅速增长。由于每个agent都有提示词引导，因此提示词工程是我们改进multi-agent表现的主要手段。本节列举一些经验。

### 主控agent合理下发工具（how to delegate）

Lead agent将查询分解为子任务并描述给sub-agent.

- 每个sub-agent 需要目标、输出格式、关于tool来源和使用的指导清晰的任务边界

- 没有详细的任务描述，agent 会重复工作或者无法找到必要信息。

我们一开始允许lead agent给出简单、简短的指令，但是发现这些指令往往过于模糊，导致subagent误解任务或者与其他agent执行完全相同的搜索。



### 查询复杂度 vs 工具量区间（scale effort to query complexity）

agent难以判断不同任务的合理投入是多少，因此我们在提示词中嵌入了规则。

- 简单的事实查找：1个 agent 进行 3-10次 tool 调用

- 直接比较：2-4 个 sub-agent各进行 10-15次调用

- 复杂研究：多到十几个 sub-agent 并明确划分职责。

这些明确的规则帮助 lead agent 高效分配资源，防止在简单查询上过度投入。

### Tool 的设计和选择至关重要

随着MCP Tool的流行，tool的设计和选择更加重要，因为agent会遇到各种tool, 不同的tool的描述质量参差不齐。

anthropic为agent提供了明确的启发式方法，例如：

- 首先检查所有可用tool，将tool与用户意图匹配

- 在互联网上进行广泛的外部探索，寻找合适的tools

- 优先使用专门tool而非通用的tool



4. 搜索策略：由宽泛到具体（start wide，then narrow down）

搜索策略应该模仿人类专家：先探索全貌，再深入细节

agent往往默认使用过长的具体策略，导致返回结果很少。通过提示agent先使用简短、宽泛的查询，评估可用内容，在逐步缩小查询范围。



























