---
title: 架构师面试官地图：总览、组卷与定级
date: 2026-11-05
summary: 架构师方向总入口：画像、90 分钟组卷、系统设计题评分维度、追问链，链到分级题、模拟面经与两本深度手册。
kind: map
---

面向**面试官**。架构师面试不考背诵，考三件事：**能不能把模糊需求变成可验收的指标、能不能讲清取舍、能不能推动落地。**

## 级别画像

| 级别 | 画像 | 定级信号 |
| --- | --- | --- |
| 初级（资深开发转架构） | 能设计单个系统，懂常见中间件 | 方案能跑通，指标意识弱 |
| 中级（系统架构师） | 能负责一条业务线的架构与演进 | 能量化指标、讲清选型理由、有故障复盘 |
| 高级（平台 / 首席架构师） | 跨团队技术战略、治理与组织 | 讲成本、风险、组织影响，能说「不做什么」 |

## 90 分钟组卷

1. **项目深挖 25 分钟**：候选人主导过的一次架构决策，按背景 → 选项 → 取舍 → 结果 → 复盘追问
2. **系统设计 40 分钟**：按级别选一道（见下表）
3. **治理与演进 15 分钟**：技术债、选型评估、容量规划，任选一个
4. **收尾 10 分钟**：反问；按评分维度打分

## 系统设计题按级别选

| 级别 | 题目 | 答案 |
| --- | --- | --- |
| 中级 | 短链系统、技术选型评估 | [架构师分级题](/posts/architect/architect-tiered-interview/) |
| 高级 | 秒杀、Feed 流、IM、异地多活 | [架构师分级题](/posts/architect/architect-tiered-interview/) · [设计与架构手册 · 秒杀](/posts/architect/design-architecture-handbook/) |
| 中级 | 延迟关单、点赞计数、限流器 | [系统设计题库 · 1、2、5](/posts/architect/system-design-interview/#q2) |
| 中高级 | 优惠券、通知中心、附近的人 | [系统设计题库 · 4、6、7](/posts/architect/system-design-interview/#q4) |
| 高级 | 抢红包、网盘、分布式缓存、搜索联想 | [系统设计题库 · 3、8、9、10](/posts/architect/system-design-interview/#q3) |
| 综合 | 三轮模拟 | [架构师模拟面经](/posts/architect/architect-mock-interview/) |
| 汇总 | 统一答题框架和全站系统设计题索引 | [系统设计题库](/posts/architect/system-design-interview/) |

## 系统设计评分维度

| 维度 | 初级表现 | 中级表现 | 高级表现 |
| --- | --- | --- | --- |
| 需求澄清 | 直接画图 | 主动问 QPS、数据量、一致性要求 | 区分核心链路和非核心链路，定 SLA |
| 容量估算 | 没有 | 数量级估算正确 | 估算驱动选型，算出成本 |
| 架构拆分 | 堆中间件 | 分层清晰，说得出理由 | 能说清每一块「为什么不用别的」 |
| 高可用 | 提到集群 | 限流、熔断、降级、隔离 | 故障演练、多活、RTO/RPO |
| 一致性 | 没考虑 | 知道最终一致和补偿 | 按业务分级给方案，能对账 |
| 演进 | 一步到位 | 分阶段 | 有灰度、回滚和指标验收 |

## 追问链（通用）

1. 这个方案的瓶颈在哪？QPS 再涨 10 倍，先坏的是哪一块？
2. 如果去掉某个中间件（Redis / MQ），还能做吗？代价是什么？
3. 数据不一致时怎么发现、怎么修复？
4. 这个方案你会怎么说服业务方和其他团队？

## 学习材料

| 类型 | 文章 |
| --- | --- |
| 题目与答案 | [系统设计题库](/posts/architect/system-design-interview/) · [架构师分级题](/posts/architect/architect-tiered-interview/) · [模拟面经](/posts/architect/architect-mock-interview/) · [设计模式题](/posts/design-patterns/patterns-interview/) |
| 深度手册 | [设计与架构手册](/posts/architect/design-architecture-handbook/) · [Java 架构师完全教程](/posts/architect/java-architect-guide/) · [分布式系统手册](/posts/backend/distributed-systems-handbook/) |
| 子地图 | [设计模式地图](/posts/design-patterns/patterns-interview-map/) · [后端地图](/posts/backend/backend-interview-map/) |
