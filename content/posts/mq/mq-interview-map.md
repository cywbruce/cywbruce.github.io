---
title: 消息队列面试官地图：Kafka / RocketMQ / RabbitMQ
date: 2026-11-08
summary: 三件套怎么组卷、怎么对比选型、按初中高定级；链到各组件题库。
kind: map
---

面向**面试官**。消息队列忌只背「削峰填谷」；用**丢失 / 重复 / 积压 / 顺序 / 选型**定级。

## 级别画像

| 级别 | 画像 | 信号 |
| --- | --- | --- |
| 初级 | 会发会收，知道队列/Topic 基本概念 | 能说清推拉、至少一种 ACK |
| 中级 | 能讲可靠性、幂等、积压治理 | 结合项目说参数与坑 |
| 高级 | 能选型、定规范、容量与故障演练 | 谈一致性、多活、观测与成本 |

## 先问选型（中高级开场很好用）

| 维度 | Kafka | RocketMQ | RabbitMQ |
| --- | --- | --- | --- |
| 定位 | 高吞吐日志/流，存储型 | 业务消息，阿里系云原生常见 | 传统业务队列，路由灵活 |
| 模型 | Topic + Partition 日志 | Topic + Queue | Exchange + Queue 路由 |
| 吞吐 | 通常最高 | 高 | 中（够用多数业务） |
| 延迟 | 可很低，偏吞吐调优 | 低延迟业务友好 | 低 |
| 事务/顺序 | 事务消息、分区有序 | 事务消息、队列级有序较强 | 事务、单队列有序 |
| 生态 | 大数据/流计算强 | Java 业务、阿里云生态 | 多语言、运维成熟 |

**没有绝对最好**：日志采集 / 流处理偏 Kafka；电商订单类业务国内常 RocketMQ；复杂路由、传统企业常 RabbitMQ。

## 60 分钟组卷建议

| 级别 | 建议 |
| --- | --- |
| 初级 | 作用 + 一种 MQ 的基本模型 + ACK |
| 中级 | 可靠性（丢/重）+ 积压 + 顺序；候选人简历用哪种就深挖哪种 |
| 高级 | 三选一对比 + 事务消息或 Exactly-once 边界 + 故障与容量 |

## 专题题库

| 文章 | 用途 |
| --- | --- |
| [Kafka 面试题](/posts/mq/kafka-interview/) | 分区、副本、消费组、ISR、事务等 |
| [RocketMQ 面试题](/posts/mq/rocketmq-interview/) | 队列、事务消息、延迟、堆积等 |
| [RabbitMQ 面试题](/posts/mq/rabbitmq-interview/) | Exchange、确认、死信、镜像/仲裁队列等 |

相关后端地图：[Java](/posts/java/java-interview-map/) · [Redis](/posts/redis/redis-interview-map/) · [MySQL](/posts/mysql/mysql-interview-map/)
- [消息队列深度面试手册](/posts/mq/mq-handbook/)

## 追问链（通用问题 × 三种 MQ）

| 主问 | 初级期望 | 中级追问 | 高级追问 | 答案 |
| --- | --- | --- | --- | --- |
| 为什么用 MQ | 解耦、异步、削峰 | 引入 MQ 带来哪些新问题 | 什么时候不该用 MQ | [Kafka 1](/posts/mq/kafka-interview/#q1) · [RabbitMQ 1](/posts/mq/rabbitmq-interview/#q1) |
| 消息会不会丢 | 生产者确认、消费者 ACK | 三个环节各自怎么保证（acks / 刷盘 / 手动 ACK） | 持久化之后还会丢吗，可靠性和吞吐怎么取舍 | [Kafka 4](/posts/mq/kafka-interview/#q4) · [RocketMQ 4](/posts/mq/rocketmq-interview/#q4) · [RabbitMQ 3、4](/posts/mq/rabbitmq-interview/#q3) |
| 重复消费 | 知道会重复 | 幂等方案（唯一键、去重表、状态机） | Exactly-once 的边界 | [Kafka 8](/posts/mq/kafka-interview/#q8) · [RocketMQ 4](/posts/mq/rocketmq-interview/#q4) |
| 顺序 | 分区 / 队列内有序 | 怎么按业务键路由 | 扩容或重平衡时顺序怎么保证 | [Kafka 2](/posts/mq/kafka-interview/#q2) · [RocketMQ 7](/posts/mq/rocketmq-interview/#q7) |
| 积压 | 加消费者 | 定位瓶颈、临时扩容 | 消费者数量受分区数限制；转存再回放；容量规划 | [Kafka 7](/posts/mq/kafka-interview/#q7) · [RocketMQ 6](/posts/mq/rocketmq-interview/#q6) · [RabbitMQ 8](/posts/mq/rabbitmq-interview/#q8) |
| 延迟 / 事务消息 | — | 延迟关单怎么做 | 事务消息原理（半消息加回查）与本地消息表对比 | [RocketMQ 8、9](/posts/mq/rocketmq-interview/#q8) · [RabbitMQ 11](/posts/mq/rabbitmq-interview/#q11) |
| 高可用 | 集群 | ISR / 主从 / 仲裁队列 | 脑裂、数据一致性 | [Kafka 3](/posts/mq/kafka-interview/#q3) · [RocketMQ 3](/posts/mq/rocketmq-interview/#q3) · [RabbitMQ 7](/posts/mq/rabbitmq-interview/#q7) |
| 选型 | 说得出各自特点 | 按场景选 | 迁移方案与成本 | [RocketMQ 12](/posts/mq/rocketmq-interview/#q12) · [RabbitMQ 9](/posts/mq/rabbitmq-interview/#q9) · [Kafka 11](/posts/mq/kafka-interview/#q11) |

## 学习材料

- 深度手册：[消息队列深度面试手册](/posts/mq/mq-handbook/)，覆盖可靠性、幂等、顺序、积压、延迟和事务消息，以及 Kafka / RocketMQ / RabbitMQ 原理
- 上级地图：[后端面试官地图](/posts/backend/backend-interview-map/)
