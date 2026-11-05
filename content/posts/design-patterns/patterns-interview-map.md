---
title: 设计模式面试官地图：怎么出题、怎么定级
date: 2026-11-07
summary: 少背 23 种定义；用场景让候选人选型，再追问取舍与代码坏味道。
kind: map
---

面向**面试官**。设计模式题最差问法是「请背出 XX 模式」；更好：**给场景 → 让他选 → 追问代价**。

## 级别画像

| 级别 | 画像 | 信号 |
| --- | --- | --- |
| 初级 | 能认出单例、工厂、策略在项目中的用法 | 说得出意图，代码能写简版 |
| 中级 | 能在业务里合理选型，知滥用坏处 | 能对比相近模式 |
| 高级 | 能用原则（SOLID）指导重构 | 谈演进、过度设计边界 |

## 组卷

| 级别 | 建议 |
| --- | --- |
| 初级 | 单例坑 + 策略 vs if-else |
| 中级 | 工厂/建造者、模板方法、代理（联 Spring）、观察者 |
| 高级 | 责任链、装饰 vs 继承、结合开闭原则重构题 |
| 补充 | 状态模式（订单状态机，中级高频）、组合、外观、命令、场景速测 |

详情见 [设计模式核心面试题](/posts/design-patterns/patterns-interview/)。

## 追问链

| 主问（题库） | 初级期望 | 中级追问 | 高级追问 |
| --- | --- | --- | --- |
| [单例](/posts/design-patterns/patterns-interview/#q1) | 双重检查锁 | volatile 为什么必须加 | 枚举单例、反射和序列化攻击 |
| [策略 vs if-else](/posts/design-patterns/patterns-interview/#q6) | 能写出策略接口 | 结合 Spring 注入 Map | 什么时候 if-else 反而更好 |
| [代理](/posts/design-patterns/patterns-interview/#q3) | 静态代理 | JDK 代理和 CGLIB | Spring AOP 的自调用问题 |
| [观察者](/posts/design-patterns/patterns-interview/#q8) | 发布订阅 | Spring 事件、异步监听 | 事务提交后才发事件 |
| [责任链](/posts/design-patterns/patterns-interview/#q9) | — | Filter / Interceptor | 动态编排与短路 |
| [SOLID 与过度设计](/posts/design-patterns/patterns-interview/#q10) | — | 开闭原则案例 | 过度设计的复盘 |
| [状态模式 / 订单状态机](/posts/design-patterns/patterns-interview/#q12) | 知道状态会变化 | 写出状态转移表 | 并发下的状态转移、领域事件 |
| [组合 / 外观 / 命令](/posts/design-patterns/patterns-interview/#q13) | 树形结构、统一入口 | 撤销和重做 | 外观类膨胀治理、命令排队重放 |
| [场景速测](/posts/design-patterns/patterns-interview/#q11) | 场景对应模式 | 先问哪里会变 | 什么时候不该用模式 |

## 学习材料

- 题目与答案：[设计模式核心面试题](/posts/design-patterns/patterns-interview/)
- 深度手册：[设计与架构手册 · 设计模式章节](/posts/architect/design-architecture-handbook/)，结合 Spring 和 JDK 源码
- 上级地图：[架构师面试官地图](/posts/architect/architect-interview-map/)
