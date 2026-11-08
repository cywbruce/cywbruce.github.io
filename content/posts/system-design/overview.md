---
title: 系统设计入门（导读）
date: 2026-11-05
summary: 系统设计入门模块的总入口：学习路线、四篇内容（基础知识、估算、系统设计题、面向对象设计题）和阅读清单。整理自 system-design-primer。
interview: false
kind: primer
---

本模块参考开源项目 [system-design-primer](https://github.com/donnemartin/system-design-primer/blob/master/README-zh-Hans.md)（作者 Donne Martin，中文译本来自掘金翻译计划），用中文重新组织和改写，并补充了国内常用的技术对照。这是一个**独立模块**，不替代站内已有的手册和题库，两边互相链接。

## 模块内容

| 文章 | 内容 | 进题库 |
| --- | --- | --- |
| [系统设计基础知识](/posts/system-design/fundamentals/) | 可扩展性、CAP、DNS、CDN、负载均衡、数据库、NoSQL、缓存、异步、通信协议、安全 | 否 |
| [估算与延迟数字](/posts/system-design/estimation/) | 2 的幂、延迟数字、QPS 和存储估算的方法与例题 | 否 |
| [系统设计题（primer 版）](/posts/system-design/design-questions/) | 千万用户架构演进、网页爬虫、社交关系、Top-K 热门、键值存储等 | 是 |
| [面向对象设计题](/posts/system-design/ood-questions/) | LRU 缓存、哈希表、停车场、呼叫中心、聊天服务、扑克牌 | 是 |
| [题解代码精讲](/posts/system-design/solutions-code/) | primer 题解代码的 Java 重写版：爬虫（SimHash）、Mint 记账、查询缓存、销售排行、社交 BFS | 否 |
| [题解完整拆解](/posts/system-design/solutions-walkthrough/) | 推特时间线、Pastebin/短链、查询缓存、销售排行四步法全拆，附原题解 5 处疏漏修正 | 否 |
| [阅读清单](/posts/system-design/reading-list/) | 经典论文和公司架构文章，附中文导读 | 否 |

## 学习路线

| 准备时间 | 怎么学 |
| --- | --- |
| 短期（1–2 周） | 通读[基础知识](/posts/system-design/fundamentals/)，追求广度；熟记[延迟数字](/posts/system-design/estimation/)；按答题框架做 2–3 道设计题 |
| 中期（1 个月） | 基础知识每节都能讲出取舍；做完本模块和[站内系统设计题库](/posts/architect/system-design-interview/)的大部分题目；手写 LRU 和停车场 |
| 长期（2–3 个月） | 读[阅读清单](/posts/system-design/reading-list/)里的论文（Dynamo、GFS、Bigtable、Spanner）；深入[分布式手册](/posts/backend/distributed-systems-handbook/)；能按 10 倍规模推演架构 |

**面试会问到多深，取决于：** 你的工作年限、技术背景、应聘的岗位和公司，还有运气。对资深工程师和架构师的期望会高很多。

## 答题四步（primer 的原始框架）

1. **明确场景、约束和假设：** 谁在用、怎么用、用户量、读写比、数据量、延迟和可用性要求
2. **画出高层设计：** 主要组件和它们之间的连接
3. **设计核心组件：** 逐个展开，包括 API、数据模型、关键算法
4. **扩展设计：** 找出瓶颈，逐步加入负载均衡、水平扩展、缓存、分片，并讨论每一步的取舍

站内的[七步答题框架](/posts/architect/system-design-interview/)是这四步的细化版，两者可以配合使用。

## 和站内其他内容的关系

- 系统设计场景题（限流、红包、优惠券等）：[系统设计题库](/posts/architect/system-design-interview/)
- 架构师面试怎么组卷、怎么定级：[架构师面试官地图](/posts/architect/architect-interview-map/)
- 分布式原理深入：[分布式系统手册](/posts/backend/distributed-systems-handbook/)
- 缓存、MQ、数据库深入：[缓存手册](/posts/redis/redis-handbook/) · [MQ 手册](/posts/mq/mq-handbook/) · [数据库手册](/posts/mysql/mysql-handbook/)
