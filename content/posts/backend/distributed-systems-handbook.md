---
title: 分布式系统深度面试手册
date: 2026-11-05
summary: 分布式锁、唯一 ID、分布式事务、一致性、限流、配置中心、链路追踪、注册发现与负载均衡：原理、方案对比、踩坑与追问。
interview: false
kind: handbook
---

> **适用对象**：3-5 年+ Java 开发者，目标大厂（阿里/美团/字节/腾讯）**使用方式**：每个知识点包含 **原理详解 → 方案对比 → 代码示例 → 生产踩坑 → 面试追问**，建议逐点精读

---

## 一、分布式锁

### 1.1 原理详解

Redis SETNX + Lua 实现

分布式锁的本质是 **互斥** —— 在分布式环境中，多个进程/线程竞争同一资源时，只能有一个获得执行权。

Redis 实现分布式锁的核心命令：

```
SET key value NX PX milliseconds

```

- `NX`：只有 key 不存在时才设置（互斥语义）
- `PX`：设置过期时间，防止持锁进程崩溃导致死锁
- `value`：必须是唯一标识（如 `UUID + threadId`），用于解锁时校验身份

**为什么解锁必须用 Lua 脚本？**

解锁需要两步：① 判断锁是否是自己持有的 ② 删除锁。如果用两条 Redis 命令，会出现竞态条件：

```
时间线：
T1: 线程A GET lock → 返回 "A_uuid"（确认是自己的锁）
T2: 锁过期，被Redis自动删除
T3: 线程B SET lock "B_uuid" NX → 成功获锁
T4: 线程A DEL lock → 误删线程B的锁！

```

Lua 脚本保证原子性：

```java
// 解锁 Lua 脚本
String luaScript =
    "if redis.call('get', KEYS[1]) == ARGV[1] then " +
    "    return redis.call('del', KEYS[1]) " +
    "else " +
    "    return 0 " +
    "end";
jedis.eval(luaScript, Collections.singletonList(lockKey),
           Collections.singletonList(requestId));

```

Redis 执行 Lua 脚本是单线程串行的，天然保证原子性。

Redisson 看门狗续期机制

直接使用 `SETNX + expire` 存在一个致命问题：**业务执行时间超过锁过期时间**。Redisson 通过 **WatchDog（看门狗）机制** 解决。

核心源码在 `RedissonLock.tryAcquireAsync()` 中：

```java
// RedissonLock.java 核心逻辑简化
private void scheduleExpirationRenewal(long threadId) {
    ExpirationEntry entry = EXPIRATION_RENEWAL_MAP.get(getEntryName());
    // 每 lockWatchdogTimeout / 3 (默认10s) 执行一次续期
    Timeout task = commandExecutor.getConnectionManager()
        .newTimeout(timeout -> {
            // Lua 脚本：如果锁还在，重新设置过期时间
            RFuture<Boolean> future = renewExpirationAsync(threadId);
            future.onComplete((res, e) -> {
                if (res) {
                    // 续期成功，递归调度下一次
                    scheduleExpirationRenewal(threadId);
                }
            });
        }, internalLockLeaseTime / 3, TimeUnit.MILLISECONDS);
}

```

**关键参数**：

- `lockWatchdogTimeout` 默认 30 秒
- 续期频率：每 10 秒（30/3）执行一次
- 如果业务线程正常执行，看门狗持续续期；线程挂了/宕机了，看门狗随之停止，锁自然过期

ZooKeeper 临时有序节点实现

ZK 实现分布式锁利用两个特性：

1. **临时节点（Ephemeral Node）**：客户端会话断开后自动删除 → 防死锁
2. **有序节点（Sequential Node）**：创建时自动追加单调递增序号 → 实现公平锁

**加锁流程**：

1. 客户端在 `/locks/resource_name` 下创建临时有序节点 → `/locks/resource_name/lock-0000000001`
2. 获取 `/locks/resource_name` 下所有子节点并排序
3. 如果自己是序号最小的节点 → 获锁成功
4. 否则，监听（watch）比自己序号小的前一个节点的删除事件
5. 前一个节点删除 → 收到通知 → 重新判断自己是否最小 → 获锁

**为什么只监听前一个节点而不是监听父节点？**

避免 **惊群效应（Herd Effect）**。如果所有等待的客户端都监听同一个父节点，当锁释放时，所有客户端同时被唤醒，但只有一个能获锁，造成大量无效通知。

RedLock 算法及其争议

RedLock 由 Antirez（Redis 作者）提出，核心思想：

1. 获取当前时间 T1
2. 依次向 N 个独立的 Redis 实例发送加锁请求（N 通常为 5）
3. 计算获锁总耗时 = 当前时间 - T1
4. 如果在 **超过半数（N/2+1）** 的实例上加锁成功，且总耗时 < 锁的过期时间 → 加锁成功
5. 如果加锁失败 → 向所有实例发送解锁请求

**Martin Kleppmann 的质疑（"How to do distributed locking"）**：

- **GC 停顿问题**：客户端获锁后发生长时间 GC，锁过期被其他客户端获取，GC 恢复后两个客户端同时操作共享资源
- **时钟跳跃问题**：Redis 实例的系统时钟发生跳跃（NTP 校准），导致锁提前过期
- **本质论点**：如果你需要强一致性的锁，应该用 ZooKeeper 这类共识系统；如果只是效率锁（防重复计算），单 Redis 实例就够了，RedLock 处于尴尬的中间地带

**Antirez 的回应（"Is Redlock safe?"）**：

- GC 停顿问题可以通过 fencing token 缓解
- 时钟跳跃问题在运维良好的系统中概率极低
- RedLock 提供的是"尽力而为"的正确性，适合大多数场景

### 1.2 实现方案对比

| 维度 | Redis SETNX | Redisson | ZooKeeper | RedLock |
| --- | --- | --- | --- | --- |
| **性能** | 极高（单次 RTT） | 高（有续期开销） | 中（需多次 ZK 交互） | 低（N 个实例交互） |
| **可靠性** | 低（主从切换丢锁） | 中（看门狗续期） | 高（ZAB 共识保证） | 中（有争议） |
| **实现复杂度** | 低 | 低（封装好） | 中（Curator 封装后低） | 高 |
| **公平性** | 非公平 | 支持公平锁 | 天然公平（有序节点） | 非公平 |
| **可重入** | 需自行实现 | 支持（Hash 结构） | 需自行实现 | 需自行实现 |
| **适用场景** | 低一致性要求 | 通用首选 | 强一致性要求 | 跨机房高可用 |

### 1.3 生产踩坑经验

**坑 1：Redis 主从切换导致锁丢失**

场景：客户端在 Master 上加锁成功，Master 宕机，Slave 提升为新 Master，但锁数据尚未同步 → 另一个客户端在新 Master 上加锁成功 → 两个客户端同时持锁。

解决方案：

- 对一致性要求高的场景使用 ZooKeeper
- 使用 RedLock 分散风险
- 在业务层加兜底：数据库乐观锁（version 字段）

**坑 2：锁过期时间设置不合理**

- 设太短：业务没执行完锁就过期了
- 设太长：持锁节点宕机后等待时间过长

解决方案：使用 Redisson 的看门狗自动续期，不手动设置 leaseTime。

**坑 3：可重入问题**

同一线程内多次获取同一把锁（如递归调用、嵌套事务），如果锁不可重入会导致死锁。

Redisson 使用 Redis Hash 结构实现可重入：

```
HSET lock_key client_uuid:thread_id 1   -- 首次加锁
HINCRBY lock_key client_uuid:thread_id 1 -- 重入 +1

```

### 1.4 面试追问点

**Q1：Redis 单节点分布式锁最大的风险是什么？怎么兜底？**

> 最大风险是主从切换导致锁丢失。兜底方案分两层：
> 1. **锁层面**：使用 RedLock 或 ZooKeeper
> 2. **业务层面**：关键操作使用数据库乐观锁/唯一约束做最终兜底。比如扣库存场景，即使分布式锁失效，`UPDATE stock SET count=count-1 WHERE id=? AND count>0` 仍然可以保证不超卖。

**Q2：Redisson 看门狗如果续期失败了怎么办？**

