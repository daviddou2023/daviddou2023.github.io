# 第5-6周-Redis + Celery 异步任务 + 幂等

## GOALS

项目主线：把耗时 Agent 任务从同步 HTTP 中剥离，丢进 Celery，用 Redis 做幂等和状态缓存。

- 安装 Redis，配置 Celery（broker 和 backend 都用 Redis）

- 提交任务时：用 Redis `SET task_id:request_id NX EX 60` 做接口幂等，防前端重试导致重复提交

- Celery Worker 执行时：调用你原有的 LangGraph `run_agent_task` 函数，每完成一个节点就把进度写入 Redis

- `/tasks/{task_id}/stream` 接口从 Redis 读取状态，通过 SSE 推给前端

必须扩展的高频知识：

- 缓存穿透/击穿/雪崩：分别是什么、怎么防（布隆过滤器、互斥锁重建、过期时间加随机）

- Redis 分布式锁：`SETNX + EXPIRE` 的问题（非原子），为什么需要 Lua 脚本或 Redisson 看门狗

- 消息队列的作用：解耦、削峰、异步；死信队列是什么、什么时候用

- Celery 的可靠性：`acks_late`、`task_reject_on_worker_lost`、重试策略

产出：提交任务后，前端能通过 SSE 看到“规划中→采数中→生成报告中”的实时进度，且重复点击不会创建两个任务。



## 一、先分清各组件的职责

HTTP接口只负责接收任务并尽快返回， Celery Worker独立执行耗时任务，Redis负责传递任务与提供进度数据。

```Python
客户端 -> FastAPI -> 数据库记录任务 -> Redis 消息队列 -> Celery Worker -> LangGraph 节点
-> Redis 进度数据 -> FastAPI -> SSE进度 -> 客户端
```

- FastAPI：校验请求、检查幂等、创建任务、返回 202 和 task_id；不等待 agent跑完

- 数据库：长期保存任务归属、状态、结果和错误，服务重启后仍可查询。

- Redis broker：Celery用它传递“需要执行哪个任务”的消息

- Celery Worker：从队列取任务，调用 agent，更新数据库与进度

- Redis result backend：保存 Celery 自身的执行结果或者状态

- SSE 接口：把进度从服务端单向推给客户端

## 二、消息队列与Celery基础

消息队列把耗时任务从 FastAPI 的请求处理中移交给独立 Worker 执行，让接口快速响应。总体上，消息队列可以带来三个作用：

- 异步：HTTP 不必等 Agent 完成

- 解耦：FastAPI 和 Agent 执行在不同进程，双方通过消息传递任务ID

- 削峰：瞬间有大量请求时候，消息先排队，Worker按照自身处理能力消费

### 2.1 为什么需要消息队列

如果 FastAPI 在请求中直接运行 agent，当客户端发送 POST，FastAPI只能等 agent执行几十秒，agent完成后才返回。

使用队列后，当客户端发送 POST， FastAPI 创建 PENDING 记录，把 task_id 发给队列，立即返回 202 和 task_id；Celery Worker收到消息，更新 RUNNING，执行agent，保存 SUCCESS/FAILED 和结果

消息队列的作用是暂存待处理工作并交给消费者，Celery负责定义任务、发送任务和运行 Worker。

### 2.2 三个角色：生产者、Broker、消费者

- 生产者：FastAPI，它创建任务并发布一条 Celery消息

- Broker：消息代理，这里用 Redis 暂存队列消息

- 消费者：Celery Worker，它从 Broker 中取出消息并执行任务

消息里面放的通常是业务任务ID，而不是把整个ORM对象、数据库Session或者视频内容塞进去。Worker收到消息后，可以用task_id 从数据库读取完整任务数据。

### 2.3 配置 Celery 与 Redis

创建 Celery实例：

```Python
from celery import Celery

celery_app = Celery(
    "creator_tasks",
    broker="redis://localhost:6379/0", # Redis 的0号逻辑数据库，保存待执行任务消息
    backend="redis://localhost:6379/1", # 1号逻辑数据库，保存 Celery 任务执行结果
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Asia/Shanghai",
    enable_utc=False,
)
```

