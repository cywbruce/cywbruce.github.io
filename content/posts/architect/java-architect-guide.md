---
title: Java 架构师完全教程
date: 2026-11-05
summary: 架构师角色、设计原则与 ADR、高可用高并发、分布式与微服务、数据与安全架构、云原生、技术管理与术语词典。
interview: false
kind: handbook
---

> 面向 3-5 年+ Java 开发者的架构师进阶指南，涵盖技术深度、架构思维、团队协作与商业视角。

---

## 第一章 架构师角色认知

### 1.1 架构师到底做什么？

很多人以为架构师就是"画框图的人"，这是对架构师最大的误解。架构师的核心职责是 **在约束条件下做出最优技术决策**。这些约束包括：

| 约束维度 | 举例 |
| --- | --- |
| **业务约束** | 功能需求、业务增长预期、合规要求 |
| **技术约束** | 团队技术栈能力、现有系统遗留债务 |
| **资源约束** | 预算（人/钱/时间）、基础设施 |
| **组织约束** | 团队规模、跨团队协作成本、上线时间窗口 |

> 💡 **关键认知**：架构不是追求"最先进"，而是追求"最合适"。一个在 10 人团队落不了地的微服务架构，还不如一个精心设计的单体。

### 1.2 架构师的能力模型

```
┌─────────────────────────────────────────┐
│           架构师能力金字塔               │
├─────────────────────────────────────────┤
│  ▲  商业思维 (ROI / TCO / 成本效益)     │
│  │  技术领导力 (RFC / ADR / Tech Radar) │
│  │  架构设计能力 (模式 / 权衡 / 演进)    │
│  │  工程实践 (CI/CD / 可观测性 / SRE)   │
│  ▼  编码功底 (Java 核心 / 框架源码)      │
└─────────────────────────────────────────┘

```

- **编码功底**：不写代码的架构师做不出好架构。你必须理解 JVM 调优、并发模型、框架源码。
- **工程实践**：CI/CD 流水线、可观测性三支柱（Metrics / Logging / Tracing）、SRE 文化。
- **架构设计能力**：掌握主流架构模式，能做 **Trade-off（权衡）**，能推动架构演进。
- **技术领导力**：通过 RFC（Request for Comments）、ADR（Architecture Decision Record）影响技术方向。
- **商业思维**：理解 **ROI（投资回报率）**、**TCO（总拥有成本）**，能用业务语言与管理层沟通。

### 1.3 架构师 vs 高级开发 vs 技术经理

| 维度 | 高级开发 | 架构师 | 技术经理 |
| --- | --- | --- | --- |
| **关注点** | 模块/功能实现 | 系统整体结构 & 技术方向 | 团队管理 & 项目交付 |
| **决策范围** | 代码级 | 系统/跨系统级 | 组织/流程级 |
| **核心输出** | 代码、单元测试 | 架构文档、技术方案、ADR | 排期、周报、绩效 |
| **沟通对象** | 同组开发 | 多团队 + 产品 + 管理层 | 团队 + 上级 |
| **成功标准** | 功能按时交付 | 系统满足 NFR（非功能需求） | 团队产出 & 人才培养 |

### 1.4 架构师的日常工作

1. **架构评审（Architecture Review）**：审查关键设计方案，确保符合整体架构原则
2. **技术选型**：评估新技术/框架的 **POC（Proof of Concept，概念验证）**
3. **技术债务管理**：识别和优先级排序 **Tech Debt（技术债务）**
4. **容量规划（Capacity Planning）**：根据业务增长预测系统容量需求
5. **故障复盘（Post-Mortem / RCA）**：Root Cause Analysis，建立改进措施
6. **编写 ADR**：记录关键架构决策的上下文、方案、决策理由

---

## 第二章 架构设计核心原则

### 2.1 SOLID 原则（面向对象设计）

SOLID 不仅仅是写代码的原则，在架构层面同样适用：

| 原则 | 全称 | 架构层含义 |
| --- | --- | --- |
| **S** | Single Responsibility（单一职责） | 一个服务只负责一个业务域 |
| **O** | Open-Closed（开闭原则） | 系统通过扩展点演进，而非修改核心逻辑 |
| **L** | Liskov Substitution（里氏替换） | 服务接口的兼容性，新版本向后兼容 |
| **I** | Interface Segregation（接口隔离） | API 按消费者需求拆分，避免"胖接口" |
| **D** | Dependency Inversion（依赖倒置） | 上层模块不依赖下层实现，通过接口/事件解耦 |

### 2.2 CAP 定理与 BASE 理论

**CAP 定理**：分布式系统最多同时满足两项：

- **C（Consistency，一致性）**：所有节点在同一时刻看到相同数据
- **A（Availability，可用性）**：每个请求都能收到非错误响应
- **P（Partition Tolerance，分区容错）**：网络分区时系统仍能运作

> ⚠️ 网络分区（P）在分布式中不可避免，所以实际是在 **CP（强一致 + 分区容错）** 和 **AP（高可用 + 分区容错）** 之间取舍。

**BASE 理论**——对 CAP 中 AP 的延伸：

- **BA（Basically Available）**：基本可用，允许响应时间延长或功能降级
- **S（Soft State）**：软状态，允许中间状态存在
- **E（Eventually Consistent）**：最终一致性，经过一定时间后数据达到一致

### 2.3 架构设计原则

| 原则 | 英文 | 说明 |
| --- | --- | --- |
| **KISS** | Keep It Simple, Stupid | 简单是终极的复杂——避免过度设计 |
| **YAGNI** | You Aren't Gonna Need It | 不要为假想的未来需求买单 |
| **DRY** | Don't Repeat Yourself | 避免重复——但在微服务中要适度，过度 DRY 导致耦合 |
| **关注点分离** | Separation of Concerns（SoC） | 不同关注点（业务/技术/横切）分层处理 |
| **最小惊讶原则** | Principle of Least Astonishment | 系统行为应符合使用者的预期 |
| **演进式架构** | Evolutionary Architecture | 架构不是一步到位，而是迭代演进 |

### 2.4 架构质量属性（NFR，非功能需求）

架构师最核心的工作是确保系统满足 **NFR（Non-Functional Requirements）**：