> 续期失败通常意味着网络分区或 Redis 不可用。此时看门狗会停止续期，锁在 TTL 到期后自动释放。业务层需要捕获 `LockExpiredException`，进行补偿操作。在设计上要假设"锁一定会失效"，关键操作做幂等。

**Q3：ZK 分布式锁为什么比 Redis 慢？**

> ZK 写操作需要经过 ZAB 协议的两阶段提交：Leader 接收写请求 → 广播 Proposal → 等待半数以上 Follower ACK → Commit。而 Redis 是单线程内存操作，一次 RTT 即可完成。ZK 的代价换来的是更强的一致性保证。

---

## 二、分布式唯一 ID

### 2.1 原理详解

UUID

UUID v4 基于随机数生成，128 位（32 个十六进制字符）。Java 中 `java.util.UUID.randomUUID()` 使用 `SecureRandom`。

**致命缺陷**：

- 无序 → 作为数据库主键时，B+ 树频繁页分裂，写入性能下降 50%+
- 太长（36 字符含连字符） → 索引空间占用大
- 无业务含义 → 无法从 ID 中提取时间信息

Snowflake 雪花算法

Twitter 开源，64 位 long 型整数，位分配如下：

```
0 | 0000000000 0000000000 0000000000 0000000000 0 | 00000 | 00000 | 000000000000
符号位  |            41位时间戳(ms)                    | 5位数据中心 | 5位机器ID | 12位序列号
(1bit)                                                 (5bit)     (5bit)    (12bit)

```

- **41 位时间戳**：相对于自定义纪元（epoch），可用约 69 年
- **10 位机器标识**：5 位数据中心 + 5 位 WorkerId，最多 1024 个节点
- **12 位序列号**：同一毫秒内自增，每毫秒最多 4096 个 ID

```java
public class SnowflakeIdGenerator {
    private final long epoch = 1609459200000L; // 2021-01-01
    private final long workerIdBits = 5L;
    private final long datacenterIdBits = 5L;
    private final long sequenceBits = 12L;
    
    private final long workerIdShift = sequenceBits; // 12
    private final long datacenterIdShift = sequenceBits + workerIdBits; // 17
    private final long timestampLeftShift = sequenceBits + workerIdBits + datacenterIdBits; // 22
    private final long sequenceMask = ~(-1L << sequenceBits); // 4095
    
    private long workerId;
    private long datacenterId;
    private long sequence = 0L;
    private long lastTimestamp = -1L;
    
    public synchronized long nextId() {
        long timestamp = System.currentTimeMillis();
        
        // 时钟回拨检测！
        if (timestamp < lastTimestamp) {
            long offset = lastTimestamp - timestamp;
            if (offset <= 5) {
                // 回拨在5ms以内，等待追上
                try { Thread.sleep(offset << 1); } catch (InterruptedException e) {}
                timestamp = System.currentTimeMillis();
                if (timestamp < lastTimestamp) {
                    throw new RuntimeException("Clock moved backwards. Refusing to generate id");
                }
            } else {
                throw new RuntimeException("Clock moved backwards. offset=" + offset);
            }
        }
        
        if (timestamp == lastTimestamp) {
            sequence = (sequence + 1) & sequenceMask;
            if (sequence == 0) {
                timestamp = tilNextMillis(lastTimestamp); // 当前毫秒序列号用尽，等下一毫秒
            }
        } else {
            sequence = 0L; // 新毫秒，序列号归零
        }
        
        lastTimestamp = timestamp;
        
        return ((timestamp - epoch) << timestampLeftShift)
                | (datacenterId << datacenterIdShift)
                | (workerId << workerIdShift)
                | sequence;
    }
    
    private long tilNextMillis(long lastTimestamp) {
        long timestamp = System.currentTimeMillis();
        while (timestamp <= lastTimestamp) {
            timestamp = System.currentTimeMillis();
        }
        return timestamp;
    }
}

```

**时钟回拨问题的根源**：服务器通过 NTP 同步时间时，如果发现本地时钟快了，会将时间往回调。此时 Snowflake 生成的 ID 可能重复。

美团 Leaf

美团开源的分布式 ID 生成服务，支持两种模式：

**号段模式（Segment）**：

核心思想：每次从数据库批量获取一段 ID，在内存中分配，减少数据库访问。

```sql
CREATE TABLE leaf_alloc (
  biz_tag VARCHAR(128) NOT NULL,  -- 业务标识
  max_id  BIGINT NOT NULL,         -- 当前已分配的最大ID
  step    INT NOT NULL,            -- 每次获取的步长
  update_time TIMESTAMP,
  PRIMARY KEY (biz_tag)
);

```

关键优化 —— **双 Buffer**：

```java
// Leaf SegmentBuffer 核心思想
public class SegmentBuffer {
    private Segment[] segments = new Segment[2]; // 双缓冲
    private volatile int currentPos; // 当前使用的 segment 索引
    private volatile boolean nextReady; // 下一个 segment 是否已加载
    
    public long getId() {
        Segment current = segments[currentPos];
        long id = current.value.getAndIncrement();
        
        // 当前号段消耗到 10% 剩余时，异步加载下一个号段
        if (id > current.max * 0.9 && !nextReady) {
            asyncLoadNextSegment();
        }
        
        // 当前号段用尽，切换到下一个
        if (id > current.max) {
            switchToNext();
            return segments[currentPos].value.getAndIncrement();
        }
        return id;
    }
}

```

**Snowflake 模式**：

Leaf 的 Snowflake 模式使用 ZooKeeper 解决 WorkerId 分配问题：

- 服务启动时在 ZK 的 `/snowflake/leaf_name/forever` 下创建持久有序节点
- 节点序号即为 WorkerId
- 本地缓存 WorkerId 到文件，ZK 不可用时仍可启动

百度 UidGenerator

对 Snowflake 的定制优化：

```
1位符号 | 28位时间(秒) | 22位WorkerId | 13位序列号

```

- 时间精度从毫秒降为秒，但位数减少到 28 位（约 8.5 年）
- WorkerId 扩展到 22 位（约 420 万），通过数据库自增表分配，用完即弃（重启后分配新 ID）
- 引入 **RingBuffer** 预生成 ID，`CachedUidGenerator` 提前填充环形缓冲区，`nextId()` 直接从 buffer 获取，性能极高

### 2.2 实现方案对比

| 维度 | UUID | Snowflake | Leaf-Segment | Leaf-Snowflake | 数据库自增 |
| --- | --- | --- | --- | --- | --- |
| **有序性** | 完全无序 | 趋势递增 | 严格递增 | 趋势递增 | 严格递增 |
| **性能** | 高（本地） | 高（本地） | 高（内存分配） | 高（本地） | 低（依赖DB） |
| **可用性** | 极高（无依赖） | 中（依赖时钟） | 中（依赖DB） | 中（依赖ZK） | 低（DB单点） |
| **ID 长度** | 128 bit | 64 bit | 64 bit | 64 bit | 64 bit |
| **信息含量** | 无 | 含时间+机器 | 无业务含义 | 含时间+机器 | 无 |
| **时钟回拨** | 无影响 | 致命问题 | 无影响 | 有缓解方案 | 无影响 |

### 2.3 生产踩坑经验

**坑 1：Snowflake 时钟回拨导致 ID 重复**

某线上服务器 NTP 同步后时钟回拨 3 秒，Snowflake 生成了重复 ID，导致数据库唯一约束冲突，订单入库失败。

解决方案：

- 小幅回拨（< 5ms）：等待追上
- 中等回拨（5ms~几秒）：使用拓展位记录回拨次数
- 大幅回拨：报警 + 拒绝生成（降级到数据库号段）

**坑 2：Leaf 号段模式数据库单点**

Leaf 的号段表是单库单表，如果数据库挂了，已缓存的号段用完后服务不可用。

解决方案：使用双 Master + 不同初始值和步长，如 Master1 分配奇数段，Master2 分配偶数段。

**坑 3：Snowflake 的 WorkerId 分配冲突**

多个容器实例在 K8s 中频繁重启，WorkerId 如果基于 IP 后几位计算，容易冲突。

解决方案：使用 ZK/Redis 集中分配 WorkerId，或用 Leaf-Snowflake 的持久化方案。

