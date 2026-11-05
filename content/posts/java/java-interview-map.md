---
title: Java 面试官地图：怎么出题、怎么定级
date: 2026-11-07
summary: 60 分钟组卷模板；按初 / 中 / 高选题；链到核心题库、并发深挖与资料库。
kind: map
---

面向**面试官**。先定目标职级，再选题；不要一轮塞满所有模块。

## 级别画像

| 级别 | 大致画像 | 回答特征 |
| --- | --- | --- |
| 初级 | 能独立做 CRUD、改需求、写基础并发安全代码 | 会用 API，机制说不清也没关系 |
| 中级 | 能设计模块、排坑、合理用线程池 / 事务 / 缓存 | 能讲清「为什么」，有线上/项目案例 |
| 高级 | 能定规范、容量与稳定性、跨服务取舍 | 谈权衡、边界、度量与团队影响 |

## 60 分钟推荐结构

1. **开场 5 分钟**：项目职责、技术栈、难点  
2. **主线 30 分钟**：集合 + 并发 + JVM（或 Spring）按级别抽题  
3. **场景 15 分钟**：接口慢 / 线程池打满 / 内存飙高等  
4. **收尾 10 分钟**：系统设计或反问；打勾定级  

## 按级别选题（直接抄）

### 面初级

- 集合：`ArrayList` / `HashMap` 基本结构  
- 并发：`synchronized` 做什么、线程池会不会用  
- JVM：堆栈差一句、Young/Old 听过吗  
- Spring：注入方式、`@Transactional` 知道挂在哪  
- 详见 [Java 核心面试题](/posts/java/java-interview/) 各章「初级」

### 面中级

- `HashMap` 树化与扩容、`ConcurrentHashMap`  
- 线程池七参数 + 拒绝策略 + 事故案例  
- volatile / 可见性、死锁怎么查  
- GC 日志直觉、常见 OOM  
- Spring 循环依赖、事务失效场景  
- 场景：接口超时、慢 SQL、缓存穿透  

### 面高级

- JMM + happens-before 直觉、AQS 用途  
- 容量：线程池 / 连接池 / JVM 参数怎么定  
- GC 选型（G1/ZGC）与停顿目标  
- 分布式：幂等、一致性、限流降级  
- 架构：拆分边界、稳定性治理  

## 专题索引

| 文章 | 用途 |
| --- | --- |
| [Java 核心面试题](/posts/java/java-interview/) | 主问 + 追问 + 答案要点 + 定级 |
| [MySQL 面试](/posts/mysql/mysql-interview/) · [地图](/posts/mysql/mysql-interview-map/) | 索引 / 事务 / 锁 / 场景 |
| [Redis 面试](/posts/redis/redis-interview/) · [地图](/posts/redis/redis-interview-map/) | 缓存 / 锁 / 高可用 |
| [Spring 面试](/posts/spring/spring-interview/) · [地图](/posts/spring/spring-interview-map/) | IoC / AOP / 事务 / Boot |
| [设计模式面试](/posts/design-patterns/patterns-interview/) · [地图](/posts/design-patterns/patterns-interview-map/) | 场景选型定级 |
| [MQ 面试地图](/posts/mq/mq-interview-map/)（Kafka / RocketMQ / RabbitMQ） | 消息队列组卷与选型 |
| [Java 深水区](/posts/java/java-deep-water/) | 学习路径对照 |
| [资料链接（含 threadandjuc）](/posts/java/good-resources/) | 候选人自学 / 你备课 |
| [JVM 知识点地图](/posts/java/jvm-knowledge-map/) | JVM 学什么、怎么分层 |
| [生产向 JVM](/posts/java/jvm-production-guide/) | K8s / 流式 / 低延迟场景 |
| [高并发经验怎么练](/posts/java/high-concurrency-practice/) | 小项目压测优化闭环 |
| [JVM GC 入门](/posts/java/jvm-gc-basics/) | GC 基础对齐 |
| [多语言 GC](/posts/java/gc-across-languages/) | 横向对比加分题 |

## 记录表

- [ ] 集合与基础 API（初级线）  
- [ ] 并发与排障（中级线）  
- [ ] JVM / 稳定性 / 架构权衡（高级线）  
- [ ] 有真实事故与复盘，而非只背八股  
- [ ] 表达结构化，承认不知道并会查  

**原则：** 追问看深度；给线索后仍能推进，比一次性背满分更有信号。

## 追问链

| 主问（题库） | 初级期望 | 中级追问 | 高级追问 |
| --- | --- | --- | --- |
| [ArrayList vs LinkedList](/posts/java/java-interview/#q1) | 数组和链表的区别 | 扩容机制、随机访问 | 缓存局部性，为什么 LinkedList 很少用 |
| [HashMap 原理](/posts/java/java-interview/#q2) | 数组 + 链表 + 红黑树 | 扩容、树化阈值、hash 扰动 | 1.7 并发死循环、容量规划 |
| [ConcurrentHashMap](/posts/java/java-interview/#q3) | 线程安全 | CAS + synchronized 锁桶 | 并发扩容、size 计数 |
| [synchronized / Lock / volatile](/posts/java/java-interview/#q5) | 会用 | 锁升级、可见性 | happens-before、锁选型 |
| [线程池](/posts/java/java-interview/#q6) | 会创建 | 七个参数、拒绝策略 | 参数怎么定、打满时的事故处理 |
| [AQS](/posts/java/java-interview/#q7) | — | state + CLH 队列 | 自定义同步器 |
| [内存区域 / GC](/posts/java/java-interview/#q8) | 堆和栈 | GC 算法、收集器 | G1/ZGC 选型、GC 日志 |
| [类加载](/posts/java/java-interview/#q10) | 加载阶段 | 双亲委派 | 打破双亲委派（SPI、Tomcat） |
| [接口变慢 / 线程池堆积](/posts/java/java-interview/#q6) | 看日志 | jstack、Arthas 定位 | 根因、改进措施与预防 |
| [幂等下单 / 缓存一致性](/posts/java/java-interview/#q19) | — | 唯一键、延迟双删 | 方案分级与对账 |

## 深度手册

- [并发编程深度面试手册](/posts/java/concurrency-handbook/)
- [JVM 与性能调优深度面试手册](/posts/java/jvm-handbook/)
- 上级地图：[后端面试官地图](/posts/backend/backend-interview-map/)