### 2.4 定义 Worker 任务

在 Celery 中可导入的模块中定义任务：

```Python
from celery_app import celery_app
# celery_app.task 会把普通 python函数注册为 Celery 任务
@celery_app.task(name="tasks.process_task")
def process_task(task_id: int):
    return {"task_id": task_id, "status": "SUCCESS"}
```

```Python
process_task.delay(task_id)
```

这种写法是 Celery 提供的快捷方式，会把任务消息发送给 Broker，等待 Worker 执行。

### 2.5 FastAPI 提交任务并返回

路由的流程应该是：校验BV号，在数据库创建 PENDING 任务并提交，得到数据库ID，将ID投递到Celery，返回 202 Accepted和业务任务ID

```Python
@app.post("/tasks", status_code=202)
async def create_task(data: TaskCreate, db: AsyncSession = Depends(get_db)):
    task = Task(bvid=data.bvid, status="PENDING")
    db.add(task)
    await db.flush()
    
    task_id = task.id
    await db.commit()
    
    process_task.delay(task_id)
    return {"task_id": task_id, "status": "PENDING"}
```

这里的代码执行顺序是先提交数据库，再投递 Celery，确保 Worker 收到 ID 时能查到任务。但是这个顺序目前还有一个隐患：数据库提交成功后，如果投递失败，任务会留在 PENDING，后续可以通过重试投递等模式改进。

### 2.6 两种 Task ID 不要混淆

- 业务 task_id：数据库 Task.id，由你的应用使用，供API查询

- Celery task ID：Celery每次投递任务生成的ID，用于追踪队列执行记录

## 三、Redis 基础与数据过期

Redis是后端常用的内存数据服务，在任务系统里可以承担 Celery消息代理、短期幂等记录和实时进度存储；TTL则控制这些临时数据保存多久。

先区分 Redis 的三种用途：它们可以运行在同一个 Redis 服务里，但键的用途、生命周期和可靠性要求不同。

业务任务的状态、结果和错误仍然以数据库中的Task记录为准。Redis的数据可以按照用途设置TTL，过期后数据库中的任务记录仍应可以查询。

### 3.1 Redis 的键值与常见命令

Redis是键值数据库。键是字符串，值可以是字符串、列表、哈希、集合、Stream等结构。

```Python
import redis
# decode_response=True 会让读取结果直接成为python字符串
r = redis.Redis(host="localhost", port=6379, db=0, decode_responses=True)

# redis 写入键值对
r.set("greeting", "hello")
# redis 读取键值对
message = r.get("greeting")
print(message)
```

Redis的 Python 客户端是 redis-py，异步代码可以使用 `redis.asyncio`：

```Python
import redis.asyncio as redis
client = redis.Redis.from_url(
    "redis://localhost:6379/0",
    decode_response=True,
)
```

异步客户端的网络操作需要 await：

```Python
await client.set("greeting", "hello")
message = await client.get("greeting")
```

创建客户端通常不会为每次命令都新建TCP连接；客户端内部使用连接池复用连接。

### 3.2 TTL：让临时数据自动过期

TTL 是键的剩余生存时间，通过` ex=3600 `参数来进行设置：

```Python
await client.set("task:123:progress", "collecting", ex=3600)
```

在键过期后，redis会把它视作不存在，TTL适合显示临时数据占用空间，但是不能替代业务数据持久化（不能想当然设置一个ex无穷大的数值）

### 3.3 用 Redis 做短期接口幂等记录

如果前端提交任务后网络超时，不知道服务端是否已经创建成功，于是重试。为了避免同一次提交创建两个任务，客户端在第一次请求时生成 `request_id`，超时重试时候沿用同一个 ID。

幂等键用来识别同一次请求；键的值保存第一次创建的业务 task_id：

```Python
幂等键：idem:user-7:req-a8f2
键值：42
```

示例流程：

```Python
request_id = "req-a8f2"
idempotency_key = f"idem:user-{user_id}:{request_id}"

existing_task_id = await client.get(idempotency_key)
if existing_task_id is not None:
    return {"task_id": int(existing_task_id), "status": "PENDING"}

# 先在数据库创建并提交任务，获得 task_id
task_id = await create_task_in_database(...)

# NX：键不存在时才写入；EX：60 秒后过期
created = await client.set(
    idempotency_key,
    str(task_id),
    nx=True, # 只在键不存在时写入
    ex=60,
)
```