| 质量属性 | 英文 | 度量指标 |
| --- | --- | --- |
| **可用性** | Availability | SLA（如 99.99% = 年停机 52 分钟） |
| **可扩展性** | Scalability | 水平扩展能力、QPS 上限 |
| **性能** | Performance | P99 延迟、吞吐量（TPS / QPS） |
| **可靠性** | Reliability | MTBF（平均故障间隔）、MTTR（平均恢复时间） |
| **可维护性** | Maintainability | 代码复杂度、部署频率、变更失败率 |
| **安全性** | Security | 漏洞数、攻击面大小 |
| **可观测性** | Observability | 故障发现时间（TTD）、故障定位时间（TTR） |

> 📐 **SLA（Service Level Agreement，服务等级协议）** 的"几个9"：
> - 99.9% → 年停机 8.76 小时
> - 99.99% → 年停机 52.56 分钟
> - 99.999% → 年停机 5.26 分钟

### 2.5 架构决策记录（ADR）

**ADR（Architecture Decision Record）** 是记录关键架构决策的轻量级文档模板：

```markdown
# ADR-001: 选择 Kafka 作为核心消息队列

## 状态
已接受 (Accepted)

## 上下文 (Context)
系统需要支撑日均 5000 万消息，要求高吞吐、消息持久化、支持回溯消费。
现有 RabbitMQ 在 2000 万/天时已出现积压。

## 决策 (Decision)
核心消息链路迁移至 Apache Kafka，保留 RabbitMQ 用于延迟消息场景。

## 理由 (Rationale)
- Kafka 吞吐量可达百万级 TPS，满足增长预期
- 分区机制天然支持水平扩展
- 消息持久化 + 消费者组支持回溯消费
- 团队已有 Kafka 运维经验

## 后果 (Consequences)
- 需要引入 Kafka 集群运维成本（3 节点起步）
- 延迟消息场景仍依赖 RabbitMQ，增加运维复杂度
- 需要培训团队 Kafka 消费者组 Rebalance 调优知识

```

---

## 第三章 高可用架构设计

### 3.1 高可用概述

**高可用（High Availability, HA）** 是指系统在面对各种故障时仍能持续提供服务的能力。衡量指标是 **SLA（Service Level Agreement）** 中的可用性百分比。

架构师需要回答的核心问题：**如果某个组件挂了，系统还能正常服务吗？**

### 3.2 冗余设计（Redundancy）

高可用的第一原则是 **消除单点故障（SPOF, Single Point of Failure）**：

| 层级 | 冗余方案 | 说明 |
| --- | --- | --- |
| **应用层** | 多实例 + 负载均衡 | Nginx / Gateway / K8s Service |
| **数据库** | 主从复制 / 双主 / 集群 | MySQL 主从、PXC、MGR |
| **缓存** | Redis Sentinel / Cluster | 自动故障转移 |
| **消息队列** | Kafka 多副本 / RocketMQ 主从 | 数据不丢失 |
| **机房** | 同城双活 / 异地多活 | 容灾级别从高到低 |

### 3.3 限流（Rate Limiting）

**限流**的目标是保护系统在突发流量下不被打垮。

令牌桶算法（Token Bucket）

```java
// Guava RateLimiter 示例
RateLimiter limiter = RateLimiter.create(100.0); // 每秒 100 个令牌

if (limiter.tryAcquire()) {
    // 获取令牌成功，处理请求
    processRequest();
} else {
    // 被限流，快速失败
    return Result.fail("系统繁忙，请稍后重试");
}

```

漏桶算法（Leaky Bucket）

- 请求以任意速率进入桶中
- 以固定速率从桶中流出处理
- 桶满则丢弃新请求
- 特点：**平滑输出**，但无法应对突发流量

令牌桶 vs 漏桶

| 对比项 | 令牌桶 | 漏桶 |
| --- | --- | --- |
| 突发流量 | ✅ 允许一定程度突发 | ❌ 严格平滑 |
| 输出速率 | 可变 | 固定 |
| 适用场景 | API 限流、秒杀入口 | 流量整形、日志输出 |

滑动窗口计数器

将时间窗口分成多个小格子，每个格子独立计数，窗口滑动时淘汰过期格子。兼顾精度和性能，是 **Sentinel** 采用的核心限流算法。

### 3.4 熔断（Circuit Breaker）

**熔断器模式**借鉴电路保险丝，防止故障级联传播（**Cascading Failure，级联故障**）。

```
状态机：CLOSED → OPEN → HALF_OPEN → CLOSED / OPEN

[CLOSED]  ──(失败率 > 阈值)──→  [OPEN]  ──(超时窗口到)──→  [HALF_OPEN]
    ↑                                                          │
    └──────────(探测成功)──────────────────────────────────────┘
                                                               │
                           [OPEN] ←──(探测失败)────────────────┘

```

| 状态 | 行为 |
| --- | --- |
| **CLOSED（关闭）** | 正常放行请求，统计失败率 |
| **OPEN（打开）** | 拒绝所有请求，直接走 Fallback（降级逻辑） |
| **HALF_OPEN（半开）** | 放行少量探测请求，成功则恢复，失败则继续熔断 |

框架：Sentinel（阿里）/ Resilience4j / Hystrix（Netflix，已停更）

### 3.5 降级（Degradation / Fallback）

当依赖方不可用时，返回 **兜底数据** 保证主链路可用：

| 降级策略 | 说明 | 示例 |
| --- | --- | --- |
| **返回默认值** | 静态兜底 | 推荐列表挂了 → 返回热门榜单缓存 |
| **缓存兜底** | 读本地/Redis 缓存 | 商品详情服务挂了 → 读 Redis 快照 |
| **功能降级** | 关闭非核心功能 | 大促时关闭评论、推荐、积分等 |
| **写降级** | 异步补偿 | 日志/埋点写入失败 → 先写本地文件后补 |

### 3.6 隔离（Isolation）

防止一个故障模块拖垮整个系统：

- **线程池隔离**：每个依赖方使用独立线程池（Hystrix 默认策略）- 优点：严格隔离
- 缺点：线程上下文切换开销
- **信号量隔离**：通过计数器限制并发数（Sentinel 默认策略）- 优点：轻量级，无线程切换
- 缺点：无法设置超时

### 3.7 超时与重试

```java
// 指数退避 + 抖动（Exponential Backoff with Jitter）
long delay = Math.min(
    BASE_DELAY * (long) Math.pow(2, retryCount),
    MAX_DELAY
);
delay += ThreadLocalRandom.current().nextLong(0, delay / 2); // 加抖动
Thread.sleep(delay);

```

