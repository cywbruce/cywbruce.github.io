---
title: 除了 JVM，其他语言怎么做垃圾回收？
date: 2026-11-03
summary: 主流语言 GC / 内存管理一览：引用计数、标记清除、复制、分代、Go 三色标记、Rust 所有权。对照 JVM 建立横向直觉。
---

几乎所有托管语言都有自动内存管理，只是算法不同。先看总表，再看分类。

## 主流一览

| 语言 | 机制 | 特点 |
| --- | --- | --- |
| Java | 分代 + 多种收集器（G1/ZGC 等） | 吞吐与延迟可调 |
| JavaScript (V8) | 分代：新生代 Scavenge + 老生代标记整理 | 短命对象多 |
| Python | 引用计数 + 分代标记清除 | 循环引用靠分代 GC |
| Go | 并发三色标记清除 | STW 极短，工程上很均衡 |
| C# | 分代标记清除压缩 | Gen0/1/2 |
| Ruby | 增量 / 分代演进 | RGenGC |
| Erlang | 每进程独立堆 GC | 互不影响 |
| PHP | 引用计数 + 循环检测 | Zend |
| Swift/ObjC | ARC | 编译期插计数，非 tracing GC |
| Rust | 无 GC | 所有权 + 借用检查，编译期定生命周期 |

更多 JVM 入门见 [JVM GC 入门](/posts/java/jvm-gc-basics/)。

## 算法分类

### 引用计数

对象持有计数，归零即回收。实时性好；**循环引用**要额外检测（Python/PHP）。Swift ARC 偏编译期插入。

### 标记 - 清除

从根可达标记，清未标记。能处理环；可能碎片，经典实现常有 STW。

### 标记 - 整理

标记后把存活对象挤到一端，减碎片。V8 老生代、.NET 常见。

### 复制（Copying）

半区复制，适合**存活率低**的新生代。代价是预留空间。V8 Scavenge、部分函数式运行时。

### 分代

按年龄分区，新区用复制、老区用标记类算法。现代托管语言几乎都借这个思想。

## 三个代表

### Go：三色标记 + 并发

白（未扫）/ 灰（扫到但孩子未完）/ 黑（完成）。写屏障保证并发标记正确性，STW 可到亚毫秒～毫秒级体感。

### Python：计数为主，分代收环

```python
import gc
print(gc.get_threshold())

a, b = [], []
a.append(b)
b.append(a)
del a, b
gc.collect()  # 清理循环引用
```

### Rust：不做运行时 GC

所有权移动、借用检查在编译期挡住悬垂与数据竞争；运行时无 tracing GC 开销，代价是学习曲线与表达约束。

## 怎么选直觉

| 诉求 | 更常被提到的方向 |
| --- | --- |
| 开发效率 + 自动内存 | Java / Go / C# / JS |
| 极低停顿 | Go、JVM ZGC/Shenandoah、按进程 GC（Erlang） |
| 极致可控与性能 | Rust（无 GC） |

## 相关文章

- [JVM GC 入门](/posts/java/jvm-gc-basics/)  
- [Java 深水区](/posts/java/java-deep-water/)  
- [Python 深水区](/posts/python/python-deep-water/)  