### 3.4 当前状态与进度事件历史

实时进度有两种常见需求：

- 只需要当前阶段：

```Python
await client.hset(
    f"task:{task_id}:progress",
    mapping={
        "stage": "reporting",
        "message": "正在生成报告",
        "percent": 80,
    },
)
await client.expire(f"task:{task_id}:progress", 3600)
```

- 需要重放所有阶段：

使用 Redis Streams 一类追加式数据结构，给每个进度事件分配ID，SSE断线重连后从上次的ID 继续读取

### 3.5 Redis 故障时要思考什么

把 redis 用在不同用途时，故障影响不同：

- **Broker 不可用**：FastAPI 可能无法投递任务。接口应返回明确错误，或保留 `PENDING` 并有后续补投机制。

- **幂等记录不可用**：不能可靠判断请求是否是重试。要决定拒绝提交，还是暂时接受重复风险。

- **进度缓存不可用**：任务仍可能在 Worker 中执行，数据库最终状态仍可查询；SSE 可以暂时没有实时进度。

- **数据库不可用**：业务任务的长期记录无法可靠创建或更新，属于核心持久化故障。

这些选择要由业务对任务丢失、重复和延迟的容忍度决定。

## 四、接口幂等：先弄清“重复”的定义

接口幂等让客户端重试“同一次提交”时取回来原来的任务ID，避免网络超时或者重复点击在数据库中创建多条任务。

### 4.1 请求ID 与任务ID

- `request_id`：标识“这是哪一次提交意图”，由客户端提供，重试时保持不变。

- `task_id`：标识数据库中的任务，由服务端创建。

它们的关系是：

```Plain Text
request_id A → task_id 42
request_id B → task_id 43
```

即使 A 和 B 提交的是同一个 BV 号，它们也是两次不同任务。将来加入登录用户后，幂等键应按用户隔离，例如 `(user_id, request_id)`；不能信任客户端请求体里自行声称的 `user_id`。

### 4.2 POST 的处理流程如何设计

流程是：

```Python
读取 Idempotency-Key
→ Redis 有 task_id：查数据库并返回已有任务
→ Redis 没有：尝试向数据库插入带 request_id 的 PENDING 任务
    → 插入成功：提交、缓存 request_id → task_id、投递 Celery
    → 唯一约束冲突：回滚、按 request_id 查已有任务并返回
```

## 五、Worker 执行与任务状态流转

Worker负责在HTTP请求结束后独立执行agent，并把任务每个关键阶段及时提交到数据库，让查询接口能读到真实进展和最终结果。

### 5.1 先明确谁负责修改状态

状态流转是：

```Python
PENDING → RUNNING → SUCCESS
                   ↘ FAILED
```

### 5.2 Worker使用自己的数据库Session

FastAPI路由使用 `get_db()` 提供 `AsyncSession`，这个 `Session `属于 HTTP请求，会在请求结束后关闭。Worker中不能继续使用它。

学习阶段有两种选择：

- 在 Worker 中另建**同步** SQLAlchemy Engine 和 Session 工厂，使用普通 `def` Celery 任务；调用流程最直观。

- 继续使用异步数据库访问，但必须明确处理 Celery 同步任务与事件循环之间的关系，复杂一些。

下面的示例采用第一种。假设 `WorkerSessionLocal` 是 Worker 自己的同步 Session 工厂，且连接到**与 FastAPI 相同的 SQLite 文件**。

### 5.3 开始处理：提交 RUNNING

Worker首先要领取任务，并保存 BV号供Agent使用。关键片段：

```SQL
from sqlalchemy import select, update

with WorkerSessionLocal.begin() as db:
    changed = db.execute(
        update(Task)
        .where(Task.id == task_id, Task.status == Status.PENDING.value)
        .values(status=Status.RUNNING.value)
    )

    if changed.rowcount != 1:
        return  # 任务不存在，或已不处于 PENDING

    bvid = db.scalar(select(Task.bvid).where(Task.id == task_id))
```

