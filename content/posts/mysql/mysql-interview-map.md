---
title: MySQL 面试官地图：怎么出题、怎么定级
date: 2026-11-07
summary: 按初 / 中 / 高组卷；索引、事务、锁、主从与慢 SQL 场景怎么追问。
kind: map
---

面向**面试官**。MySQL 题最容易变成背口诀；用**慢 SQL / 死锁 / 主从延迟**场景更能定级。

## 级别画像

| 级别 | 画像 | 信号 |
| --- | --- | --- |
| 初级 | 会写 CRUD、建简单索引、懂主键 | 知道 B+ 树、聚簇索引名词 |
| 中级 | 能看 EXPLAIN、优化慢 SQL、懂事务与锁 | 能讲清最左前缀、间隙锁、MVCC 直觉 |
| 高级 | 能定规范、容量与稳定性 | 谈拆分、一致性、参数与架构取舍 |

## 45～60 分钟组卷

| 级别 | 建议 |
| --- | --- |
| 初级 | 索引是什么 + 事务 ACID + 简单慢查询 |
| 中级 | EXPLAIN + 联合索引 + RR/RC + 死锁 |
| 高级 | 深分页、主从延迟、数据归档与拆分 |

详情见 [MySQL 核心面试题](/posts/mysql/mysql-interview/)。

## 追问链

| 主问（题库） | 初级期望 | 中级追问 | 高级追问 |
| --- | --- | --- | --- |
| [索引为什么快](/posts/mysql/mysql-interview/#q1) | B+ 树、聚簇索引 | 回表、覆盖索引 | 索引过多对写入的代价 |
| [联合索引 / 最左前缀](/posts/mysql/mysql-interview/#q2) | 能判断简单 WHERE | ORDER BY 和范围查询 | 索引下推、跳跃扫描 |
| [隔离级别 / MVCC](/posts/mysql/mysql-interview/#q5) | 四个级别 | ReadView、undo 链 | RR 下的幻读边界 |
| [锁与死锁](/posts/mysql/mysql-interview/#q7) | 行锁 | 间隙锁、next-key | 死锁日志分析与规避规范 |
| [深分页 / 主从 / 分库分表](/posts/mysql/mysql-interview/#q9) | — | 延迟关联、主从延迟 | 分片键选择、跨库查询、数据迁移 |

## 学习材料

- 题目与答案：[MySQL 核心面试题](/posts/mysql/mysql-interview/)
- 深度手册：[数据库专题深度面试手册](/posts/mysql/mysql-handbook/)，覆盖索引、MVCC、锁、分库分表、Binlog、大表优化
- 上级地图：[后端面试官地图](/posts/backend/backend-interview-map/)
