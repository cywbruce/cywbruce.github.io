---
title: "Java CAS 与原子类 面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "Unsafe/cmpxchg、ABA 与自旋、原子类、LongAdder 分段思想与 VarHandle。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **CAS 原理、原子类体系与无锁编程** 的真实深度"问出来"。
> 核心原则：**CAS 的每一道题，最终都会落到"volatile 可见性 + cmpxchg 原子指令 → ABA/自旋/单变量三大问题 → 原子类如何逐个解决 → LongAdder 分段优化"这条主线**。只会说"CAS 是比较并交换"却讲不清 ABA 和 LongAdder 的人，基本停留在八股记忆层。
> 配套：本题库与 ThreadLocal / synchronized / AQS / volatile+JMM 等共同构成"Java 并发面试定级体系"。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题](#part-1)
- [Part 2：底层原理题（Unsafe 与 CPU 指令）](#part-2)
- [Part 3：核心区分度题（ABA 与 LongAdder）](#part-3)
- [Part 4：实战与陷阱题](#part-4)
- [Part 5：2026 新趋势：VarHandle 与无锁编程演进](#part-5)
- [Part 6：能否用 CAS/原子类定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 CAS 和 Java 原子类的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> CAS（Compare And Swap，比较并交换）是一种**无锁原子操作**：它接收三个参数——内存位置 V、预期原值 A、新值 B，当且仅当 V 的值等于 A 时，才把 V 改为 B，否则什么都不做（或重试）。整个过程是 **CPU 原子指令**（x86 上是 cmpxchg），不会被打断。
>
> Java 中 CAS 的底层通过 **Unsafe 类**的 `compareAndSwapInt/Object/Long` 等 native 方法实现，最终落到 CPU 原子指令。J.U.C 包里大量类（AQS、原子类、ConcurrentHashMap）都基于 CAS。
>
> CAS 解决了**原子性问题**，但配合**volatile 保证可见性**（如 AtomicInteger 的 value 用 volatile 修饰），两者缺一不可。
>
> CAS 有三大经典问题：① **ABA 问题**（值从 A→B→A，CAS 误以为没变），用版本号/AtomicStampedReference 解决；② **自旋开销**（失败后循环重试，长时间不成功耗 CPU）；③ **只能保证一个变量的原子性**（多个变量用 AtomicReference 封装对象或加锁）。
>
> 原子类体系包括：基本类型（AtomicInteger 等）、数组、引用、字段更新器、累加器（**LongAdder 高并发下性能优于 AtomicInteger**，用分段思想）。

**评分要点：** CAS 三参数 / CPU 原子指令+Unsafe / volatile 配合 / 三大问题 / 原子类体系与 LongAdder，对应入门到高级。能主动提到 ABA 和 LongAdder 的，直接往 Part 2 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题

### Q1. 什么是 CAS？它的三个参数是什么？

**标准答案：**
- CAS（Compare And Swap / Compare And Set），比较并交换，是一种**乐观锁**机制。
- 三个操作数：
  - **V**：要更新的变量的内存地址。
  - **A**：预期的原值。
  - **B**：要写入的新值。
- 语义：如果内存位置 V 的值等于预期值 A，处理器用 B 更新 V 的值，否则不更新（失败）。整个"比较+交换"是一个**原子操作**。
- 与悲观锁（synchronized）对比：synchronized 是"先加锁再操作"（悲观，认为一定会冲突）；CAS 是"先操作，冲突了就重试"（乐观，认为大概率不冲突）。

**追问：CAS 是乐观锁还是悲观锁？它属于无锁编程吗？**
> **答案：** CAS 是**乐观锁**的典型实现，常被称为"无锁（lock-free）编程"的基础。注意"无锁"不等于"无冲突"——冲突依然发生，只是不通过阻塞线程解决，而是让失败线程自旋重试，避免了线程挂起/唤醒的上下文切换开销。

---

### Q2. Java 中怎么用 CAS？原子类有哪些分类？

**标准答案：**
Java 中 CAS 通过 `sun.misc.Unsafe` 类暴露的 native 方法使用（如 `compareAndSwapInt(Object o, long offset, int expected, int x)`），普通开发者一般通过 J.U.C 的原子类间接使用。

原子类 (`java.util.concurrent.atomic`) 分 6 类：
1. **基本类型**：`AtomicInteger`、`AtomicLong`、`AtomicBoolean`。
2. **数组类型**：`AtomicIntegerArray`、`AtomicLongArray`、`AtomicReferenceArray`。
3. **引用类型**：`AtomicReference`、`AtomicStampedReference`（带版本号解决 ABA）、`AtomicMarkableReference`（带 boolean 标记）。
4. **对象属性修改**：`AtomicIntegerFieldUpdater`、`AtomicLongFieldUpdater`、`AtomicReferenceFieldUpdater`（基于反射，用于修改 volatile 字段）。
5. **累加器/计算器**（JDK 8 新增，高并发更优）：`LongAdder`、`DoubleAdder`、`LongAccumulator`、`DoubleAccumulator`。
6. **JDK 9+ 新增**：`AtomicReference` 的 updateAndGet 等方法增强。

**追问 1：AtomicInteger 的 getAndIncrement() 原理是什么？**
> **答案：** 内部是一个 **自旋 CAS 循环**：
> ```java
> public final int getAndIncrement() {
>     return unsafe.getAndAddInt(this, valueOffset, 1);
> }
> // Unsafe 内部大致逻辑：
> do {
>     current = getIntVolatile(o, offset);      // 读到volatile的当前值
> } while (!compareAndSwapInt(o, offset, current, current + 1));  // CAS 失败就重试
> return current;
> ```
> 循环读取当前值，用 CAS 尝试更新为 current+1，失败（说明被其他线程改了）就重试，直到成功。

**追问 2：为什么 AtomicInteger 的 value 要声明为 volatile？**
> **答案：** CAS 只保证"比较并交换"这个动作的**原子性**，但一个线程 CAS 成功后，其他线程要能**立即看到**新值，这依赖 volatile 的**可见性**保证。所以 value 用 volatile 修饰——**volatile 管可见，CAS 管原子**，缺一不可。（呼应 volatile/JMM 题库）

---

<a id="part-2"></a>

## Part 2：底层原理题（Unsafe 与 CPU 指令）

> 这是"会用原子类"和"懂底层"的分水岭，L2→L3 的关键。

### Q3. CAS 的底层实现是怎样的？从 Java 到 CPU 指令说一遍。

**标准答案：**
调用链：`AtomicInteger.getAndIncrement()` → `Unsafe.compareAndSwapInt()` (native 方法) → JVM 本地实现 → **CPU 原子指令**。

- 在 **x86 架构**上，CAS 最终编译成 **`cmpxchg`（Compare and Exchange）** 指令。
- 在多核处理器上，为了保证原子性，CPU 会在执行 cmpxchg 时通过**总线锁（早期）**或**缓存锁（现代，基于 MESI 缓存一致性协议）**保证该操作的原子性：_lock 前缀指令会锁住缓存行，确保同一时刻只有一个 CPU 核心能修改该内存地址。
- 所以 CAS 的原子性**由硬件保证**，不是 Java 层面能做到的。

**追问 1：Unsafe 类是什么？为什么叫"不安全"？**
> **答案：** `sun.misc.Unsafe` 是 JDK 内部的一个类，提供了一系列**绕过 JVM 安全检查**的底层操作：直接读写内存、CAS、操作对象字段/数组、内存分配、线程挂起（park/unpark）、CAS 等。它叫"Unsafe"是因为这些操作**绕过了 Java 的安全机制**（如数组越界检查、访问权限检查），误用可能导致 JVM 崩溃、内存泄漏等严重问题。因此普通开发者不推荐直接使用——JDK 9 后逐步用 VarHandle、MethodHandles 等官方 API 替代。

**追问 2：CAS 在 Java 层面的方法 (compareAndSwapInt) 是 native，那它是怎么拿到字段的内存位置的？**
> **答案：** 通过 `objectFieldOffset(Field)` 获取字段相对于对象起始地址的**内存偏移量（offset）**。CAS 方法接收"对象引用 + 偏移量"就能定位到字段的实际内存地址。Unsafe 的 `objectFieldOffset` 返回的就是这个 offset，AtomicInteger 在静态初始化块里通过 `unsafe.objectFieldOffset(AtomicInteger.class.getDeclaredField("value"))` 得到 `valueOffset`。

---

### Q4. CAS 为什么会出现"自旋"？自旋有什么问题？

**标准答案：**
- **自旋**：CAS 失败后（预期值与当前值不等，说明被其他线程改了），通常不阻塞线程，而是**在循环里重新读取当前值、再次尝试 CAS**，这个过程叫自旋。
- **问题**：
  1. **CPU 开销**：如果竞争一直很激烈，线程反复 CAS 失败、反复自旋，会长时间占用 CPU 却不推进工作（空转）。
  2. **公平性问题**：自旋没有排队机制，某些线程可能一直"抢"不到，导致饥饿。
- 缓解：限制自旋次数、自适应策略，或高并发下改用分段方案（LongAdder）。

**追问：CAS 自旋和 synchronized 的轻量级锁自旋是一回事吗？**
> **答案：** 机制类似（都是失败后循环重试避免线程挂起），但层次不同：CAS 自旋是**应用层的原子操作重试**（如 AtomicInteger 的 do-while）；synchronized 轻量级锁自旋是 **JVM 层面的锁优化**（线程在获取 Monitor 失败时自旋等待）。两者目的相同——减少线程切换开销，但实现层面和适用场景不同。

---

<a id="part-3"></a>

## Part 3：核心区分度题（ABA 与 LongAdder）

> **这一部分是全题的题眼**——能否讲清 ABA 和 LongAdder，直接决定 L2 还是 L3/L4。定级主要看这里。

### Q5. 什么是 ABA 问题？如何解决？

**标准答案：** （必问题）

**ABA 问题**：一个值原来是 A，被线程改成 B，又被另一个线程改回 A。此时用 CAS 检查，发现值还是 A，就认为"没被改过"，从而成功更新——但实际上中间发生过变化，可能引发错误。

**经典场景**（栈顶ABA）：
- 线程 1 读到栈顶是 A，准备 CAS 把栈顶换成 B。
- 期间线程 2 弹出 A、压入 C、再压入 A（A 被复用），栈顶又变回 A。
- 线程 1 的 CAS 成功（栈顶确实是 A），但实际上 A 的状态已经和之前不同——如果 A 的内部状态变了，就会出错。

**解决方案：加版本号/时间戳**。
- 不只比较值本身，还比较**版本号**（每次修改版本号+1）。A→B→A 后，值虽是 A，但版本号从 1 变成 3，CAS 检测版本号不一致就会失败。
- Java 提供 **`AtomicStampedReference`**：把"值 + stamp（版本号/时间戳）"作为一个整体，用 `compareAndSet(expectedRef, newRef, expectedStamp, newStamp)` 同时校验引用和版本号。
- 若只关心"是否被改过"而不关心改了几次，可用 **`AtomicMarkableReference`**（boolean 标记位）。

**追问 1：AtomicStampedReference 的 ABA 解决有什么局限？**
> **答案：** 它的 stamp 是一个 int，需要手动管理递增；且它比较的是**引用对象的身份**（==），不是 equals——如果每次都是 new 出来的新对象，即使内容相同也会被当作不同对象。另外，多数业务场景其实**不关心 ABA**（比如纯数值累加，A→B→A 对最终结果无影响），滥用反而增加复杂度。

**追问 2：除了版本号，还有什么办法规避 ABA？**
> **答案：** ① 不复用对象，每次修改都创建新对象（避免同一对象被 ABA 复用）；② 用不可变对象 + AtomicReference；③ 在 Actual 场景下，如果中间状态变化对业务无影响（如计数器），可以容忍 ABA 不处理。关键是先判断"ABA 是否真的会影响业务正确性"。

---

### Q6. LongAdder 为什么比 AtomicInteger 在高并发下性能更好？原理是什么？

**标准答案：** （L4 区分度题）

**问题背景**：AtomicInteger 高并发下，所有线程竞争**同一个 volatile 变量**的 CAS，失败率高、自旋严重，大量 CPU 浪费在无谓重试上。

**LongAdder 的分段思想**：
- 它不维护一个单一值，而是维护一个 **base + 一个 Cell 数组**（每个 Cell 内部有一个 volatile long value）。
- **低竞争时**：直接对 base 做 CAS 累加（类似 AtomicLong）。
- **高竞争时**：不同线程通过**线程探针（probe，类似 ThreadLocalRandom 的机制）**被分散到**不同的 Cell** 上各自 CAS，冲突大幅减少。
- **读取时**（sum()）：把 base 和所有 Cell 的 value **求和**得到总和。

```java
// 概念示意
class LongAdder {
    volatile long base;              // 无竞争时直接用
    volatile Cell[] cells;           // 竞争时分段
    static class Cell { volatile long value; }
    // add(): 优先CAS base，失败则按线程probe定位到某个Cell做CAS
    // sum(): base + cells[0].value + cells[1].value + ...
}
```

- **本质**：用**空间换时间**——把一个热点变量的竞争，分散到多个变量上，降低冲突概率。这是"分段锁/分桶"思想在无锁计数上的应用（和 ConcurrentHashMap 的分段思想类似）。

**追问 1：LongAdder 有什么缺点？**
> **答案：** ① **sum() 结果不是强一致的原子快照**——求和过程中其他线程可能还在修改 Cell，所以 sum() 返回的是一个"近似准确"的值（对累加计数场景够用，但不能用于需要精确瞬时值的场景）；② 占用更多内存（Cell 数组）；③ 不提供 `compareAndSet` 等通用原子操作，只适合累加场景。所以它是**专用工具**，不能替代 AtomicLong。

**追问 2：什么场景用 AtomicLong，什么场景用 LongAdder？**
> **答案：**
> - **AtomicLong**：需要精确的当前值、需要 CAS 这类原子操作、并发不激烈的场景。如生成全局唯一序列号、需要 getAndIncrement 返回精确递增值。
> - **LongAdder**：高并发计数、统计场景，不要求每次读到精确瞬时值，如 QPS 统计、请求数累加。在高并发下吞吐量显著优于 AtomicLong。

**追问 3：LongAdder 的 cells 扩容时会怎样？**
> **答案：** 当 Cell 数组长度小于 CPU 核数且 CAS 冲突时，会**扩容 cells 数组**（翻倍），并把线程重新分散。扩容时通过 cellsBusy 标志（CAS 加锁）保证只有一个线程能扩容。这体现了"竞争越激烈，分段越细"的自适应思想。

---

### Q7. CAS 只能保证一个变量的原子操作，多个变量怎么办？

**标准答案：**
CAS 的原子性只针对**一个内存地址**。多个变量需要原子更新时：
1. **封装成对象，用 AtomicReference**：把多个变量放进一个不可变对象，对这个对象引用做 CAS——"比较并替换整个对象"，间接实现多变量原子更新。
2. **加锁**（synchronized / Lock）：最简单直接。
3. 用 `AtomicReferenceFieldUpdater` + 不可变对象模式。

**示例**（用 AtomicReference 实现多字段原子更新）：
```java
class Pair {
    final int a, b;
    Pair(int a, int b) { this.a = a; this.b = b; }
}
AtomicReference<Pair> ref = new AtomicReference<>(new Pair(0, 0));
// 原子地同时更新 a 和 b：构造新 Pair 对象，CAS 替换引用
ref.compareAndSet(new Pair(0,0), new Pair(1,2));
```

**追问：为什么说封装成对象 + AtomicReference 就可以？CAS 比较的不是引用地址吗？**
> **答案：** 对，AtomicReference 的 CAS 比较的是**引用是否指向同一个对象**（identity，`==`）。因为我们每次更新都 new 一个新对象，旧引用和新引用是不同的对象，所以能正确判断"是否被改过"。关键在于配合**不可变对象**——对象内容一旦创建就不变，替换引用就等价于原子替换了整组状态。如果用可变对象且原地改字段，CAS 就检测不到变化了。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题

### Q8. 原子类在生产中有哪些坑？ABA、自旋、伪共享怎么防？

**标准答案：**
1. **ABA 问题**：用 AtomicStampedReference / AtomicMarkableReference（见 Q5）。
2. **自旋开销**：高并发用 LongAdder 代替 AtomicInteger/Long；避免在临界区做耗时操作。
3. **伪共享**：AtomicLong 等对象高并发下可能与其他热点变量落在同一缓存行 → 用 `@Contended` 注解或填充（呼应 volatile 题库 Q8）。
4. **复合操作非原子**：`if (atomic.get() == x) atomic.set(y)` 这种"检查再设置"不是原子的，要用 `compareAndSet` 或 `updateAndGet`。
5. **数值溢出**：AtomicInteger 累加到 Integer.MAX_VALUE 会溢出，超大数据量用 AtomicLong。

**追问：`updateAndGet` / `accumulateAndGet` 为什么能安全做复合操作？**
> **答案：** 它们内部就是 CAS 自旋循环：把"更新函数"作为参数传入，循环读取当前值 → 应用函数计算新值 → CAS 替换，失败就重试。整个函数式更新在 CAS 循环里完成，因此是原子的。比如 `atomic.updateAndGet(x -> x * 2)`，乘 2 这个操作在 CAS 保护下原子执行。

---

### Q9. 用 CAS 实现一个线程安全的栈/队列，思路是什么？

**标准答案：** （考察无锁数据结构理解）
以 Treiber 栈为例：
- 用 `AtomicReference<Node> top` 保存栈顶。
- **push**：构造新节点 next 指向当前 top，然后 CAS 把 top 换成新节点；失败重试。
- **pop**：读当前 top，计算下一个节点 next，然后 CAS 把 top 换成 next；失败重试。
- 关键点：CAS 保证"读 top + 改 top"的原子性。

**追问：无锁栈的 pop 会遇到 ABA 问题吗？**
> **答案：** 会！这正是 ABA 的经典场景——线程读到 top=A，另一个线程 pop 了 A、又 push 回 A（A 被复用），第一个线程的 CAS 会成功但栈状态可能已经错乱。解决方式：用带版本号的 AtomicStampedReference 保存 (top, version)，pop/push 时版本号+1。这也说明无锁数据结构的正确实现远比加锁困难。

---

### Q10. synchronized、CAS、LongAdder 在高并发计数场景下如何选型？

**标准答案：**
| 方案 | 适用场景 | 特点 |
|------|---------|------|
| synchronized | 临界区复杂、多变量、低到中并发 | 简单可靠，重量级时有线程切换开销 |
| AtomicLong | 需要精确值/CAS、中低并发 | 无锁，高并发自旋严重 |
| LongAdder | 高并发纯累加计数 | 分段，吞吐最高，sum 非强一致 |

选型原则：**先保证正确性，再看性能**。低并发下三者差异不大，synchronized 最简单；高并发计数首选 LongAdder；需要 CAS 语义或精确瞬时值用 AtomicLong。

**追问：为什么说"过早优化是万恶之源"，在并发选型上怎么体现？**
> **答案：** 很多开发者一上来就用 CAS/Atomic 追求"无锁高性能"，但 CAS 代码更难写对（ABA、复合操作、伪共享），维护成本高。实际大部分业务并发度远没到 Atomic 成为瓶颈的程度。正确做法：先用 synchronized 保证正确性，通过压测发现锁竞争确实是瓶颈后，再有针对性地换 CAS/LongAdder。这就是"先正确、后优化"。

---

<a id="part-5"></a>

## Part 5：2026 新趋势：VarHandle 与无锁编程演进

> 加分题，考察技术视野。

### Q11. JDK 9+ 的 VarHandle 对 CAS/原子类有什么影响？

**标准答案：**
- **VarHandle**（JEP 193，JDK 9）提供了**官方、类型安全**的细粒度变量访问 API，支持 volatile、原子（compareAndSet/getAndAdd）、opaque、acquire/release 等多种内存序。
- 它逐步**替代 sun.misc.Unsafe**：JDK 18 起 Unsafe 的 compareAndSwap 等方法被标记废弃，JDK 21+ 内部（Atomic 系列、ConcurrentHashMap 等）大量使用 VarHandle 重写。
- 对开发者的影响：① 框架/中间件开发者有了安全、受支持的底层 CAS 手段；② 普通业务开发者仍推荐直接用 Atomic 类（其内部已用 VarHandle 优化），无需碰 VarHandle。

**追问：VarHandle 相比 Unsafe 的优势？**
> **答案：** ① **类型安全**：VarHandle 在编译期校验类型，Unsafe 是弱类型、易出错；② **受官方支持**：属于标准 API（java.lang.invoke），不像 Unsafe 是内部 API 可能被移除；③ **可被 JIT 优化**：JVM 能识别 VarHandle 调用并做内联优化；④ **细粒度内存序**：能按需选择更弱的屏障，减少开销。

---

### Q12. 虚拟线程时代，原子类和 CAS 还重要吗？

**标准答案：**
- 依然重要，但**使用模式有变化**：虚拟线程数量巨大（百万级），如果对同一个 Atomic 变量竞争激烈，CAS 自旋问题会被放大——大量虚拟线程争抢一个变量。
- 虚拟线程不池化，ThreadLocal 缓存模式失效（呼应 ThreadLocal 题库），但**无状态、不可变、CAS 计数**这类模式依然适用。
- 高并发计数场景下，LongAdder 的分段思想依然有效，甚至在虚拟线程下更重要。
- 关键认知：虚拟线程解决的是 **IO 阻塞的并发扩展**，不改变共享状态同步的基本规律——CAS/原子类的三大问题依然存在。

**追问：虚拟线程下还需要担心 CAS 的 ABA 吗？**
> **答案：** 需要。ABA 是 CAS 机制本身的问题，与线程类型无关。虚拟线程只是调度方式不同，共享状态的可见性和原子性依然遵循 JMM。所以该用 AtomicStampedReference 的场景照样要用。

---

<a id="part-6"></a>

## Part 6：能否用 CAS/原子类定级？如何定级？

### 结论先行

**可以，CAS/原子类是并发模块里很好的"深度 + 视野"探针**——分层清晰：会背定义 → 懂 volatile 配合 → 懂 Unsafe/CPU 指令 → 懂 ABA/LongAdder → 懂无锁数据结构 → 懂 VarHandle 演进。但要注意区分"背过三大问题"和"真正理解 traded-off"，需用实战题验证。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 知道 CAS 是比较交换、会用 AtomicInteger；说不清三大问题 |
| **中级（L2）** | 2–5 年 | Part 2 | 知道底层 Unsafe/cpu 指令、知道 volatile 配合；说不清 ABA/LongAdder |
| **中高级（L3）** | 5–8 年 | Part 3 | 能讲清 ABA 与版本号、LongAdder 分段原理、多变量方案 |
| **高级（L4）** | 8 年+ | Part 4 | 懂复合操作陷阱、能设计无锁数据结构、有性能调优实战 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 跟进 VarHandle/内存序、理解虚拟线程下的同步规律 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能主动提到 ABA/LongAdder → 至少 L2，直接跳 Part 3；只背"比较交换" → 从 Part 2 问起。

**第二步：沿追问链下探，重点问"为什么"。**
- 为什么 AtomicInteger 既用 volatile 又用 CAS？（可见+原子缺一不可）
- ABA 不处理会怎样？版本号为什么能解决？（值变回但状态不同；版本单调递增可识别）
- LongAdder 为什么快？sum 为什么不强一致？（分段分散竞争；读取时其他线程还在改）

**第三步：三类信号防背题。**
1. **真实性**：能否讲出实际用过 AtomicStampedReference/LongAdder 的场景、遇到过 CAS 自旋性能问题。
2. **抽象能力**：能否把 AtomicInteger、LongAdder、ConcurrentHashMap、AQS 统一到"**CAS + volatile 的无锁基石**"这一底层模型。
3. **权衡能力**：能否说清"什么时候不该用 CAS"（复杂临界区、高竞争自旋、过早优化）。

**第四步：按最深层级定级，结合实战验证。**

---

### 面试官避坑提醒

- **别停在"CAS 三大问题"背诵**——真正区分度在"版本号为什么能解决 ABA""LongAdder sum 为何不强一致"这类追问。
- **警惕过早优化的答案**：一味推崇 CAS 而无视复杂性和正确性的人，通常缺乏生产经验。
- **结合岗位**：业务开发问到 Part 3 足够；中间件/高并发团队要问 Part 4 无锁数据结构、Part 5 VarHandle。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**

1. CAS 是什么？三参数？→（比较交换；V 内存位置/A 预期值/B 新值）
2. 乐观锁还是悲观锁？→（乐观锁，无锁编程基础）
3. 底层实现？→（Unsafe native → CPU cmpxchg + 缓存锁，硬件保证原子）
4. 为什么 value 用 volatile + CAS？→（volatile 管可见，CAS 管原子）
5. 什么是自旋？问题？→（失败重试；CPU 空转、公平性）
6. ABA 问题？解决？→（A→B→A 误判；AtomicStampedReference 版本号）
7. LongAdder 为什么快？→（base + Cell[] 分段，线程分散 CAS，空间换时间）
8. LongAdder 缺点？→（sum 非强一致、占内存、只适合累加）
9. 多变量原子？→（封装对象 + AtomicReference，或加锁）
10. 复合操作坑？→（用 compareAndSet/updateAndGet，别用 get+set）
11. VarHandle？→（JDK9 官方替代 Unsafe，类型安全、细粒度内存序）
12. 虚拟线程下？→（依然遵循 JMM，三大问题仍在，LongAdder 更重要）

**定级速判：**
- 答到第 2–4 问 → L1/L2
- 答到第 5–6 问 → L2/L3
- 答到第 7–9 问 → L3/L4
- 答到第 10–11 问 + 有实战 → L4
- 答到第 12 问 + 体系化 → L5

**一票否决信号：** 认为 CAS 是"无冲突"的、说不出 ABA 是什么、认为 LongAdder 能替代 AtomicLong 做序列号 → 无论年限，最高 L2。

---

*资料整理于 2026-11-19，参考 JDK 源码（AtomicInteger/LongAdder/Unsafe）、JEP 193（VarHandle）、《Java 并发编程实战》及 2026 年 Java 面试趋势资料。*