> ⚠️ **重试风暴（Retry Storm）**：如果所有调用方同时重试，会放大下游压力。解决方案：
> - 加随机抖动（Jitter）
> - 限制最大重试次数
> - 重试只在 **可重试错误**（超时、5xx）时触发，**非幂等操作** 不重试

### 3.8 幂等设计（Idempotency）

**幂等**：同一操作执行一次和执行多次的效果相同。在分布式系统中，网络重试、MQ 重复消费都要求接口幂等。

| 方案 | 原理 | 适用场景 |
| --- | --- | --- |
| **Token 机制** | 请求前获取 Token，服务端一次性消费 | 表单重复提交 |
| **数据库唯一约束** | UNIQUE KEY 去重 | 订单创建、支付 |
| **状态机** | 只允许合法的状态流转 | 订单状态变更 |
| **Redis SETNX** | 幂等 Key 存 Redis，TTL 过期自动清理 | 高并发去重 |
| **乐观锁（版本号）** | UPDATE ... SET version=version+1 WHERE version=? | 库存扣减 |

### 3.9 同城双活与异地多活

| 架构模式 | 说明 | RPO | RTO |
| --- | --- | --- | --- |
| **冷备** | 备份数据到异地，手动切换 | 小时级 | 小时级 |
| **同城双活** | 同城两个机房，实时同步 | 秒级 | 分钟级 |
| **异地多活** | 多城市多机房，各自可读写 | 秒级 | 秒级 |

名词解释：

- **RPO（Recovery Point Objective，恢复点目标）**：最多能丢失多少数据
- **RTO（Recovery Time Objective，恢复时间目标）**：系统从故障到恢复需要多长时间

异地多活的核心挑战：**数据一致性**。通常按用户维度做 **单元化（Unit）** 架构：

- 每个用户的数据归属一个 **逻辑单元**
- 单元内是强一致的
- 跨单元是最终一致的

---

## 第四章 高并发架构设计

### 4.1 高并发核心指标

| 指标 | 全称 | 含义 |
| --- | --- | --- |
| **QPS** | Queries Per Second | 每秒查询数（读） |
| **TPS** | Transactions Per Second | 每秒事务数（写） |
| **RT** | Response Time | 响应时间（通常看 P99，即 99% 请求的响应时间） |
| **并发数** | Concurrency | 同时处理的请求数 |
| **吞吐量** | Throughput | 单位时间处理的请求总量 |

> 📐 **利特尔法则（Little's Law）**：并发数 = QPS × 平均 RT 例如：QPS=1000，RT=200ms → 并发数 = 1000 × 0.2 = 200

### 4.2 缓存化（Caching）

**缓存是高并发的第一利器**。多级缓存架构：

```
客户端缓存 → CDN → Nginx 本地缓存 → 网关缓存
→ 应用 L1 缓存（Caffeine） → L2 缓存（Redis） → 数据库

```

关键概念：

- **Cache Hit Ratio（缓存命中率）**：命中率低于 90% 时需优化
- **Cache Aside Pattern**：先查缓存 → 未命中查 DB → 写回缓存
- **缓存击穿/穿透/雪崩**：详见前述缓存专题

### 4.3 异步化（Asynchronous）

用 **消息队列（MQ）** 做流量削峰填谷：

```
同步链路：下单 → 扣库存 → 生成订单 → 发短信 → 送积分  (串行 800ms)
异步链路：下单 → 扣库存 → 生成订单 → 发 MQ → 返回成功  (核心 200ms)
                                      ↓
                              消费者异步：发短信 + 送积分

```

**异步化原则**：核心链路同步保证，非核心链路异步解耦。

### 4.4 池化（Pooling）

复用昂贵资源，减少创建/销毁开销：

| 池类型 | 技术实现 | 核心参数 |
| --- | --- | --- |
| **线程池** | ThreadPoolExecutor | coreSize / maxSize / queueCapacity |
| **数据库连接池** | HikariCP / Druid | maximumPoolSize / connectionTimeout |
| **HTTP 连接池** | OkHttp / Apache HttpClient | maxIdleConnections / keepAlive |
| **对象池** | Apache Commons Pool | maxTotal / maxIdle / minIdle |

### 4.5 预计算（Pre-computation）

将热点数据提前计算好，避免实时计算：

- 排行榜：定时任务每 5 分钟刷新 Redis ZSet
- 首页推荐：离线计算 + 定时推送到 Redis
- 商品库存：Redis 预热，避免大促开始瞬间击穿 DB

### 4.6 分而治之（Divide & Conquer）

| 策略 | 说明 | 典型场景 |
| --- | --- | --- |
| **分库分表** | 数据水平拆分，降低单库压力 | 订单表、用户表 |
| **读写分离** | 主库写 / 从库读 | 读多写少的业务 |
| **CDN 分发** | 静态资源就近访问 | 图片、视频、JS/CSS |
| **服务拆分** | 按业务域拆分为独立服务 | 用户服务、订单服务、支付服务 |

---

## 第五章 分布式系统架构

### 5.1 分布式锁

分布式环境下多节点对共享资源的互斥访问。三种主流方案：

| 方案 | 实现 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **Redis** | SETNX + Lua + 看门狗续期 | 高性能、简单 | 主从切换可能丢锁 |
| **ZooKeeper** | 临时有序节点 + Watcher | 强一致、可靠 | 性能较低 |
| **MySQL** | SELECT ... FOR UPDATE / 唯一索引 | 不引入新组件 | 性能最低 |

```java
// Redisson 分布式锁（推荐生产使用）
RLock lock = redisson.getLock("order:lock:" + orderId);
try {
    // 等待 5 秒获取锁，锁自动续期（看门狗 30 秒）
    if (lock.tryLock(5, TimeUnit.SECONDS)) {
        // 业务逻辑
        processOrder(orderId);
    }
} finally {
    if (lock.isHeldByCurrentThread()) {
        lock.unlock();
    }
}

```

> 💡 **看门狗（Watchdog）机制**：Redisson 后台线程每 10 秒检查锁持有者是否存活，存活则续期 30 秒，防止业务未完成锁就过期。

### 5.2 分布式事务

