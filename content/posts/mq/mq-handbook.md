---
title: 消息队列深度面试手册
date: 2026-11-05
summary: 消息可靠性、幂等、顺序、积压、延迟与事务消息、MQ 选型，以及 Kafka / RocketMQ / RabbitMQ 核心原理。
interview: false
kind: handbook
---

> **适用对象**：3-5 年+ Java 后端开发者 · 大厂（阿里/美团/字节/腾讯）面试备战
> **核心目标**：不浮于表面，每个知识点深入到原理/源码/生产经验层面

---

## 1. 消息可靠性

### 1.1 原理详解

消息可靠性是指从 **Producer 发出消息** 到 **Consumer 成功处理** 的端到端保证，涉及三个环节：

#### （一）生产者可靠发送

**Kafka `acks` 机制（核心源码类：`KafkaProducer#doSend`）**

- `acks=0`：Producer 不等待任何确认，消息写入 socket buffer 即返回。最快但最不可靠。
- `acks=1`：Leader 写入本地 log 即返回确认。Leader 宕机未同步到 Follower 时会丢消息。
- `acks=all`（等同 `acks=-1`）：Leader 等待 ISR 中所有副本确认。配合 `min.insync.replicas=2`，才能真正保证不丢。

底层流程：`KafkaProducer.send()` → `RecordAccumulator.append()` → `Sender` 线程批量发送 → 等待 `ProduceResponse` 中的 ack。当 `acks=all` 时，Broker 端 `ReplicaManager.appendToLocalLog()` 写入 Leader 后，`DelayedProduce` 等待 ISR 列表中所有 Follower fetch 到该偏移量才返回响应。

**RocketMQ 同步/异步发送（核心源码类：`DefaultMQProducer#send`）**

- `send(Message msg)`：同步发送，内部调用 `MQClientAPIImpl.sendMessage()`，等待 Broker `SendResult` 返回。
- `send(Message msg, SendCallback callback)`：异步发送，底层 Netty Channel 写出后立即返回，响应通过 `SendCallback.onSuccess/onException` 回调。
- `sendOneway(Message msg)`：单向发送，不等任何响应。

同步发送 + `SYNC_MASTER`（主从同步复制）是最高可靠级别。

#### （二）Broker 持久化

**Kafka 副本机制**

```
Partition-0: Leader(Broker-1) → Follower(Broker-2) → Follower(Broker-3)
```

- 写入 Leader 的 PageCache → 由 OS 异步 flush 到磁盘（`log.flush.interval.messages` / `log.flush.interval.ms` 可配但通常不建议改，依赖副本冗余保障可靠性）。
- Follower 通过 `ReplicaFetcherThread` 持续拉取 Leader 数据，拉取成功后更新自己的 LEO（Log End Offset），Leader 据此推进 HW（High Watermark）。

**RocketMQ 刷盘策略（核心源码类：`CommitLog#putMessage`）**

- **同步刷盘**（`flushDiskType=SYNC_FLUSH`）：写入 CommitLog 后调用 `GroupCommitService`，等待刷盘完成才返回 `PutMessageResult`。性能低但不丢。
- **异步刷盘**（`flushDiskType=ASYNC_FLUSH`）：写入 MappedByteBuffer 即返回，由 `FlushRealTimeService` 后台定时刷盘。性能高但宕机可能丢少量消息。

#### （三）消费者确认

- **Kafka**：Consumer 提交 offset。`enable.auto.commit=true` 时自动提交（可能丢或重复），手动 `commitSync()`/`commitAsync()` 后处理完再提交更安全。
- **RocketMQ**：`MessageListenerConcurrently` 返回 `ConsumeConcurrentlyStatus.CONSUME_SUCCESS` 表示成功，返回 `RECONSUME_LATER` 会重试。底层通过更新 ConsumeQueue 的 offset 实现。
- **RabbitMQ**：`channel.basicAck(deliveryTag, false)` 手动确认。若不 ack 且 consumer 断开，消息重回队列。

### 1.2 实现方案对比

| 维度 | Kafka | RocketMQ | RabbitMQ |
|------|-------|----------|----------|
| 生产者确认 | `acks=all` + 重试 | 同步发送 + `SYNC_MASTER` | Publisher Confirm + mandatory |
| Broker 持久化 | 多副本 + PageCache | CommitLog + 同步/异步刷盘 | 镜像队列 + 持久化消息 |
| 消费者确认 | 手动 commit offset | 返回 `CONSUME_SUCCESS` | `basicAck` 手动确认 |
| 可靠性级别 | `acks=all` + `min.insync.replicas≥2` 最高 | 同步刷盘 + 同步复制最高 | 镜像队列 + 持久化最高 |
| 性能代价 | `acks=all` 吞吐约降 30%-50% | 同步刷盘吞吐降 50%+ | 镜像队列延迟明显增加 |

### 1.3 代码示例

```java
// Kafka 可靠发送配置
Properties props = new Properties();
props.put("acks", "all");
props.put("retries", 3);
props.put("retry.backoff.ms", 1000);
props.put("min.insync.replicas", 2);  // Broker 端配置
props.put("enable.idempotence", true); // 幂等生产者，防重试导致重复

KafkaProducer<String, String> producer = new KafkaProducer<>(props);
ProducerRecord<String, String> record = new ProducerRecord<>("order-topic", orderId, orderJson);

// 同步发送 + 异常处理
try {
    RecordMetadata metadata = producer.send(record).get();
    log.info("发送成功: topic={}, partition={}, offset={}", 
             metadata.topic(), metadata.partition(), metadata.offset());
} catch (ExecutionException e) {
    // 区分可重试异常和不可重试异常
    if (e.getCause() instanceof RetriableException) {
        // 重试逻辑（SDK 内部已 retry 过 retries 次后仍失败）
        saveToLocalDB(record); // 降级到本地表，定时补偿
    } else {
        log.error("不可重试异常", e);
        throw e;
    }
}
```

```java
// RocketMQ 可靠发送 + 本地消息表兜底
DefaultMQProducer producer = new DefaultMQProducer("reliable-producer-group");
producer.setRetryTimesWhenSendFailed(3);
producer.setSendMsgTimeout(5000);

Message msg = new Message("OrderTopic", "TagA", orderId, orderJson.getBytes());
try {
    SendResult result = producer.send(msg); // 同步发送
    if (result.getSendStatus() == SendStatus.SEND_OK) {
        updateLocalMessageStatus(orderId, "SENT");
    }
} catch (Exception e) {
    // 发送失败 → 落本地消息表 → 定时任务补偿重发
    saveToLocalMessageTable(orderId, orderJson, "PENDING");
}
```

### 1.4 生产踩坑经验

**坑1：Kafka `acks=all` 但 `min.insync.replicas=1`，等于没用**

很多团队以为设了 `acks=all` 就万事大吉，但如果 `min.insync.replicas` 默认为 1，当只剩 Leader 一个副本时，`acks=all` 退化为 `acks=1`。**必须 `min.insync.replicas≥2`**。

**坑2：RocketMQ 异步刷盘 + 主从异步复制，断电丢消息**

某电商在 Broker 物理机断电后丢失了约 30 秒的订单消息。原因：异步刷盘 + 异步复制的组合下，PageCache 中未刷盘的数据全丢。解决：核心业务改为同步刷盘，或在 Producer 端增加本地消息表做补偿。

**坑3：Consumer 先提交 offset 再处理业务，处理失败消息就丢了**

正确做法：先处理业务逻辑 → 业务成功后再提交 offset。如果处理时间过长导致 session.timeout 触发 rebalance，需要调大 `max.poll.interval.ms`。

### 1.5 面试追问点

**Q1：如果要保证消息绝对不丢，你会怎么做端到端的方案设计？**

> A：三阶段保障：
> 1. **Producer 端**：同步发送 + 失败重试 + 本地消息表兜底（发前写本地表，成功后更新状态，定时任务扫描重发失败的）
> 2. **Broker 端**：Kafka 用 `acks=all` + `min.insync.replicas=2` + `unclean.leader.election.enable=false`；RocketMQ 用同步刷盘 + 同步复制
> 3. **Consumer 端**：手动 ACK，先处理后提交，处理失败进重试队列
> 4. **补充**：对账机制 — 上游发消息后在 Redis 写一个标记，下游消费后删除标记，定时任务扫描超时未消费的消息进行报警/补偿

**Q2：`acks=all` 和 `min.insync.replicas` 的关系？如果 ISR 只剩 Leader 一个了会怎样？**

> A：如果 `min.insync.replicas=2` 但 ISR 只剩 Leader，则 Producer 发送会抛 `NotEnoughReplicasException`，消息发送失败。这是一种"宁可发送失败也不丢数据"的策略。`unclean.leader.election.enable=false` 则进一步保证不会从 OSR（非同步副本）中选举 Leader，避免数据回退。

**Q3：本地消息表方案的缺点？**

> A：增加了数据库写入压力，且定时任务扫描存在延迟（秒级到分钟级）。优化方案：用本地消息表 + 事件驱动（消息发送失败时立即触发重试线程），或使用 RocketMQ 事务消息替代。

---

## 2. 消息重复消费与幂等

### 2.1 原理详解

#### 为什么会重复？

重复的根本原因是 **at-least-once** 语义。常见场景：

