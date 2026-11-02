---
title: Spring / Spring Boot 面试官地图
date: 2026-11-07
summary: 按初 / 中 / 高组卷；IoC、AOP、循环依赖、事务、Boot 自动配置与场景追问。
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
