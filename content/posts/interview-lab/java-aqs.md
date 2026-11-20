---
title: "Java AQS 面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "AQS 的 volatile state、CLH 队列与模板方法；acquire/release 完整流程、公平性与现场实现 Mutex。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **AQS（AbstractQueuedSynchronizer）底层与 J.U.C 体系** 的真实深度"问出来"。
> 核心原则：**AQS 的每一道题，最终都会落到"一个 volatile int state + 一个 CLH 双向队列 + 模板方法钩子"这条主线**。只会用 ReentrantLock 却讲不清它和 AQS 关系的人，基本停留在 API 记忆层。
> 配套：本题库与 ThreadLocal / synchronized / ThreadPoolExecutor 三套共同构成"Java 并发面试定级体系"。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题](#part-1)
- [Part 2：底层原理题（state 与 CLH 队列）](#part-2)
- [Part 3：源码流程题（核心区分度）](#part-3)
- [Part 4：J.U.C 组件与自定义同步器题](#part-4)
- [Part 5：2026 新趋势：AQS 与虚拟线程](#part-5)
- [Part 6：能否用 AQS 定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 AQS 的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> AQS 全称 AbstractQueuedSynchronizer，是 J.U.C 包里**大多数同步器的底层框架**——ReentrantLock、CountDownLatch、Semaphore、ReentrantReadWriteLock 等都基于它实现。
>
> 它的核心思想是用一个 **volatile int 类型的 state** 表示同步状态（比如锁的重入次数、剩余许可数），再配合一个 **FIFO 双向队列（CLH 队列的变体）** 存放竞争失败的线程。
>
> AQS 采用**模板方法模式**：它把"如何判断能否获取/释放资源"（`tryAcquire` / `tryRelease` 等）留给子类实现，而把"线程入队、阻塞、唤醒、CAS 修改 state"这些通用骨架封装在自己内部。
>
> 竞争失败的线程会被封装成 Node 节点加入队列，并通过 **LockSupport.park/unpark** 挂起和唤醒，实现高效阻塞。
>
> 它支持**独占（Exclusive）** 和**共享（Shared）** 两种模式：ReentrantLock 是独占，CountDownLatch/Semaphore 是共享。

**评分要点：** J.U.C 基石 / volatile state / CLH 队列 / 模板方法 / park+unpark / 独占共享 这几个点，对应入门到高级。能说出模板方法和 state 语义的，直接往 Part 2 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题

### Q1. AQS 是什么？为什么 J.U.C 里这么多类都基于它？

**标准答案：**
- AQS 是一个**用来构建锁和同步器的抽象框架**，位于 `java.util.concurrent.locks` 包。
- 它把同步器实现中**通用且复杂**的部分抽出来：状态管理、线程排队、阻塞/唤醒、超时/中断处理。子类只需关心"什么条件下能获取/释放资源"这一**差异化逻辑**。
- 好处：大幅降低实现同步器的门槛和出错率——你不用自己处理线程安全和队列维护，只写几个钩子方法即可。这是典型的"**框架抽象复用**"思想。

**追问 1：AQS 是抽象类还是接口？它是不是用了模板方法模式？**
> **答案：** 是**抽象类**（`public abstract class AbstractQueuedSynchronizer`），确实用了**模板方法模式**。它定义了 `acquire()` / `release()` 等模板方法（final 或固定流程），内部调用 `tryAcquire()` / `tryRelease()` 等由子类重写的钩子方法。子类通常作为同步器类的**内部静态类**存在（如 ReentrantLock.Sync）。

**追问 2：AQS 只支持锁吗？**
> **答案：** 不止。它支持所有需要"状态+排队"的同步原语：互斥锁（ReentrantLock）、读写锁（ReentrantReadWriteLock）、信号量（Semaphore）、倒计时门闩（CountDownLatch）、栅栏的底层（部分）、FutureTask（它内部有一个类似 AQS 的 Sync）。凡是"竞争一个公共资源，失败的要排队等待"的场景都适用。

---

### Q2. AQS 的 state 是什么？为什么用 volatile？它如何被修改？

**标准答案：**
- `state` 是 AQS 内部一个 `private volatile int state` 字段，表示**同步状态**。
- 它的**语义由子类定义**：
  - ReentrantLock：state = 重入次数（0 表示未锁，1 表示锁一次，N 表示重入 N 次）。
  - Semaphore：state = 剩余许可数。
  - CountDownLatch：state = 计数器的值。
  - ReentrantReadWriteLock：state 高 16 位读锁、低 16 位写锁（**按位拆分**）。
- 用 volatile 是为了保证 state 在多线程间的**可见性**。
- 修改方式：通过 `getState()` / `setState()` / `compareAndSetState()`（CAS）。**CAS 保证修改的原子性**——这是 AQS 无锁化竞争的基础。

**追问：为什么 state 用 int 而不是更丰富的类型？ReentrantReadWriteLock 怎么表示两种锁？**
> **答案：** int 是 CAS 操作原生支持的类型，简单高效。读写锁把 32 位 int **拆成高低 16 位**分别表示读锁和写锁计数，通过位运算读写——这是非常经典的"状态压缩"技巧，能答出来是加分点。

---

<a id="part-2"></a>

## Part 2：底层原理题（state 与 CLH 队列）

> 这是"会用同步器"和"懂框架内核"的分水岭，L2→L3 的关键。

### Q3. AQS 的队列结构是怎样的？为什么是双向链表？

**标准答案：**
- AQS 内部维护一个**双向 FIFO 队列**（CLH 锁队列的变体），节点类型是内部类 `Node`。
- 每个等待线程被封装成一个 Node，包含：
  - `waitStatus`：节点状态（CANCELLED=1、SIGNAL=-1、CONDITION=-2、PROPAGATE=-3、0）。
  - `prev` / `next`：前驱/后继指针（双向）。
  - `thread`：关联的线程。
  - `nextWaiter`：条件队列用的单向指针。
- 队列有 `head` 和 `tail` 两个指针。**head 节点通常是虚节点（dummy），不代表实际等待线程**，它指向/代表当前持有锁的节点。
- **双向的原因**：
  1. **方便前驱节点唤醒后继**：释放锁时需要找到后继节点唤醒，双向链表通过 `node.next` 直接定位。
  2. **方便取消等待时移除节点**：线程被中断/取消时要把自己从队列摘除，双向链表能 O(1) 找到前驱和 successor，正确维护队列。

**追问 1：为什么说是"CLH 队列的变体"？和原始 CLH 锁有什么区别？**
> **答案：** 原始 CLH 锁是基于**单向链表 + 自旋前驱节点状态**实现的高公平性自旋锁。AQS 借鉴了它的"排队"思想，但做了关键改造：① 改成**双向链表**（便于唤醒后继）；② 用 **park/unpark 阻塞**代替纯自旋（更省 CPU）；③ 每个节点关联实际线程。所以是"变体"而非照搬。

**追问 2：Node 的 waitStatus 中 SIGNAL(-1) 是什么含义？**
> **答案：** SIGNAL 表示"**后继节点正在等待被唤醒**"。当一个节点释放锁时，如果发现自己的 waitStatus 是 SIGNAL，就知道要唤醒它的后继节点。这是 AQS 避免"遗漏唤醒"的关键标记——前驱节点负责唤醒后继，SIGNAL 就是这个"责任"的标记。

---

### Q4. AQS 为什么用 LockSupport.park/unpark，而不是 wait/notify 或自旋？

**标准答案：**
- **对比 wait/notify**：`wait/notify` 依赖对象 Monitor，必须在 synchronized 块内调用，且 notify 唤醒哪个线程不可控、可能丢失唤醒。而 `park/unpark` 是更底层、更灵活的线程阻塞原语：
  - 不需要持有锁就能调用。
  - **unpark 可以先于 park 调用**（"许可"机制）：先 unpark 的线程，之后 park 会立即返回，不会丢失唤醒——这解决了 wait/notify 的"唤醒丢失"痛点。
  - 可以精确唤醒**指定线程**（`unpark(thread)`），而不是随机或全部唤醒。
- **对比纯自旋**：park 会让线程真正阻塞挂起，不占 CPU；自旋在长时间等待时空转耗 CPU。
- 底层：`LockSupport` 基于 **Unsafe 的 park/unpark**，最终由操作系统原语实现。

**追问：park/unpark 的"许可（permit）"机制是怎样的？**
> **答案：** 每个线程有一个许可（0 或 1）。`park()` 在许可为 0 时阻塞线程，许可为 1 时立即返回并把许可清零；`unpark(thread)` 把该线程的许可置为 1（若已为 1 则不叠加），并唤醒正在 park 的线程。许可**不会累积**（最多 1 个）。这个机制保证了"先 unpark 后 park"也不会死锁——这是它优于 wait/notify 的核心。

---

<a id="part-3"></a>

## Part 3：源码流程题（核心区分度）

> **这一部分是全题的题眼**——能否讲清 acquire/release 流程，直接决定 L2 还是 L3/L4。定级主要看这里。

### Q5. 讲一下 AQS 独占模式下 acquire() 的完整流程。

**标准答案：** （能完整讲下来基本是 L3+）

`acquire(int arg)` 的流程：

1. **尝试获取**：先调用 `tryAcquire(arg)`（子类实现）尝试直接获取资源。
2. **成功则返回**：获取成功，线程继续执行临界区。
3. **失败则入队**：调用 `addWaiter(Node.EXCLUSIVE)` 把当前线程封装成独占模式 Node，用 CAS 加入队尾。
4. **排队等待**：调用 `acquireQueued(node, arg)`，在一个循环中：
   - 检查**前驱节点是否是 head**（即自己是否是队首候选）——如果是，再次尝试 `tryAcquire`。
   - 获取成功则把自己设为 head，返回。
   - 获取失败/不是队首，则判断前驱 waitStatus 是否 SIGNAL，是则**park() 阻塞**线程。
5. **唤醒后重试**：线程被 unpark 唤醒后，回到循环继续尝试获取。
6. **响应中断**：acquireQueued 返回是否被中断过，若被中断则 `selfInterrupt()` 补上中断（AQS 的 acquire 默认**不响应中断**，只记录标记）。

伪代码骨架：
```java
public final void acquire(int arg) {
    if (!tryAcquire(arg) &&
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        selfInterrupt();
}
```

**追问 1：为什么线程释放锁后要唤醒后继，而不是所有等待线程？**
> **答案：** 因为队列是 FIFO，队首线程是下一个最该获得锁的。只唤醒后继（队首）避免了"惊群效应"（所有线程被唤醒又竞争，浪费上下文切换），也保证了公平性的基本秩序。

**追问 2： acquire 获取失败后，为什么要"再试一次"才 park？**
> **答案：** 避免"刚要 park，锁就被释放了"导致永久错过唤醒的竞态。在 park 之前再确认一次前驱状态并尝试获取，能减少不必要的阻塞，是与 unpark 许可机制配合的严谨设计。

---

### Q6. release() 的流程是怎样的？和 acquire 如何配合？

**标准答案：**

`release(int arg)` 流程：
1. 调用子类 `tryRelease(arg)` 释放资源（如 ReentrantLock 中 state 减 1）。
2. 若释放成功（state 归零/条件满足），检查 head 节点 waitStatus 是否 != 0（通常是 SIGNAL）。
3. 若是，调用 `unparkSuccessor(head)`，找到**有效的后继节点**（跳过已 CANCELLED 的节点），用 `LockSupport.unpark(thread)` 唤醒它。
4. 被唤醒的线程在 acquireQueued 的循环中重新 tryAcquire，成功后上位。

配合逻辑：**释放的线程负责唤醒队首线程**，交接"锁的所有权"，形成链式唤醒。

**追问 1：如果后继节点被取消了（CANCELLED），怎么办？**
> **答案：** `unparkSuccessor` 会从队尾向前遍历，跳过 waitStatus 为 CANCELLED 的节点，找到最近的有效节点唤醒。从后往前找是因为 next 指针在并发下可能不可靠，而 prev 指针相对稳定。

**追问 2：独占模式和共享模式的释放有什么不同？**
> **答案：** 共享模式（`releaseShared`）唤醒后继后，如果后继也是共享节点，会**继续向后传播唤醒**（PROPAGATE 状态配合），让多个共享线程同时获取资源——因为共享锁允许多个线程同时持有。典型如 CountDownLatch 归零后唤醒所有等待线程。独占模式则只唤醒一个。

---

### Q7. 公平锁和非公平锁在 AQS 里怎么实现？区别是什么？

**标准答案：** （以 ReentrantLock 为例）

- **非公平锁（默认）**：`tryAcquire` 直接先 CAS 抢 state，**不看队列是否有线程在等**。抢不到才入队。吞吐高，但可能"插队"。
- **公平锁**：`tryAcquire` 先检查 `hasQueuedPredecessors()`（队列中是否有前驱在等），**只有没有前驱或自己是队首才尝试获取**，否则入队排队。保证先来后到。

**追问 1：为什么默认是非公平锁？**
> **答案：** 因为公平锁严格排队会带来更多线程切换和上下文开销，**吞吐量明显低于非公平锁**。非公平锁下，刚释放锁的线程再次抢锁成功率很高（缓存局部性好、还没被 park），显著提升性能。代价是可能造成线程"饥饿"——但大多数场景能接受。

**追问 2：非公平锁真的完全不公平吗？**
> **答案：** 不是"完全"不公平——它只是**抢锁时不检查队列**，一旦抢锁失败入了队，仍然按 FIFO 排队。所以是"有限的插队机会"，而非彻底无序。

---

<a id="part-4"></a>

## Part 4：J.U.C 组件与自定义同步器题

### Q8. ReentrantLock、CountDownLatch、Semaphore 分别怎么用 AQS 的 state？

**标准答案：** （考察是否真正理解 state 语义由子类定义）

| 同步器 | state 含义 | 获取/释放逻辑 | 模式 |
|--------|-----------|--------------|------|
| **ReentrantLock** | 重入次数 | tryAcquire：state 0→1 或 +1（需判断持有者是自己）；tryRelease：-1，到 0 释放 | 独占 |
| **CountDownLatch** | 计数 | tryAcquireShared：state==0 才可获取；countDown 调用 tryReleaseShared 使 state-1 | 共享 |
| **Semaphore** | 剩余许可数 | tryAcquireShared：state-许可数>=0 才能获取（CAS）；release 使 state+许可数 | 共享 |
| **ReentrantReadWriteLock** | 高16位读/低16位写 | 读锁用共享模式、写锁用独占模式 | 混合 |

**追问 1：ReentrantLock 如何知道重入的线程是不是自己？**
> **答案：** AQS 内部有一个 `exclusiveOwnerThread` 字段记录当前独占锁的线程。`tryAcquire` 时若 state>0，检查 `getExclusiveOwnerThread() == Thread.currentThread()`，是则 state+1 重入成功；否则获取失败入队。这是可重入的实现关键。

**追问 2：CountDownLatch 是一次性的，CyclicBarrier 可以复用，为什么？**
> **答案：** CountDownLatch 的 state 减到 0 后不会重置，闸门打开后永久开放，所以一次性。CyclicBarrier 内部基于 ReentrantLock + Condition，每一轮屏障突破后会**重置计数**（generation 换代），所以可循环使用。这体现了不同同步器基于 AQS/锁的不同封装策略。

---

### Q9. 让你基于 AQS 实现一个"一次性门闩"或"简单互斥锁"，怎么做？

**标准答案：** （考察是否会综合运用模板方法）

以简单互斥锁为例：
```java
class Mutex extends AbstractQueuedSynchronizer {
    // 尝试独占获取：state 0->1 表示加锁
    @Override
    protected boolean tryAcquire(int acquires) {
        if (compareAndSetState(0, 1)) {
            setExclusiveOwnerThread(Thread.currentThread());
            return true;
        }
        return false;
    }
    // 尝试释放：state 1->0
    @Override
    protected boolean tryRelease(int releases) {
        if (getState() == 0) throw new IllegalMonitorStateException();
        setExclusiveOwnerThread(null);
        setState(0);
        return true;
    }
    @Override protected boolean isHeldExclusively() {
        return getState() == 1;
    }
    public void lock()   { acquire(1); }
    public void unlock() { release(1); }
}
```
关键点：继承 AQS → 重写 tryAcquire/tryRelease → 用 CAS 改 state → 对外暴露 acquire/release 包装。

**追问：为什么子类一般定义成静态内部类，而不是直接暴露 AQS？**
> **答案：** ① 封装性：AQS 的方法（acquire/release 等）很底层，直接暴露给使用者容易误用；② 通过内部类（如 ReentrantLock.Sync）作为"代理"，对外只暴露语义清晰的 lock/unlock API；③ 一个同步器类可以根据需要选择不同的 Sync 实现（如公平/非公平）。

---

<a id="part-5"></a>

## Part 5：2026 新趋势：AQS 与虚拟线程

> 加分题，考察候选人的技术视野。

### Q10. 虚拟线程普及后，AQS 和 ReentrantLock 还有必要吗？

**标准答案：**
- AQS 依然是 Java 并发的基石，ReentrantLock/ConcurrentHashMap 等底层仍广泛依赖它，**短期内不可替代**。
- 但虚拟线程改变了部分使用模式：
  - 虚拟线程不池化、数量巨大，基于 AQS 的**锁竞争和阻塞（park/unpark）语义依然有效**，但要注意**锁竞争和临界区**仍是可扩展性的瓶颈——虚拟线程不能让 CPU 密集或高竞争临界区变快。
  - JDK 24 的 **JEP 491** 解决了 synchronized 的 pinning 问题后，简单互斥场景可以回归更轻量的 synchronized；需要 **tryLock、可中断、公平性、多 Condition** 时才用 ReentrantLock（即 AQS）。
- 并发控制的重心从"线程池限流"转向"**对真实稀缺资源（数据库连接、下游 API）用 Semaphore 显式限流**"——因为百万虚拟线程会瞬间打爆连接池，线程数不再是天然的背压信号。

**追问：虚拟线程下为什么还要用 Semaphore 限流？**
> **答案：** 因为虚拟线程可以创建上百万个，如果每个请求都去拿数据库连接，会瞬间耗尽连接池。必须用一个**代表真实资源容量**的 Semaphore（如 permit=20 对应连接池大小）显式限制并发。注意不能用"模仿小线程池"的随意小值，而要按资源真实容量设定。

---

<a id="part-6"></a>

## Part 6：能否用 AQS 定级？如何定级？

### 结论先行

**可以，AQS 是并发模块里区分度最高的探针之一**——因为它天然分层：会用 API → 知道基于 AQS → 懂 state/队列 → 懂 acquire/release 源码 → 能自定义同步器 → 懂体系演进。但 AQS 偏难，**对初中级候选人可能"问不动"**，要结合岗位使用：招初中级时问到 Part 1/2 即可，强问源码只会考察背诵。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 用过 ReentrantLock/CountDownLatch，知道 AQS 是它们底层；说不清 state/队列 |
| **中级（L2）** | 2–5 年 | Part 2 | 知道 volatile state + CLH 队列 + 模板方法；知道 park/unpark |
| **中高级（L3）** | 5–8 年 | Part 3 | 能讲清 acquire/release 流程、公平非公平、唤醒机制；理解 Node 状态 |
| **高级（L4）** | 8 年+ | Part 4 | 能说清各同步器如何用 state、能自定义同步器、懂 ReentrantLock 可重入实现 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 理解 AQS 在虚拟线程时代的定位与取舍，能把同步器选型放入整体并发设计 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"state + 队列 + 模板方法"→ 至少 L2；只知道"ReentrantLock 底层是 AQS"→ 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追问"为什么"：
- 为什么 state 用 volatile 还要 CAS？（可见性 vs 原子性，两个不同问题）
- 为什么释放只唤醒一个后继？（防惊群 + FIFO）
- 为什么 park/unpark 优于 wait/notify？（许可机制、精确唤醒）

**第三步：三类信号防背题。**
1. **真实性**：能否结合 ConcurrentHashMap、自己封装同步器的实战经历。
2. **抽象能力**：能否把 ReentrantLock/CountDownLatch/Semaphore 统一为"**state 语义不同、骨架相同**"的抽象——这是理解模板方法模式的关键。
3. **权衡能力**：能否讲清公平/非公平的取舍、何时该用 AQS 何时用 synchronized。

**第四步：按最深层级定级，不按正确率。** 结合岗位难度调整追问深度。

---

### 面试官避坑提醒

- **不要对所有人问到源码级**——AQS 源码复杂，很多优秀的中级工程师没背源码但理解思想。区分"理解设计"和"背过源码"，前者更有价值。
- **把"自定义同步器"作为 L4 分水岭**：能现场写出 Mutex 的人，一定是真懂 AQS。
- **结合岗位**：业务开发问到 Part 3 足够；基础架构/中间件团队才需要 Part 4 自定义能力。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**

1. AQS 是什么？哪些类基于它？→（J.U.C 基石；ReentrantLock/CountDownLatch/Semaphore）
2. 核心结构？→（volatile int state + CLH 双向队列 + 模板方法）
3. state 语义谁定义？→（子类；int 按位拆分可表示多种状态）
4. 队列为什么双向？节点状态？→（便于唤醒后继/取消；SIGNAL=-1）
5. 为什么用 park/unpark？→（许可机制不丢唤醒、精确唤醒、无需锁）
6. acquire 流程？→（tryAcquire→入队→acquireQueued 重试/park→唤醒重试）
7. release 流程？→（tryRelease→unparkSuccessor 唤醒有效后继）
8. 公平/非公平？→（是否检查 hasQueuedPredecessors；默认非公平为吞吐）
9. 各同步器如何用 state？→（重入次数/计数/许可；独占 vs 共享）
10. 能自定义同步器吗？→（继承 AQS，重写 tryAcquire/tryRelease）
11. 虚拟线程下 AQS 定位？→（仍重要；JEP491 后简单锁回归 synchronized；Semaphore 显式限流）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–8 问 → L3
- 答到第 9–10 问 + 能自定义 → L4
- 答到第 11 问 + 体系化权衡 → L5

**一票否决信号：** 认为"AQS 就是 ReentrantLock 的别名"、说不清 state 和队列的关系、认为 acquire 一定响应中断 → 无论年限，最高 L2。

---

*资料整理于 2026-11-19，参考 JDK 源码（AbstractQueuedSynchronizer / ReentrantLock）、《Java 并发编程实战》、JEP 491（JDK24 synchronized 无 pinning）及 2026 年 Java 面试趋势资料。*