1. **Producer 重试**：消息已到达 Broker，但 ack 丢失（网络闪断），Producer 超时重发 → Broker 存了两条。Kafka 的幂等生产者通过 `PID + SequenceNumber`（`ProducerStateManager` 维护）解决了单 Partition 内的去重。
2. **Consumer Rebalance**：Consumer A 正在处理消息，尚未提交 offset，Rebalance 发生，Partition 重新分配给 Consumer B，B 从上次已提交的 offset 开始消费 → 重复处理。
3. **Consumer 处理成功但 ACK 失败**：业务逻辑执行完，提交 offset 时网络异常，下次从旧 offset 消费 → 重复。

#### 幂等的本质

> 对于同一操作，执行一次和执行多次的效果完全一样。

核心思路：**每条消息携带唯一标识（Business ID / Message ID），消费端通过该标识做去重判断**。

### 2.2 实现方案对比

| 方案 | 原理 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|----------|
| **唯一 ID + 去重表** | 消费前查数据库去重表，不存在则处理并插入 | 强一致、可靠 | 增加 DB 查询，高并发下有性能瓶颈 | 订单/支付等强一致场景 |
| **Redis SETNX** | `SET messageId 1 NX EX 3600`，返回 true 才处理 | 性能高 | Redis 宕机可能导致误判；过期时间难以精确设定 | 高吞吐、允许极小概率重复的场景 |
| **数据库唯一约束** | 业务表设唯一索引（如 orderId），重复插入报 DuplicateKeyException | 简单直接 | 只适用于 INSERT 操作，UPDATE 场景不适用 | 新增类操作 |
| **Token 机制** | 消费前申请 Token（一次性），处理时校验并销毁 Token | 严格一次性 | 多一次网络交互，Token 管理复杂 | 防表单重复提交 |
| **状态机** | 检查当前状态是否允许转换，如"待支付→已支付"，重复触发时状态不允许再转换 | 天然幂等、无额外存储 | 仅适用于有明确状态流转的业务 | 订单状态流转 |
| **乐观锁 (version)** | `UPDATE order SET status='paid', version=version+1 WHERE id=? AND version=?` | 简单高效 | 并发冲突时需重试 | 更新类操作 |

### 2.3 代码示例

```java
// 方案一：唯一 ID + Redis SETNX + 去重表 双重保障
@Component
public class OrderMessageConsumer {
    
    @Autowired
    private StringRedisTemplate redisTemplate;
    @Autowired
    private IdempotentRecordMapper idempotentMapper;
    @Autowired
    private OrderService orderService;

    @RocketMQMessageListener(topic = "OrderTopic", consumerGroup = "order-consumer-group")
    public void onMessage(MessageExt msg) {
        String msgId = msg.getProperty("UNIQ_KEY"); // RocketMQ 消息唯一 ID
        String bizKey = msg.getKeys(); // 业务 Key（如 orderId）
        
        // 第一层：Redis 快速去重（挡住 99% 的重复）
        Boolean absent = redisTemplate.opsForValue()
            .setIfAbsent("mq:dedup:" + bizKey, "1", 24, TimeUnit.HOURS);
        if (Boolean.FALSE.equals(absent)) {
            log.warn("Redis 去重拦截，bizKey={}", bizKey);
            return; // 已消费过
        }
        
        // 第二层：数据库去重表（兜底，防 Redis 故障后的重复）
        try {
            IdempotentRecord record = new IdempotentRecord();
            record.setBizKey(bizKey);
            record.setMsgId(msgId);
            record.setCreateTime(new Date());
            idempotentMapper.insert(record); // 唯一索引在 bizKey 上
        } catch (DuplicateKeyException e) {
            log.warn("DB 去重拦截，bizKey={}", bizKey);
            return;
        }
        
        // 实际业务处理
        orderService.processOrder(JSON.parseObject(new String(msg.getBody()), Order.class));
    }
}
```

```java
// 方案二：状态机幂等
@Transactional
public void processPayment(String orderId, BigDecimal amount) {
    // 乐观锁 + 状态机，天然幂等
    int rows = orderMapper.updateStatus(orderId, 
        OrderStatus.PENDING,   // 期望当前状态
        OrderStatus.PAID,      // 目标状态
        amount);
    if (rows == 0) {
        log.info("订单状态已变更，重复消费被忽略，orderId={}", orderId);
        return; // 状态已不是 PENDING，说明已处理过
    }
    // 后续逻辑：扣库存、发通知等
}

// MyBatis SQL:
// UPDATE orders SET status=#{targetStatus}, pay_amount=#{amount}, 
//   update_time=NOW() 
// WHERE order_id=#{orderId} AND status=#{expectedStatus}
```

### 2.4 生产踩坑经验

**坑1：只用 MQ 的 MessageId 去重是不够的**

RocketMQ 的 `msgId` 是由 Producer 端生成的（`MessageClientIDSetter.createUniqID()`），在 Producer 重试时同一条消息会生成 **不同的 msgId**。应该用业务唯一键（orderId）做去重，而非 msgId。

**坑2：Redis 去重过期时间设置不当**

如果过期时间太短，消息在过期后被重新投递就会重复消费。如果太长，Redis 内存消耗大。实践经验：核心业务设 24h，结合 DB 去重表兜底。

**坑3：并发消费时 Redis SETNX 通过了但 DB 唯一约束也通过了**

极端情况：两个 Consumer 几乎同时消费同一条消息，Redis SETNX 只有一个成功，但如果 Redis 故障 failover 期间两个都返回 true？解决方案：DB 唯一约束是最终兜底，或者使用 Redis Lua 脚本保证原子性。

### 2.5 面试追问点

**Q1：Kafka 的幂等生产者是怎么实现的？能保证跨 Partition 幂等吗？**

> A：幂等生产者通过 `ProducerId(PID)` + `SequenceNumber` 实现。每个 Producer 实例启动时从 Broker 获取一个全局唯一的 PID，每条消息携带递增的 SequenceNumber。Broker 端 `ProducerStateManager` 维护每个 PID 在每个 Partition 上的最近 5 个 batch 的 SequenceNumber，重复则拒绝。
>
> **只能保证单 Partition 内的幂等**。跨 Partition 场景需要 Kafka 事务（`Transactional Producer`），通过 `TransactionCoordinator` + `__transaction_state` 内部 Topic 实现。

**Q2：如果消费者做幂等的 Redis 和 DB 都扛不住怎么办？**

> A：可以考虑：(1) 布隆过滤器做第零层过滤，内存极小，极快，容忍极低假阳性；(2) 本地缓存 Caffeine 做 L1，Redis 做 L2，DB 做 L3 三级去重；(3) 从设计层面让业务天然幂等（状态机 / 乐观锁），减少对外部去重组件的依赖。

---

## 3. 消息顺序性

### 3.1 原理详解

#### 全局有序 vs 分区有序

- **全局有序**：整个 Topic 的所有消息严格有序。代价极大 — 只能 1 个 Partition/Queue + 1 个 Consumer，吞吐量急剧下降，生产中几乎不用。
- **分区有序**：同一个 Partition/MessageQueue 内的消息有序。**生产中 99% 的顺序需求都是分区有序**（如同一订单的消息有序，不同订单之间不需要有序）。

#### Kafka 顺序保证原理

Kafka 保证 **单 Partition 内消息有序**。Producer 通过 `Partitioner` 将相同 Key 的消息路由到同一 Partition：

```
ProducerRecord(topic, key=orderId, value=...) 
→ DefaultPartitioner: hash(key) % numPartitions → 固定 Partition
```

Consumer 端：单 Partition 只能被同一 Consumer Group 中的一个 Consumer 消费（`ConsumerCoordinator` 分配保证），且 `KafkaConsumer.poll()` 返回的消息天然按 offset 有序。

**关键问题**：Consumer 内部如果是多线程并行处理，则顺序会被打破。

#### RocketMQ 顺序消息原理

RocketMQ 提供 `MessageQueueSelector` 接口：

```java
SendResult result = producer.send(msg, (mqs, m, arg) -> {
    int index = Math.abs(arg.hashCode()) % mqs.size();
    return mqs.get(index);
}, orderId);
```

消费端使用 `MessageListenerOrderly`（而非 `MessageListenerConcurrently`）：底层通过 `ConsumeMessageOrderlyService` 实现，对每个 MessageQueue **加锁**后顺序消费。锁的实现分两层：
1. **Broker 端分布式锁**：Consumer 定时向 Broker 发送 `LOCK_BATCH_MQ` 请求，锁定分配给自己的 Queue。
2. **Consumer 端本地锁**：`ProcessQueue` 级别的 `consumeLock`（ReentrantLock），保证同一 Queue 的消息顺序执行。

### 3.2 实现方案对比

| 方案 | 原理 | 吞吐量 | 实现复杂度 | 适用场景 |
|------|------|--------|-----------|----------|
| 全局有序（1 Partition + 1 Consumer） | 整个 Topic 单队列 | 极低（万级/s） | 低 | 极少数严格全局有序场景（如 binlog 同步单表） |
| 分区有序 + 相同 Key 路由 | hash(key) % partitions | 高（可水平扩展） | 中 | 同一业务实体有序（订单/用户维度） |
| 分区有序 + Consumer 内有序线程池 | 按 Key 分配到固定线程 | 中高 | 高 | 既要顺序又要一定并发度 |

### 3.3 代码示例