`WorkerSessionLocal.begin()` 正常结束会提交事务，异常时会回滚。

### 5.4 成功时保存结果与终态

agent成功返回时，将状态和结果放在同一次事务中提交：

```Python
with WorkerSessionLocal.begin() as db:
    db.execute(
        update(Task)
        .where(Task.id == task_id, Task.status == Status.RUNNING.value)
        .values(
            status=Status.SUCCESS.value,
            result=result_text,
            error=None,
        )
    )
```

### 5.5 失败时保存错误与终态

只把 agent 处理过程包在异常捕获范围内：

```Python
try:
    result_text = run_agent_task(bvid)
except Exception as exc:
    error_summary = f"{type(exc).__name__}: {exc}"[:500]

    with WorkerSessionLocal.begin() as db:
        db.execute(
            update(Task)
            .where(Task.id == task_id, Task.status == Status.RUNNING.value)
            .values(
                status=Status.FAILED.value,
                result=None,
                error=error_summary,
            )
        )

    raise
else:
    # 在这里提交 SUCCESS 和 result
    ...
```

保存 `FAILED` 后重新 `raise`，Celery 才能知道任务执行失败，日志和 Celery 自身状态也能体现异常。对客户端展示的 `error` 应是简短、合适的摘要；详细异常堆栈留在 Worker 日志中。

## 六、LangGraph 节点进度如何表达

Langgraph 节点进度把图内部的执行变化转成稳定、简短的业务事件，供 Worker写入 Redis，再由后端推给前端。

现有工程中图中实际节点是 `plan → execute →（可能 replan → execute）→ verify → report`。

### 6.1 定义“进度”要表达什么

前端需要知道的是“现在做到哪一步”，而不是 LangGraph 内部完整的 `state`。可以给节点定义一套稳定的对外事件：

### 6.2 用 LangGraph 的更新流取得节点完成事件

假设 bvid 已从数据库读取，redis_client 是同步 Redis 客户端，Worker的核心片段：

```Python
NODE_PROGRESS = {
    "plan": ("planning", "规划完成"),
    "execute": ("collecting", "采数与分析完成"),
    "replan": ("replanning", "重新规划完成"),
    "verify": ("verifying", "证据校验完成"),
    "report": ("reporting", "报告生成完成"),
}

events_key = f"task:{task_id}:events"

# 创建已经编译的图
for update in build_graph().stream(
    {"video_id": bvid, "platform": "bilibili"},
    stream_mode="updates", # 节点完成后才产出更新
):
    # update中的键是节点名，delta是该节点返回的数据
    for node, delta in update.items():
        # NODE_PROGRESS将内部节点名翻译成前端能使用的阶段和文案
        stage, message = NODE_PROGRESS[node]

        # XADD 把事件追加到 task:{task_id}:events这个Stream中，它会生成有顺序的事件
        redis_client.xadd(
            events_key,
            {
                "kind": "node_completed",
                "stage": stage,
                "node": node,
                "message": message,
            },
        )
        # EXPIRE 让临时进度在一段时间内清理
        redis_client.expire(events_key, 3600)
```

### 6.3 终态与异常由 Worker负责

节点流正常结束后，Worker 要把最终报告写入数据库，并将任务改为 `SUCCESS`；随后可向 Redis 写一个 `completed` 事件。若图执行抛出异常，Worker 要保存 `FAILED` 和错误摘要，并写 `failed` 事件。

## 七、SSE 基础

SSE让FastAPI保持一个HTTP响应打开，将 Worker写入Redis的任务进度逐条推给浏览器，而浏览器不必反复请求 `GET /tasks/{task_id}`

数据路径是：

```Python
langgraph 节点完成
-> Celery Worker 写入Redis Stream
-> FastAPI 从 Redis Stream 读取
-> SSE 推送给浏览器
```

### 7.1 SSE究竟是什么

SSE使用普通 HTTP GET 请求。服务端返回 `Content-Type: text/event-stream`，并持续向响应中写入事件。连接可以保持一段时间，浏览器收到一条处理一条

一条SSE消息的文本格式例如：