| 方案 | 一致性 | 性能 | 侵入性 | 适用场景 |
| --- | --- | --- | --- | --- |
| **2PC / XA** | 强一致 | 低（同步阻塞） | 低 | 传统数据库跨库事务 |
| **TCC** | 最终一致 | 中 | 高（需写 T/C/C 三套） | 资金类高一致性场景 |
| **SAGA** | 最终一致 | 高 | 中 | 长流程业务编排 |
| **本地消息表** | 最终一致 | 高 | 中 | 跨服务数据同步 |
| **最大努力通知** | 弱一致 | 高 | 低 | 通知类（短信/邮件） |

**TCC 三阶段**：

1. **Try**：预留资源（冻结库存、冻结余额）
2. **Confirm**：确认提交（扣减冻结库存、扣减冻结余额）
3. **Cancel**：释放资源（解冻库存、解冻余额）

> ⚠️ TCC 的坑：空回滚（Try 未执行但收到 Cancel）、悬挂（Cancel 先于 Try 到达）、幂等（网络重试导致重复调用）。

### 5.3 分布式唯一 ID

| 方案 | 有序性 | 性能 | 依赖 | 缺点 |
| --- | --- | --- | --- | --- |
| **UUID** | ❌ 无序 | 极高 | 无 | 无序影响索引、占空间 36 字节 |
| **Snowflake** | ✅ 趋势递增 | 极高 | 时钟 | 时钟回拨问题 |
| **号段模式** | ✅ 趋势递增 | 高 | DB | DB 宕机影响 |
| **Redis INCR** | ✅ 递增 | 高 | Redis | Redis 宕机影响 |

**Snowflake 位分配（64 位）**：

```
0 | 41 位时间戳 | 10 位机器 ID | 12 位序列号
  | (69年)      | (1024节点)   | (4096/ms)

```

### 5.4 一致性算法

**Raft 协议**（比 Paxos 更易理解，被 etcd、Consul、Nacos 采用）：

1. **Leader 选举**：Follower 超时未收到心跳 → 转为 Candidate → 请求投票 → 获得多数票当选 Leader
2. **日志复制**：Leader 接收写请求 → 追加日志 → 并行发送给 Follower → 多数确认后提交
3. **安全性**：只有包含最新已提交日志的节点才能当选 Leader

### 5.5 服务治理

```
┌──────────────────────────────────────────────────┐
│                    服务治理全景                    │
├──────────────────────────────────────────────────┤
│  注册发现：Nacos / Consul / Eureka               │
│  配置管理：Nacos Config / Apollo                  │
│  负载均衡：Ribbon / Spring Cloud LoadBalancer     │
│  服务网关：Spring Cloud Gateway / Kong            │
│  熔断降级：Sentinel / Resilience4j               │
│  链路追踪：SkyWalking / Zipkin / Jaeger          │
│  服务网格：Istio + Envoy (Service Mesh)           │
└──────────────────────────────────────────────────┘

```

---

## 第六章 微服务架构

### 6.1 单体 → 微服务演进路线

```
单体应用 → 垂直拆分（按业务模块） → SOA（ESB 企业服务总线）
→ 微服务（去中心化） → 云原生（容器 + 服务网格 + Serverless）

```

### 6.2 服务拆分原则

| 原则 | 说明 |
| --- | --- |
| **单一职责** | 一个服务只负责一个业务域（DDD 限界上下文） |
| **高内聚低耦合** | 服务内部高度内聚，服务之间松耦合 |
| **团队自治** | **康威定律（Conway's Law）**：系统结构反映组织结构 |
| **数据自治** | 每个服务独占自己的数据库（Database per Service） |
| **渐进拆分** | 不要一步到位，先拆最痛的点（**Strangler Fig Pattern，绞杀者模式**） |

> 💡 **康威定律**：组织沟通结构决定系统架构。反过来说，如果你想要微服务架构，先把团队拆成自治小组。

### 6.3 服务间通信

| 方式 | 协议 | 特点 | 适用场景 |
| --- | --- | --- | --- |
| **同步 - REST** | HTTP/JSON | 简单、通用、调试方便 | 对外 API、CRUD 操作 |
| **同步 - gRPC** | HTTP/2 + Protobuf | 高性能、强类型、流式 | 内部服务间高频调用 |
| **异步 - MQ** | Kafka/RocketMQ | 解耦、削峰、可靠 | 跨服务事件通知 |
| **异步 - Event** | Spring Cloud Stream | 事件驱动架构 | 领域事件传播 |

### 6.4 API 设计规范

**RESTful API 成熟度模型（Richardson Maturity Model）**：

| Level | 描述 | 示例 |
| --- | --- | --- |
| 0 | 单一 URI，POST 为主 | POST /api |
| 1 | 引入资源（URI 定位） | /api/orders/{id} |
| 2 | 正确使用 HTTP 动词 | GET/POST/PUT/DELETE |
| 3 | HATEOAS（超媒体驱动） | 响应中包含可用链接 |

**API 版本管理策略**：

- URI 版本：`/api/v1/orders`、`/api/v2/orders`
- Header 版本：`Accept: application/vnd.company.v2+json`
- Query 参数：`/api/orders?version=2`

### 6.5 服务网格（Service Mesh）

**Service Mesh** 将服务治理能力（限流/熔断/路由/观测）从应用代码下沉到基础设施层：

```
┌─────────────────────────────────┐
│ Service A                       │
│  ┌──────┐    ┌──────────────┐   │
│  │ App  │───→│ Sidecar Proxy│───┼──→ Service B
│  └──────┘    │ (Envoy)      │   │
│              └──────────────┘   │
└─────────────────────────────────┘
         ↕ 控制面（Istio）

```

- **数据面（Data Plane）**：Envoy Sidecar 代理，处理入站/出站流量
- **控制面（Control Plane）**：Istio，下发路由规则、安全策略、遥测配置

### 6.6 部署策略

| 策略 | 原理 | 风险 | 回滚速度 |
| --- | --- | --- | --- |
| **蓝绿部署（Blue-Green）** | 两套完整环境，流量整体切换 | 低 | 秒级切回 |
| **金丝雀发布（Canary）** | 新版本先接 5-10% 流量，逐步扩大 | 低 | 分钟级 |
| **滚动更新（Rolling Update）** | K8s 默认，逐个 Pod 替换 | 中 | 分钟级 |
| **A/B 测试** | 按用户/地区分流 | 低 | 即时 |