```java
// Kafka：相同订单 ID 路由到同一 Partition，Consumer 内按 Key 分发到有序线程
// Producer 端
ProducerRecord<String, String> record = new ProducerRecord<>("order-events", orderId, eventJson);
producer.send(record); // DefaultPartitioner 根据 orderId hash 路由

// Consumer 端：单线程消费 + 按 Key 分配到有序执行器
public class OrderlyConsumer {
    // Key → 固定线程，保证相同 orderId 始终在同一线程执行
    private final ExecutorService[] workers = new ExecutorService[16];
    
    public OrderlyConsumer() {
        for (int i = 0; i < workers.length; i++) {
            workers[i] = Executors.newSingleThreadExecutor();
        }
    }
    
    public void consume(ConsumerRecords<String, String> records) {
        for (ConsumerRecord<String, String> record : records) {
            int slot = Math.abs(record.key().hashCode()) % workers.length;
            workers[slot].submit(() -> processOrder(record));
        }
        // 注意：这里不能立即 commitSync()，需等所有 worker 处理完
        // 实际方案：用 CountDownLatch 或 CompletableFuture 等待后再提交
    }
}
```

```java
// RocketMQ 顺序消息
// Producer
SendResult result = producer.send(msg, new MessageQueueSelector() {
    @Override
    public MessageQueue select(List<MessageQueue> mqs, Message msg, Object arg) {
        String orderId = (String) arg;
        int index = Math.abs(orderId.hashCode()) % mqs.size();
        return mqs.get(index);
    }
}, orderId);

// Consumer：使用 MessageListenerOrderly
consumer.registerMessageListener(new MessageListenerOrderly() {
    @Override
    public ConsumeOrderlyStatus consumeMessage(List<MessageExt> msgs, 
                                                ConsumeOrderlyContext context) {
        for (MessageExt msg : msgs) {
            // 同一 Queue 内严格顺序执行到这里
            processOrderEvent(msg);
        }
        return ConsumeOrderlyStatus.SUCCESS;
    }
});
```

### 3.4 生产踩坑经验

**坑1：Partition 扩容导致顺序被打乱**

`hash(orderId) % 4` 和 `hash(orderId) % 8` 的结果不同。Partition 扩容后，相同 orderId 的消息可能被路由到不同 Partition。解决：扩容期间做消息迁移（类似一致性 Hash），或确保旧 Partition 的消息全部消费完后再扩容。

**坑2：RocketMQ 顺序消费时某条消息失败会阻塞整个 Queue**

`MessageListenerOrderly` 消费失败后会**不断重试当前消息**（默认 `MaxReconsumeTimes=Integer.MAX_VALUE` for orderly），后续消息全部阻塞。必须设置合理的最大重试次数，超过后发送到死信队列，让后续消息继续。

**坑3：Kafka Consumer 多线程处理打破了顺序**

很多团队从 `poll()` 拿到消息后丢到线程池并行处理，顺序完全丢失。正确做法见上面的"按 Key 分发到固定线程"方案。

### 3.5 面试追问点

**Q1：Kafka 能否做到 Exactly-Once 顺序消费？**

> A：Kafka 的 Exactly-Once 语义通过 `幂等生产者 + 事务` 实现。在消费端，可以将消费和 offset 提交放在同一个事务中（`read-process-write` 模式，输出到 Kafka），但如果输出到外部系统（如 DB），则需要消费端自行保证幂等。严格来说，Kafka 的 EOS 是 **Kafka 到 Kafka 的端到端保证**。

**Q2：顺序消费和吞吐量如何平衡？**

> A：(1) 缩小有序范围——只对需要有序的 Key 保证顺序，不同 Key 可以并行；(2) 增加 Partition 数量提高并行度；(3) Consumer 内使用有序线程池（按 Key 哈希到固定线程），在保证同 Key 有序的同时利用多核。

---

## 4. 消息积压

### 4.1 原理详解

消息积压 = **生产速率 > 消费速率**，本质是一个**排队论问题**。当 `λ (到达率) > μ (服务率)` 时，队列长度持续增长。

#### 积压的常见原因

1. **消费者故障**：消费线程异常退出、OOM、死锁。
2. **消费速度不足**：单条消息处理太慢（如调外部接口超时）、消费者数量不够。
3. **突发流量**：促销/秒杀导致生产速率暴增。
4. **Rebalance 风暴**：频繁 Rebalance 导致 Consumer 停止消费（STW 效应），期间消息持续堆积。

#### 积压的影响

- **Kafka**：消息存磁盘，积压本身不会丢消息，但会导致消费延迟。严重时磁盘满，触发 `log.retention` 策略删除旧数据 → **未消费的消息被删除**。
- **RocketMQ**：CommitLog 默认保留 72h，ConsumeQueue 的 offset 指向的 CommitLog 被删除后消费失败。大量积压还会导致 ConsumeQueue 膨胀，Broker 内存压力增大。
- **RabbitMQ**：内存队列为主，积压直接吃内存，触发 `vm_memory_high_watermark` 后 Broker 阻塞 Producer（Flow Control）。

### 4.2 实现方案对比

| 方案 | 适用场景 | 优点 | 缺点 |
|------|---------|------|------|
| **扩容 Consumer** | 消费速度不足 | 最直接有效 | Kafka: Consumer 数不能超过 Partition 数 |
| **临时 Topic 转发** | 紧急消费大量积压 | 快速清理积压 | 需要额外资源，操作复杂 |
| **跳过非关键消息** | 积压严重且部分消息可丢弃 | 极快恢复 | 有数据丢失风险 |
| **提升单条处理速度** | 消费逻辑慢 | 治本 | 优化空间有限 |
| **批量消费** | 数据库写入类消费 | 吞吐提升数倍 | 需要业务支持批量操作 |

### 4.3 代码示例

```java
// 紧急积压处理：临时转发到多 Partition 的新 Topic，用更多 Consumer 消费

// Step 1: 启动转发 Consumer，从积压 Topic 快读快写到临时 Topic
public class EmergencyDispatcher {
    public void dispatch() {
        KafkaConsumer<String, String> consumer = createConsumer("backlog-group");
        KafkaProducer<String, String> producer = createProducer();
        consumer.subscribe(Collections.singletonList("order-topic")); // 积压 Topic
        
        while (hasBacklog) {
            ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(1000));
            for (ConsumerRecord<String, String> r : records) {
                // 转发到 50 个 Partition 的临时 Topic
                producer.send(new ProducerRecord<>("order-topic-tmp", r.key(), r.value()));
            }
            consumer.commitSync();
        }
    }
}

// Step 2: 部署 50 个 Consumer 实例消费临时 Topic
// Step 3: 积压清理完成后，切回原 Topic，销毁临时资源
```

```java
// 提升消费吞吐：批量消费 + 批量写 DB
@KafkaListener(topics = "user-behavior", groupId = "analytics-group",
               containerFactory = "batchFactory")
public void batchConsume(List<ConsumerRecord<String, String>> records) {
    List<UserBehavior> batch = records.stream()
        .map(r -> JSON.parseObject(r.value(), UserBehavior.class))
        .collect(Collectors.toList());
    
    // 批量写入，一次 SQL 插入 500 条
    userBehaviorMapper.batchInsert(batch); // INSERT INTO ... VALUES (...),(...),(...)
    log.info("批量消费 {} 条", batch.size());
}

// batchFactory 配置
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> batchFactory() {
    var factory = new ConcurrentKafkaListenerContainerFactory<String, String>();
    factory.setBatchListener(true);
    factory.getContainerProperties().setAckMode(AckMode.MANUAL_IMMEDIATE);
    factory.setConcurrency(8); // 8 个消费线程
    return factory;
}
```

### 4.4 生产踩坑经验

**坑1：Kafka 扩了 Consumer 但没扩 Partition，新 Consumer 空闲**

Kafka 中一个 Partition 只能被同一 ConsumerGroup 的一个 Consumer 消费。如果有 8 个 Partition 但部署了 16 个 Consumer，则 8 个 Consumer 空闲。**先扩 Partition，再扩 Consumer**。

**坑2：Rebalance 导致的"消费停顿性积压"**

Consumer 频繁上下线触发 Rebalance，每次 Rebalance 期间所有 Consumer 停止消费。解决：(1) 增大 `session.timeout.ms` 和 `max.poll.interval.ms`；(2) 使用 Kafka 2.4+ 的 `CooperativeStickyAssignor`，增量式 Rebalance 减少停顿。

**坑3：积压消息全部从磁盘读取，Kafka PageCache 失效**

正常消费时 Kafka 利用 PageCache 做热数据读取（零拷贝），但大量积压意味着要读冷数据，频繁磁盘 IO 会拖慢整个 Broker。解决：独立的积压消费 Consumer 使用限流，避免把 Broker IO 打满。

### 4.5 面试追问点

**Q1：如果线上出现百万级消息积压，你的应急处理流程是什么？**

> A：(1) **止血**：检查消费者是否存活、是否有异常日志，快速重启故障实例。(2) **评估**：通过监控看积压量和消费速度，计算恢复时间。(3) **扩容**：如果是消费能力不足，先扩 Partition（Kafka）再扩 Consumer。如果积压太严重，启动临时转发方案。(4) **降级**：非核心消息可以暂时跳过或延后。(5) **复盘**：根因分析，加监控报警。

**Q2：RabbitMQ 积压和 Kafka 积压有什么本质区别？**

> A：RabbitMQ 是内存优先的 Broker，消息堆积直接吃内存，触发 Flow Control 后会反压 Producer；Kafka 是磁盘存储，消息积压本身对 Broker 压力较小（只是占磁盘），但消费冷数据会影响 PageCache 命中率。所以 RabbitMQ 不适合大量积压的场景，Kafka 天然更抗积压。

