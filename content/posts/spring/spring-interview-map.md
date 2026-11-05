---
title: Spring / Spring Boot 面试官地图
date: 2026-11-07
summary: 按初 / 中 / 高组卷；IoC、AOP、循环依赖、事务、Boot 自动配置与场景追问。
kind: map
---

面向**面试官**。Spring 题忌只背生命周期名词；用**事务失效、循环依赖、AOP 失效**定中级，用**扩展点与设计取舍**定高级。

## 级别画像

| 级别 | 画像 | 信号 |
| --- | --- | --- |
| 初级 | 会注入、写 Controller/Service、用注解事务 | 懂 IoC/DI 是干什么的 |
| 中级 | 懂代理与失效场景、Boot 自动配置 | 能排事务/循环依赖坑 |
| 高级 | 能定分层与扩展规范 | 谈自定义 Starter、性能与安全边界 |

## 组卷

| 级别 | 建议 |
| --- | --- |
| 初级 | IoC + Bean 作用域 + `@Autowired` |
| 中级 | 循环依赖 + 事务失效 + AOP 原理 |
| 高级 | 自动配置原理 + 扩展点 + 多数据源事务 |

详情见 [Spring 核心面试题](/posts/spring/spring-interview/)。  
入门笔记：[Spring Boot 笔记](/posts/java/spring-boot-notes/)。

## 追问链

| 主问（题库） | 初级期望 | 中级追问 | 高级追问 |
| --- | --- | --- | --- |
| [IoC / DI](/posts/spring/spring-interview/#q1) | 解耦、注入方式 | 构造器注入为什么更好 | 容器启动流程与扩展点 |
| [Bean 生命周期](/posts/spring/spring-interview/#q2) | 作用域 | BeanPostProcessor 的位置 | 自定义扩展的实际案例 |
| [循环依赖](/posts/spring/spring-interview/#q3) | 知道有这个问题 | 三级缓存 | 为什么构造器注入解决不了，Boot 2.6 以后的默认行为 |
| [AOP](/posts/spring/spring-interview/#q4) | 切面概念 | JDK 代理和 CGLIB | 自调用失效与解决方案 |
| [事务失效 / 传播](/posts/spring/spring-interview/#q5) | `@Transactional` | 失效的六种场景 | REQUIRES_NEW、NESTED 的用法，多数据源事务 |
| [自动配置](/posts/spring/spring-interview/#q7) | starter 是什么 | 条件注解 | 自定义 Starter 的设计 |

## 学习材料

- 题目与答案：[Spring 核心面试题](/posts/spring/spring-interview/)
- 深度手册：[Spring 生态深度面试手册](/posts/spring/spring-handbook/)，含 Cloud 和 Security
- 上级地图：[后端面试官地图](/posts/backend/backend-interview-map/)