> 💡 **灰度发布（Gray Release）** 是金丝雀发布的中文别名，核心思想：新版本小流量验证，确认无问题再全量。

---

## 第七章 数据架构

### 7.1 数据分层架构

```
┌─────────────────────────────────────┐
│  ODS   │ 原始数据层，接入原始日志/DB │
├────────┼────────────────────────────┤
│  DWD   │ 明细数据层，清洗 + 标准化   │
├────────┼────────────────────────────┤
│  DWS   │ 汇总数据层，按主题聚合     │
├────────┼────────────────────────────┤
│  ADS   │ 应用数据层，面向报表/API   │
└────────┴────────────────────────────┘

```

名词：

- **ODS（Operational Data Store）**：操作数据存储
- **DWD（Data Warehouse Detail）**：明细数据
- **DWS（Data Warehouse Summary）**：汇总数据
- **ADS（Application Data Service）**：应用数据服务
- **ETL（Extract, Transform, Load）**：数据抽取、转换、加载

### 7.2 OLTP vs OLAP

| 维度 | OLTP | OLAP |
| --- | --- | --- |
| **全称** | Online Transaction Processing | Online Analytical Processing |
| **目标** | 快速事务处理 | 复杂分析查询 |
| **典型 SQL** | 单行 INSERT/UPDATE | 多表 JOIN + GROUP BY |
| **数据量** | GB ~ TB | TB ~ PB |
| **代表** | MySQL, PostgreSQL | ClickHouse, Hive, Doris |

### 7.3 数据同步方案

| 方案 | 原理 | 实时性 | 适用场景 |
| --- | --- | --- | --- |
| **双写** | 应用同时写两个存储 | 实时 | 简单场景，但一致性难保证 |
| **CDC（Change Data Capture）** | 监听 Binlog 变更 | 准实时（秒级） | MySQL → ES / Redis / 数据仓库 |
| **ETL 批处理** | 定时全量/增量同步 | 分钟 ~ 小时 | 数据仓库离线分析 |
| **MQ 事件驱动** | 业务事件 → MQ → 消费者写入 | 准实时 | 跨服务数据同步 |

> 💡 **CDC 工具**：Canal（阿里，MySQL 专用）、Debezium（开源，支持多种 DB）、Maxwell、Flink CDC。

### 7.4 分库分表

**水平分片策略**：

| 策略 | 原理 | 优点 | 缺点 |
| --- | --- | --- | --- |
| **Hash 取模** | hash(shardKey) % N | 数据均匀 | 扩容困难（数据迁移） |
| **Range 范围** | 按时间/ID 范围 | 扩容方便 | 可能热点 |
| **一致性 Hash** | 虚拟节点 + Hash 环 | 扩容影响小 | 实现复杂 |

**跨库问题及解决**：

| 问题 | 解决方案 |
| --- | --- |
| 跨库 Join | 字段冗余 / 全局表 / 应用层组装 |
| 全局排序分页 | 各分片取 TopN → 内存归并 |
| 分布式主键 | Snowflake / 号段模式 |
| 跨库事务 | Seata / 本地消息表 |

---

## 第八章 安全架构

### 8.1 认证与授权

| 概念 | 英文 | 含义 |
| --- | --- | --- |
| **认证** | Authentication（AuthN） | 你是谁？（验证身份） |
| **授权** | Authorization（AuthZ） | 你能做什么？（验证权限） |

**常用认证方案**：

| 方案 | 原理 | 适用场景 |
| --- | --- | --- |
| **Session + Cookie** | 服务端存储会话状态 | 传统 Web 应用 |
| **JWT（JSON Web Token）** | 无状态令牌，自包含用户信息 | 微服务、前后端分离 |
| **OAuth 2.0** | 授权框架，支持第三方授权 | 开放平台、SSO |
| **SSO（Single Sign-On）** | 一次登录访问多个系统 | 企业内部系统 |

**JWT 结构**：

```
Header.Payload.Signature
  ↓        ↓        ↓
算法类型  用户信息   签名验证
(Base64) (Base64)  (HMAC/RSA)

```

> ⚠️ JWT 的坑：
> - 无法主动失效（解决：维护 Token 黑名单 / 短有效期 + Refresh Token）
> - Payload 不加密（不要放敏感信息）
> - Token 体积大（每次请求都携带）

**OAuth 2.0 四种授权模式**：

| 模式 | 英文 | 适用场景 |
| --- | --- | --- |
| 授权码模式 | Authorization Code | Web 后端应用（最安全） |
| 隐式模式 | Implicit | SPA 单页应用（已不推荐） |
| 密码模式 | Password | 高度信任的自有应用 |
| 客户端凭证 | Client Credentials | 服务间调用（M2M） |

### 8.2 权限模型

| 模型 | 全称 | 说明 |
| --- | --- | --- |
| **RBAC** | Role-Based Access Control | 基于角色的权限控制（最常用） |
| **ABAC** | Attribute-Based Access Control | 基于属性（用户/资源/环境）的动态权限 |
| **ACL** | Access Control List | 基于访问控制列表 |

**RBAC 模型**：

```
用户 ──(1:N)──→ 角色 ──(N:M)──→ 权限
  │                                 │
  └── 张三 → [管理员]              └── [user:create, user:delete, order:view]
  └── 李四 → [运营]                └── [order:view, report:export]

```

### 8.3 接口安全

| 安全措施 | 说明 |
| --- | --- |
| **HTTPS** | TLS 加密传输，防中间人攻击（**MITM, Man-In-The-Middle**） |
| **接口签名** | 请求参数 + 时间戳 + 密钥 → 签名（防篡改） |
| **防重放** | Nonce（一次性随机数）+ 时间戳窗口 |
| **限流** | 防暴力破解、CC 攻击 |
| **参数校验** | 防 **SQL 注入 / XSS（跨站脚本） / CSRF（跨站请求伪造）** |
| **脱敏** | 手机号、身份证号等 **PII（Personally Identifiable Information）** 脱敏处理 |

### 8.4 数据安全

| 层面 | 措施 |
| --- | --- |
| **传输安全** | TLS 1.2+ / mTLS（双向 TLS） |
| **存储安全** | 敏感字段加密（AES-256）、密码哈希（BCrypt / Argon2） |
| **访问审计** | 操作日志、数据访问日志 |
| **数据分级** | 按敏感等级分类管理（公开 / 内部 / 机密 / 绝密） |