```Python
id: 1710000000000-0
event: node_completed
data: {"stage":"planning","message":"规划完成"}

```

最后的**空行**很重要，它表示这一条事件结束：

- `id`：事件 ID，可用于断线后续读。

- `event`：事件类型，例如 `node_completed`、`completed`、`failed`。

- `data`：事件内容，通常放 JSON 字符串。

### 7.2 FastAPI从 Redis Stream推送事件

假设 Worker 已将事件写入 `task:{task_id}:events`，并且已有异步 Redis 客户端 `redis_client`。以下是 SSE 路由的**核心片段**：

```Python
import json

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse


@app.get("/tasks/{task_id}/stream")
async def stream_task(task_id: int, request: Request):
    key = f"task:{task_id}:events"

    # 在开始长连接前检查任务是否存在，随后关闭数据库 Session
    async with SessionLocal() as db:
        task = await db.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
    
    # 异步生成器，每次执行到yield，FastAPI就可以把一段事件文本写入HTTP响应
    async def event_stream():
        cursor = request.headers.get("last-event-id") or "0-0"

        while not await request.is_disconnected():
            batches = await redis_client.xread(
                {key: cursor}, # 表示读取 ID 大于 cursor的事件
                count=20,
                block=10_000,
            )

            if not batches:
                # 心跳只是让连接保持活动，不代表任务仍然健康
                yield ": heartbeat\n\n"
                continue

            for _, entries in batches:
                for event_id, fields in entries:
                    cursor = event_id
                    kind = fields["kind"]

                    yield (
                        f"id: {event_id}\n"
                        f"event: {kind}\n"
                        f"data: {json.dumps(fields, ensure_ascii=False)}\n\n"
                    )

                    if kind in {"completed", "failed"}:
                        return

    return StreamingResponse( # StreamingResponse逐块返回
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache"},
    )
```

### 7.3 浏览器接收从服务端返回的消息

浏览器原生提供 `EventSource`：

```JavaScript
const source = new EventSource(`/tasks/${taskId}/stream`);

*// 监听名为 "node_completed" 的自定义事件。*
*// 当服务端推送该事件时，浏览器会触发这个回调，event.data 是服务端发送的数据（字符串）。*
source.addEventListener("node_completed", (event) => {
    const progress = JSON.parse(event.data);
    console.log(progress.stage, progress.message);
});

source.addEventListener("completed", () => source.close());
source.addEventListener("failed", () => source.close());
```

### 7.4 断线重连与 Last-Event-ID

浏览器收到带 `id` 的 SSE 事件后，连接意外中断时，重连请求通常会携带 `Last-Event-ID`。服务端以该 ID 作为 Redis `XREAD` 的游标，就能读取后续事件。

浏览器自动重连与“用户刷新整个网页后新建一个 `EventSource`”也不同。新建连接默认从头读取当前保留的事件；如果需要从上次位置继续，前端还要保存游标并在新连接时传回。

### 7.5 SSE 和轮询 GET 如何分工

- `GET /tasks/{task_id}`：随时读取数据库中的当前状态和最终结果，适合刷新页面、恢复状态、查询历史任务。

- `GET /tasks/{task_id}/stream`：在任务执行期间持续推送细粒度进度，减少前端反复轮询。

SSE 不应成为获取最终结果的唯一途径。即使用户从未打开进度连接，Worker 也应该照常执行并把最终结果写入数据库。



## 八、缓存问题与分布式锁

缓存策略减少重复读取数据库的成本，分布式锁协调多个进程对同一资源的并发操作，二者都要明确数据过期、故障和重复执行时的行为。

### 8.1 缓存穿透

当请求查询一个不存在的资源，例如无效的 BV号。缓存没有，数据库也没有。每次请求都继续查数据库，恶意或者高频请求就会重复打到数据库。对于这个问题，有两种方案：

- 方案一：缓存空结果

```Python
NOT_FOUND = "__not_found__"

async def get_video(bvid: str):
    key = f"video:{bvid}"
    cached = await redis_client.get(key)

    if cached == NOT_FOUND:
        return None
    if cached is not None:
        return json.loads(cached)

    video = await load_video_from_db(bvid)

    if video is None:
        await redis_client.set(key, NOT_FOUND, ex=60)
        return None

    await redis_client.set(
        key,
        json.dumps(video),
        ex=300,
    )
    return video
```

