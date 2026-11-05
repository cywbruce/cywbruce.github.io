---
title: 后端面试官地图：总览、组卷与定级
date: 2026-11-05
summary: 后端方向总入口：级别画像、60 分钟组卷、按模块的追问链，一键跳到各专题题库与深度手册。
kind: map
---

面向**面试官**。后端题面很广，先定级别和岗位侧重（业务后端 / 中间件 / 基础架构），再从下面的模块里挑 3～4 块，不要一轮全问。

## 级别画像

| 级别 | 能独立交付 | 定级信号 |
| --- | --- | --- |
| 初级 | CRUD、简单接口、按规范写 SQL 和缓存 | 概念正确，会用常见 API |
| 中级 | 模块设计、慢 SQL 和缓存问题排查、合理用 MQ 和线程池 | 讲得清机制，有真实的坑和解法 |
| 高级 | 容量与稳定性、分布式一致性、跨团队技术决策 | 讲取舍、能量化指标、有治理手段 |

## 60 分钟组卷

1. **开场 5 分钟**：项目、职责、最难的一次技术问题
2. **基础 15 分钟**：Java 或语言基础加一项存储（MySQL / Redis）
3. **分布式 20 分钟**：MQ、分布式事务、限流熔断，三选二
4. **排障 / 场景 15 分钟**：CPU 飙高、接口超时、消息积压，选一个
5. **收尾 5 分钟**：反问，按下面的记录表打勾

## 模块 × 级别追问链

| 模块 | 初级主问 | 中级追问 | 高级追问 | 题库 | 手册 |
| --- | --- | --- | --- | --- | --- |
| Java 基础与集合 | HashMap 结构 | 扩容、树化、并发问题 | 容量规划与内存占用 | [Java 题](/posts/java/java-interview/) | — |
| 并发 | 线程池怎么用 | 七个参数与拒绝策略、AQS | 线程池打满的事故复盘 | [Java 题](/posts/java/java-interview/) | [并发手册](/posts/java/concurrency-handbook/) |
| JVM | 堆与栈 | GC 日志、OOM 类型 | G1/ZGC 选型、容器内调优 | [Java 题](/posts/java/java-interview/) | [JVM 手册](/posts/java/jvm-handbook/) |
| Spring | IoC / DI | 循环依赖、事务失效 | 自动配置与扩展点 | [Spring 题](/posts/spring/spring-interview/) | [Spring 手册](/posts/spring/spring-handbook/) |
| MySQL | 索引是什么 | 最左前缀、MVCC、死锁 | 深分页、分库分表 | [MySQL 题](/posts/mysql/mysql-interview/) | [数据库手册](/posts/mysql/mysql-handbook/) |
| Redis | 五种类型 | 穿透 / 击穿 / 雪崩、分布式锁 | 一致性、热 Key、集群 | [Redis 题](/posts/redis/redis-interview/) | [缓存手册](/posts/redis/redis-handbook/) |
| MQ | 为什么用 MQ | 丢消息、重复、顺序、积压 | 事务消息、选型对比 | [MQ 地图](/posts/mq/mq-interview-map/) | [MQ 手册](/posts/mq/mq-handbook/) |
| 分布式 | 分布式 ID | CAP、分布式事务、限流 | 一致性协议、多活 | [后端分级题](/posts/backend/backend-tiered-interview/) | [分布式手册](/posts/backend/distributed-systems-handbook/) |
| 排障 | 日志怎么看 | CPU 100%、接口慢 | 可观测体系建设 | [后端分级题](/posts/backend/backend-tiered-interview/) | [JVM 手册](/posts/java/jvm-handbook/) |

| 系统设计 | 延迟关单 | 限流器、点赞计数 | 抢红包、分布式缓存 | [系统设计题库](/posts/architect/system-design-interview/) | [设计与架构手册](/posts/architect/design-architecture-handbook/) |

## 子地图

- [Java 面试官地图](/posts/java/java-interview-map/) · [JVM 知识点地图](/posts/java/jvm-knowledge-map/)
- [Spring 地图](/posts/spring/spring-interview-map/) · [MySQL 地图](/posts/mysql/mysql-interview-map/) · [Redis 地图](/posts/redis/redis-interview-map/) · [MQ 地图](/posts/mq/mq-interview-map/)

## 真实面经与模拟

- [建设银行 Java 后端面经](/posts/backend/ccb-java-backend-interview/)
- [大厂 Java 后端模拟面经](/posts/backend/bigtech-java-backend-mock-interview/)

## 记录表

- [ ] 基础概念正确（初级线）
- [ ] 至少一个模块能讲清机制，有排障案例（中级线）
- [ ] 能讲分布式取舍，并给出量化指标（高级线）
- [ ] 回答有结构：现象 → 证据 → 方案 → 验证