---

## 5. 延迟消息/定时消息

### 5.1 原理详解

#### RocketMQ 延迟级别（源码类：`ScheduleMessageService`）

RocketMQ 开源版支持 18 个固定延迟级别：`1s 5s 10s 30s 1m 2m 3m 4m 5m 6m 7m 8m 9m 10m 20m 30m 1h 2h`。

**实现原理**：

1. Producer 发送延迟消息：`msg.setDelayTimeLevel(3)` → level 3 对应 10s。
2. Broker 收到后，**不写入原 Topic**，而是写入内部 Topic `SCHEDULE_TOPIC_XXXX` 的对应 Queue（queueId = delayLevel - 1）。
3. `ScheduleMessageService` 为每个 delayLevel 启动一个 `DeliverDelayedMessageTimerTask`，定时扫描到期的消息。
4. 到期后，将消息从 `SCHEDULE_TOPIC` 取出，**恢复原 Topic 和 QueueId**（存储在消息属性 `REAL_TOPIC` / `REAL_QID` 中），重新写入 CommitLog。
5. 消费者从原 Topic 正常消费。

核心设计思想：**利用多级 Queue 做"时间桶"分隔**，避免全量扫描。

#### RabbitMQ 死信队列 + TTL 实现延迟

```
Producer → delay.exchange → delay.queue (TTL=30s, 无 Consumer) 
    → 消息过期 → DLX(Dead Letter Exchange) → real.queue → Consumer
```

原理：消息在 `delay.queue` 中到达 TTL 后，被路由到死信交换机，再投递到实际消费队列。

**注意**：RabbitMQ 的队列级 TTL 和消息级 TTL 有区别。队列级 TTL 只检查队头消息，如果队头消息 TTL 较长，后面 TTL 短的消息不会先过期 → **无法实现任意延迟时间的精确投递**。RabbitMQ 3.8+ 引入的 `rabbitmq_delayed_message_exchange` 插件解决了此问题。

#### 时间轮算法（HashedWheelTimer）

Netty 的 `HashedWheelTimer` 被广泛用于实现高性能延迟任务：

```
时间轮：一个环形数组 bucket[512]，每个 bucket 挂一个链表
tickDuration = 100ms，一圈 = 512 * 100ms ≈ 51.2s
超过一圈的任务通过 remainingRounds 字段记录剩余圈数
```

每次 tick（100ms）：遍历当前 bucket 的链表，`remainingRounds == 0` 的任务执行，`> 0` 的减 1。时间复杂度 O(1) 添加，O(m) 每 tick（m 为当前 bucket 任务数）。

### 5.2 实现方案对比

| 方案 | 精度 | 延迟范围 | 吞吐 | 复杂度 | 适用 MQ |
|------|------|---------|------|--------|---------|
| RocketMQ 延迟级别 | 固定 18 级 | 1s ~ 2h | 高 | 低 | RocketMQ |
| RabbitMQ DLX + TTL | 秒级 | 任意（有队列头阻塞问题） | 中 | 中 | RabbitMQ |
| RabbitMQ 延迟插件 | 秒级 | 任意 | 中低 | 低 | RabbitMQ |
| Kafka + 外部调度 | 取决于调度精度 | 任意 | 高 | 高 | Kafka |
| 时间轮 + Redis | 毫秒级 | 任意 | 极高 | 高 | 自研 |
| 数据库轮询 | 秒~分钟级 | 任意 | 低 | 低 | 无 MQ |

### 5.3 代码示例

```java
// RocketMQ 延迟消息
Message msg = new Message("OrderTimeoutTopic", "timeout", orderId,
    JSON.toJSONBytes(orderTimeout));
msg.setDelayTimeLevel(16); // level 16 = 30 分钟
SendResult result = producer.send(msg);

// Consumer 30 分钟后收到，检查订单是否已支付
@RocketMQMessageListener(topic = "OrderTimeoutTopic", consumerGroup = "timeout-check-group")
public void onMessage(MessageExt msg) {
    OrderTimeout timeout = JSON.parseObject(msg.getBody(), OrderTimeout.class);
    Order order = orderService.getById(timeout.getOrderId());
    if (order.getStatus() == OrderStatus.PENDING) {
        orderService.cancelOrder(order.getOrderId()); // 超时关单
    }
}
```

```java
// RabbitMQ 死信队列实现延迟消息
@Configuration
public class DelayQueueConfig {
    
    // 延迟队列（无消费者，消息 TTL 后进入死信交换机）
    @Bean
    public Queue delayQueue() {
        return QueueBuilder.durable("order.delay.queue")
            .withArgument("x-dead-letter-exchange", "order.dlx.exchange")
            .withArgument("x-dead-letter-routing-key", "order.close")
            .withArgument("x-message-ttl", 1800000) // 30 分钟
            .build();
    }
    
    // 死信交换机 → 实际消费队列
    @Bean
    public Queue realQueue() {
        return new Queue("order.close.queue", true);
    }
    
    @Bean
    public DirectExchange dlxExchange() {
        return new DirectExchange("order.dlx.exchange");
    }
    
    @Bean
    public Binding dlxBinding() {
        return BindingBuilder.bind(realQueue())
            .to(dlxExchange()).with("order.close");
    }
}
```

```java
// Kafka 无原生延迟消息，基于时间轮的自研方案骨架
public class KafkaDelayService {
    private final HashedWheelTimer timer = new HashedWheelTimer(100, TimeUnit.MILLISECONDS, 512);
    private final KafkaProducer<String, String> producer;
    
    // 消费延迟 Topic → 放入时间轮 → 到期后写入真实 Topic
    public void scheduleDelay(String realTopic, String key, String value, long delayMs) {
        timer.newTimeout(timeout -> {
            producer.send(new ProducerRecord<>(realTopic, key, value));
        }, delayMs, TimeUnit.MILLISECONDS);
    }
}
// 注意：纯内存时间轮，重启丢数据。生产中需结合 Redis ZSet 做持久化兜底。
```

### 5.4 生产踩坑经验

**坑1：RabbitMQ 消息级 TTL 的"队头阻塞"**

给不同消息设置不同 TTL，但 RabbitMQ 只检查队头。队头 TTL=60s 的消息未过期时，后面 TTL=5s 的消息即使到期也不会被投递到 DLX。解决：为不同延迟时间创建不同的延迟队列，或使用延迟消息插件。

**坑2：RocketMQ 延迟级别不满足业务需求**

业务需要延迟 15 分钟，但开源版只有 10m 和 20m 两个级别。方案：(1) 修改 `MessageStoreConfig.messageDelayLevel` 自定义级别；(2) 使用 RocketMQ 5.x 的任意延迟（底层基于 TimerWheel + TimerLog 实现）。

**坑3：大量延迟消息同时到期导致瞬间洪峰**

例如电商场景，大促期间大量订单同时下单，30 分钟后同时触发超时检查。解决：延迟时间加随机抖动（如 30min ± random(0, 60s)），打散到期时间。

### 5.5 面试追问点

**Q1：RocketMQ 5.x 的任意时间延迟消息是怎么实现的？**

> A：RocketMQ 5.x 引入了 `TimerWheel` + `TimerLog` 机制。TimerWheel 是一个时间轮（默认精度 1s，时长 7 天），每个槽位存储一个 TimerLog 的链表。延迟消息先写入 `rmq_sys_wheel_timer` Topic，`TimerEnqueueService` 将消息按到期时间放入 TimerWheel 对应槽位。`TimerDequeueService` 扫描到期消息，恢复原 Topic 后投递。相比固定 18 级，支持任意秒级延迟，但增加了存储和 CPU 开销。

**Q2：为什么不直接用 `ScheduledExecutorService` 或 `DelayQueue`？**

> A：`ScheduledExecutorService` 底层是最小堆（`DelayedWorkQueue`），添加和删除的时间复杂度 O(log n)，百万级任务性能差。`HashedWheelTimer` 添加是 O(1)，更适合大量定时任务。但 HashedWheelTimer 精度受 `tickDuration` 限制，适合秒级以上的延迟场景。

---

## 6. 事务消息

### 6.1 原理详解

#### RocketMQ 事务消息（半消息机制）

解决的核心问题：**本地事务和消息发送的原子性** — 要么都成功，要么都失败。

**流程（源码类：`TransactionalMessageServiceImpl`）**：

```
1. Producer → Broker: 发送 Half Message (写入内部 Topic: RMQ_SYS_TRANS_HALF_TOPIC)
2. Broker → Producer: 返回发送结果
3. Producer: 执行本地事务（如 DB 操作）
4. Producer → Broker: 发送 Commit/Rollback
   - Commit: Broker 将 Half Message 恢复到原 Topic，Consumer 可消费
   - Rollback: Broker 删除 Half Message（实际是标记 OP Topic 对应位置已处理）
5. 如果 Step 4 失败（网络断开等）:
   Broker 定时回查（TransactionalMessageCheckService，默认 60s 一次）
   → Producer 端 LocalTransactionChecker 检查本地事务状态
   → 返回 COMMIT / ROLLBACK / UNKNOWN
```

**半消息存储细节**：
- Half Message 写入 `RMQ_SYS_TRANS_HALF_TOPIC`，`queueId = 0`。
- Commit/Rollback 的操作记录写入 `RMQ_SYS_TRANS_OP_HALF_TOPIC`。
- 回查服务扫描 Half Topic 中未在 OP Topic 中出现的消息进行回查。
- 默认最多回查 15 次（`transactionCheckMax`），超过则丢弃并打印日志。

