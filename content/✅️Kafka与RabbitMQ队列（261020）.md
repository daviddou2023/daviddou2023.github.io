# ✅️Kafka与RabbitMQ队列（261020）

https://www.cnblogs.com/flaming/p/11304278.html

https://cloud.tencent.com/developer/article/2665439

https://aws.amazon.com/cn/compare/the-difference-between-rabbitmq-and-kafka/



kafka是一个分布式、高吞吐量、高扩展性的消息队列系统。主要应用在日志收集系统和消息系统，相信大家之前也听说过其他的消息队列中间件，比如RabbitMQ、AcitveMQ，其实kafka就是这么一个东西，也可以叫做KafkaMQ。总之，Kafka比其他消息队列要好一点，优点也比较多，稳定性和效率都比较高。

## 一、Kafka中的相关概念

![Image](assets/images/3c71e48551/image-01.png)

### Producer

producer负责源源不断向着kafka服务器发送消息，producer每发送一条消息必须有一个topic。

### Topic

每一个发送到kafka的消息都有都有一个主题，也可以叫做类别，类别下面有很多消息。

### Partition

producer发送的消息数据topic会被存储在分区中，分区是被分在不同的broker上也就是服务器上，这样topic分块存储在不同的分区上，大量的消息就实现了负载均衡。

每个topic可以指定多个分区，但是至少指定一个分区。每个分区存储的数据都是有序的，不同分区之间的数据不保证有序性。如果要保证消息的顺序消费，可以设置为一个分区，只有一个分区的时候就只能消费这一个分区，自然就保证有序了。

### Replica（副本）

副本就是分区中数据的备份，是kafka为了防止数据丢失或者服务器宕机采取的保护数据完整性的措施，一般的数据存储软件都会有这个功能。kafka做了副本之后同样会把副本分区放到不同的服务器上，保证负载均衡。实际上这就是传统数据库中的主从复制功能——kafka会找一个分区作为主分区（leader）来控制消息的读写，其他的副本都是从分区（follower），这样的话读写可以通过leader来控制，然后同步到副本上去，保证数据的完整性。

### Broker（实例或者节点）

启动一个kafka就是一个broker,多个broker构成一个kafka集群，这就是分布式的体现，服务器多了自然吞吐率这些指标都上来了。

### Consumer

消费者来读取kafka中的消息，可以消费任何topic的数据，多个consumer组成一个消费者组。

## **二、 Kafka的架构与设计**

一般来说，一个kafka集群包含一个或者多个的producer,一个或者多个broker,一个或者多个consumer group,一个zookeeper集群，kafka通过zookeeper管理集群配置，管理集群在运行过程中负责均衡、故障转移和恢复等。producer使用push的方式将消息发布到broker,consumer使用pull的方式从broker获取信息，二者都是主动操作的。

### topic和partition的设计

kafka把topic分成一个或者多个分区，每个partition在物理磁盘上对应一个文件夹，该文件夹下存储这个partition的所有消息和索引文件。当我们创建一个topic时，同时可以指定分区数据，数目越多，吞吐量越大，但是消耗的资源也越多。在存储的过程中，每条消息都是被顺序写到磁盘上的（顺序写比磁盘比随机写内存效率要高）

![Image](assets/images/3c71e48551/image-02.png)

kafka的消息都是顺序写入的，consumer消费的时候也是按照顺序来消费的。

对于传统的MQ而言，一般经过消费后的数据都会被删除，而kafka却不会被删除，只记录一个消费者消费消息的offset量作为标记，可以允许消费者自己设置offset的值，从而可以重复消费一些消息。kafka提供了两种策略来删除消息：一个是基于时间；另一个是基于partition文件的大小。

### producer的设计

producer发送消息时，会根据partition的策略来决定存到哪个partition中，一般默认的策略是kafka提供的均衡分布的策略。一般如果我们的消息对于顺序没有要求的话可以多设置几个分区，这样可以更好地负载均衡吞吐量了。发送消息的时候，需需要指定消息的key值，producer会根据这个key值和partition的数量来决定这个消息发到哪个分区。

### Consumer group的设计

传统的消息队列有两种传播消息的方式，一种是单播，类似队列的方式，一个消息只被消费一次，消费过了，其他消费者就不能消费了；另一种是多播，类似发布-订阅的方式，一个消息可以被多个消费者同时消费。kafka通过消费者组的方式来实现这两种方式：

- 分区的个数和消费者的个数一致，这样每个消费者就成了单播形式

- 不同的消费者组可以同时消费同一个消息，这样就实现了多播，类似发布-订阅的模式。



