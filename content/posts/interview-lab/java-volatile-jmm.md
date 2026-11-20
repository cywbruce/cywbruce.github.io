---
title: "Java volatile 与 JMM 面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "volatile 的可见性与禁重排、happens-before、内存屏障、DCL、伪共享与 VarHandle。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **volatile 语义与 Java 内存模型（JMM）** 的真实深度"问出来"。
> 核心原则：**volatile 的每一道题，最终都会落到"可见性 + 禁止重排序 → happens-before → 内存屏障"这条主线**。只会背"volatile 保证可见性不保证原子性"却讲不清 happens-before 和内存屏障的人，基本停留在八股记忆层。
> 配套：本题库与 ThreadLocal / synchronized / AQS / 线程池等共同构成"Java 并发面试定级体系"。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题](#part-1)
- [Part 2：底层原理题（JMM 与 happens-before）](#part-2)
- [Part 3：核心区分度题（内存屏障与 DCL）](#part-3)
- [Part 4：实战与陷阱题](#part-4)
- [Part 5：2026 新趋势：VarHandle 与 JMM 演进](#part-5)
- [Part 6：能否用 volatile/JMM 定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 volatile 和 JMM 的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> volatile 是 Java 的**轻量级同步机制**，它有两个核心语义：① **保证可见性**——对一个 volatile 变量的写，立即对其他线程可见；② **禁止指令重排序**——通过插入内存屏障保证有序性。但它**不保证复合操作的原子性**（如 `i++`）。
>
> 这些语义的底层依据是 **JMM（Java 内存模型）**。JMM 定义了线程与主内存之间的抽象关系：每个线程有自己的**工作内存**（寄存器/缓存的抽象），共享变量放在主内存。线程操作变量时会经历 read/load/use/assign/store/write 等原子操作。
>
> JMM 用 **happens-before 规则**描述操作间的可见性关系——如果一个操作 happens-before 另一个，那么前一个的结果对后一个可见，且执行顺序不能被重排。
>
> volatile 的底层是通过 JVM 在读写前后插入**内存屏障（Memory Barrier）**实现的：写后加 StoreStore+StoreLoad 屏障，读后加 LoadLoad+StoreLoad 屏障。写 volatile 相当于"锁释放"，读 volatile 相当于"锁获取"，两者构成 happens-before 配对。
>
> 典型使用场景：状态标志位、DCL 单例（禁止重排）、配合 CAS 实现可见性。

**评分要点：** 两大语义 / 不保证原子性 / JMM 工作内存 / happens-before / 内存屏障 这几点，对应入门到高级。能主动提到 happens-before 和内存屏障的，直接往 Part 2 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题

### Q1. volatile 的作用是什么？它和 synchronized 有什么区别？

**标准答案：**
volatile 两大语义：
1. **可见性**：写 volatile 变量后，新值立即刷新到主内存，并使其他线程工作内存中该变量的副本失效，其他线程读时直接从主内存加载。
2. **有序性（禁止指令重排序）**：禁止特定类型的指令重排，保证代码执行顺序符合预期。

**不保证原子性**：`volatile int i; i++;` 在多线程下仍然线程不安全，因为 i++ 是"读-改-写"三步复合操作。

与 synchronized 对比：
| 维度 | volatile | synchronized |
|------|----------|--------------|
| 可见性 | 保证 | 保证 |
| 有序性 | 保证（禁重排） | 保证（锁的 happens-before） |
| 原子性 | 不保证复合操作 | 保证临界区原子性 |
| 是否阻塞 | 不阻塞 | 可能阻塞（重量级锁） |
| 适用范围 | 修饰变量 | 修饰方法/代码块 |
| 开销 | 低 | 较高 |

**追问 1：volatile 能替代 synchronized 吗？**
> **答案：** 不能。volatile 是轻量级机制，只保证可见性和有序性，无法保证复合操作的原子性。典型反例就是 `i++`。只有满足两个条件时才能用 volatile 代替锁：① 对变量的写操作不依赖当前值（如纯赋值 `flag = true`）；② 变量没有与其他状态变量共同维持不变式。

**追问 2：volatile 适合哪些场景？**
> **答案：** ① **状态标志位**（`volatile boolean shutdown`，一个线程改、其他线程看）；② **DCL 单例**中修饰实例引用，禁止 `new` 的重排；③ 作为**轻量级原子读/单写**场景；④ 配合 CAS（如 AtomicInteger 内部 value 就是 volatile）实现原子更新。

---

### Q2. 什么是指令重排序？为什么要重排序？

**标准答案：**
- **指令重排序**：编译器和 CPU 在不改变单线程程序执行结果的前提下，对指令执行顺序重新排列，以优化性能（提高流水线效率、利用并行性）。
- 分三类：① **编译器重排序**（编译期）；② **指令级并行重排序**（CPU 流水线）；③ **内存系统重排序**（缓存/写缓冲区导致）。
- 目的：让 CPU 执行更高效——比如把耗时长的指令后面不相关的指令提前执行，填满流水线空档。

**追问 1：重排序会带来什么问题？**
> **答案：** 在单线程下，重排序遵循 **as-if-serial 语义**（不管怎么重排，单线程执行结果不变），所以没问题。但在**多线程**下，重排序可能破坏线程间的逻辑依赖，导致另一线程看到"不该出现的中间状态"。经典案例就是 DCL 单例：不加 volatile 时，`new Singleton()` 的三步可能被重排，导致其他线程拿到"未初始化完成"的对象。

**追问 2：as-if-serial 和 happens-before 有什么区别？**
> **答案：**
> - **as-if-serial**：单线程语义——不管怎么重排，单线程程序的执行结果不能被改变。编译器/JVM/CPU 都必须遵守。
> - **happens-before**：多线程语义——JMM 用一套规则定义多线程间操作的可见性与顺序关系。如果两个操作之间满足 happens-before，JVM 保证前一个的结果对后一个可见，且顺序不被重排。
> - 简单说：as-if-serial 保护单线程，happens-before 保护多线程。

---

<a id="part-2"></a>

## Part 2：底层原理题（JMM 与 happens-before）

> 这一部分是"背过语义"和"懂内存模型"的分水岭，L2→L3 的关键。

### Q3. JMM 是什么？为什么要抽象出"工作内存"和"主内存"？

**标准答案：**
- **JMM（Java Memory Model）** 是一组规范，定义了**线程如何通过内存进行交互**，规定了共享变量的读写在多线程下的可见性、有序性、原子性保证。它不是物理结构，而是一套**抽象的内存模型**。
- **主内存（Main Memory）**：所有共享变量都存放在这里（类比堆内存，但不完全等同）。
- **工作内存（Working Memory）**：每个线程私有的抽象（类比寄存器、CPU 缓存、写缓冲区）。线程不能直接操作主内存，必须把变量从主内存读到工作内存，在工作内存中操作，再写回主内存。
- **为什么抽象**：真实硬件的缓存、写缓冲区、寄存器、内存屏障机制非常复杂且各平台不同。JMM 通过抽象屏蔽硬件差异，给 Java 程序员一套**统一的、跨平台的一致性保证**——只要按 JMM 规则写代码，在任何平台上行为一致。

**追问 1：JMM 的 8 种原子操作是什么？**
> **答案：**
> 1. **lock（锁定）**：作用于主内存变量，标识为线程独占。
> 2. **unlock（解锁）**：释放主内存变量的锁定。
> 3. **read（读取）**：从主内存读变量到工作内存。
> 4. **load（载入）**：把 read 得到的值放入工作内存的变量副本。
> 5. **use（使用）**：把工作内存变量值传给执行引擎。
> 6. **assign（赋值）**：把执行引擎的结果赋给工作内存变量。
> 7. **store（存储）**：把工作内存变量值传到主内存。
> 8. **write（写入）**：把 store 的值写入主内存变量。
> read/load 配对完成"读"，store/write 配对完成"写"。（这是 JMM 规范层面的原子操作，面试能说出 read/load/use/assign/store/write 六大操作即可。）

**追问 2：工作内存是真实存在的物理内存吗？**
> **答案：** 不是。工作内存是 JMM 的**抽象概念**，它对应的是 CPU 寄存器、各级缓存（L1/L2/L3）、写缓冲区、编译器优化等一系列硬件/编译优化的**综合抽象**。JMM 用这个抽象来描述"为什么线程可能读到旧值"——因为值被缓存在线程私有的工作内存里，还没刷新回主内存。

---

### Q4. happens-before 规则有哪些？完整说一遍。

**标准答案：** （能完整说出 8 条基本是 L3+）

happens-before 是 JMM 判断"一个操作的结果是否对另一个操作可见"的依据。8 条规则：

1. **程序顺序规则**：一个线程内，前面的操作 happens-before 后面的操作。
2. **监视器锁规则**：对一个锁的 unlock happens-before 随后对这个锁的 lock。
3. **volatile 变量规则**：对一个 volatile 变量的写 happens-before 随后对这个变量的读。
4. **传递性**：A happens-before B，B happens-before C，则 A happens-before C。
5. **start() 规则**：Thread.start() happens-before 该线程的任何操作。
6. **join() 规则**：线程的所有操作 happens-before 其他线程检测到该线程结束（join 返回）。
7. **interrupt() 规则**：对线程的 interrupt() happens-before 被中断线程检测到中断。
8. **对象终结规则**：对象的初始化完成 happens-before 它的 finalize() 开始。

**关键理解**：**两个操作之间如果不存在 happens-before 关系，JVM 就可以任意重排序它们**——这就是线程不安全的根源。

**追问 1：happens-before 和"可见性"是什么关系？**
> **答案：** happens-before 是 JMM 提供的**可见性保证的表述**。如果 A happens-before B，那么：① A 的结果对 B 可见；② A 一定在 B 之前执行（顺序保证）。注意一个关键点：**happens-before 强调的是"对另一个线程可见"，即使实际执行时 B 可能在 A 之前被 CPU 执行（只要单线程结果不变），只要保证可见性语义即可**。它是逻辑上的偏序关系，不是严格的物理时序。

**追问 2：为什么要有 happens-before，直接说"可见性"不行吗？**
> **答案：** 因为"可见性"太笼统，无法精确指导程序员和 JVM 实现。happens-before 提供了一套**可判定的偏序规则**：给定两个操作，能明确判断它们之间是否具备可见性保证。这既方便程序员推理并发程序的正确性，也方便 JVM 在编译时判断哪些重排是允许的（有 happens-before 就不能重排，没有就可以优化）——它是连接"程序员语义"和"JVM 实现优化"的桥梁。

---

<a id="part-3"></a>

## Part 3：核心区分度题（内存屏障与 DCL）

> **这一部分是全题的题眼**——能否讲清内存屏障和 DCL 原理，直接决定 L2 还是 L3/L4。定级主要看这里。

### Q5. volatile 的底层是怎么实现的？内存屏障是什么？

**标准答案：** （能完整讲下来基本是 L3+）

volatile 的可见性和有序性由 JVM 插入的**内存屏障（Memory Barrier / Memory Fence）**保证。内存屏障是一类特殊的 CPU 指令，作用有两个：① 禁止屏障两侧的特定类型指令重排；② 强制把缓存/写缓冲区的数据刷回主内存或使缓存失效。

JMM 针对 volatile 的四类屏障（保守策略）：
- **在每个 volatile 写操作前**插入 **StoreStore 屏障**：禁止上面的普通写与下面的 volatile 写重排，并保证前面的写刷回主内存。
- **在每个 volatile 写操作后**插入 **StoreLoad 屏障**：禁止下面的volatile 读/写与上面的 volatile 写重排，并保证 volatile 写刷回主内存——这是开销最大的屏障。
- **在每个 volatile 读操作后**插入 **LoadLoad 屏障**：禁止下面的普通读与上面的 volatile 读重排。
- **在每个 volatile 读操作后**插入 **StoreLoad 屏障**（或 LoadStore）：禁止下面的普通写与上面的 volatile 读重排。

简化记忆：
| 操作 | 前 | 后 |
|------|----|----|
| volatile 写 | StoreStore | StoreLoad |
| volatile 读 | — | LoadLoad + LoadStore |

**追问 1：volatile 写和读的内存屏障逻辑，和锁有什么对应关系？**
> **答案：** volatile 的**写**语义等同于**锁的释放（unlock）**——都会把工作内存数据刷回主内存；volatile 的**读**语义等同于**锁的获取（lock）**——都会使工作内存失效、从主内存重新加载。所以"写 volatile → 读 volatile"构成一对 happens-before，和"unlock → lock"完全对应。这也是为什么 synchronized 和 volatile 都能保证可见性——底层都是类似的屏障机制。

**追问 2：为什么 volatile 写之后要加 StoreLoad 屏障（开销最大）？**
> **答案：** 因为要防止"一个线程写了 volatile 变量后，紧接着读另一个 volatile 变量"时，写操作被重排到读之后，导致可见性语义被破坏。StoreLoad 屏障同时具备 Store 和 Load 的排序能力，是最强的全屏障，能保证写立即对其他线程可见后再执行后续读。它是 volatile 写的主要性能开销来源。

---

### Q6. DCL 单例为什么要加 volatile？完整解释重排序问题。（高频中的高频）

**标准答案：**

```java
public class Singleton {
    private static volatile Singleton instance;   // 关键：volatile
    private Singleton() {}
    public static Singleton getInstance() {
        if (instance == null) {                    // 第一重检查：避免每次都加锁
            synchronized (Singleton.class) {
                if (instance == null) {            // 第二重检查：防止并发重复创建
                    instance = new Singleton();
                }
            }
        }
        return instance;
    }
}
```

`new Singleton()` 在字节码层面分三步：
1. **分配对象内存空间**（申请堆内存）。
2. **初始化对象**（执行构造函数，给字段赋初始值）。
3. **把 instance 引用指向该内存地址**（此时 instance != null）。

不加 volatile 时，步骤 2 和 3 可能被**指令重排序**成 1→3→2：
- 线程 A 执行到步骤 3（instance 已指向内存，但对象还没初始化完成）。
- 线程 B 在**第一重检查**时看到 instance != null，直接返回，**拿到的是一个尚未初始化完成的对象**——调用其方法/字段可能出错（这就是 DCL 的经典 bug）。

**加 volatile 后**：volatile 写的内存屏障**禁止步骤 3 被重排到步骤 2 之前**，保证对象完全初始化后引用才可见，修复该问题。

**追问 1：为什么单重检查不行，要双重检查？**
> **答案：** 第一重检查（`if (instance == null)` 在锁外）是为了**性能**——避免每次调用都进入 synchronized 加锁（单例创建后绝大多数调用都不需要加锁）。第二重检查（锁内）是为了**正确性**——防止多个线程同时通过第一重检查后，在锁内重复创建对象。

**追问 2：除了 volatile + DCL，还有哪些推荐的单例实现？**
> **答案：** ① **静态内部类**（`private static class Holder { static final Singleton INSTANCE = new Singleton(); }`）——利用类加载机制保证线程安全且懒加载，推荐；② **枚举单例**（`enum Singleton { INSTANCE; }`）——最简洁、天然防反射和反序列化破坏，Effective Java 推荐；③ 饿汉式（类加载即创建，非懒加载但简单）。

**追问 3：为什么静态内部类能实现线程安全的懒加载？**
> **答案：** 因为外部类加载时，静态内部类**不会立即加载**；只有在第一次调用 getInstance() 触发访问 Holder.INSTANCE 时，内部类才被加载并初始化。而 JVM 的**类加载机制保证了初始化过程是线程互斥的**（`<clinit>` 方法由 JVM 加锁执行），所以 INSTANCE 只会被创建一次，且是懒加载的。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题

### Q7. volatile 能保证 i++ 的原子性吗？如何用 volatile 实现原子累加？

**标准答案：**
- 不能。`i++` 是 "读 i → 加 1 → 写回 i" 三步复合操作，volatile 只保证每次读写都访问主内存（可见性），但三步之间可能被其他线程打断，导致丢失更新。
- 实现原子累加的方式：① 用 `AtomicInteger` / `LongAdder`（内部用 CAS + volatile）；② 用 synchronized 锁住累加操作；③ 用 Lock。

**追问：为什么 AtomicInteger 的 value 要用 volatile 修饰，同时还要 CAS？**
> **答案：** 两者职责不同，缺一不可：
> - **volatile 保证可见性**：一个线程 CAS 成功后，其他线程能立即看到新的 value 值。
> - **CAS 保证原子性**：`compareAndSet` 是 CPU 原子指令（cmpxchg），保证"比较+更新"这一复合操作不被打断，解决 volatile 无法保证原子性的问题。
> 这正好说明 volatile 和 CAS 是互补关系——**volatile 管可见，CAS 管原子**，合起来才能实现线程安全的原子类。

---

### Q8. 什么是伪共享（False Sharing）？如何避免？

**标准答案：** （L4 区分度题）
- **缓存行（Cache Line）**：CPU 缓存以缓存行为单位（通常 64 字节）与内存交换数据。
- **伪共享**：多个线程频繁修改**同一个缓存行中的不同变量**，虽然逻辑上互不干扰，但因为它们在同一个缓存行，导致该缓存行在各 CPU 核心间频繁失效和同步（缓存一致性协议 MESI），性能急剧下降。
- **举例**：一个类中的两个 `volatile long` 字段紧挨着，两个线程分别高频写这两个字段 → 它们在同一个 64 字节缓存行 → 互相使对方缓存失效 → 性能暴跌。

**避免方式：**
1. **缓存行填充**：在变量前后填充无用字段，让不同变量落到不同缓存行。如 JDK 8 之前 Disruptor 用了 7 个 long 填充（`long p1,p2,...p7;`）。
2. **`@sun.misc.Contended` 注解**：JDK 8 引入（需 `-XX:-RestrictContended`），JVM 自动做缓存行对齐填充。JDK 的 `LongAdder.Cell`、`Thread` 中的部分字段用了它。
3. 合理设计数据结构，让高频写的变量分散。

**追问：为什么 JDK 8 之后 `@Contended` 更受推荐，而不是手动填充？**
> **答案：** 手动填充依赖 JVM 的对象字段布局（可能被重排），且浪费空间、代码丑陋、难以维护。`@Contended` 由 JVM 在底层保证对齐，语义明确、可读性好。不过它属于 sun.misc 内部 API，JDK 9+ 移到 `jdk.internal.vm.annotation.Contended`，普通应用使用受限——所以业务代码里伪共享场景其实不多，主要在高性能框架（Disruptor、ConcurrentHashMap）中关注。

---

### Q9. volatile 变量 writers-to-readers 的可见性，是如何通过其他变量传递的？（进阶 happens-before 应用）

**标准答案：** （考察 happens-before 传递性的实际运用）

这是 JMM 中一个经典模式：**对一个 volatile 变量的写，会让之前所有普通写的结果，对随后读该 volatile 变量的线程可见**。

```java
// 线程 A
data = 42;              // 普通写
ready = true;           // volatile 写

// 线程 B
if (ready) {            // volatile 读
    assert data == 42;  // 一定能看到 data=42
}
```

原理（happens-before 传递性）：
1. 程序顺序规则：`data = 42` happens-before `ready = true`（同一线程）。
2. volatile 变量规则：`ready = true`（写）happens-before `ready`（读）。
3. 程序顺序规则：`ready`（读）happens-before `assert data == 42`。
4. 由**传递性**：`data = 42` happens-before `assert`，所以 B 一定能看到 data=42。

这就是 volatile 的"**piggyback（搭便车）**"效应——普通写借 volatile 写的 happens-before 通道实现了跨线程可见。

**追问：如果没有 volatile，能看到 data=42 吗？**
> **答案：** 不保证。因为普通写 `data=42` 和另一线程的普通读之间没有 happens-before 关系，JVM 可以：① 把 data 缓存在 A 的工作内存不刷回；② 重排指令；③ B 从自己的工作内存读到旧的 data 值。这就是数据竞争的不可预测性。

---

<a id="part-5"></a>

## Part 5：2026 新趋势：VarHandle 与 JMM 演进

> 加分题，考察候选人的技术视野。

### Q10. VarHandle 是什么？它和 volatile/Unsafe 有什么关系？

**标准答案：**
- **VarHandle**（JDK 9 引入，JEP 193）是 Java 对**变量句柄**的官方抽象，提供了一种**类型安全、受支持的方式**来以各种内存序（memory ordering）访问对象字段、数组元素和静态字段。
- 它支持三类访问模式：
  1. **普通访问**（get/set，无可见性保证）。
  2. **volatile 访问**（getVolatile/setVolatile，等价于 volatile 读写语义）。
  3. **原子访问**（compareAndSet/getAndAdd 等，CAS 操作）。
  4. 还有 **lazySet**（opaque）、**acquire/release** 等更细粒度的内存序。
- **与 volatile 的关系**：VarHandle 把 volatile 语义、CAS 语义从"语言关键字/字段修饰符"提升为**可编程的、细粒度的操作**，让开发者能在不声明字段为 volatile 的情况下，按需选择内存序。
- **与 Unsafe 的关系**：VarHandle 是 `sun.misc.Unsafe` 中那些内存操作方法的**官方替代品**——Unsafe 是内部 API、不受支持、有兼容性风险，VarHandle 提供了安全、标准、可被 JVM 优化的替代方案。JDK 自身的 Atomic 系列、ConcurrentHashMap 等内部实现已逐步迁移到 VarHandle。

**追问 1：VarHandle 的细粒度内存序有什么实际价值？**
> **答案：** 在高性能并发场景下，"全 volatile"的内存屏障开销可能过大。VarHandle 允许选择更弱的、刚好满足需求的内存序（如 `setOpaque` 只保证原子性不保证可见性、`release/acquire` 单向屏障），在不牺牲正确性的前提下减少屏障开销。这是给框架开发者用的"精细调优工具"，普通业务代码用 volatile/Atomic 即可。

**追问 2：JMM 在虚拟线程时代有变化吗？**
> **答案：** JMM 的**核心语义没有变化**——happens-before、volatile 规则对虚拟线程同样适用。变化在于：① 虚拟线程由 JVM 调度、不绑定固定平台线程，但线程间的内存可见性规则不变；② 由于虚拟线程数量巨大且短生命周期，基于 ThreadLocal 的"每线程缓存"模式失效（详见 ThreadLocal 题库）；③ 上下文传递更推荐 ScopedValue（JEP 506，JDK 25 转正）——它提供了比 ThreadLocal 更清晰的作用域语义，底层同样依赖 JMM 的可见性保证。

---

<a id="part-6"></a>

## Part 6：能否用 volatile/JMM 定级？如何定级？

### 结论先行

**可以，volatile/JMM 是并发模块里区分度最高的探针之一**——因为它天然分层：背语义 → 懂 JMM → 懂 happens-before → 懂内存屏障 → 懂 DCL 本质 → 懂 VarHandle 演进。而且 JMM 是很多并发问题（可见性、重排、DCL、原子类）的**共同理论基础**，答得好说明候选人建立了体系化的理解。但注意：**它偏理论，必须结合实战题验证，否则容易筛出"八股背得好但没用过"的人**。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 知道 volatile 保可见性、不保原子性；说不清底层 |
| **中级（L2）** | 2–5 年 | Part 2 | 知道 JMM 工作内存/主内存、能说出几条 happens-before 规则 |
| **中高级（L3）** | 5–8 年 | Part 3 | 能讲清内存屏障、完整解释 DCL 为什么加 volatile、理解 happens-before 传递性 |
| **高级（L4）** | 8 年+ | Part 4 | 懂 volatile+CAS 配合、伪共享与缓存行、有实际性能优化经验 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 跟进 VarHandle/内存序/ScopedValue，能把 JMM 纳入整体并发设计 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能主动提到 happens-before/内存屏障 → 至少 L2，直接跳 Part 3；只会背"可见性不保原子性" → 从 Part 2 问起。

**第二步：沿追问链下探，重点问"为什么"。**
- 为什么 volatile 写后要加 StoreLoad 屏障？（最强屏障，保证写可见）
- DCL 不加 volatile 具体会发生什么？（1→3→2 重排，拿到半初始化对象）
- volatile 如何让普通写也变得可见？（happens-before 传递性，piggyback 效应）

**第三步：三类信号防背题。**
1. **真实性**：能否讲出确切的 DCL bug 案例、伪共享调优经历、可见性问题的排查过程。
2. **抽象能力**：能否把 volatile、synchronized、AQS、原子类统一到"**happens-before + 内存屏障**"这一个底层模型上——这是从"记语义"到"懂原理"的分水岭。
3. **权衡能力**：能否说清 volatile 的开销来源（StoreLoad 屏障）、何时用 volatile 何时用锁、VarHandle 的细粒度取舍。

**第四步：按最深层级定级，不按正确率。** 结合实战题验证，避免筛出纯八股选手。

---

### 面试官避坑提醒

- **不要停在"volatile 两大语义"**——那是 L1 水平。真正区分度在 happens-before、内存屏障、DCL。
- **DCL 是必问题**：能完整讲清 1→3→2 重排的人，JMM 一定真懂；讲不清的，多半是背的。
- **警惕"八股高分低能"**：JMM 理论性强，务必用 Part 4 实战题（尤其是"项目里遇到过可见性问题吗"）验证是否真用过。
- **结合岗位**：业务开发问到 Part 3 的 DCL 足够；高并发/中间件团队要问到 Part 4 伪共享、Part 5 VarHandle。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**

1. volatile 的作用？→（可见性 + 禁重排，不保原子性）
2. 和 synchronized 区别？→（轻量不阻塞，只修饰变量，无复合原子性）
3. 什么是重排序 / as-if-serial？→（优化手段；单线程结果不变）
4. JMM 是什么？工作内存/主内存？→（抽象模型；线程私有工作内存 vs 共享主内存）
5. happens-before 8 条规则？→（程序顺序/监视器锁/volatile/传递性/start/join/interrupt/终结）
6. volatile 底层？内存屏障？→（写前 StoreStore、写后 StoreLoad；读后 LoadLoad+LoadStore）
7. DCL 为什么加 volatile？→（禁止 new 的 1→3→2 重排，防半初始化对象）
8. 静态内部类单例为何安全？→（类加载 `<clinit>` 由 JVM 加锁，懒加载+线程安全）
9. volatile 能保证 i++ 吗？AtomicInteger 为何又 volatile 又 CAS？→（不能；volatile 管可见、CAS 管原子）
10. 伪共享？→（同缓存行不同变量互相失效；填充/@Contended）
11. volatile 写让普通写可见？→（happens-before 传递性，piggyback）
12. VarHandle / 虚拟线程下的 JMM？→（细粒度内存序替代 Unsafe；JMM 核心不变，上下文用 ScopedValue）

**定级速判：**
- 答到第 2–4 问 → L1/L2
- 答到第 5–6 问 → L2/L3
- 答到第 7–9 问 → L3
- 答到第 10–11 问 + 有实战 → L4
- 答到第 12 问 + 体系化归纳 → L5

**一票否决信号：** 认为 volatile 能保证 i++ 原子性、讲不清 DCL 为什么要 volatile、说不出任何 happens-before 规则 → 无论年限，最高 L2。

---

*资料整理于 2026-11-19，参考 JMM 规范（JSR-133）、《Java 并发编程实战》、JEP 193（VarHandle）、JEP 506（ScopedValue）及 2026 年 Java 面试趋势资料。*