#### Kafka 事务消息

Kafka 的事务是更宏观的概念：**保证一组消息的原子写入**（跨 Partition），以及 **read-process-write 的端到端 EOS**。

核心组件：
- `TransactionCoordinator`：运行在 Broker 上，管理事务状态。
- `__transaction_state`：内部 Topic，存储事务元数据（类似两阶段提交的 redo log）。
- `PID + Epoch`：每个事务 Producer 有唯一 PID 和递增的 Epoch，防止僵尸 Producer。

流程：
```
1. producer.initTransactions() → 注册 transactional.id，获取 PID + Epoch
2. producer.beginTransaction()
3. producer.send(record1) / send(record2) → 写入目标 Partition
4. producer.sendOffsetsToTransaction(offsets, consumerGroupId) → 消费 offset 和生产写入同一事务
5. producer.commitTransaction() → Two-Phase Commit
   Phase 1: 写 PREPARE 到 __transaction_state
   Phase 2: 写 COMMIT marker 到各目标 Partition + 写 COMPLETE 到 __transaction_state
```

Consumer 端通过 `isolation.level=read_committed` 只读取已提交的消息（通过 LSO - Last Stable Offset 过滤）。

### 6.2 实现方案对比

| 维度 | RocketMQ 事务消息 | Kafka 事务 | 本地消息表 |
|------|------------------|-----------|-----------|
| 本质 | 半消息 + 回查 | 两阶段提交 | 本地 DB 事务绑定 |
| 原子性保证 | 本地事务 + 消息发送 | 多 Partition 消息 + offset | 本地事务 + 消息记录 |
| 实现复杂度 | 中（SDK 封装好） | 高（需理解 EOS 语义） | 低但侵入性强 |
| 回查机制 | 有（Broker 主动回查） | 无（依赖事务超时） | 无（依赖定时任务） |
| 适用场景 | 分布式事务最终一致性 | Kafka Streams / 精确一次处理 | 任意 MQ、简单可靠 |
| 性能影响 | 额外写半消息 Topic | 额外写 __transaction_state | 额外 DB 写入 |

### 6.3 代码示例

```java
// RocketMQ 事务消息：下单 → 扣库存
TransactionMQProducer producer = new TransactionMQProducer("tx-producer-group");
producer.setTransactionListener(new TransactionListener() {
    
    @Override
    public LocalTransactionState executeLocalTransaction(Message msg, Object arg) {
        // 执行本地事务（Half Message 已发送成功）
        try {
            OrderCreateParam param = (OrderCreateParam) arg;
            orderService.createOrder(param); // 数据库操作
            return LocalTransactionState.COMMIT_MESSAGE;
        } catch (Exception e) {
            log.error("本地事务失败", e);
            return LocalTransactionState.ROLLBACK_MESSAGE;
        }
    }
    
    @Override
    public LocalTransactionState checkLocalTransaction(MessageExt msg) {
        // Broker 回查：根据消息中的业务 ID 查本地事务状态
        String orderId = msg.getKeys();
        Order order = orderService.getById(orderId);
        if (order != null) {
            return LocalTransactionState.COMMIT_MESSAGE;
        }
        // 如果查不到，可能事务还在执行中
        return LocalTransactionState.UNKNOW; // Broker 会继续回查
    }
});

// 发送事务消息
Message msg = new Message("OrderTopic", "create", orderId, orderJson.getBytes());
msg.setKeys(orderId);
TransactionSendResult result = producer.sendMessageInTransaction(msg, createParam);
```

```java
// Kafka 事务：read-process-write 精确一次
Properties props = new Properties();
props.put("transactional.id", "order-processor-001");
props.put("enable.idempotence", true);
KafkaProducer<String, String> producer = new KafkaProducer<>(props);
producer.initTransactions();

KafkaConsumer<String, String> consumer = createConsumer("order-group");
consumer.subscribe(List.of("raw-orders"));

while (true) {
    ConsumerRecords<String, String> records = consumer.poll(Duration.ofMillis(500));
    if (records.isEmpty()) continue;
    
    producer.beginTransaction();
    try {
        for (ConsumerRecord<String, String> r : records) {
            // 处理消息
            String enrichedOrder = enrichOrder(r.value());
            producer.send(new ProducerRecord<>("enriched-orders", r.key(), enrichedOrder));
        }
        // 消费 offset 也纳入事务
        producer.sendOffsetsToTransaction(
            getOffsets(records), 
            new ConsumerGroupMetadata("order-group"));
        producer.commitTransaction();
    } catch (Exception e) {
        producer.abortTransaction();
        log.error("事务失败，消息将重新消费", e);
    }
}
```

### 6.4 生产踩坑经验

**坑1：RocketMQ 事务回查不生效**

回查需要 Producer 保持运行。如果 Producer 是短生命周期进程（如定时任务），发完消息就退出了，Broker 回查时找不到 Producer → 超过 15 次后消息被丢弃。解决：事务 Producer 必须是长驻进程。

**坑2：Kafka 事务超时导致 Zombie Fencing**

`transaction.timeout.ms` 默认 60s。如果事务内处理时间超过 60s，`TransactionCoordinator` 会主动 Abort 事务并 Fence 掉 Producer（递增 Epoch），之后该 Producer 实例无法继续发送。解决：调大超时时间或减小单次事务处理的消息量。

**坑3：事务消息和本地事务不在同一个 DB 事务中**

RocketMQ 的 `executeLocalTransaction` 里执行 DB 操作，但消息发送和 DB 操作不在同一个事务中（消息走网络，DB 走 JDBC）。如果 DB 提交后断电，Broker 会通过回查确认。但如果 DB 提交前断电，本地事务回滚了，回查时根据业务 ID 查不到记录 → 回查返回 ROLLBACK → 最终一致。

### 6.5 面试追问点

**Q1：RocketMQ 事务消息和本地消息表方案对比，你怎么选？**

> A：RocketMQ 事务消息：侵入性低、不需要额外 DB 表、有回查兜底机制，适合已使用 RocketMQ 的场景。本地消息表：不依赖特定 MQ、实现简单透明、可靠性强（本地 DB 事务保证），适合 MQ 迁移频繁或使用 Kafka 等不支持事务消息的场景。中大型项目推荐 RocketMQ 事务消息；简单项目或非 RocketMQ 技术栈推荐本地消息表。

**Q2：Kafka 事务和 RocketMQ 事务消息解决的是同一个问题吗？**

> A：不完全相同。RocketMQ 事务消息解决的是 **"本地事务 + 消息发送"的原子性**，是分布式事务的一种实现（基于可靠消息的最终一致性）。Kafka 事务解决的是 **"多 Partition 原子写入 + read-process-write EOS"**，更偏向流处理场景的精确一次语义。如果要在 Kafka 上实现类似 RocketMQ 的事务消息，需要在 Consumer 端配合本地事务 + 幂等来实现。

---

## 7. MQ 选型对比

### 7.1 核心维度对比

| 维度 | Kafka | RocketMQ | RabbitMQ |
|------|-------|----------|----------|
| **开发语言** | Scala + Java | Java | Erlang |
| **单机吞吐** | 百万级/s（顺序写 + 零拷贝） | 十万级/s | 万级/s |
| **消息延迟** | ms 级 | ms 级 | μs 级（最低） |
| **可用性** | 高（副本 + ISR） | 高（主从 + DLedger） | 高（镜像队列） |
| **消息可靠** | 高 | 高 | 高 |
| **顺序消息** | Partition 级有序 | Queue 级有序，支持全局顺序 | 单 Queue 有序 |
| **延迟消息** | 不支持（需自研） | 原生支持（18 级 / 5.x 任意延迟） | 通过 DLX+TTL / 插件 |
| **事务消息** | 支持（Transactional Producer） | 原生支持（半消息） | 不支持 |
| **消息过滤** | 不支持（Consumer 自行过滤） | Tag + SQL92 表达式过滤 | RoutingKey + Exchange 灵活路由 |
| **消息回溯** | 支持（按 offset / timestamp） | 支持（按时间） | 不支持（ack 后删除） |
| **消息堆积** | 非常强（磁盘顺序存储） | 强（CommitLog 磁盘存储） | 弱（内存为主，堆积导致性能急剧下降） |
| **运维复杂度** | 高（依赖 ZK 或 KRaft） | 中（NameServer 轻量） | 中 |
| **生态** | 大数据生态极强 | 电商/金融场景丰富 | 企业级集成丰富 |
| **社区 / 商业支持** | Confluent 商业版 | 阿里云商业版 | VMware 商业版 |

### 7.2 选型建议

```
                 ┌─ 大数据场景（日志采集、实时计算、数据管道）─→ Kafka
                 │
                 ├─ 电商/金融（事务消息、延迟消息、消息过滤）─→ RocketMQ
你的业务场景 ────┤
                 ├─ 复杂路由/企业集成（多协议、灵活 Exchange）─→ RabbitMQ
                 │
                 └─ 超高吞吐 + 流处理（Kafka Streams / Flink）─→ Kafka
```

### 7.3 面试追问点

**Q1：为什么 Kafka 吞吐量能做到百万级？**