## 三、RabbitMQ中的相关概念

![Image](assets/images/3c71e48551/image-03.png)

- `Broker`：就是 RabbitMQ 服务，用于接收和分发消息，接受客户端的连接，实现 AMQP 实体服务。

- `Connection`：连接，生产者/消费者与 Broker 之间的 TCP 网络连接。

- `Channel`：网络信道，如果每一次访问 RabbitMQ 都建立一个 Connection，在消息量大的时候建立连接的开销将是巨大的，效率也

较低。Channel 是在 connection 内部建立的逻辑连接，如果应用程序支持多线程，通常每个 thread 创建单独的 channel 进行通讯，AMQP method 包含了 channel id 帮助客户端和 message broker 识别 channel，所以 channel 之间是完全隔离的。Channel 作为轻量级的Connection 极大减少了操作系统建立 TCP connection 的开销。

- `Message`：消息，服务与应用程序之间传送的数据，由Properties和body组成，Properties可是对消息进行修饰，比如消息的优先级，延迟等高级特性，Body则就是消息体的内容。

- `Virtual Host`：虚拟节点，用于进行逻辑隔离，最上层的消息路由，一个虚拟主机理由可以有若干个Exhange和Queue，同一个虚拟主机里面不能有相同名字的Exchange

- `Exchange`：交换机，是 message 到达 broker 的第一站，用于根据分发规则、匹配查询表中的 routing key，分发消息到 queue 中去，不具备消息存储的功能。常用的类型有：direct、topic、fanout。

- `Bindings`：exchange 和 queue 之间的虚拟连接，binding 中可以包含 routing key，Binding 信息被保存到 exchange 中的查询表

中，用于 message 的分发依据。

- `Routing key`：是一个路由规则，虚拟机可以用它来确定如何路由一个特定消息

- `Queue`：消息队列，保存消息并将它们转发给消费者进行消费。

![Image](assets/images/3c71e48551/image-04.png)

**生产者**：产生数据发送消息的程序是生产者。

**交换机**：交换机是 RabbitMQ 非常重要的一个部件，一方面它接收来自生产者的消息，另一方面它将消息推送到队列中。交换机必须确切知道如何处理它接收到的消息，是将这些消息推送到特定队列还是推送到多个队列，亦或者是把消息丢弃，这个是由交换机类型决定的。

**队列**：队列是 RabbitMQ 内部使用的一种数据结构，尽管消息流经 RabbitMQ 和应用程序，但它们只能存储在队列中。队列仅受主机的内存和磁盘限制的约束，本质上是一个大的消息缓冲区。许多生产者可以将消息发送到一个队列，许多消费者可以尝试从一个队列接收数据。

**消费者**：消费与接收具有相似的含义。消费者大多时候是一个等待接收消息的程序。请注意生产者，消费者和消息中间件很多时候并不在同一机器上。同一个应用程序既可以是生产者又是可以是消费者。

## 四、Kafka和RabbitMQ处理消息的不同



RabbitMQ是通用消息代理，它优先考虑端到端消息传输。kafka是分布式事件流式处理平台，支持持续大数据的实时交换。

### 消息使用

rabbitMQ中，代理确保消费者收到消息，消费者应用程序扮演被动角色，等待RabbitMQ代理将消息推送到队列中。

kafka消费者更积极地读取和跟踪信息。当消息加入实体日志文件时，kafka消费者会跟踪他们读取的最后一条消息，并相应地更新offset。

### 消息优先级

RabbitMQ代理允许生产者软件使用优先队列升级某些消息。代理不是按照先入先出的顺序发送消息，而是先处理优先级更高的消息，然后再处理普通消息。

Apache Kafka不支持优先级队列。将所有消息分配到各自的分区时，该代理平等地对待这些消息。

### 消息删除

RabbitMQ代理将消息路由到目标队列。读取后，消费者向代理发送确认（ACK）回复，然后代理将消息从队列中删除。

Apache Kafka将消息附加到日志文件中，该日志文件将一直留存到其保留期到期。

### 其他区别

性能上：在消息传输容量上，kafka优于RabbitMQ。

- kafka每一秒可以发送数百万条消息，因为它使用顺序磁盘I/O来实现高吞吐量消息交换。顺序磁盘I/O是一种存储系统，用于存储和访问来自相邻内存空间的数据，比随机磁盘访问更加迅速。

- RabbitMQ也可以每秒发送数百万条消息，但是它需要多个代理才能实现。通常，RabbitMQ的性能为平均每秒处理数千条消息，如果RabbitMQ队列拥挤，处理可能会变慢。