### 2.4 面试追问点

**Q1：为什么 Snowflake 生成的 ID 是趋势递增而不是严格递增？**

> 因为多个机器同一毫秒生成的 ID，虽然时间戳部分相同，但 WorkerId 不同，导致不同机器产生的 ID 之间无法保证严格有序。只有在单机维度才是严格递增的。

**Q2：如果让你设计一个 ID 生成服务，怎么保证高可用？**

> 多层次：
> 1. **内嵌 SDK**：本地生成，无网络依赖（Snowflake 方案）
> 2. **双 Buffer 预加载**：号段模式提前加载下一段，避免切换时的 RT 毛刺
> 3. **多级降级**：优先 Snowflake 本地生成 → 降级到号段服务 → 最终降级到数据库自增
> 4. **WorkerId 本地缓存**：依赖的注册中心不可用时仍可启动

**Q3：ID 的单调递增在数据库层面为什么重要？**

> InnoDB 的主键索引是 B+ 树聚簇索引，数据按主键物理排序。如果 ID 无序（如 UUID），每次插入可能落在 B+ 树的任意位置，导致频繁的 **页分裂（Page Split）**，写入性能可能下降 3-5 倍。趋势递增的 ID 总是追加在最后，避免页分裂。

---

## 三、分布式事务

### 3.1 原理详解

2PC（两阶段提交）

**阶段一（Prepare/投票）**：协调者询问所有参与者"能否提交？"，参与者执行事务但不提交，写 undo/redo 日志，回复 Yes/No。

**阶段二（Commit/执行）**：如果所有参与者回复 Yes → 协调者发送 Commit；否则发送 Rollback。

**致命缺陷**：

- **同步阻塞**：Prepare 后参与者持有资源锁，等待协调者指令，阻塞其他事务
- **协调者单点**：协调者在阶段二宕机，参与者永远等待
- **数据不一致**：协调者发送 Commit 后宕机，部分参与者收到 Commit，部分未收到

3PC 的改进

在 2PC 基础上增加 **CanCommit** 阶段（预检查），并引入 **超时机制**：

- 参与者在阶段三（DoCommit）超时后 **默认提交**（概率上大部分情况应该提交）
- 但仍然无法完全解决网络分区下的数据不一致

TCC（Try-Confirm-Cancel）

**本质是业务层面的 2PC**，把数据库层面的锁提升到了业务层面的"资源预留"：

```
Try 阶段：预留资源
  - 冻结库存（available_stock - 2, frozen_stock + 2）
  - 冻结余额（available_balance - 100, frozen_balance + 100）

Confirm 阶段：确认执行
  - 扣减冻结库存（frozen_stock - 2）
  - 扣减冻结余额（frozen_balance - 100）

Cancel 阶段：回滚释放
  - 释放库存（available_stock + 2, frozen_stock - 2）
  - 释放余额（available_balance + 100, frozen_balance - 100）

```

```java
// TCC 接口定义示例（基于 Hmily 框架）
public interface StockService {
    
    @Hmily(confirmMethod = "confirmDeduct", cancelMethod = "cancelDeduct")
    boolean tryDeduct(String productId, int count);
    
    boolean confirmDeduct(String productId, int count);
    
    boolean cancelDeduct(String productId, int count);
}

@Service
public class StockServiceImpl implements StockService {
    
    @Override
    @Transactional
    public boolean tryDeduct(String productId, int count) {
        // Try: 冻结库存
        int affected = stockMapper.freezeStock(productId, count);
        // UPDATE stock SET available = available - #{count}, 
        //                  frozen = frozen + #{count}
        // WHERE product_id = #{productId} AND available >= #{count}
        return affected > 0;
    }
    
    @Override
    @Transactional
    public boolean confirmDeduct(String productId, int count) {
        // Confirm: 扣减冻结库存
        return stockMapper.deductFrozen(productId, count) > 0;
        // UPDATE stock SET frozen = frozen - #{count}
    }
    
    @Override
    @Transactional
    public boolean cancelDeduct(String productId, int count) {
        // Cancel: 释放冻结库存
        return stockMapper.releaseFrozen(productId, count) > 0;
        // UPDATE stock SET available = available + #{count}, 
        //                  frozen = frozen - #{count}
    }
}

```

**TCC 三大难题**：

1. **空回滚**：Try 未执行（超时/异常），Cancel 被调用 → 需要判断 Try 是否执行过
2. **幂等**：网络重试导致 Confirm/Cancel 被重复调用 → 需要事务状态表记录执行状态
3. **悬挂**：Cancel 先于 Try 到达（网络延迟） → Try 必须检查是否已经 Cancel

SAGA

长事务分解为一系列本地事务，每个本地事务有对应的补偿操作：

**编排模式（Orchestration）**：有一个中心编排器，负责调度各步骤。类似交响乐指挥。

**协作模式（Choreography）**：各服务通过事件驱动自发执行。类似舞蹈，没有指挥。

```
编排模式：
  Orchestrator → [创建订单] → [扣库存] → [扣余额] → [完成]
                      ↓ 失败      ↓ 失败      ↓ 失败
                  [取消订单] ← [恢复库存] ← [恢复余额]

协作模式：
  订单服务 --创建订单事件→ 库存服务 --扣库存事件→ 支付服务 --支付成功事件→ 订单服务
                                               ↓ 失败
                                    库存服务 ←恢复库存事件← 支付服务

```

本地消息表

最经典的最终一致性方案：

```java
// 1. 业务操作和消息写入在同一个本地事务中
@Transactional
public void createOrder(Order order) {
    orderMapper.insert(order);           // 业务操作
    messageMapper.insert(new Message(    // 消息记录
        topic, JSON.toJSONString(order), "NEW"
    ));
}

// 2. 定时任务扫描消息表，发送到 MQ
@Scheduled(fixedRate = 5000)
public void scanAndSend() {
    List<Message> messages = messageMapper.selectByStatus("NEW");
    for (Message msg : messages) {
        try {
            mqProducer.send(msg.getTopic(), msg.getBody());
            messageMapper.updateStatus(msg.getId(), "SENT");
        } catch (Exception e) {
            // 发送失败，下次重试
            log.warn("Send message failed, will retry", e);
        }
    }
}

// 3. 下游消费者消费后回调确认
@RocketMQMessageListener(topic = "order_topic")
public class OrderConsumer implements RocketMQListener<String> {
    @Override
    public void onMessage(String message) {
        Order order = JSON.parseObject(message, Order.class);
        // 幂等检查
        if (stockService.isDeducted(order.getOrderId())) return;
        stockService.deduct(order);
    }
}

```

Seata 四种模式对比

Seata 是阿里开源的分布式事务框架，核心组件：

- **TC（Transaction Coordinator）**：事务协调器，维护全局和分支事务状态
- **TM（Transaction Manager）**：事务管理器，定义全局事务边界
- **RM（Resource Manager）**：资源管理器，管理分支事务

### 3.2 实现方案对比

| 维度 | 2PC/XA | TCC | SAGA | 本地消息表 | 最大努力通知 |
| --- | --- | --- | --- | --- | --- |
| **一致性** | 强一致 | 最终一致 | 最终一致 | 最终一致 | 最终一致 |
| **性能** | 低（长时间锁资源） | 高（无全局锁） | 高 | 高 | 高 |
| **业务侵入** | 无 | 极高（三个接口） | 高（补偿接口） | 中（消息表） | 低 |
| **实现复杂度** | 低 | 极高 | 高 | 中 | 低 |
| **适用场景** | 单体/短事务 | 金融/核心链路 | 长事务 | 跨服务异步 | 通知类业务 |
| **Seata 模式** | XA 模式 | TCC 模式 | SAGA 模式 | — | — |

**补充：Seata AT 模式**（Seata 特有，最常用）：

- 一阶段：解析 SQL → 生成前后镜像（beforeImage/afterImage）→ 执行 SQL → 写 undo_log → 提交本地事务 → 释放本地锁
- 二阶段 Commit：异步删除 undo_log
- 二阶段 Rollback：根据 undo_log 做反向 SQL 补偿
- **核心优势**：对业务代码无侵入，只需加 `@GlobalTransactional` 注解