---

## 第九章 云原生与 DevOps

### 9.1 云原生概念

**云原生（Cloud Native）** 是一套技术体系和方法论，核心特征：

| 要素 | 说明 |
| --- | --- |
| **容器化** | Docker 封装应用 + 依赖，保证环境一致性 |
| **微服务** | 服务独立部署、独立扩缩 |
| **服务网格** | Istio/Envoy 管理服务间通信 |
| **不可变基础设施** | 基础设施通过 **IaC（Infrastructure as Code）** 管理，如 Terraform |
| **声明式 API** | 描述期望状态，系统自动收敛，如 Kubernetes YAML |
| **DevOps** | 开发运维一体化 |

### 9.2 Docker 核心概念

| 概念 | 说明 |
| --- | --- |
| **Image（镜像）** | 只读模板，包含应用 + 依赖 + 配置 |
| **Container（容器）** | 镜像的运行实例，隔离的进程 |
| **Dockerfile** | 构建镜像的脚本 |
| **Registry（仓库）** | 存储和分发镜像（Docker Hub、Harbor） |
| **Namespace** | Linux 内核隔离机制（PID/网络/文件系统） |
| **Cgroup** | 资源限制（CPU/内存/IO） |

```dockerfile
# 多阶段构建（Multi-stage Build）——减小镜像体积
FROM maven:3.8-openjdk-17 AS builder
COPY . /app
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre-alpine
COPY --from=builder /app/target/app.jar /app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app.jar"]

```

### 9.3 Kubernetes 核心概念

| 概念 | 说明 |
| --- | --- |
| **Pod** | 最小调度单位，包含 1+ 容器 |
| **Deployment** | 管理 Pod 副本数、滚动更新 |
| **Service** | 为 Pod 提供稳定的访问入口（ClusterIP / NodePort / LoadBalancer） |
| **Ingress** | 七层（HTTP）流量入口，类似 Nginx |
| **ConfigMap / Secret** | 配置管理 / 敏感信息管理 |
| **HPA（Horizontal Pod Autoscaler）** | 根据 CPU/内存/自定义指标自动扩缩容 |
| **PV / PVC** | 持久化存储卷 |
| **Namespace** | 逻辑隔离（类似租户） |

### 9.4 CI/CD 流水线

**CI（Continuous Integration，持续集成）** + **CD（Continuous Delivery / Deployment，持续交付/部署）**

```
代码提交 → 代码扫描（SonarQube）→ 单元测试 → 构建镜像
→ 推送 Registry → 部署 Dev → 自动化测试 → 部署 Staging
→ 审批 → 部署 Production（金丝雀/蓝绿）

```

工具链：

- **CI**：Jenkins / GitLab CI / GitHub Actions
- **代码质量**：SonarQube / SpotBugs / Checkstyle
- **制品管理**：Nexus / Harbor / JFrog Artifactory
- **部署**：ArgoCD（GitOps）/ Helm / Kustomize

### 9.5 可观测性三支柱

| 支柱 | 英文 | 工具 | 回答的问题 |
| --- | --- | --- | --- |
| **指标** | Metrics | Prometheus + Grafana | 系统健康吗？（QPS/RT/Error Rate） |
| **日志** | Logging | ELK（Elasticsearch + Logstash + Kibana）/ Loki | 发生了什么？ |
| **链路** | Tracing | SkyWalking / Jaeger / Zipkin | 请求经过了哪里？ |

**关键指标框架**：

- **USE（Utilization, Saturation, Errors）**：面向资源（CPU/内存/磁盘/网络）
- **RED（Rate, Errors, Duration）**：面向服务（QPS、错误率、延迟）
- **四个黄金信号（Google SRE）**：Latency / Traffic / Errors / Saturation

### 9.6 SRE 核心概念

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **SLI** | Service Level Indicator | 服务质量指标（如 P99 < 200ms） |
| **SLO** | Service Level Objective | 服务质量目标（如 99.9% 请求 P99 < 200ms） |
| **SLA** | Service Level Agreement | 服务等级协议（对外承诺 + 违约赔偿） |
| **Error Budget** | — | 错误预算 = 1 - SLO，用完则冻结上线 |
| **Toil** | — | 重复性手工操作，SRE 目标是消除 Toil |
| **Post-Mortem** | — | 故障复盘（无指责文化，聚焦改进） |

> 📐 **SLI → SLO → SLA 关系**： SLI 是你能测量的指标 → SLO 是你内部设定的目标 → SLA 是你对外承诺的协议

---

## 第十章 架构决策与技术管理

### 10.1 ROI（Return on Investment，投资回报率）

架构师做任何技术决策都要回答一个问题：**这件事值不值得做？**

```
ROI = (收益 - 成本) / 成本 × 100%

```

| 类型 | 量化方式 |
| --- | --- |
| **收益** | 提升吞吐量 → 节省服务器 → 每年省 X 万 |
| **收益** | 减少故障 → 减少赔付/客诉 → 每年省 X 万 |
| **收益** | 提升开发效率 → 减少人力投入 → 每年省 X 人月 |
| **成本** | 开发工时 + 测试工时 + 迁移风险 + 运维成本 |

> 💡 **技巧**：和老板/PM 沟通技术方案时，把技术语言翻译成业务语言。
> - ❌ "我们要引入 Redis Cluster 做多级缓存"
> - ✅ "通过架构优化，预计节省 40% 数据库服务器成本，每年节省约 50 万，投入 2 个人月即可完成"

### 10.2 TCO（Total Cost of Ownership，总拥有成本）

**TCO** 不仅仅是买软件/硬件的钱，还包括：

| 成本项 | 举例 |
| --- | --- |
| **采购成本** | 服务器、云服务费、License |
| **开发成本** | 开发人员工时 |
| **运维成本** | 部署/监控/升级/故障处理 |
| **迁移成本** | 数据迁移、接口改造 |
| **学习成本** | 团队培训、爬坡期效率损失 |
| **机会成本** | 做了 A 就做不了 B |

### 10.3 技术选型方法论

**技术选型决策矩阵**：

