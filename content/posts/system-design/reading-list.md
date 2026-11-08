---
title: 系统设计阅读清单：经典论文与公司架构（中文导读）
date: 2026-11-05
summary: MapReduce、GFS、Bigtable、Dynamo、Spanner、Chubby、Dapper、Kafka、ZooKeeper、Raft 等论文的一句话导读和面试关联，以及值得读的公司工程博客。
interview: false
kind: primer
---

primer 推荐了一批论文和公司架构文章。下面给每篇写一句**它解决了什么问题**，以及**面试里的哪些问题和它有关**，方便你按需要挑着读。来源：[system-design-primer](https://github.com/donnemartin/system-design-primer/blob/master/README-zh-Hans.md)。

## 一、经典论文

| 论文 | 一句话 | 和哪些面试题有关 |
| --- | --- | --- |
| **MapReduce**（Google，2004） | 把大规模批处理抽象成 map 和 reduce 两步，由框架负责分布式执行和容错 | 海量数据统计、Top-K、Hadoop |
| **GFS**（Google，2003） | 大文件分块存储，一个 Master 管元数据，块存 3 副本，针对追加写优化 | 网盘、对象存储、HDFS |
| **Bigtable**（Google，2006） | 稀疏的宽列存储，按行键排序，底层是 LSM 和 SSTable | HBase、宽列 NoSQL、LSM-Tree |
| **Dynamo**（Amazon，2007） | 一致性哈希、Quorum 读写、向量时钟、暗示移交、Merkle 树，**AP 系统的集大成者** | 分布式 KV 存储、Cassandra |
| **Spanner**（Google，2012） | 全球分布的强一致数据库，用 TrueTime（原子钟加 GPS）给事务定时间戳 | 分布式事务、NewSQL、TiDB |
| **Chubby**（Google，2006） | 基于 Paxos 的分布式锁服务，同时提供小文件存储 | 分布式锁、ZooKeeper |
| **ZooKeeper**（Yahoo，2010） | 用于分布式协调的服务，基于 ZAB 协议，提供有序的一致性保证 | 注册中心、配置中心、选主 |
| **Raft**（Stanford，2014） | 比 Paxos 更容易理解的共识算法，分为选主、日志复制、安全性三部分 | etcd、仲裁队列、TiKV |
| **Dapper**（Google，2010） | 分布式链路追踪，用 trace / span 模型和采样 | SkyWalking、Zipkin、OpenTelemetry |
| **Kafka**（LinkedIn，2011） | 把日志作为消息系统的核心，顺序写、分区并行、靠消费者自己记录位移 | MQ 原理 |
| **Cassandra**（Facebook，2009） | 结合了 Dynamo 的分布式设计和 Bigtable 的数据模型 | 海量写入、时序数据 |
| **Borg**（Google，2015） | 大规模集群调度系统，是 Kubernetes 的前身 | 云原生、资源调度 |

**推荐阅读顺序：** GFS → MapReduce → Bigtable → Dynamo → Raft → Spanner。先建立存储和计算的基本概念，再看一致性的取舍。

## 二、公司工程博客与架构文章

| 公司 | 值得看的主题 |
| --- | --- |
| Netflix | 微服务、Chaos Monkey（混沌工程）、Hystrix 熔断 |
| Uber | 地理位置服务、调度系统、数据库从 Postgres 迁到 MySQL |
| Instagram | 用 Django 加 Postgres 扛住海量用户、ID 生成方案 |
| Twitter / X | Timeline（推拉结合）、Snowflake ID |
| Dropbox | 块存储、同步引擎、自建存储（Magic Pocket） |
| Pinterest | 分片 MySQL、缓存体系 |
| WhatsApp | 用 Erlang 支撑单机百万连接 |
| Discord | 消息存储从 Cassandra 迁到 ScyllaDB |
| 国内：美团技术团队 | Leaf 分布式 ID、缓存、全链路压测 |
| 国内：阿里技术 | 双十一大促、RocketMQ、异地多活 |
| 国内：字节跳动技术团队 | 推荐系统、Kitex/Hertz 微服务框架 |

## 三、怎么读

1. **带着问题读：** 比如「Dynamo 为什么不用主从架构？」读完能用 3 句话说清楚这篇论文的核心设计。
2. **对照开源实现：** Dynamo 对照 Cassandra，Bigtable 对照 HBase，Raft 对照 etcd，Chubby 对照 ZooKeeper。
3. **用到面试里：** 回答系统设计题时，能说出「这里借鉴了 Dynamo 的 Quorum 读写」这类话，会是明显的加分项。

## 相关文章

- [系统设计入门导读](/posts/system-design/overview/)
- [分布式系统手册](/posts/backend/distributed-systems-handbook/)
- [学习资料链接](/posts/java/good-resources/)