### 3.3 生产踩坑经验

**坑 1：TCC 空回滚和悬挂**

通过事务控制表解决：

```sql
CREATE TABLE tcc_fence (
    xid VARCHAR(128),      -- 全局事务ID
    branch_id BIGINT,      -- 分支事务ID
    action_name VARCHAR(64),-- Try/Confirm/Cancel
    status INT,            -- 状态: tried/committed/cancelled
    PRIMARY KEY (xid, branch_id)
);

```

Cancel 前检查 Try 是否执行过：如果 tcc_fence 中没有 Try 记录 → 空回滚 → 插入 Cancel 记录后直接返回。 Try 前检查是否已经 Cancel → 如果已 Cancel → 悬挂 → 直接拒绝。

**坑 2：Seata AT 模式的全局锁性能问题**

Seata AT 虽然释放了本地数据库锁，但引入了 TC 侧的全局锁。高并发场景下，全局锁成为瓶颈。

解决方案：

- 热点数据考虑用 TCC 模式代替 AT 模式
- TC 做集群部署，使用数据库/Redis 存储分支事务状态

### 3.4 面试追问点

**Q1：TCC 和 2PC 的本质区别是什么？**

> 2PC 是**资源层面**的锁定，通过数据库 XA 协议实现，Prepare 阶段持有数据库行锁不释放，阻塞其他事务。TCC 是**业务层面**的锁定，Try 阶段通过"冻结/预留"业务字段实现隔离，本地事务在 Try 阶段就提交了，不阻塞数据库。所以 TCC 性能远优于 2PC，但代价是业务侵入大。

**Q2：SAGA 编排和协作模式怎么选？**

> - **编排模式**：适合流程固定、步骤较多的场景。优点是流程清晰可控，缺点是编排器是单点。
> - **协作模式**：适合参与方少、服务自治性强的场景。优点是解耦彻底，缺点是流程散落在各服务中，难以追踪整体事务状态。 实践中大部分团队选编排模式，因为可观测性和可维护性更好。

**Q3：本地消息表方案消息发送失败怎么办？消息重复消费怎么办？**

> 发送失败：定时任务不断重试，直到发送成功后更新消息状态。对于多次失败的消息，设置最大重试次数，超过后人工介入。 重复消费：消费者必须做**幂等处理**。常见方案：① 唯一索引（数据库层面）② Redis SET（消息ID去重）③ 状态机（已处理的状态不允许再处理）。

---

## 四、分布式一致性

### 4.1 原理详解

CAP 定理

**C（Consistency）**：所有节点在同一时间看到的数据一致 **A（Availability）**：每个请求都能收到非错误的响应 **P（Partition Tolerance）**：网络分区发生时系统仍能运行

**为什么只能三选二？**

网络分区在分布式系统中是 **不可避免的**（网线断了、交换机故障），所以 P 是必选的。在 P 发生时：

- 选 CP：分区期间拒绝部分请求（牺牲可用性），保证一致性。如 ZooKeeper —— Leader 不可达时，Follower 拒绝写请求。
- 选 AP：分区期间继续服务（保证可用性），但数据可能不一致。如 Eureka —— 注册中心节点间数据异步复制，网络分区时各节点数据可能不同。

**实际不是非黑即白**：现实中更多的是一致性和可用性之间的 **程度权衡**。比如 Nacos 既支持 AP 模式（临时实例，Distro 协议）又支持 CP 模式（持久化实例，Raft 协议）。

BASE 理论

对 CAP 中 AP 的延伸：

- **Basically Available**：基本可用，允许响应时间增长或功能降级
- **Soft State**：软状态，允许中间状态存在
- **Eventually Consistent**：最终一致性，经过一段时间后数据达成一致

Paxos（Basic Paxos）

分布式共识的开山算法（Lamport 提出），理解它是理解 Raft/ZAB 的基础。

**三种角色**：Proposer（提议者）、Acceptor（接受者）、Learner（学习者）

**两阶段流程**：

```
阶段一（Prepare）：
  Proposer → Acceptor: Prepare(n)   // n 是全局唯一递增的提案编号
  Acceptor: 
    if n > 已见过的最大编号:
      承诺不再接受编号 < n 的提案
      返回之前已接受的最大编号的提案值（如果有）
    else:
      拒绝

阶段二（Accept）：
  Proposer: 
    if 收到多数派的 Prepare OK:
      如果回复中有已接受的值 → 使用编号最大的那个值
      否则 → 使用自己的值
      发送 Accept(n, value)
  Acceptor:
    if n >= 已见过的最大编号:
      接受该提案
    else:
      拒绝

```

**Paxos 的问题**：活锁（两个 Proposer 交替提高编号互相打断）→ 引入 Leader 解决 → Multi-Paxos → Raft

Raft

Raft 是 Paxos 的工程化简化版本，核心三个子问题：

**1. Leader 选举**：

```
初始状态：所有节点都是 Follower
超时触发：Follower 在 election timeout（150~300ms 随机）内未收到 Leader 心跳
          → 转为 Candidate → Term+1 → 给自己投票 → 向其他节点请求投票

投票规则：
  - 每个 Term 内每个节点只能投一票（先来先得）
  - 候选人的日志至少要和自己一样新（安全性保证）
    比较方式：先比较最后一条日志的 Term，Term 大的更新；
              Term 相同，index 大的更新

选举结果：
  - 获得多数派投票 → 成为 Leader
  - 收到新 Leader 的心跳 → 退为 Follower
  - 超时无结果 → 重新选举（随机超时避免持续冲突）

```

**2. 日志复制**：

```
Client → Leader: 写请求
Leader: 追加到本地日志（uncommitted）
Leader → Followers: AppendEntries RPC（携带日志条目）
Followers: 追加到本地日志 → 回复 ACK
Leader: 收到多数派 ACK → Commit → 应用到状态机 → 回复 Client
Leader: 下一次心跳通知 Followers 该日志已 Commit → Followers 也 Commit

```

**3. 安全性（Safety）**：

- **选举限制**：只有包含所有已提交日志的节点才能被选为 Leader
- **只允许提交当前 Term 的日志**：防止已提交的日志被覆盖（论文 Figure 8 的经典场景）

ZAB 协议（ZooKeeper Atomic Broadcast）

ZAB 是 ZooKeeper 的核心共识协议，类似 Raft 但有差异：

**两种模式**：

1. **崩溃恢复（Recovery）**：Leader 选举 + 数据同步
2. **消息广播（Broadcast）**：正常工作状态下的写操作同步

**崩溃恢复**：

- 选出拥有最大 ZXID（事务ID）的节点作为新 Leader
- ZXID 是 64 位：高 32 位是 epoch（任期），低 32 位是事务计数器
- 新 Leader 将未同步的事务发送给 Follower，确保一致

**消息广播**：

- Leader 收到写请求 → 生成 ZXID → 发送 Proposal 给所有 Follower
- Follower 收到 Proposal → 写入事务日志 → 返回 ACK
- Leader 收到 **过半 ACK** → 发送 Commit
- Follower 收到 Commit → 提交事务

### 4.2 Raft vs ZAB vs Paxos 对比

| 维度 | Basic Paxos | Raft | ZAB |
| --- | --- | --- | --- |
| **设计目标** | 通用共识 | 易理解的共识 | ZooKeeper 专用 |
| **Leader** | 无（Multi-Paxos 有） | 有，强 Leader | 有，强 Leader |
| **日志连续性** | 不要求 | 严格连续 | 严格连续 |
| **选举条件** | 编号最大 | 日志最新 | ZXID 最大 |
| **提交规则** | 多数派 | 多数派 | 过半 |
| **工程实现** | 极难 | 较易 | 中等 |
| **典型应用** | Google Chubby | etcd, Consul | ZooKeeper |

### 4.3 生产踩坑经验

**坑 1：ZooKeeper 选举风暴**

ZK 集群出现频繁选举，服务注册发现不可用。原因：某台 ZK 节点磁盘 IO 慢，导致事务日志写入超时，被其他节点认为宕机。

解决方案：ZK 数据目录使用 SSD，事务日志和快照分不同磁盘。

**坑 2：脑裂（Split Brain）**