> A：四大优化：(1) **顺序写磁盘**：追加写 CommitLog，磁盘顺序写速度接近内存随机写（600MB/s vs 100MB/s）；(2) **PageCache**：利用操作系统页缓存，写入内存即返回，由 OS 异步刷盘；(3) **零拷贝（sendfile）**：Consumer 拉取消息时，通过 `FileChannel.transferTo()` → Linux `sendfile()` 系统调用，数据从磁盘 → PageCache → 网卡，不经过用户态拷贝；(4) **批量 + 压缩**：Producer 端 `RecordAccumulator` 批量聚合 + gzip/snappy 压缩，减少网络 IO 次数和带宽。

**Q2：什么场景不适合用 Kafka？**

> A：(1) 需要精确延迟消息（Kafka 无原生支持）；(2) 需要复杂消息路由（Kafka 只有 Topic 级别，RabbitMQ 的 Exchange 更灵活）；(3) Topic 数量极多（数万）的场景 — Kafka 每个 Partition 对应独立日志文件，过多 Partition 导致随机 IO，性能急剧下降；RocketMQ 所有 Topic 共用一个 CommitLog，更适合多 Topic 场景。

---

## 8. Kafka 核心原理

### 8.1 分区与副本

```
Topic: order-events (3 partitions, replication-factor=3)

Broker-0: P0(Leader), P1(Follower), P2(Follower)
Broker-1: P0(Follower), P1(Leader), P2(Follower)
Broker-2: P0(Follower), P1(Follower), P2(Leader)
```

每个 Partition 是一个有序、不可变的消息序列，物理上由多个 Segment 文件组成（默认 1GB 一个 Segment）。每个 Segment 包含 `.log`（消息数据）+ `.index`（稀疏索引，offset → 物理位置）+ `.timeindex`（时间索引）。

### 8.2 ISR 机制（In-Sync Replicas）

ISR 是与 Leader 保持同步的副本集合。判断标准：Follower 的 LEO（Log End Offset）是否落后 Leader 超过 `replica.lag.time.max.ms`（默认 30s）。

```
Leader LEO = 1000, HW = 980
ISR: [Broker-0(Leader), Broker-1(LEO=995), Broker-2(LEO=980)]
OSR: [Broker-3(LEO=500)] -- 落后超过阈值，被移出 ISR
```

- **HW (High Watermark)**：ISR 中所有副本的最小 LEO。Consumer 只能消费 HW 之前的消息。
- **Leader Epoch**：解决 HW 截断导致数据不一致的问题（Kafka 0.11+ 引入）。每次 Leader 切换递增 Epoch，Follower 恢复时通过 `OffsetsForLeaderEpoch` 请求确认截断点，而非简单截断到 HW。

### 8.3 Consumer Group Rebalance

当 Consumer 数量变化、Partition 数量变化或 Consumer 心跳超时时触发 Rebalance。

**协议演进**：
- **Eager Rebalance（旧）**：所有 Consumer 停止消费 → 重新分配 → 恢复消费。全程 STW。
- **Cooperative Sticky Rebalance（新，2.4+）**：增量式分配，只迁移需要变动的 Partition，其余 Consumer 继续消费。减少停顿。

**分配策略**：
- `RangeAssignor`：按 Partition 范围分配，可能不均匀。
- `RoundRobinAssignor`：轮询分配，较均匀。
- `StickyAssignor`：尽量保持现有分配不变，减少迁移。
- `CooperativeStickyAssignor`：Sticky + 增量式 Rebalance。

### 8.4 零拷贝（sendfile）

```
传统方式: 磁盘 → 内核缓冲区 → 用户缓冲区 → Socket 缓冲区 → 网卡 (4次拷贝, 4次上下文切换)
sendfile: 磁盘 → 内核缓冲区 → 网卡 (2次拷贝, 2次上下文切换, 支持 DMA 时可进一步优化)
```

Kafka 通过 `FileChannel.transferTo()` → 底层调用 Linux `sendfile()` 系统调用 → 数据在内核态直接从 PageCache 传输到 Socket Buffer → 网卡发出。

### 8.5 顺序写 + PageCache

```java
// Kafka 写消息：追加写到 Segment 文件尾部
// 源码类: kafka.log.LogSegment#append
// 实际操作：FileChannel.write(records) → 写入 PageCache → OS 后台 flush 到磁盘
```

顺序写磁盘的带宽可达 600MB/s（SSD），而随机写仅 100KB/s~1MB/s。Kafka 所有消息追加到日志末尾，完全避免随机写。

Producer 的消息先写入 PageCache（操作系统内存缓存），由 OS 根据 dirty page ratio 异步刷盘。这也是为什么 Kafka 不建议在 Broker 端配置同步刷盘的原因 — 依赖副本机制保证可靠性，让 OS 管理刷盘效率更高。

### 8.6 Controller 选举

- **ZooKeeper 模式**（旧）：多个 Broker 竞争创建 `/controller` 临时节点，成功者成为 Controller。Controller 负责 Partition Leader 选举、ISR 变更、Topic 增删等元数据管理。
- **KRaft 模式**（新，3.0+ GA）：去除 ZooKeeper 依赖，使用 Raft 协议在多个 Controller 节点间选举 Leader。元数据存储在内部 `__cluster_metadata` Topic 中。

### 8.7 代码示例

```java
// Kafka Consumer 手动 Rebalance 监听 + 优雅处理
KafkaConsumer<String, String> consumer = new KafkaConsumer<>(props);
consumer.subscribe(List.of("order-events"), new ConsumerRebalanceListener() {
    
    @Override
    public void onPartitionsRevoked(Collection<TopicPartition> partitions) {
        // Rebalance 前回调：提交当前消费进度，避免重复消费
        log.info("Partitions 被回收: {}", partitions);
        consumer.commitSync(getCurrentOffsets());
    }
    
    @Override
    public void onPartitionsAssigned(Collection<TopicPartition> partitions) {
        // Rebalance 后回调：可以从特定位置开始消费
        log.info("Partitions 被分配: {}", partitions);
        for (TopicPartition tp : partitions) {
            Long savedOffset = offsetStore.get(tp); // 从外部存储恢复
            if (savedOffset != null) {
                consumer.seek(tp, savedOffset);
            }
        }
    }
});
```

### 8.8 面试追问点

**Q1：Kafka 的 HW 和 LEO 分别是什么？为什么需要 Leader Epoch？**

> A：LEO（Log End Offset）是每个副本日志的下一条写入位置；HW（High Watermark）是 ISR 中所有副本 LEO 的最小值，Consumer 只能读到 HW 之前的消息。
>
> HW 的问题：Leader 宕机恢复后，如果 Follower 按 HW 截断日志，可能导致已提交数据丢失。Leader Epoch 解决这个问题：Follower 恢复时不直接截断到 HW，而是向新 Leader 发送 `OffsetsForLeaderEpoch` 请求，获取该 Epoch 下的正确截断位置。

**Q2：为什么 Kafka 不建议 Topic 太多？**

> A：每个 Partition 对应独立的 `.log` + `.index` + `.timeindex` 文件。Partition 数量 = Topic 数 × Partition 数/Topic。过多文件导致：(1) 文件描述符耗尽；(2) 顺序写退化为随机写（多文件并发追加）；(3) Controller 元数据管理压力增大。经验值：单 Broker 建议 Partition 数不超过 4000-6000。

**Q3：Kafka 消费者 Rebalance 有什么问题？怎么优化？**

> A：主要问题是 STW — Rebalance 期间所有 Consumer 停止消费。优化：(1) 使用 `CooperativeStickyAssignor` 增量式 Rebalance；(2) 合理设置 `session.timeout.ms`（10-30s）和 `heartbeat.interval.ms`（3s）避免误判；(3) 减少消费者频繁上下线；(4) 使用静态 GroupMembership（`group.instance.id`），Consumer 短暂下线不触发 Rebalance（等待 session timeout）。

---

## 9. RocketMQ 核心原理

### 9.1 NameServer

NameServer 是轻量级的服务发现组件，类似简化版的 ZooKeeper，但 **无状态、无主从、各节点独立**。

- Broker 每 30s 向 **所有** NameServer 发送心跳（包含 Topic 路由信息）。
- NameServer 每 10s 扫描 Broker 存活状态，120s 无心跳则移除。
- Producer/Consumer 启动时随机连一个 NameServer 获取路由信息，缓存在本地，每 30s 更新。

为什么不用 ZooKeeper？(1) 轻量、运维简单；(2) 无选举、无一致性协议开销；(3) RocketMQ 不需要强一致的服务发现（路由信息最终一致即可）。

### 9.2 Broker 主从架构

```
NameServer-1  NameServer-2  NameServer-3
     ↑             ↑             ↑
     └──── heartbeat ─────────────┘
              ↑
   Broker-Master (brokerId=0)  ←→  Broker-Slave (brokerId=1)
        同步/异步复制
```

- **同步复制（SYNC_MASTER）**：Master 写入 CommitLog 后，等待 Slave 也写入成功才返回。高可靠，性能略低。
- **异步复制（ASYNC_MASTER）**：Master 写入即返回，Slave 异步拉取。高性能，Master 宕机可能丢数据。
- **DLedger 模式（4.5+）**：基于 Raft 协议实现自动选主，Master 宕机后 Slave 自动选举为新 Master。

### 9.3 CommitLog + ConsumeQueue 设计

这是 RocketMQ 存储层最核心的设计，也是高频面试考点。

```
              写入
Producer ──────→ CommitLog (所有 Topic 消息混合顺序写入)
                    │
                    │ ReputMessageService 异步构建
                    ↓
              ConsumeQueue (每个 Topic-QueueId 独立)
              ┌──────────────────────────────┐
              │ offset(8B) | size(4B) | tag hashcode(8B) │ = 20 字节/条
              └──────────────────────────────┘
                    │
                    ↓
              IndexFile (可选，支持按 Key/时间查询)
              Hash 索引结构，500 万个槽位
```