| 评估维度 | 权重 | 方案 A | 方案 B | 方案 C |
| --- | --- | --- | --- | --- |
| 功能满足度 | 30% | 8 | 9 | 7 |
| 性能 | 20% | 9 | 7 | 8 |
| 团队熟悉度 | 20% | 9 | 5 | 6 |
| 社区活跃度 | 15% | 8 | 9 | 6 |
| 运维复杂度 | 15% | 7 | 6 | 8 |
| **加权总分** | — | **8.25** | **7.35** | **7.05** |

### 10.4 技术雷达（Tech Radar）

**Technology Radar（技术雷达）** 由 ThoughtWorks 提出，将技术/工具分为四个环：

| 环 | 英文 | 含义 |
| --- | --- | --- |
| **采纳** | Adopt | 已在生产验证，推荐使用 |
| **试验** | Trial | 值得在非关键项目试点 |
| **评估** | Assess | 值得关注和调研 |
| **暂缓** | Hold | 不推荐使用（过时/风险高） |

建议每个团队维护自己的技术雷达，每季度更新。

### 10.5 RFC 流程（Request for Comments）

重大技术方案通过 RFC 流程决策：

1. **作者撰写 RFC**：问题背景 → 方案选项 → 推荐方案 → 风险评估
2. **团队评审**：利益相关人提出 Comments
3. **决策**：架构师/Tech Lead 最终决策
4. **归档**：存入技术文档库，成为 ADR

### 10.6 技术债务管理

**Tech Debt（技术债务）** 就像金融债务，有"利息"——会拖慢未来的开发速度。

| 债务类型 | 举例 | 利息 |
| --- | --- | --- |
| **架构债** | 未拆分的巨石服务、过时框架 | 每次改动都很痛苦 |
| **代码债** | 复制粘贴、魔法数字、无单测 | Bug 频出、回归测试成本高 |
| **文档债** | 无 API 文档、无运维手册 | 新人上手慢、故障定位慢 |
| **基础设施债** | 手动部署、无监控告警 | 故障频繁、恢复慢 |

管理方法：

- 建立 **技术债看板**（和产品需求平行管理）
- 每个迭代预留 **20% 时间** 偿还技术债
- 用 **影响 × 偿还成本** 矩阵排优先级

---

## 第十一章 架构师常用术语与名词词典

> 按字母顺序排列，方便查阅。在面试、技术方案评审、架构文档中高频出现。

### A

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **ACID** | Atomicity, Consistency, Isolation, Durability | 数据库事务四大特性：原子性、一致性、隔离性、持久性 |
| **ADR** | Architecture Decision Record | 架构决策记录 |
| **API** | Application Programming Interface | 应用程序编程接口 |
| **APM** | Application Performance Management | 应用性能管理（如 SkyWalking、New Relic） |
| **AOP** | Aspect-Oriented Programming | 面向切面编程 |

### B

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **BASE** | Basically Available, Soft state, Eventually consistent | CAP 中 AP 的延伸理论 |
| **BFF** | Backend For Frontend | 为前端定制的后端聚合层 |
| **Blue-Green** | — | 蓝绿部署，两套环境切换 |
| **BPM** | Business Process Management | 业务流程管理 |

### C

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **CAP** | Consistency, Availability, Partition tolerance | 分布式系统三选二定理 |
| **CDC** | Change Data Capture | 变更数据捕获（如 Canal、Debezium） |
| **CDN** | Content Delivery Network | 内容分发网络 |
| **CI/CD** | Continuous Integration / Continuous Delivery | 持续集成 / 持续交付 |
| **CQRS** | Command Query Responsibility Segregation | 命令查询职责分离 |
| **CRUD** | Create, Read, Update, Delete | 增删改查 |

### D

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **DDD** | Domain-Driven Design | 领域驱动设计 |
| **DevOps** | Development + Operations | 开发运维一体化 |
| **DI** | Dependency Injection | 依赖注入 |
| **DNS** | Domain Name System | 域名解析系统 |
| **DRY** | Don't Repeat Yourself | 避免重复原则 |
| **DTO** | Data Transfer Object | 数据传输对象 |
| **DWH** | Data Warehouse | 数据仓库 |

### E-F

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **EDA** | Event-Driven Architecture | 事件驱动架构 |
| **ESB** | Enterprise Service Bus | 企业服务总线（SOA 时代产物） |
| **ETL** | Extract, Transform, Load | 数据抽取、转换、加载 |
| **Failover** | — | 故障转移 |
| **Failback** | — | 故障恢复 |
| **FMEA** | Failure Mode and Effects Analysis | 故障模式与影响分析 |

### G-H

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **GitOps** | — | 以 Git 仓库为单一真相源的运维模式 |
| **gRPC** | gRPC Remote Procedure Call | Google 开源的高性能 RPC 框架 |
| **HA** | High Availability | 高可用 |
| **HPA** | Horizontal Pod Autoscaler | K8s 水平自动扩缩容 |

### I-K

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **IaC** | Infrastructure as Code | 基础设施即代码（Terraform、Ansible） |
| **IOC** | Inversion of Control | 控制反转 |
| **ISR** | In-Sync Replicas | Kafka 同步副本集合 |
| **JWT** | JSON Web Token | 无状态认证令牌 |
| **KISS** | Keep It Simple, Stupid | 保持简单原则 |
| **K8s** | Kubernetes | 容器编排平台 |

### L-M

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **LB** | Load Balancer | 负载均衡器 |
| **MITM** | Man-In-The-Middle | 中间人攻击 |
| **MQ** | Message Queue | 消息队列 |
| **MTBF** | Mean Time Between Failures | 平均故障间隔时间 |
| **MTTR** | Mean Time To Repair/Recover | 平均修复/恢复时间 |
| **MVCC** | Multi-Version Concurrency Control | 多版本并发控制（数据库） |
| **MVP** | Minimum Viable Product | 最小可行产品 |

### N-O

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **NFR** | Non-Functional Requirements | 非功能需求（性能/安全/可用性等） |
| **OLAP** | Online Analytical Processing | 在线分析处理 |
| **OLTP** | Online Transaction Processing | 在线事务处理 |
| **ORM** | Object-Relational Mapping | 对象关系映射（MyBatis、JPA） |

### P-Q

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **P99 / P95** | 99th / 95th Percentile | 99% / 95% 分位数延迟 |
| **PII** | Personally Identifiable Information | 个人身份信息（手机号、身份证等） |
| **POC** | Proof of Concept | 概念验证 |
| **QoS** | Quality of Service | 服务质量 |
| **QPS** | Queries Per Second | 每秒查询数 |