网络分区导致两个子网各选出一个 Leader。

解决方案：Raft/ZAB 天然通过"多数派"机制防止脑裂 —— 5 节点集群分裂为 2+3，只有 3 节点的子网能选出 Leader（需要 3 票），2 节点的子网无法选出 Leader。这也是为什么建议奇数节点部署。

### 4.4 面试追问点

**Q1：CAP 中的 C 和 ACID 中的 C 是一回事吗？**

> 不是。ACID 的 C 是**约束一致性**，指事务前后数据满足业务约束（如外键、唯一约束）。CAP 的 C 是**线性一致性**（Linearizability），指所有节点在同一时刻看到的数据相同。两者是不同层面的概念。

**Q2：Raft 的 election timeout 为什么要随机？**

> 防止所有 Follower 同时超时、同时发起选举、互相瓜分选票导致无人当选（投票分裂）。随机超时使节点错开发起选举的时间，通常第一个超时的节点就能获得多数派投票。

**Q3：ZAB 和 Raft 有什么本质区别？**

> 核心思想非常相似，主要差异在：
> 1. **发现已提交日志的方式**：Raft 在选举时通过日志比较保证 Leader 拥有所有已提交日志；ZAB 在选举后通过同步阶段（Discovery + Synchronization）让新 Leader 补全日志。
> 2. **初始化**：Raft Leader 不会提交前任 Term 的日志（通过提交当前 Term 的空日志间接提交）；ZAB 新 Leader 会把前任所有未提交的 Proposal 重新提交。
> 3. **ZXID 设计**：ZAB 用 epoch + counter 的方式天然标识每任 Leader，Raft 用 Term。

---

## 五、分布式限流

### 5.1 原理详解

令牌桶（Token Bucket）

核心思想：以固定速率往桶里放令牌，请求需要获取令牌才能通过。桶有容量上限。

```
特征：
- 允许突发流量（桶里积累的令牌可以一次用完）
- 长期平均速率 = 令牌生成速率
- 桶满时新生成的令牌被丢弃

```

漏桶（Leaky Bucket）

核心思想：请求进入桶中排队，以固定速率从桶底流出处理。

```
特征：
- 严格平滑，不允许突发
- 输出速率恒定
- 桶满时新请求被拒绝

```

**令牌桶 vs 漏桶的关键区别**：令牌桶允许一定程度的突发流量，漏桶完全平滑。实际场景中令牌桶更常用。

滑动窗口计数器

解决固定窗口计数器的边界突发问题：

```
固定窗口的问题：
  窗口 [0s, 1s] 限制 100 QPS
  实际在 0.9s~1.1s 之间（跨窗口边界）可能通过 200 个请求

滑动窗口：
  将一个窗口分成多个小格子（如 10 个 100ms 的格子）
  每次判断时，统计当前时间前 1s 内所有格子的总数

```

```java
// 基于 Redis 的滑动窗口限流
public boolean isAllowed(String key, int maxCount, int windowSeconds) {
    long now = System.currentTimeMillis();
    String windowKey = "rate_limit:" + key;
    
    // 使用 Sorted Set，score 为时间戳
    String luaScript = 
        "redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[1])\n" +  // 移除窗口外的记录
        "local count = redis.call('ZCARD', KEYS[1])\n" +           // 统计窗口内的请求数
        "if count < tonumber(ARGV[2]) then\n" +
        "    redis.call('ZADD', KEYS[1], ARGV[3], ARGV[3])\n" +    // 添加当前请求
        "    redis.call('EXPIRE', KEYS[1], ARGV[4])\n" +
        "    return 1\n" +
        "else\n" +
        "    return 0\n" +
        "end";
    
    long windowStart = now - windowSeconds * 1000L;
    Long result = (Long) jedis.eval(luaScript,
        Collections.singletonList(windowKey),
        Arrays.asList(
            String.valueOf(windowStart),
            String.valueOf(maxCount),
            String.valueOf(now),
            String.valueOf(windowSeconds)
        ));
    return result == 1;
}

```

Guava RateLimiter

Google Guava 提供的单机限流器，基于令牌桶算法，有两种实现：

**SmoothBursty**：允许突发，令牌匀速生成，积累的令牌可以一次性使用。

**SmoothWarmingUp**：冷启动，刚开始发放令牌较慢，逐渐加速到稳态速率。适合需要预热的场景（如数据库连接池、缓存预热）。

```java
// SmoothBursty 源码核心 —— 惰性计算令牌
// RateLimiter 不是真的定时生成令牌，而是每次 acquire 时计算应该有多少令牌
// SmoothRateLimiter.java
void resync(long nowMicros) {
    if (nowMicros > nextFreeTicketMicros) {
        // 计算从上次到现在应该新增多少令牌
        double newPermits = (nowMicros - nextFreeTicketMicros) / coolDownIntervalMicros();
        storedPermits = Math.min(maxPermits, storedPermits + newPermits);
        nextFreeTicketMicros = nowMicros;
    }
}

// 使用示例
RateLimiter limiter = RateLimiter.create(10); // 每秒10个令牌
// SmoothBursty：如果1秒没有请求，积累了10个令牌，下1秒可以瞬间通过10个

RateLimiter warmUpLimiter = RateLimiter.create(10, 3, TimeUnit.SECONDS);
// SmoothWarmingUp：前3秒预热，速率从低逐渐增长到每秒10个

```

**SmoothWarmingUp 的数学模型**：

令牌生成间隔是存储令牌数的函数 —— 存储令牌越多（表示系统越"冷"），间隔越大（发放越慢）。区间从 `thresholdPermits` 到 `maxPermits` 是一个梯形/线性递增区域，面积等于 warmupPeriod。

Sentinel 限流规则

阿里 Sentinel 支持多种限流维度：

| 规则类型 | 说明 | 核心参数 |
| --- | --- | --- |
| **QPS 限流** | 按请求数限流 | count, grade=1 |
| **线程数限流** | 按并发线程数限流 | count, grade=0 |
| **关联限流** | A 资源达到阈值时限制 B | refResource |
| **链路限流** | 只统计指定入口的流量 | refResource（入口） |

Sentinel 的核心架构：所有请求通过 **责任链**（ProcessorSlotChain），每个 Slot 负责一种能力：

```
NodeSelectorSlot → ClusterBuilderSlot → StatisticSlot → FlowSlot → DegradeSlot → ...
         ↓                    ↓               ↓            ↓           ↓
     构建调用树          构建集群节点       统计数据      限流判断    熔断降级

```

`StatisticSlot` 使用 **滑动窗口** 实现实时统计：`LeapArray` 将时间划分为多个 bucket（默认 1 秒 2 个 bucket），每个 bucket 记录通过数、阻塞数、异常数。

### 5.2 实现方案对比

| 维度 | 令牌桶 | 漏桶 | 滑动窗口 | 固定窗口 |
| --- | --- | --- | --- | --- |
| **突发流量** | 允许一定突发 | 完全平滑 | 取决于粒度 | 边界可能2倍 |
| **实现复杂度** | 中 | 低 | 中 | 低 |
| **精确度** | 高 | 高 | 取决于窗口数 | 低 |
| **典型实现** | Guava RateLimiter | Nginx limit_req | Sentinel | 简单计数器 |
| **适用场景** | API 限流 | 流量整形 | 精确统计 | 简单场景 |

### 5.3 生产踩坑经验

**坑 1：单机限流 vs 集群限流**

Guava RateLimiter 是单机限流器，在多实例部署时，实际 QPS = 单机阈值 × 实例数。扩容/缩容会导致全局阈值波动。

解决方案：

- Sentinel 集群限流模式（Token Server 方案）
- 基于 Redis 的集中式限流
- 简单粗暴：总阈值 / 实例数 = 单机阈值（每次扩缩容要调整配置）

**坑 2：RateLimiter.acquire() 的"预支"行为**

`acquire()` 可以提前消费尚未生成的令牌，将等待时间转嫁给下一个请求：

```java
RateLimiter limiter = RateLimiter.create(1); // 1个/秒
limiter.acquire(10); // 立即返回，但下一个 acquire 需要等 10 秒！
limiter.acquire(1);  // 等待约 10 秒

```

