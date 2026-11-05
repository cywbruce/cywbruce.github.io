---
title: Redis 面试官地图：怎么出题、怎么定级
date: 2026-11-07
summary: 按初 / 中 / 高组卷；数据类型、过期淘汰、穿透击穿雪崩、持久化与集群怎么追问。
kind: map
---

面向**面试官**。Redis 八股多；用**缓存一致性、热 Key、大 Key、集群故障**场景区分中高级。

## 级别画像

| 级别 | 画像 | 信号 |
| --- | --- | --- |
| 初级 | 会 get/set、过期、做简单缓存 | 知道五种基础类型用途 |
| 中级 | 能选对数据结构、防穿透击穿雪崩 | 能讲持久化、内存淘汰、分布式锁坑 |
| 高级 | 能定缓存规范与高可用 | 谈集群、一致性、热 Key 治理 |

## 组卷

| 级别 | 建议 |
| --- | --- |
| 初级 | 类型选型 + 过期 + 为什么快 |
| 中级 | 穿透/击穿/雪崩 + 锁 + RDB/AOF |
| 高级 | 一致性方案 + 集群/哨兵 + 大 Key |

详情见 [Redis 核心面试题](/posts/redis/redis-interview/)。

## 追问链

| 主问（题库） | 初级期望 | 中级追问 | 高级追问 |
| --- | --- | --- | --- |
| [为什么快](/posts/redis/redis-interview/#q1) | 内存、单线程、IO 多路复用 | 6.0 多线程 IO 是什么 | 慢命令如何影响整体 |
| [数据结构选型](/posts/redis/redis-interview/#q2) | 五种类型用途 | 底层编码（listpack、skiplist） | 大 Key 拆分方案 |
| [穿透 / 击穿 / 雪崩](/posts/redis/redis-interview/#q5) | 能区分三者 | 布隆过滤器、互斥锁、随机过期 | 多级缓存与降级 |
| [缓存一致性](/posts/redis/redis-interview/#q6) | 先更新 DB 再删缓存 | 延迟双删、订阅 binlog | 按业务分级的一致性方案 |
| [分布式锁](/posts/redis/redis-interview/#q7) | SET NX EX | 误删、续期（看门狗） | Redlock 争议与替代方案 |
| [持久化 / 集群](/posts/redis/redis-interview/#q8) | RDB 和 AOF | 混合持久化、哨兵 | Cluster 槽迁移、脑裂 |

## 学习材料

- 题目与答案：[Redis 核心面试题](/posts/redis/redis-interview/)
- 深度手册：[缓存专题深度面试手册](/posts/redis/redis-handbook/)
- 上级地图：[后端面试官地图](/posts/backend/backend-interview-map/)