**为什么不像 Kafka 一样每个 Topic-Partition 一个文件？**

- **Kafka 方案**：每个 Partition 独立文件，顺序写。但 Topic 多时变成随机写。
- **RocketMQ 方案**：所有 Topic 共用一个 CommitLog **保证绝对的顺序写**。代价是消费时需要通过 ConsumeQueue 间接索引。

**CommitLog 文件组织**：每个文件 1GB（`mappedFileSizeCommitLog=1073741824`），文件名是起始偏移量。通过 `MappedFileQueue` 管理多个 `MappedFile`（mmap 映射）。

**ConsumeQueue 的作用**：消费者通过 ConsumeQueue 获取消息在 CommitLog 中的物理偏移量和大小，然后到 CommitLog 中精确读取。每条 ConsumeQueue 记录仅 20 字节，所以 ConsumeQueue 可以全部加载到内存（或 PageCache），查询极快。

### 9.4 消息过滤

#### Tag 过滤（Broker 端 + Consumer 端两级过滤）

```java
// Producer
Message msg = new Message("OrderTopic", "TagA", body); // Tag = "TagA"

// Consumer
consumer.subscribe("OrderTopic", "TagA || TagB"); // 只消费 TagA 和 TagB
```

Broker 端过滤原理：ConsumeQueue 中存储了 Tag 的 **hashCode**（8 字节），Broker 根据 hashCode 快速过滤。由于 hashCode 可能冲突，Consumer 端会二次精确匹配 Tag 字符串。

#### SQL92 过滤（Broker 端表达式过滤）

```java
// Producer: 设置消息属性
msg.putUserProperty("price", "100");
msg.putUserProperty("region", "hangzhou");

// Consumer: SQL 表达式订阅
consumer.subscribe("OrderTopic", 
    MessageSelector.bySql("price > 50 AND region = 'hangzhou'"));
```

底层通过 `FilterServerManager` 和布隆过滤器实现（RocketMQ 4.x），性能低于 Tag 过滤但更灵活。

### 9.5 代码示例

```java
// RocketMQ Broker 主从 + DLedger 自动切换配置
// broker.conf
brokerClusterName=DefaultCluster
brokerName=broker-a
enableDLegerCommitLog=true
dLegerGroup=broker-a
dLegerPeers=n0-192.168.1.1:40911;n1-192.168.1.2:40911;n2-192.168.1.3:40911
dLegerSelfId=n0
storePathRootDir=/data/rocketmq/store
```

```java
// 利用 ConsumeQueue 的 Tag HashCode 做 Broker 端消息过滤伪代码
// 源码位置: org.apache.rocketmq.store.DefaultMessageStore#getMessage
public GetMessageResult getMessage(String group, String topic, int queueId, 
                                    long offset, int maxMsgNums, 
                                    MessageFilter messageFilter) {
    // 1. 定位 ConsumeQueue 文件
    ConsumeQueue consumeQueue = findConsumeQueue(topic, queueId);
    
    // 2. 从 offset 开始遍历 ConsumeQueue 条目（每条 20 字节）
    SelectMappedBufferResult bufferCQ = consumeQueue.getIndexBuffer(offset);
    for (int i = 0; i < maxMsgNums; i++) {
        long offsetPy = bufferCQ.getByteBuffer().getLong();   // CommitLog 物理偏移
        int sizePy = bufferCQ.getByteBuffer().getInt();       // 消息大小
        long tagsCode = bufferCQ.getByteBuffer().getLong();   // Tag HashCode
        
        // 3. Broker 端一级过滤：Tag HashCode 匹配
        if (messageFilter.isMatchedByConsumeQueue(tagsCode, null)) {
            // 4. 到 CommitLog 读取完整消息
            SelectMappedBufferResult msg = commitLog.getMessage(offsetPy, sizePy);
            // 5. 二级过滤（如 SQL92 表达式）
            if (messageFilter.isMatchedByCommitLog(msg.getByteBuffer(), null)) {
                result.addMessage(msg);
            }
        }
    }
    return result;
}
```

### 9.6 生产踩坑经验

**坑1：Broker 磁盘满导致 CommitLog 写入失败**

CommitLog 默认保留 72 小时。如果消息量大且磁盘不够，CommitLog 还没过期磁盘就满了。当磁盘使用率 > 90% 时 Broker 拒绝写入。解决：(1) 监控磁盘使用率；(2) 合理设置 `fileReservedTime`；(3) 部署时确保足够的磁盘空间。

**坑2：NameServer 全部宕机，Producer/Consumer 仍能工作一段时间**

因为路由信息缓存在本地。但新的 Topic 无法路由、Broker 上下线感知不到。这是设计上的取舍 — NameServer 允许短暂全部不可用，但长时间宕机会导致路由信息过期。

**坑3：Tag 过滤的 HashCode 冲突**

两个不同的 Tag 可能 `hashCode()` 相同，Broker 端过滤通过但 Consumer 端二次匹配不通过 → 消息被过滤掉但占用了网络带宽。冲突概率低但存在。SQL92 过滤不受此影响。

### 9.7 面试追问点

**Q1：RocketMQ 为什么用 CommitLog + ConsumeQueue 分离的设计？优劣是什么？**

> A：**优势**：(1) 所有消息顺序写一个 CommitLog，保证极致的写性能，即使 Topic 数量非常多也不影响写入速度（对比 Kafka 多 Partition 文件的随机写退化）；(2) ConsumeQueue 是定长记录（20B），完全可以放入 PageCache，消费索引查找极快。
>
> **劣势**：(1) 消费时需要二次寻址（先查 ConsumeQueue 再查 CommitLog），增加一次随机读；(2) CommitLog 混合存储，不同 Topic 的消息交叉存储，单 Topic 消费时 PageCache 利用率低于 Kafka（Kafka 单 Partition 文件，顺序读更友好）。

**Q2：RocketMQ 的 NameServer 为什么不用 ZooKeeper？不需要一致性吗？**

> A：RocketMQ 的路由信息是 **最终一致** 即可的：(1) Broker 每 30s 向所有 NameServer 报心跳，短暂不一致最多持续 30s；(2) Producer/Consumer 本地缓存路由信息，30s 更新一次，即使 NameServer 数据有短暂差异也不影响消息收发；(3) NameServer 之间无通信、无选举，运维简单、不会出现"脑裂"等一致性问题。ZooKeeper 太重了 — 选举、会话管理、Watch 机制等 RocketMQ 都不需要。

**Q3：CommitLog 写满 1GB 后切换新文件，这个过程会阻塞写入吗？**

> A：RocketMQ 使用 `MappedFileQueue` 管理 CommitLog 文件。`AllocateMappedFileService` 是一个预分配线程，会提前创建并 mmap 映射下一个 MappedFile（warmMappedFile 机制还会预热 PageCache）。当当前文件写满时，直接切换到预分配好的文件，**几乎不阻塞写入**。这是 RocketMQ 高性能写入的关键设计之一。

---

## 10. RabbitMQ 核心原理

### 10.1 架构与 AMQP 模型

```text
Producer → [Connection / Channel] → Exchange ──(Binding + RoutingKey)──→ Queue → Consumer
                                      ↑
                         vhost：逻辑隔离（权限、资源）
```

| 概念 | 说明 |
| --- | --- |
| Broker | 一个 RabbitMQ 节点，多个节点组成集群 |
| vhost | 虚拟主机，相当于命名空间，各自隔离 Exchange、Queue 和权限 |
| Connection / Channel | 一条 TCP 连接上复用多个 Channel；**Channel 不是线程安全的**，每个线程用自己的 Channel |
| Exchange | 只负责路由，**不存消息**；没有匹配的队列时消息会被丢弃（除非设置了 `mandatory` 或备用交换机） |
| Queue | 真正存消息的地方，消息按 FIFO 投递 |
| Binding | Exchange 和 Queue 之间的路由规则 |

**和 Kafka / RocketMQ 的本质区别：** RabbitMQ 是**推模式加消费后删除**的「智能 Broker、简单消费者」模型；Kafka 是**拉模式加日志保留加位移**的「简单 Broker、智能消费者」模型，可以回放。

### 10.2 四种 Exchange

| 类型 | 路由规则 | 典型场景 |
| --- | --- | --- |
| direct | RoutingKey 完全匹配 | 按类型分发（订单、支付） |
| topic | 通配符：`*` 匹配一个词，`#` 匹配零个或多个词，例如 `order.*.created` | 多维度订阅 |
| fanout | 忽略 RoutingKey，广播给所有绑定的队列 | 配置刷新、广播通知 |
| headers | 按消息头匹配（`x-match: all/any`） | 很少用，性能较差 |

默认交换机（名字是空字符串）是 direct 类型，每个队列都会自动用队列名作为 key 绑定到它上面。

### 10.3 可靠性：三个环节

```text
生产者 ──①──→ Broker（Exchange → Queue，落盘）──②──→ 消费者 ──③──→ ACK
```

**① 生产者到 Broker：Publisher Confirm**

