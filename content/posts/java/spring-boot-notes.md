---
title: Spring Boot 笔记：启动与配置
date: 2026-11-03
summary: Java 目录下的 demo：自动配置与 application.yml 的直觉理解。
---

同样位于 `java/` 分类。地址：

`/posts/java/spring-boot-notes/`

## 为什么「加个依赖就能跑」？

Spring Boot 通过 **自动配置** 根据 classpath 上的依赖，推断并装配常用 Bean（例如 Web、DataSource）。你仍可用配置或自定义 Bean 覆盖默认行为。

## 配置从哪来？

常见来源优先级（简化理解）：

1. 命令行参数  
2. 环境变量  
3. `application-{profile}.yml`  
4. `application.yml`  

```yaml
server:
  port: 8080

spring:
  application:
    name: demo
```

## 小结

- 目录分类：`content/posts/java/*.md`  
- 列表里会显示分类标签 `java`  
- 详情页 URL 保留目录结构  

适合把同一主题的文章收在一个文件夹里管理。
