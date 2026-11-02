---
title: JVM 垃圾回收入门
date: 2026-11-02
summary: Java 目录下的 demo：GC 在干什么、常见收集器名字扫一眼。
---

放在 `content/posts/java/` 下的文章，URL 会是：

`/posts/java/jvm-gc-basics/`

## GC 在解决什么问题？

堆上不再被引用的对象占用内存。垃圾回收负责找出这些对象并回收空间，让程序尽量少因为内存耗尽而崩溃。

## 常见概念（极简）

- **Young / Old**：新生代与老年代，存活时间不同的对象往往分代管理  
- **Stop-The-World**：部分阶段会暂停应用线程  
- **吞吐量 vs 延迟**：不同收集器在吞吐与暂停时间上取舍不同  

## 一点代码感

```java
public class Demo {
  public static void main(String[] args) {
    // 大量短生命周期对象更容易触发 Young GC
    for (int i = 0; i < 1_000_000; i++) {
      byte[] buf = new byte[1024];
    }
  }
}
```

本篇只做目录与渲染演示；深入调优以后再写专题。