如果不希望这种行为，使用 `tryAcquire(permits, timeout, unit)` 做超时控制。

### 5.4 面试追问点

**Q1：令牌桶和漏桶在实际选型中怎么选？**

> 需要允许突发（如秒杀活动开始瞬间）→ 令牌桶。需要严格平滑（如调用第三方 API，对方有严格 QPS 限制）→ 漏桶。大多数 API 限流场景用令牌桶，因为突发流量是正常的。

**Q2：Sentinel 的滑动窗口具体是怎么实现的？**

> `LeapArray` 是核心数据结构。内部维护一个 `WindowWrap` 数组，每个 `WindowWrap` 包含一个时间窗口的起始时间和统计数据（`MetricBucket`）。通过 `当前时间 % 数组长度` 计算索引，实现环形复用。如果某个 bucket 的时间已过期（跨了一整个窗口周期），会重置该 bucket 后复用。这是一种 **内存友好** 的固定大小 O(1) 查询方案。

---

## 六、分布式配置中心

### 6.1 原理详解

Nacos 配置中心（长轮询）

Nacos 客户端获取配置变更的核心机制是 **长轮询（Long Polling）**：

```
1. 客户端发送 HTTP 请求到 Nacos Server，携带本地配置的 MD5 值
2. Server 比对 MD5：
   - 如果有变更 → 立即返回变更的 dataId 列表
   - 如果无变更 → 挂起请求（hold 住连接），默认 30 秒
3. 在 hold 期间如果配置发生变更 → 立即返回
4. 30 秒到期仍无变更 → 返回空结果
5. 客户端收到结果后：
   - 有变更 → 拉取最新配置 → 通知监听器
   - 无变更 → 重新发起长轮询

```

源码核心类：`ClientLongPolling`（Nacos Server 端）、`ClientWorker`（Nacos Client 端）

**为什么用长轮询而不是 WebSocket？**

- HTTP 长轮询兼容性更好，穿透防火墙/代理更容易
- 无状态，服务端重启后客户端自动重连
- 实现简单，运维友好

Apollo 架构

携程开源的配置中心，四大核心组件：

```
Config Service    ─── 配置读取服务（客户端直连）
Admin Service     ─── 配置管理服务（Portal 调用）
Portal            ─── Web 管理界面
Meta Server       ─── 服务发现（封装 Eureka）

```

**配置发布流程**：

1. 用户在 Portal 修改配置 → Admin Service 写入数据库
2. Admin Service 发送 ReleaseMessage 到数据库（消息表）
3. Config Service 定时（1s）扫描 ReleaseMessage 表
4. 发现新消息 → 通知对应客户端的长轮询连接
5. 客户端收到通知 → 拉取最新配置

配置热更新机制

**Spring Cloud 集成方式**：

```java
// 方式一：@Value + @RefreshScope
@RefreshScope  // Spring Cloud 的配置刷新注解
@RestController
public class ConfigController {
    @Value("${app.timeout:3000}")
    private int timeout;
    
    // @RefreshScope 的原理：将 Bean 放入特殊的 refresh scope
    // 配置变更时，销毁该 scope 内的 Bean，下次访问时重新创建
    // 底层是通过 GenericScope + ScopedProxyFactoryBean 实现
}

// 方式二：@ConfigurationProperties（推荐）
@ConfigurationProperties(prefix = "app")
@Component
public class AppConfig {
    private int timeout;
    private String name;
    // getter/setter...
    // 配置变更时通过 EnvironmentChangeEvent 触发 rebind
}

```

### 6.2 Nacos vs Apollo vs Spring Cloud Config 对比

| 维度 | Nacos | Apollo | Spring Cloud Config |
| --- | --- | --- | --- |
| **配置推送** | 长轮询（实时） | 长轮询 + 消息表（秒级） | Git Webhook + Bus（秒级~分钟） |
| **灰度发布** | 支持（IP/标签） | 支持（完善） | 不支持 |
| **版本管理** | 支持 | 支持（完善） | 依赖 Git |
| **多环境** | namespace + group | app + env + cluster | profile + label |
| **高可用** | 集群 + MySQL | 集群 + MySQL | Git 自身高可用 |
| **额外能力** | 服务发现 + 配置 | 纯配置中心 | 纯配置中心 |
| **运维复杂度** | 低 | 中（4 组件） | 低 |

### 6.3 生产踩坑经验

**坑 1：配置变更导致线上事故**

某次修改数据库连接池大小，推送到所有实例，连接池同时重建导致大量请求超时。

解决方案：配置变更走灰度发布，先推少量实例 → 观察监控 → 全量推送。Apollo/Nacos 都支持灰度发布功能。

**坑 2：@RefreshScope 导致并发问题**

`@RefreshScope` 刷新时会销毁并重建 Bean，在高并发下可能导致短暂的 NPE 或状态丢失。

解决方案：使用 `@ConfigurationProperties` 代替 `@RefreshScope`，配置变更时只更新属性值而不销毁 Bean。

### 6.4 面试追问点

**Q1：Nacos 的长轮询和普通轮询有什么区别？**

> 普通轮询：客户端定时（如每秒）发请求查询是否有变更，大部分请求返回"无变更"，浪费带宽和 Server 资源。 长轮询：客户端发一个请求后，Server 如果没有变更就 hold 住连接不返回，有变更时立即返回。本质是 **推拉结合** —— 服务端有能力立即推送变更，同时客户端也在主动拉取，兼具实时性和可靠性。

**Q2：配置中心宕机了怎么办？**

> 客户端有**本地缓存机制**。Nacos 客户端会将拉取到的配置缓存到本地文件（`~/.nacos/config/`），配置中心不可用时读取本地缓存。Apollo 同理，客户端维护本地缓存文件。但注意：如果是全新部署的实例且配置中心不可用，则无缓存可用 —— 这是需要降级处理的场景。

---

## 七、分布式链路追踪

### 7.1 原理详解

OpenTracing 标准

OpenTracing 定义了分布式追踪的标准 API（已演进为 OpenTelemetry），核心概念：

- **Trace**：一次完整的请求链路，由全局唯一的 TraceId 标识
- **Span**：链路中的一个操作单元，包含：SpanId、ParentSpanId、操作名、开始/结束时间、Tags、Logs
- **SpanContext**：跨进程传递的上下文，通常包含 TraceId + SpanId

```
Trace: [TraceId=abc123]
├── Span A (API Gateway)         SpanId=1, ParentSpanId=null
│   ├── Span B (Order Service)   SpanId=2, ParentSpanId=1
│   │   ├── Span C (MySQL)       SpanId=3, ParentSpanId=2
│   │   └── Span D (Redis)       SpanId=4, ParentSpanId=2
│   └── Span E (Stock Service)   SpanId=5, ParentSpanId=1
│       └── Span F (MySQL)       SpanId=6, ParentSpanId=5

```

SkyWalking 字节码增强原理

SkyWalking 的 Java Agent 采用 **字节码增强（Byte Code Enhancement）** 技术，在不修改业务代码的情况下实现链路追踪：

```
启动命令：java -javaagent:/path/to/skywalking-agent.jar -jar app.jar

```

**底层原理**：

1. 通过 `java.lang.instrument.Instrumentation` 的 `premain()` 方法在 JVM 启动时介入
2. 使用 **Byte Buddy**（ASM 的高级封装）修改目标类的字节码
3. 在方法入口/出口织入追踪逻辑（类似 AOP）

```java
// SkyWalking 插件的典型结构
// 以 Dubbo 插件为例（简化）
public class DubboInstrumentation extends ClassInstanceMethodsEnhancePluginDefine {
    
    @Override
    protected ClassMatch enhanceClass() {
        return byName("org.apache.dubbo.monitor.support.MonitorFilter");
    }
    
    @Override
    public InstanceMethodsInterceptPoint[] getInstanceMethodsInterceptPoints() {
        return new InstanceMethodsInterceptPoint[] {
            new InstanceMethodsInterceptPoint() {
                @Override
                public ElementMatcher<MethodDescription> getMethodsMatcher() {
                    return named("invoke"); // 增强 invoke 方法
                }
                @Override
                public String getMethodsInterceptor() {
                    return "DubboInterceptor"; // 拦截器类名
                }
            }
        };
    }
}

// 拦截器实现
public class DubboInterceptor implements InstanceMethodsAroundInterceptor {
    @Override
    public void beforeMethod(EnhancedInstance objInst, Method method, 
                             Object[] allArguments, ...) {
        // 创建 Span，注入 TraceContext 到 RPC 头
        AbstractSpan span = ContextManager.createExitSpan(operationName, remotePeer);
        CarrierItem next = contextCarrier.items();
        while (next.hasNext()) {
            next = next.next();
            invocation.getAttachment().put(next.getHeadKey(), next.getHeadValue());
        }
    }
    
    @Override
    public Object afterMethod(EnhancedInstance objInst, Method method, ...) {
        // 结束 Span
        ContextManager.stopSpan();
        return ret;
    }
}

```