```java
channel.confirmSelect();
channel.addConfirmListener(
    (seq, multiple) -> outstanding.headMap(seq, multiple).clear(),          // ack：已落盘或已复制
    (seq, multiple) -> resend(outstanding.headMap(seq, multiple)));         // nack：要重发
channel.basicPublish("order.ex", "order.created", true /* mandatory */,
    MessageProperties.PERSISTENT_TEXT_PLAIN, body);
channel.addReturnListener(r -> log.warn("路由失败: {}", r.getRoutingKey())); // 没有匹配到队列
```

- **Confirm** 解决「消息有没有到 Broker」，**Return / mandatory** 解决「消息有没有路由到队列」，两者都要处理。
- 事务模式（`txSelect`）性能会下降几十倍，生产环境用 Confirm 加批量或异步确认。
- 兜底方案：本地消息表加定时补偿重发。

**② Broker 自身：持久化加副本**

- Exchange 声明为 `durable`，Queue 声明为 `durable`，消息设置 `deliveryMode=2`，**三者缺一不可**。
- 持久化不等于不丢：消息写到 OS 页缓存后还没刷盘时宕机，或者单节点磁盘损坏，都会丢。所以还需要**仲裁队列**做副本复制，而且 Confirm 要在多数副本写入后才返回。

**③ 消费者：手动 ACK**

```java
channel.basicQos(50); // prefetch
channel.basicConsume("order.q", false /* autoAck=false */, (tag, msg) -> {
    try {
        handle(msg);                                       // 业务逻辑要幂等
        channel.basicAck(msg.getEnvelope().getDeliveryTag(), false);
    } catch (BizException e) {
        channel.basicNack(tag(msg), false, false);         // 不重新入队，进入 DLX
    } catch (Exception e) {
        channel.basicNack(tag(msg), false, true);          // 临时错误，重新入队（注意死循环）
    }
}, tag -> {});
```

- `autoAck=true` 时，消息一投递就从队列删除，消费者处理到一半宕机，消息就丢了。
- `requeue=true` 时，消息会回到**队头**，如果是代码 bug 导致的失败，会无限重试，CPU 被打满。应该限制重试次数（通过 `x-delivery-count` 或业务计数），超过后进入 DLX。

### 10.4 prefetch（QoS）与推模式

- RabbitMQ 主动**推送**消息，prefetch 限制「每个消费者最多有多少条已投递但没 ACK 的消息」。
- **设得太大**：消息都堆在一个消费者的内存里，其他消费者空闲，负载不均；这个消费者宕机后，大量消息需要重新投递。
- **设得太小**：每处理一条就要等一次网络往返，吞吐上不去。
- 经验值：先按「单条处理耗时 × 期望并发数」估算，通常在 10–300 之间，再通过压测调整。
- 尽量不要用 `basicGet` 拉取消息，每次都是一个同步 RPC，性能很差。

### 10.5 死信队列（DLX）

消息在以下三种情况下成为「死信」，被转发到队列配置的 `x-dead-letter-exchange`：

1. 被 `basicNack` 或 `basicReject` 拒绝，并且 `requeue=false`
2. 消息 TTL 过期
3. 队列长度超过上限（`x-max-length`），队头的消息被挤出去

```java
Map<String, Object> args = Map.of(
    "x-dead-letter-exchange", "dlx.ex",
    "x-dead-letter-routing-key", "order.dead",
    "x-message-ttl", 60_000);
channel.queueDeclare("order.q", true, false, false, args);
```

死信消息会带上 `x-death` 头，记录原队列、原因和次数，可以用来排查问题和人工补偿。**必须监控死信队列的堆积量**，否则消息进了死信队列也没人处理。

### 10.6 延迟消息：两种方案

| 方案 | 原理 | 问题 |
| --- | --- | --- |
| TTL + DLX | 消息放进一个没有消费者的队列，过期后转到死信交换机，再到真正的消费队列 | **队头阻塞**：队列只检查队头消息是否过期。如果先放进去一条 30 分钟的消息，后面 1 分钟的消息也要等它到期。解决办法是按延迟时长分成不同队列（1m / 5m / 30m） |
| `rabbitmq_delayed_message_exchange` 插件 | 用 `x-delayed-message` 类型的交换机，消息带 `x-delay` 头，在 Mnesia 里保存到期后再投递 | 不适合海量延迟消息（单节点存储，有上限）；插件状态不会被复制，节点宕机可能丢失 |

延迟消息量很大、精度要求高的场景，可以考虑 RocketMQ 5.x 的任意延迟消息、Redis ZSet 加轮询，或者时间轮方案。

### 10.7 高可用：从镜像队列到仲裁队列

| 类型 | 原理 | 现状 |
| --- | --- | --- |
| 普通集群 | 元数据在各节点之间同步，**队列内容只存在一个节点上** | 那个节点宕机后，队列就不可用 |
| 经典镜像队列 | 一主多从，主节点把消息同步给镜像 | 3.8 起不推荐，**4.0 已移除**；网络分区时容易丢数据，同步时会阻塞 |
| **仲裁队列（Quorum Queue）** | 基于 **Raft**，多数副本写入后才确认，自动选主 | 3.8+ 推荐用于需要可靠性的业务队列 |
| Stream | 只追加写的日志，可以按 offset 重复读，类似 Kafka | 3.9+，适合大量消息堆积和回放的场景 |

```java
channel.queueDeclare("order.q", true, false, false,
    Map.of("x-queue-type", "quorum", "x-delivery-limit", 5)); // 重试超过 5 次自动转入死信
```

**仲裁队列的注意点：** 副本数用奇数（3 或 5）；不支持非持久化、排他队列，也不支持优先级（4.0 起有有限支持）；内存和磁盘开销比经典队列大。
**网络分区处理**（`cluster_partition_handling`）：`pause_minority` 让少数派节点暂停服务，优先保证一致性，是生产环境的常用配置；`autoheal` 会自动恢复，但可能丢数据。

### 10.8 性能与积压

- **积压的原因：** 消费者处理慢，prefetch 设置不合理，队列很长导致内存告警（`vm_memory_high_watermark`），触发流控后**生产者被阻塞**。
- **处理办法：**
  - 临时增加消费者，同时排查慢消费的原因；
  - 积压的消息先转存，之后再回放；
  - 大量堆积的场景用惰性队列（3.12 起经典队列默认就是这种行为）或者 Stream。
- **吞吐参考：** 单队列只在单个节点上，受单核限制，通常是几万 QPS 量级。要扩展的话，**拆成多个队列**，或者用一致性哈希交换机把消息分散到多个队列。
- **顺序：** 单队列加单个消费者（或 `x-single-active-consumer`）可以保证顺序；多个消费者并发消费时不保证顺序。

### 10.9 面试连环炮

1. 为什么 RabbitMQ 不适合做日志采集？（推模式、消费后删除、单队列吞吐有限、不能回放；用 Stream 可以部分弥补）
2. Confirm 和 Return 分别解决什么问题？只开其中一个行不行？
3. 消费者处理成功了，但 ACK 发出去之前宕机了，会怎样？（消息会重新投递，所以消费逻辑必须幂等）
4. 镜像队列为什么被淘汰？仲裁队列是怎么保证不丢消息的？
5. TTL + DLX 做延迟消息有什么坑？怎么解决？

详见题库：[RabbitMQ 核心面试题](/posts/mq/rabbitmq-interview/)

## 附录：面试高频组合连环炮

以下是大厂面试中常见的连环追问路径，按照"表层 → 深层"递进：

### 连环炮 1：消息可靠性深入
```
你怎么保证消息不丢？
→ 生产端、Broker 端、消费端分别怎么做？
→ acks=all 和 min.insync.replicas 的关系？
→ 如果 ISR 只剩一个副本了怎么办？
→ unclean.leader.election.enable 是什么？打开会怎样？
→ 消息一定不丢的代价是什么？（性能、可用性降低）
→ 你在实际项目中是怎么权衡的？
```

### 连环炮 2：消息顺序 + 重复 + 事务
```
如何保证消息顺序消费？
→ 全局有序和分区有序的区别和代价？
→ 顺序消费时如何处理消费失败？
→ 顺序消费 + 幂等怎么同时保证？
→ 如果涉及分布式事务呢？事务消息是怎么实现的？
→ RocketMQ 半消息的回查机制具体怎么工作？
```

### 连环炮 3：Kafka 存储原理深入
```
Kafka 为什么快？
→ 零拷贝是怎么实现的？和 mmap 有什么区别？
→ sendfile 在 Java 中是哪个 API？
→ PageCache 和零拷贝的关系？
→ 如果消费积压，PageCache 会怎样？
→ 那 RocketMQ 的零拷贝呢？（mmap，不是 sendfile）
→ mmap 和 sendfile 分别适用什么场景？
```

> **mmap vs sendfile 补充**：
> - Kafka 用 `sendfile`（`FileChannel.transferTo()`），适合大块数据传输（Consumer 拉取消息）。
> - RocketMQ 用 `mmap`（`MappedByteBuffer`），适合小块随机读写（CommitLog 写入 + ConsumeQueue 读取）。
> - `sendfile` 不经过用户态，性能更高但无法修改数据；`mmap` 映射到用户态虚拟地址空间，可读可写但有 PageFault 开销。

---

> **手册总结**：本手册从消息可靠性、幂等、顺序性、积压、延迟消息、事务消息、选型对比、Kafka 原理、RocketMQ 原理九大维度，深入源码和生产实践层面，覆盖大厂面试中消息队列领域的核心追问点。建议结合实际项目经验组织话术，面试时用"先总后分"的方式回答：先给结论，再逐层展开原理和方案。

## 相关文章

- [mq-interview-map](/posts/mq/mq-interview-map/)