负缓存只存一小段时间，因为之前不存在的数据可能后来被创建。还要避免把空字符串误当作“缓存未命中”，所以这里使用专门的哨兵值。



- 方案二：参数校验与布隆过滤器

对明显非法的 BV 格式在请求层拒绝，不访问数据库。

布隆过滤器可以快速判断一个 key **一定不在集合中**，或“可能存在”。它有误判为可能存在的概率，但不会把真实存在误判为不存在。

布隆过滤器适合非常大的已知 key 集合，不适合当前刚开始的练习，也不能替代数据库最终查询。

### 8.2 缓存击穿

一个热点键刚过期，大量请求同时发现缓存缺失，便同时查询数据库、同时重建缓存，数据库瞬时负载飙高，有两种解决方案：

- 方案一：互斥重建

```Python
读缓存 ──命中──> 返回
   │
  未命中
   ↓
抢锁(SET NX EX 10)
   ├─ 抢到 → 再查缓存 ─命中→ 返回
   │            └未命中→ 查库 → 回填缓存(EX 300) → 返回
   │          finally: 按 token 安全释放锁
   │
   └─ 没抢到 → 轮询 20 次 × 50ms 等缓存
                 ├─ 等到 → 返回
                 └─ 超时 → 直接查库返回(兜底)
```

```Python
import asyncio
import uuid

async def get_hot_video(video_id: str):
    key = f"video:{video_id}"
    cache = await redis_client.get(key)
    if cache is not None:
        return json.loads(cache)
    
    # 锁的键是 lock:video:{video_id}，与缓存键对应。
    lock_key = f"lock:{key}"
    # token 是本次请求生成的唯一 UUID，用于标识锁的持有者
    token = str(uuid.uuid4())
    acquired = await redis_client.set(
        lock_key,
        token,
        nx=True,
        ex=10,
    )

    if acquired:
        try:
            # 再检查一次，可能另一个请求刚刚填好缓存
            cache = await redis_client.get(key)
            if cache is not None:
                return json.loads(cache)

            value = await load_video_from_db(video_id)
            await redis_client.set(
                key,
                json.dumps(value),
                ex=300,
            )
            return value
        finally:
            await release_lock_if_owner(lock_key, token)
    
    #  没拿到锁的请求：轮询等待缓存
    for _ in range(20):
        await asyncio.sleep(0.05)
        cache = await redis_client.get(key)
        if cache is not None:
            return json.loads(cache)

    return await load_video_from_db(video_id)
```

另一种方案是**逻辑过期**：缓存数据本身不立即删除，而是标记已过期；某个请求负责异步刷新，其他请求继续读稍旧的数据。它提高响应连续性，但业务必须能接受短时间旧值。

### 8.3 缓存雪崩

大量缓存键在同一时刻过期，或 Redis 整体不可用，许多请求同时回源数据库，数据库过载：

常见缓解措施

- 给 TTL 加随机值，避免同一批数据同时过期。

- 热点数据提前刷新。

- 限制并发回源、设置超时和熔断。

- Redis 故障时控制降级行为，避免所有请求无上限地打数据库。

### 8.4 Redis 分布式锁解决什么问题

单进程里的 `asyncio.Lock` 只能协调同一个 Python 进程内的协程。FastAPI 多 Worker、Celery 多进程部署后，每个进程各有自己的锁，彼此看不到。

Redis 锁让不同进程对同一个资源竞争同一把锁，例如 `lock:video:BV...`。Redis 的基础加锁命令是：

```Python
token = str(uuid.uuid4())

acquired = await redis_client.set(
    "lock:video:BV1234567890",
    token,
    nx=True,
    ex=10,
)
```

- `nx=True`：仅键不存在时成功，确保同一时刻只有一个持有者取得锁。

- `ex=10`：锁自动过期，避免进程崩溃后锁永久遗留。

- `token`：每次持锁使用独一无二的值，用来判断锁仍属于当前持有者。