### R

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **RBAC** | Role-Based Access Control | 基于角色的权限控制 |
| **RCA** | Root Cause Analysis | 根因分析（故障复盘） |
| **REST** | Representational State Transfer | 表述性状态传递（API 风格） |
| **RFC** | Request for Comments | 技术方案征求意见稿 |
| **ROI** | Return on Investment | **投资回报率**——架构师最重要的商业指标 |
| **RPC** | Remote Procedure Call | 远程过程调用 |
| **RPO** | Recovery Point Objective | 恢复点目标（能容忍丢多少数据） |
| **RTO** | Recovery Time Objective | 恢复时间目标（多快能恢复） |

### S

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **SAGA** | — | 分布式事务模式（补偿事务链） |
| **SDK** | Software Development Kit | 软件开发工具包 |
| **SLA** | Service Level Agreement | 服务等级协议 |
| **SLI** | Service Level Indicator | 服务等级指标 |
| **SLO** | Service Level Objective | 服务等级目标 |
| **SoC** | Separation of Concerns | 关注点分离 |
| **SOA** | Service-Oriented Architecture | 面向服务架构 |
| **SOLID** | S.O.L.I.D Principles | 面向对象五大设计原则 |
| **SPOF** | Single Point of Failure | 单点故障 |
| **SRE** | Site Reliability Engineering | 站点可靠性工程 |
| **SSO** | Single Sign-On | 单点登录 |

### T

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **TCC** | Try-Confirm-Cancel | 分布式事务模式 |
| **TCO** | Total Cost of Ownership | **总拥有成本**——评估技术方案的全生命周期成本 |
| **TDD** | Test-Driven Development | 测试驱动开发 |
| **TPS** | Transactions Per Second | 每秒事务数 |
| **TTD** | Time To Detect | 故障发现时间 |
| **TTL** | Time To Live | 存活时间（缓存/DNS） |
| **TTR** | Time To Resolve/Recover | 故障解决/恢复时间 |

### U-Z

| 术语 | 全称 | 含义 |
| --- | --- | --- |
| **USE** | Utilization, Saturation, Errors | 资源监控方法论 |
| **VIP** | Virtual IP | 虚拟 IP（负载均衡） |
| **VPA** | Vertical Pod Autoscaler | K8s 垂直自动扩缩容 |
| **WAF** | Web Application Firewall | Web 应用防火墙 |
| **YAGNI** | You Aren't Gonna Need It | 不要过度设计原则 |
| **Zero Trust** | — | 零信任安全模型（永不信任，始终验证） |

---

## 总结：架构师成长路径

```
初级开发 (0-2 年)
  │  基础扎实：Java 核心、数据库、Linux
  ↓
高级开发 (2-5 年)
  │  技术深度：框架源码、中间件原理、性能调优
  ↓
架构师 (5-8 年)
  │  架构广度 + 深度：分布式系统、高可用高并发设计、技术选型
  │  商业思维：ROI / TCO / 技术与业务对齐
  │  技术领导力：ADR / RFC / Tech Radar / 技术债管理
  ↓
首席架构师 / CTO (8+ 年)
     技术战略 + 组织能力 + 商业洞察

```

> 🎯 **记住**：架构师的终极价值不是技术多牛，而是 **用合适的技术解决真实的业务问题，并能让团队落地执行**。

---

*本教程共 11 章，覆盖架构师需要掌握的技术体系、架构方法论、商业思维和管理能力。建议结合实际项目反复实践。*

## 目录

- [第一章 架构师角色认知](#%E7%AC%AC%E4%B8%80%E7%AB%A0-%E6%9E%B6%E6%9E%84%E5%B8%88%E8%A7%92%E8%89%B2%E8%AE%A4%E7%9F%A5)
- [第二章 架构设计核心原则](#%E7%AC%AC%E4%BA%8C%E7%AB%A0-%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1%E6%A0%B8%E5%BF%83%E5%8E%9F%E5%88%99)
- [第三章 高可用架构设计](#%E7%AC%AC%E4%B8%89%E7%AB%A0-%E9%AB%98%E5%8F%AF%E7%94%A8%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1)
- [第四章 高并发架构设计](#%E7%AC%AC%E5%9B%9B%E7%AB%A0-%E9%AB%98%E5%B9%B6%E5%8F%91%E6%9E%B6%E6%9E%84%E8%AE%BE%E8%AE%A1)
- [第五章 分布式系统架构](#%E7%AC%AC%E4%BA%94%E7%AB%A0-%E5%88%86%E5%B8%83%E5%BC%8F%E7%B3%BB%E7%BB%9F%E6%9E%B6%E6%9E%84)
- [第六章 微服务架构](#%E7%AC%AC%E5%85%AD%E7%AB%A0-%E5%BE%AE%E6%9C%8D%E5%8A%A1%E6%9E%B6%E6%9E%84)
- [第七章 数据架构](#%E7%AC%AC%E4%B8%83%E7%AB%A0-%E6%95%B0%E6%8D%AE%E6%9E%B6%E6%9E%84)
- [第八章 安全架构](#%E7%AC%AC%E5%85%AB%E7%AB%A0-%E5%AE%89%E5%85%A8%E6%9E%B6%E6%9E%84)
- [第九章 云原生与 DevOps](#%E7%AC%AC%E4%B9%9D%E7%AB%A0-%E4%BA%91%E5%8E%9F%E7%94%9F%E4%B8%8E-devops)
- [第十章 架构决策与技术管理](#%E7%AC%AC%E5%8D%81%E7%AB%A0-%E6%9E%B6%E6%9E%84%E5%86%B3%E7%AD%96%E4%B8%8E%E6%8A%80%E6%9C%AF%E7%AE%A1%E7%90%86)
- [第十一章 架构师常用术语与名词词典](#%E7%AC%AC%E5%8D%81%E4%B8%80%E7%AB%A0-%E6%9E%B6%E6%9E%84%E5%B8%88%E5%B8%B8%E7%94%A8%E6%9C%AF%E8%AF%AD%E4%B8%8E%E5%90%8D%E8%AF%8D%E8%AF%8D%E5%85%B8)

---

## 相关文章

- [architect-tiered-interview](/posts/architect/architect-tiered-interview/)
- [架构师面试官地图](/posts/architect/architect-interview-map/)