TraceId/SpanId 透传（MDC + 线程池）

TraceId 在进程内通过 **MDC（Mapped Diagnostic Context）** 传递，底层是 `ThreadLocal`。

**核心问题**：线程池场景下 ThreadLocal 无法自动传递到子线程。

```java
// 问题复现
ExecutorService pool = Executors.newFixedThreadPool(10);
MDC.put("traceId", "abc123");
pool.submit(() -> {
    String traceId = MDC.get("traceId"); // null！ThreadLocal 丢失
});

// 解决方案一：手动包装（最基础）
String traceId = MDC.get("traceId");
pool.submit(() -> {
    MDC.put("traceId", traceId);
    try {
        // 业务逻辑
    } finally {
        MDC.clear();
    }
});

// 解决方案二：TTL（TransmittableThreadLocal）—— 阿里开源
// 包装线程池
ExecutorService ttlPool = TtlExecutors.getTtlExecutorService(pool);

// 解决方案三：自定义 TaskDecorator（Spring）
@Bean
public ThreadPoolTaskExecutor taskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setTaskDecorator(runnable -> {
        Map<String, String> contextMap = MDC.getCopyOfContextMap();
        return () -> {
            try {
                if (contextMap != null) MDC.setContextMap(contextMap);
                runnable.run();
            } finally {
                MDC.clear();
            }
        };
    });
    return executor;
}

```

### 7.2 生产踩坑经验

**坑 1：异步场景 TraceId 丢失**

`@Async`、`CompletableFuture`、自定义线程池等场景下 TraceId 丢失，导致链路断裂。

解决方案：全局使用 TTL 包装的线程池，或自定义 `TaskDecorator` 统一透传。SkyWalking 提供了 `@TraceCrossThread` 注解和 `CallableWrapper/RunnableWrapper` 工具类。

**坑 2：日志中的 TraceId 为空**

logback 配置了 `%X{traceId}` 但打印为空。原因：SkyWalking 的 TraceId 不会自动放入 MDC，需要引入 `apm-toolkit-logback-1.x` 依赖并使用 `%tid` 占位符，或手动在 Filter 中桥接。

### 7.3 面试追问点

**Q1：SkyWalking 和 Zipkin 的核心区别？**

> - **数据收集**：SkyWalking 用字节码增强（无侵入），Zipkin 需要在代码中手动埋点或依赖 Spring Cloud Sleuth 自动装配
> - **存储**：SkyWalking 支持 ES/MySQL/BanyanDB，Zipkin 支持 ES/MySQL/Cassandra
> - **分析能力**：SkyWalking 内置拓扑发现、性能指标分析；Zipkin 主要是追踪展示
> - **性能开销**：SkyWalking Agent 的采样和异步上报设计，性能开销约 3-5%

**Q2：字节码增强的性能影响如何评估？**

> 主要开销在：① 额外的方法调用（Span 创建/结束）② 上下文传递 ③ 数据上报。SkyWalking 通过采样（默认全采）和异步上报（gRPC + Buffer 批量发送）控制开销。实测 TPS 5000+ 的接口，开启 SkyWalking 后 RT 增加 1-3ms（约 3-5%）。可以通过降低采样率进一步降低开销。

---

## 八、服务注册与发现

### 8.1 原理详解

Nacos（AP/CP 双模式）

Nacos 根据实例类型选择一致性协议：

- **临时实例（默认）**：AP 模式，使用 **Distro 协议**（Nacos 自研）- 每个 Nacos 节点负责一部分服务的健康检查
- 节点间异步复制数据
- 客户端通过心跳（默认 5s）维持注册
- 15s 无心跳标记为不健康，30s 摘除
- **持久化实例**：CP 模式，使用 **Raft 协议**（JRaft 实现）- 写请求转发给 Leader
- Leader 同步到 Follower 后返回
- 服务端主动健康检查（TCP/HTTP/MySQL）

Eureka 自我保护机制

当 Eureka Server 在短时间内丢失大量实例心跳时（如网络分区），不会剔除这些实例，而是进入自我保护模式。

**触发条件**：最近一分钟实际收到的心跳数 < 期望心跳数 × 85%

**原理**：期望心跳数 = 注册实例数 × 2（每 30s 一次心跳，每分钟 2 次）。如果 100 个实例，期望 200 次心跳/分钟。如果实际收到 < 170 次 → 可能是网络问题而非实例真正下线 → 进入保护模式 → 不剔除实例。

```java
// Eureka Server 自我保护判断核心逻辑（简化）
// PeerAwareInstanceRegistryImpl.java
public boolean isLeaseExpirationEnabled() {
    if (!isSelfPreservationModeEnabled()) return true;
    // numberOfRenewsPerMinThreshold = 实例数 * 2 * 0.85
    return numberOfRecentRenewsPerMin > numberOfRenewsPerMinThreshold;
}

```

**问题**：自我保护模式下，已经宕机的实例不会被剔除，客户端可能调用到不可用的实例。

**解决方案**：客户端配合使用重试 + 熔断，或在非生产环境关闭自我保护 `eureka.server.enable-self-preservation=false`。

健康检查机制对比

| 方式 | Nacos 临时实例 | Nacos 持久实例 | Eureka | Consul |
| --- | --- | --- | --- | --- |
| **检查方向** | 客户端 → Server（心跳） | Server → 客户端 | 客户端 → Server | Server → 客户端 |
| **协议** | HTTP 心跳 | TCP/HTTP/MySQL | HTTP 心跳 | HTTP/TCP/gRPC/Script |
| **频率** | 5s | 可配置 | 30s | 10s |
| **不健康判定** | 15s 无心跳 | 探测失败 | 90s 无心跳 | 连续失败次数 |
| **摘除** | 30s 自动摘除 | 不自动摘除 | 有自我保护 | 可配置 |

### 8.2 注册中心选型对比

| 维度 | Nacos | Eureka | Consul | ZooKeeper |
| --- | --- | --- | --- | --- |
| **一致性** | AP/CP 可选 | AP | CP | CP |
| **健康检查** | 客户端+服务端 | 仅客户端心跳 | 多种方式 | 会话超时 |
| **雪崩保护** | 有（阈值保护） | 有（自我保护） | 无 | 无 |
| **跨数据中心** | 支持（Sync） | 有限 | 原生支持 | 不支持 |
| **额外能力** | 配置中心 | 无 | KV 存储 | 分布式协调 |
| **社区活跃度** | 高（阿里维护） | 低（2.x停止） | 高（HashiCorp） | 高（Apache） |
| **推荐场景** | 国内主流首选 | 遗留 Spring Cloud 项目 | 多语言微服务 | 已有 ZK 集群 |

### 8.3 生产踩坑经验

**坑 1：Eureka 注册延迟导致调用 404**

新实例启动后 30s~90s 内可能不被其他服务发现。原因：Eureka Client 默认 30s 拉取一次注册表，Ribbon 默认 30s 刷新一次 ServerList。

解决方案：缩短拉取间隔 `eureka.client.registry-fetch-interval-seconds=5`，并配合负载均衡器的预热机制。

**坑 2：Nacos 大量临时实例心跳打满 CPU**

上千个服务实例的心跳请求导致 Nacos Server CPU 飙高。

解决方案：调大心跳间隔、使用 gRPC 长连接（Nacos 2.x）代替 HTTP 心跳，连接数从 O(n*频率) 降为 O(n)。

### 8.4 面试追问点

