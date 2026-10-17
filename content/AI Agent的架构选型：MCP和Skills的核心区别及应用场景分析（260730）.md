# AI Agent的架构选型：MCP和Skills的核心区别及应用场景分析（260730）

https://www.youtube.com/watch?v=goU9VIXA8II

API 是供开发人员使用的接口，而 MCP 是供 LLM 使用的 API 的接口/包装器

![文章配图](assets/images/ai-agent/image-01.png)

### MCP：Model Context Protocal



![文章配图](assets/images/ai-agent/image-02.png)

![文章配图](assets/images/ai-agent/image-03.png)

就像一台电脑通过USB-C接口转接器来连接各种外设，MCP protocals就是连接MCP client和 MCP server的角色。



每个MCP server都会发布一份机器可读的目录：

- tools：在MCP server中存储着工具的名称，描述和功能。当LLM通过MCP client来调用某个工具时，MCP服务器会负责执行相应的功能。

- resources：指的是MCP server能够提供的只能被读取的数据或者文档，client需要随时获取这些内容

- Templates

- ....其他



### API：Application Programming Interface

通过使用api，开发者可以整合外部系统的各种功能，而无需从头开始构建。最常用的api类型就是RESTful API。



**RESTful API** 是一种基于 **REST（Representational State Transfer，表现层状态转移）** 架构风格的现代化网络应用程序接口设计规范。它允许不同的软件系统在网络上通过标准的 Web 协议（通常是 **HTTP/HTTPS**）进行极其高效、轻量化的数据通信。

`GET` 方法可以用来检索（retrieve）数据，`POST` 方法可以用来发布数据，`PUT` 方法用来更改数据，`DELETE` 方法用来删除数据。



事实上很多agents都是通过 REST API来执行网络搜索，或者与企业内部的REST服务进行交互。



### 相似点

- 二者都是client-server model architecture，都是client向server发送请求，然后接收server的回复

- 二者都提供了统一的抽象层，使得一个系统无需去了解另一个系统的底层细节

- 二者都可以简化集成流程，使开发者能够直接将各个系统连起来，而不是反复造轮子



### 不同点

- MCP是为了将LLM整合到系统中而专门设计的，结合外部数据和工具，它规范了各种操作模式，比如提供上下文，调用工具的方式，这些都和agents的运作方式一致；API并非是专门为了LLM而设计

- MCP拥有动态自我发掘能力，agents每次连接到服务器时，都会获取到最新的功能列表，从而动态启动新的功能；而传统的REST API一旦API更改，或者有新的端点被添加，那么需要由开发者来更新客户端程序

- 接口标准化：MCP不管连接的什么数据，它的API都是独一无二的，具体的端点、参数格式以及认证方式因服务而异。

在没有 MCP 之前，如果一个 AI 助手（如 Claude、Cursor 等客户端）想要连接 5 个不同的传统 REST API（比如 GitHub、Slack、Notion、谷歌日历和本地数据库），

GitHub 有自己的 `/issues` 端点，Slack 有自己的 `/channels` 参数，认证方式有的是 OAuth2，有的是 API Key。

开发团队必须为这 5 个工具写 5 套完全不同的集成代码。任何一方改动了接口参数，全盘皆输，开发者需要没完没了地维护这套复杂的对接矩阵。



只需要按照 MCP 的标准规范，把你的数据或现有的 REST API **包装一次（Build Once）**，做成一个 MCP Server。开发者不需要再为 Claude 写一个插件，为 ChatGPT 写一个插件，为 Cursor 写一个插件。写好的这个 MCP Server，天然就能被**所有**支持 MCP 协议的 AI 客户端直接识别和调用（Integrate Many）。对于client来说，AI 助手内部只有一套标准代码：调用工具永远是 `tools/call`，获取列表永远是 `tools/list`

- 现有的很多MCP servers实际上只是对API的封装，通过使用该API，在MCP格式与各个底层服务之间的原生接口进行转换。就像MCP github server一样，它将仓库列表等高级功能作为MCP的底层功能来实现，但是实际上，他会将每次工具调用内部转化为相应的github REST API请求。





Mcp is wrong

https://www.reddit.com/r/mcp/comments/1jyld4j/everything\_wrong\_with\_mcp/

https://blog.csdn.net/gs80140/article/details/147563832

