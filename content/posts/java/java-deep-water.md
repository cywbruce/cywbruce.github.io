---
title: Java 如何快速掌握：路径与深水区
date: 2026-11-03
summary: 语法只是入场券。集合、并发、JVM、字节码才是拉开差距的深水区；附对标学习路径与验证手段。
---

语法层过关之后，按这条线往下挖：

```text
语法 / OOP → 集合框架 → 异常与 IO/NIO → 并发（JUC）→ JVM → 工程化（构建 / 框架）
```

## 深水区清单

| 领域 | 核心知识点 | 难度 |
| --- | --- | --- |
| 集合框架 | `HashMap` 链表转红黑树、`ArrayList` 1.5 倍扩容、`ConcurrentHashMap` 演进 | 中 |
| JVM | 类加载、堆栈方法区、GC（G1/ZGC）、JIT | 高 |
| 并发 | 线程池七参数、锁升级、`volatile` / `synchronized`、JUC | 高 |
| 反射与代理 | `Class`、JDK 动态代理 vs CGLIB | 中高 |
| 字节码 | `javap`、ASM / Javassist | 中高 |

## 关键直觉（够用版）

### HashMap

JDK8+：数组 + 链表 + 红黑树。链表长度 ≥ 8 且容量 ≥ 64 时树化；负载因子默认 0.75，超过阈值扩容。

```java
HashMap<String, Integer> map = new HashMap<>(16);
map.put("key", 1);
// 超过 16 * 0.75 = 12 个元素倾向扩容到 32
```

### 线程池

```java
new ThreadPoolExecutor(
  5, 10,
  60L, TimeUnit.SECONDS,
  new LinkedBlockingQueue<>(100),
  new ThreadPoolExecutor.AbortPolicy()
);
```

要能讲清：核心/最大线程、队列满了怎么办、四种常见拒绝策略、为什么不建议 Executors 无界队列默认工厂。

## 怎么验证「学会了」

```bash
javac Main.java
javap -c Main.class   # 看字节码
```

再用 JVisualVM / Arthas 看运行时。读《深入理解 Java 虚拟机》《Java 并发编程实战》。

## 相关文章

- [JVM GC 入门](/posts/java/jvm-gc-basics/)  
- [多语言 GC 对比](/posts/java/gc-across-languages/)  
- [三语言掌握总览](/posts/guides/language-mastery/)  