**Q1：为什么 Nacos 要区分临时实例和持久实例？**

> 两种场景的需求不同：
> - **临时实例**：微服务实例，生命周期短，随时可能扩缩容，用 AP 模式保证可用性优先
> - **持久实例**：数据库、中间件等基础设施，生命周期长，需要精确的健康状态，用 CP 模式保证一致性。且持久实例下线后不自动摘除，方便运维排查。

**Q2：如果注册中心全部挂了，服务还能互相调用吗？**

> 短期内可以。因为服务消费者会在本地缓存服务提供者的地址列表。注册中心挂了后：
> - 已有的地址缓存仍然可用
> - 新实例无法注册，下线实例无法摘除
> - 地址列表逐渐变得不准确 这体现了注册中心对可用性的设计 —— 注册中心本身不应该成为调用链路上的单点。

---

## 九、负载均衡

### 9.1 原理详解

客户端负载均衡

客户端从注册中心拉取服务列表，在本地选择一个实例发起调用。

**Ribbon 核心组件**（Spring Cloud Netflix）：

```java
// IRule 接口 —— 负载均衡策略
public interface IRule {
    Server choose(Object key);
}

// 常见实现：
// RoundRobinRule        —— 轮询（默认）
// RandomRule            —— 随机
// WeightedResponseTimeRule —— 根据响应时间加权
// BestAvailableRule     —— 选并发数最低的
// ZoneAvoidanceRule     —— 区域感知 + 可用性过滤（Spring Cloud 默认）

```

**Spring Cloud LoadBalancer**（Ribbon 的替代者）：

```java
// 自定义负载均衡策略
@Bean
public ReactorLoadBalancer<ServiceInstance> customLB(
        Environment environment,
        LoadBalancerClientFactory clientFactory) {
    String name = environment.getProperty(LoadBalancerClientFactory.PROPERTY_NAME);
    return new RandomLoadBalancer(
        clientFactory.getLazyProvider(name, ServiceInstanceListSupplier.class), name);
}

```

服务端负载均衡（Nginx）

| 算法 | Nginx 指令 | 说明 |
| --- | --- | --- |
| 轮询 | 默认 | 依次分发 |
| 加权轮询 | `weight=N` | 按权重比例分发 |
| IP Hash | `ip_hash` | 同 IP 固定到同一后端 |
| 最少连接 | `least_conn` | 选当前连接数最少的 |
| 一致性 Hash | `hash $key consistent` | 按 key 的一致性 Hash 分发 |

一致性 Hash 原理及虚拟节点

**传统 Hash 的问题**：`hash(key) % N`，当 N 变化时（扩缩容），几乎所有 key 都需要重新映射 → 缓存雪崩。

**一致性 Hash**：

1. 将 Hash 空间组织成一个环（0 ~ 2^32-1）
2. 将服务节点 Hash 到环上
3. 请求的 key Hash 后在环上顺时针找到最近的节点
4. 节点增减只影响相邻节点的数据

**虚拟节点解决数据倾斜**：

```java
public class ConsistentHash<T> {
    private final int numberOfReplicas; // 每个物理节点的虚拟节点数
    private final TreeMap<Long, T> circle = new TreeMap<>();
    
    public ConsistentHash(int numberOfReplicas, Collection<T> nodes) {
        this.numberOfReplicas = numberOfReplicas;
        for (T node : nodes) {
            addNode(node);
        }
    }
    
    public void addNode(T node) {
        for (int i = 0; i < numberOfReplicas; i++) {
            long hash = hash(node.toString() + "#" + i);
            circle.put(hash, node);
        }
    }
    
    public void removeNode(T node) {
        for (int i = 0; i < numberOfReplicas; i++) {
            long hash = hash(node.toString() + "#" + i);
            circle.remove(hash);
        }
    }
    
    public T get(String key) {
        if (circle.isEmpty()) return null;
        long hash = hash(key);
        // 顺时针找到第一个 >= hash 的节点
        Map.Entry<Long, T> entry = circle.ceilingEntry(hash);
        if (entry == null) {
            entry = circle.firstEntry(); // 环绕
        }
        return entry.getValue();
    }
    
    private long hash(String key) {
        // 使用 MurmurHash / FNV 等高质量 Hash 函数
        // MD5 取前 4 字节也行，但性能差
        return MurmurHash.hash64(key);
    }
}

```

**虚拟节点数量的选择**：

- 太少（如 10 个）：数据分布仍然不均匀
- 太多（如 10000 个）：内存占用大，查找慢
- 经验值：**150~200 个虚拟节点**，可以使数据分布标准差控制在 5%~10%

### 9.2 实现方案对比

| 维度 | 客户端负载均衡 | 服务端负载均衡（Nginx） | DNS 负载均衡 |
| --- | --- | --- | --- |
| **决策位置** | 客户端进程内 | 独立的代理层 | DNS 服务器 |
| **灵活性** | 高（自定义策略） | 中 | 低 |
| **性能** | 高（无额外跳转） | 中（多一跳） | 高 |
| **服务发现** | 需集成注册中心 | 需配置 upstream | DNS 记录 |
| **健康检查** | 依赖注册中心 | 主动/被动探测 | 无 |
| **适用场景** | 微服务内部调用 | 南北向流量（外部访问） | 全局流量调度 |

### 9.3 生产踩坑经验

**坑 1：一致性 Hash 热点问题**

某个热 key 被大量请求命中同一个节点，导致该节点过载。

解决方案：热 key 探测 + 本地缓存。发现热 key 后在客户端本地缓存，不再请求后端节点。或者对热 key 增加随机后缀分散到多个虚拟节点。

**坑 2：Ribbon 缓存导致调用已下线实例**

Ribbon 默认 30s 刷新 ServerList，在这期间下线的实例仍然可能被调用。

解决方案：缩短刷新间隔 + 配合重试机制。或使用 Spring Cloud LoadBalancer + Nacos 的推送通知实现实时感知。

### 9.4 面试追问点

**Q1：一致性 Hash 在扩容时如何保证数据迁移最少？**

> 新增节点只影响环上相邻的一段区间。假设环上有 A、B、C 三个节点，新增 D 落在 B 和 C 之间，则只有原本映射到 C 的 key 中，Hash 值落在 B~D 之间的部分需要迁移到 D。其他 key 不受影响。迁移量约为 `1/N`（N 为节点数）。

**Q2：客户端负载均衡的最大风险是什么？**

> **地址列表不一致**。不同客户端实例从注册中心拉取地址列表的时间不同，可能看到不同的列表。极端情况下，某个已下线实例在部分客户端的列表中仍然存在。需要配合健康检查、重试、熔断机制来缓解。

**Q3：为什么推荐用 ZoneAvoidanceRule 而不是简单的 RoundRobinRule？**

> `ZoneAvoidanceRule` 先按 Zone（可用区）过滤掉不可用或高负载的 Zone，再在剩余 Zone 内轮询。在多可用区部署时，可以优先调用同可用区的实例（低延迟），并自动规避故障区域。这在生产环境中比简单轮询更安全。

---

## 总结：面试知识图谱

```
分布式系统
├── 分布式锁 ──── Redis/Redisson/ZK/RedLock
├── 分布式ID ──── Snowflake/Leaf/UidGenerator
├── 分布式事务 ── 2PC/TCC/SAGA/本地消息表/Seata
├── 一致性协议 ── CAP/BASE/Paxos/Raft/ZAB
├── 限流 ──────── 令牌桶/漏桶/滑动窗口/Sentinel/Guava
├── 配置中心 ──── Nacos/Apollo/热更新
├── 链路追踪 ──── OpenTracing/SkyWalking/MDC透传
├── 注册发现 ──── Nacos/Eureka/Consul/ZK
└── 负载均衡 ──── Ribbon/Nginx/一致性Hash

```

> **面试答题心法**：先说 **是什么**（一句话定义），再说 **怎么做**（实现原理），然后说 **有什么坑**（生产经验），最后说 **怎么选**（方案对比）。展现你不仅知道理论，更有落地经验和独立思考。

## 相关文章

- [backend-tiered-interview](/posts/backend/backend-tiered-interview/)
- [后端面试官地图](/posts/backend/backend-interview-map/)
