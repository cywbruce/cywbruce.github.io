---
title: 并发编程深度面试手册
date: 2026-11-05
summary: 线程池、synchronized 锁升级、ReentrantLock、AQS、CAS、并发工具、ConcurrentHashMap、volatile、ThreadLocal、CompletableFuture。
interview: false
kind: handbook
---

> 面向 3-5 年+ Java 开发者，覆盖阿里/美团/字节/腾讯等大厂高频追问点。
> 每个知识点包含：**原理详解 → 方案对比 → 代码示例 → 生产踩坑 → 面试追问**。

---

## 1. 线程池（ThreadPoolExecutor）

### 1.1 原理详解

#### 7 个核心参数

```java
public ThreadPoolExecutor(
    int corePoolSize,        // 核心线程数：即使空闲也不会回收（除非设置 allowCoreThreadTimeOut）
    int maximumPoolSize,     // 最大线程数：核心线程 + 救急线程的上限
    long keepAliveTime,      // 救急线程空闲存活时间
    TimeUnit unit,           // 时间单位
    BlockingQueue<Runnable> workQueue,  // 任务等待队列
    ThreadFactory threadFactory,        // 线程创建工厂（命名、守护线程等）
    RejectedExecutionHandler handler    // 拒绝策略
)
```

**任务提交流程（核心源码 `execute()` 方法）**：

```java
// ThreadPoolExecutor#execute 精简逻辑
public void execute(Runnable command) {
    int c = ctl.get();
    // Step1: 当前线程数 < corePoolSize → 创建核心线程
    if (workerCountOf(c) < corePoolSize) {
        if (addWorker(command, true)) return;
        c = ctl.get();
    }
    // Step2: 核心线程满 → 尝试加入等待队列
    if (isRunning(c) && workQueue.offer(command)) {
        int recheck = ctl.get();
        // 二次检查：如果线程池已关闭，则移除任务并拒绝
        if (!isRunning(recheck) && remove(command))
            reject(command);
        // 如果工作线程为 0，创建一个非核心线程（防止任务无人执行）
        else if (workerCountOf(recheck) == 0)
            addWorker(null, false);
    }
    // Step3: 队列满 → 尝试创建救急线程（最大线程数限制）
    else if (!addWorker(command, false))
        // Step4: 救急线程也满 → 执行拒绝策略
        reject(command);
}
```

> **关键洞察**：先核心线程 → 再入队 → 再救急线程 → 最后拒绝。**不是**先把线程创满再入队。这是面试中最常被追问的点。

#### 4 种拒绝策略

| 拒绝策略 | 行为 | 适用场景 |
|---------|------|---------|
| `AbortPolicy`（默认） | 直接抛 `RejectedExecutionException` | 关键业务，不允许丢失任务 |
| `CallerRunsPolicy` | 由提交任务的线程自己执行 | 需要反压（backpressure）的场景 |
| `DiscardPolicy` | 静默丢弃，不抛异常 | 可容忍丢失的非核心任务（如日志上报） |
| `DiscardOldestPolicy` | 丢弃队列头部最旧任务，重新提交当前任务 | 时效性优先场景（如实时行情） |

#### 线程池状态流转

```
RUNNING(-1)  →  SHUTDOWN(0)  →  STOP(1)  →  TIDYING(2)  →  TERMINATED(3)
```

- **RUNNING → SHUTDOWN**：调用 `shutdown()`，不再接受新任务，但会处理完队列中的任务
- **RUNNING → STOP**：调用 `shutdownNow()`，不接受新任务，尝试中断正在执行的任务，清空队列
- **SHUTDOWN → TIDYING**：队列为空且工作线程数为 0
- **STOP → TIDYING**：工作线程数为 0
- **TIDYING → TERMINATED**：`terminated()` 钩子方法执行完毕

> **源码设计精妙之处**：`ctl` 是一个 `AtomicInteger`，高 3 位存储线程池状态，低 29 位存储工作线程数。通过位运算实现一个变量同时管理两种信息，避免加锁。

```java
private final AtomicInteger ctl = new AtomicInteger(ctlOf(RUNNING, 0));
private static int runStateOf(int c)     { return c & ~COUNT_MASK; }
private static int workerCountOf(int c)  { return c & COUNT_MASK; }
private static int ctlOf(int rs, int wc) { return rs | wc; }
```

#### 线程池大小设计公式

| 任务类型 | 推荐大小 | 原理 |
|---------|---------|------|
| CPU 密集型 | `N + 1`（N = CPU 核数） | +1 是为了在某线程因缺页等暂停时不浪费 CPU |
| IO 密集型 | `2N` 或 `N × U × (1 + W/C)` | U = 目标 CPU 利用率；W/C = 等待时间/计算时间 |

> **美团实践**：线上不会简单套公式，而是通过**动态线程池**（核心参数可通过配置中心实时修改）+ **监控**来调整。

#### execute vs submit

```java
// execute：提交 Runnable，无返回值，异常直接抛到 UncaughtExceptionHandler
executor.execute(runnable);

// submit：提交 Callable/Runnable，返回 Future，异常被封装在 Future 中
Future<String> future = executor.submit(callable);
// 调用 get() 时才抛出 ExecutionException
future.get();
```

| 对比项 | execute | submit |
|-------|---------|--------|
| 返回值 | void | Future |
| 异常处理 | 直接抛出（UncaughtExceptionHandler） | 封装在 Future 中，get() 时抛出 |
| 参数类型 | Runnable | Runnable / Callable |
| 底层实现 | 直接调用 | 将任务包装成 FutureTask 再调用 execute |

#### 动态线程池（美团实践）

核心思路：通过配置中心（如 Apollo / Nacos）动态调整线程池参数，结合监控告警实现自适应。

```java
// ThreadPoolExecutor 提供了 setter 方法，可以在运行时修改参数
executor.setCorePoolSize(newCoreSize);
executor.setMaximumPoolSize(newMaxSize);

// 注意：修改 corePoolSize 时，如果新值 > 旧值，会立即创建新线程
// 如果新值 < 旧值，空闲线程会在下次取任务超时后回收
```

动态线程池的完整落地方案需要关注以下要点：首先，修改 `corePoolSize` 时如果新值大于旧值，内部会调用 `interruptIdleWorkers()` 唤醒多余的核心线程使其退出；其次，修改等待队列容量在默认的 `LinkedBlockingQueue` 中是不支持的，美团的做法是自定义 `ResizableCapacityLinkedBlockingQueue`，通过反射或重写来暴露 `capacity` 的 setter 方法；最后，需要配合监控指标（队列积压、活跃线程比、拒绝次数等）来做告警驱动的动态调整。

#### ScheduledThreadPoolExecutor

底层基于 `DelayedWorkQueue`（最小堆实现），任务按执行时间排序。

- `schedule()`：一次性延迟执行
- `scheduleAtFixedRate()`：固定速率（上一次**开始**后间隔 period）
- `scheduleWithFixedDelay()`：固定延迟（上一次**结束**后间隔 delay）

两者的核心区别在于：`scheduleAtFixedRate` 在任务执行时间超过 period 时会立即执行下一次（不会并行，但不会间隔等待），而 `scheduleWithFixedDelay` 始终在上一次结束后等待 delay 才执行下一次。需要特别注意的是，如果任务抛出未捕获异常，后续的周期性执行将被**静默终止**，这是一个非常隐蔽的生产 bug。

### 1.2 生产踩坑经验

**坑 1：使用无界队列导致 OOM**

```java
// ❌ Executors.newFixedThreadPool 内部用 LinkedBlockingQueue（无界）
ExecutorService pool = Executors.newFixedThreadPool(10);
// 当任务提交速度 >> 消费速度，队列无限增长 → OOM

// ✅ 手动创建，指定有界队列
ExecutorService pool = new ThreadPoolExecutor(
    10, 20, 60, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(1000),  // 有界队列
    new ThreadPoolExecutor.CallerRunsPolicy()
);
```

> **阿里巴巴 Java 开发手册明确规定**：线程池不允许使用 Executors 创建，而是通过 ThreadPoolExecutor 手动构造，这样可以让开发者更加明确线程池的运行规则，规避资源耗尽的风险。

**坑 2：submit 吞异常**

```java
// ❌ 异常被吞，无任何日志输出
executor.submit(() -> { throw new RuntimeException("boom"); });

// ✅ 方案一：用 execute 代替 submit
executor.execute(() -> { throw new RuntimeException("boom"); });

// ✅ 方案二：获取 Future 结果
Future<?> f = executor.submit(() -> { throw new RuntimeException("boom"); });
try { f.get(); } catch (ExecutionException e) { log.error("任务异常", e.getCause()); }

// ✅ 方案三：自定义 ThreadPoolExecutor，重写 afterExecute
```

**坑 3：线程池未关闭导致应用无法退出**

```java
// ✅ 在 Spring 中使用 @Bean(destroyMethod = "shutdown") 或实现 DisposableBean
@Bean(destroyMethod = "shutdown")
public ExecutorService taskExecutor() { ... }
```

### 1.3 面试追问点

> **Q1：为什么线程池不是先创建到最大线程数再入队，而是先入队？**
> A：先入队可以减少线程创建和上下文切换的开销。线程创建成本高（分配栈空间、OS 调度），而入队只是一个指针操作。只有队列满了（说明负载确实很高）才会创建救急线程。

> **Q2：`CallerRunsPolicy` 的反压效果是怎样的？**
> A：当线程池和队列都满时，由调用线程（如 main 线程或 Tomcat 线程）执行任务。此时调用线程被阻塞，无法继续提交新任务，从而实现了对上游的"反压"，避免无限制地堆积请求。

> **Q3：`allowCoreThreadTimeOut(true)` 什么时候用？**
> A：当线程池在流量低谷期完全空闲时，希望回收所有线程以释放资源。常用于 Serverless 或弹性伸缩场景。

> **Q4：线程工厂为什么重要？**
> A：生产环境必须给线程命名（`new ThreadFactoryBuilder().setNameFormat("order-pool-%d").build()`），否则排查问题时只看到 `pool-1-thread-1`，无法定位是哪个线程池出了问题。

> **Q5：Worker 线程是如何循环取任务执行的？**
> A：每个 Worker 内部执行 `runWorker()` 方法，在一个 while 循环中调用 `getTask()` 从阻塞队列中取任务。核心线程调用 `workQueue.take()`（无限等待），救急线程调用 `workQueue.poll(keepAliveTime, unit)`（超时等待）。如果 `getTask()` 返回 null，Worker 线程退出。

---

## 2. synchronized 锁升级

### 2.1 原理详解

JDK 6 对 synchronized 做了重大优化，引入了**偏向锁 → 轻量级锁 → 重量级锁**的渐进式升级过程。

#### 对象头 Mark Word 结构（64 位 JVM）

```
|------------------------------------------------------|
|  Mark Word (64 bits)                                  |
|------------------------------------------------------|
| 无锁    | hashcode (31) | age (4) | biased(0) | 01   |
| 偏向锁  | threadID (54) | epoch(2) | age(4) | biased(1) | 01 |
| 轻量级锁 | 指向栈中锁记录的指针 (62)              | 00   |
| 重量级锁 | 指向 Monitor 对象的指针 (62)            | 10   |
| GC 标记 | 空                                      | 11   |
|------------------------------------------------------|
```

> 最后两位是锁标志位，JVM 通过这两位快速判断对象当前的锁状态，这是整个锁升级机制的基础。

#### 锁升级全过程

**1. 无锁 → 偏向锁**

当一个线程第一次进入同步块时，JVM 将该线程 ID 记录到对象头的 Mark Word 中（通过 CAS）。之后该线程再进入同步块时，只需要简单比较 Mark Word 中的线程 ID 是否为自己，无需任何 CAS 或系统调用。

```
适用场景：始终只有一个线程访问同步代码——实际上大多数锁都是这种情况。
```

偏向锁的设计依据是一项统计观察：大部分同步块在运行时只被一个线程持有。通过在对象头写入线程 ID，让后续同线程的加锁操作变成一次内存比较操作（几乎零成本），比 CAS 更快。

**2. 偏向锁 → 轻量级锁**

当第二个线程尝试获取锁时（但没有竞争，只是交替执行），偏向锁**撤销**（需要等到安全点 safepoint），升级为轻量级锁。

轻量级锁过程：
1. 在当前线程的栈帧中创建 `Lock Record`
2. 将对象头 Mark Word 复制到 Lock Record 中（称为 `Displaced Mark Word`）
3. 通过 CAS 将对象头 Mark Word 替换为指向 Lock Record 的指针
4. 如果 CAS 成功，获取锁成功
5. 如果 CAS 失败，检查是否是锁重入（Mark Word 指向当前线程栈帧），如果是则直接重入

**3. 轻量级锁 → 重量级锁**

当 CAS 自旋达到一定次数后仍然失败（JDK 6 后采用**自适应自旋**：根据上一次自旋结果动态调整自旋次数），升级为重量级锁。

重量级锁本质：关联一个 `ObjectMonitor`（C++ 层面，位于 `hotspot/src/share/vm/runtime/objectMonitor.hpp`），包含：
- `_owner`：持有锁的线程
- `_EntryList`：阻塞等待队列（等待获取锁的线程）
- `_WaitSet`：等待集合（调用 wait() 的线程）
- `_count`：重入计数
- `_cxq`：竞争队列（新到达的竞争线程先进入 _cxq）

> `_cxq` 与 `_EntryList` 的关系：新到达的竞争线程先 push 到 `_cxq`（栈结构，无锁 CAS 操作），当 owner 释放锁时将 `_cxq` 中的节点转移到 `_EntryList`（策略可配），然后从 `_EntryList` 中选择一个线程唤醒。这种双队列设计的目的是将高竞争的入队操作（_cxq）与相对有序的出队操作（_EntryList）解耦。

#### 锁消除与锁粗化

**锁消除**（Lock Elimination）：JIT 编译器通过逃逸分析，发现同步块中的对象不会逃逸到其他线程，则消除锁。

```java
// JIT 会消除这个 synchronized，因为 sb 不会逃逸
public String concat(String a, String b) {
    StringBuffer sb = new StringBuffer(); // 方法内部局部变量
    sb.append(a);
    sb.append(b);
    return sb.toString();
}
```

**锁粗化**（Lock Coarsening）：如果一系列连续操作都对同一个对象加锁，JIT 会将多个加锁操作合并为一个范围更大的锁。

```java
// 优化前：每次 append 都加锁/解锁
for (int i = 0; i < 1000; i++) {
    synchronized(lock) { list.add(i); }
}
// 优化后：粗化为一个大锁
synchronized(lock) {
    for (int i = 0; i < 1000; i++) { list.add(i); }
}
```

### 2.2 方案对比

| 锁级别 | 加锁方式 | 解锁方式 | 性能 | 适用场景 |
|-------|---------|---------|------|---------|
| 偏向锁 | 比较 Mark Word 线程 ID | 无需主动解锁 | 最高 | 单线程访问 |
| 轻量级锁 | CAS 替换 Mark Word | CAS 恢复 Mark Word | 较高 | 两个线程交替执行 |
| 重量级锁 | `ObjectMonitor.enter()` | `ObjectMonitor.exit()` | 较低 | 多线程高竞争 |

### 2.3 生产踩坑经验

**坑 1：JDK 15 默认禁用偏向锁**

从 JDK 15 开始，偏向锁默认关闭（`-XX:+UseBiasedLocking` 已废弃）。原因是偏向锁撤销需要 STW（Stop-The-World），在现代高并发应用中，偏向锁的收益 < 撤销成本。如果你的应用升级到 JDK 15+，且发现同步性能变化，需要关注这个变化。

**坑 2：`hashCode()` 与偏向锁的冲突**

如果对象在获取偏向锁之前调用了 `hashCode()`，由于 Mark Word 已经存储了 hashcode，没有空间存储线程 ID，该对象将无法获取偏向锁，直接进入轻量级锁。这个问题在实践中不易察觉，但可能影响性能基准测试的结果。

**坑 3：批量重偏向与批量撤销**

JVM 有两个阈值：当同一类的对象偏向锁撤销达到 20 次时触发**批量重偏向**（将该类所有对象的偏向锁偏向当前线程）；达到 40 次时触发**批量撤销**（该类所有新对象不再使用偏向锁）。这意味着如果你的锁对象属于同一个类，大量交替使用会导致该类全局禁用偏向锁。

### 2.4 面试追问点

> **Q1：偏向锁撤销为什么需要在安全点进行？**
> A：偏向锁撤销需要遍历偏向线程的栈帧，修改锁记录。如果线程正在执行，修改栈帧会导致数据不一致。安全点确保所有线程处于可预知状态。

> **Q2：自适应自旋是怎么实现的？**
> A：JVM 会根据同一个锁上一次自旋等待的结果来决定。如果上次自旋成功获取了锁，则这次认为"自旋大概率能成功"，会增加自旋次数；如果上次自旋失败（最终膨胀为重量级锁），则减少甚至跳过自旋。

> **Q3：synchronized 锁能降级吗？**
> A：严格来说**不会降级**。HotSpot 的实现中，一旦膨胀为重量级锁，不会退回轻量级锁。但 GC 时如果发现某个重量级锁的 Monitor 不再被任何线程引用，会被回收，对象重新回到无锁状态。

> **Q4：为什么 `wait()` 必须在 synchronized 块内调用？**
> A：`wait()` 的语义是"释放锁并等待通知"，如果不在同步块内，没有锁可释放，JVM 会抛出 `IllegalMonitorStateException`。从设计角度看，wait/notify 的正确使用必须配合条件判断（while 循环），而条件判断本身需要在互斥区内进行以避免竞态条件。

---

## 3. ReentrantLock

### 3.1 原理详解

`ReentrantLock` 基于 AQS 实现，内部有 `FairSync` 和 `NonfairSync` 两个内部类。

#### 公平锁 vs 非公平锁

```java
// NonfairSync（默认）
final void lock() {
    // 先尝试 CAS 直接抢锁（插队）
    if (compareAndSetState(0, 1))
        setExclusiveOwnerThread(Thread.currentThread());
    else
        acquire(1); // 失败则走 AQS 排队
}

// FairSync
final void lock() {
    acquire(1); // 直接走 AQS 排队，不尝试插队
}

// FairSync 的 tryAcquire 中多了一个关键判断
protected final boolean tryAcquire(int acquires) {
    // ...
    if (c == 0) {
        // 公平锁：检查队列中是否有前驱节点
        if (!hasQueuedPredecessors() &&
            compareAndSetState(0, acquires)) {
            setExclusiveOwnerThread(current);
            return true;
        }
    }
    // ...
}
```

`hasQueuedPredecessors()` 是公平性的核心——它检查 AQS 等待队列中是否存在等待更久的线程，如果有则当前线程不能插队。

#### Lock / tryLock / lockInterruptibly 对比

| 方法 | 阻塞 | 可中断 | 超时 | 使用场景 |
|-----|------|-------|------|---------|
| `lock()` | 是 | 否（中断后仍排队，获取锁后再设置中断标志） | 否 | 普通加锁 |
| `tryLock()` | 否 | 否 | 可选 | 非阻塞尝试获取（如避免死锁） |
| `lockInterruptibly()` | 是 | 是（抛 InterruptedException） | 否 | 需要响应中断的场景 |

`tryLock()` 有一个容易被忽视的特性：即使是公平锁，`tryLock()` 不带参数版本也是**非公平的**（会直接尝试 CAS，不检查队列）。只有 `tryLock(timeout, unit)` 才遵循公平策略。

#### Condition 条件变量

```java
ReentrantLock lock = new ReentrantLock();
Condition notFull = lock.newCondition();
Condition notEmpty = lock.newCondition();

// 生产者
lock.lock();
try {
    while (queue.isFull()) notFull.await();  // 等待"不满"条件
    queue.add(item);
    notEmpty.signal();  // 通知"不空"条件
} finally { lock.unlock(); }

// 消费者
lock.lock();
try {
    while (queue.isEmpty()) notEmpty.await();
    Object item = queue.poll();
    notFull.signal();
} finally { lock.unlock(); }
```

> **关键优势**：synchronized 只有一个等待集合（`wait/notify`），无法精确唤醒；而 `ReentrantLock` + `Condition` 可以有多个条件变量，实现精确唤醒。`ArrayBlockingQueue` 内部就是使用两个 Condition（`notEmpty` 和 `notFull`）实现的生产者-消费者模型。

### 3.2 ReentrantLock vs synchronized 对比

| 特性 | synchronized | ReentrantLock |
|-----|-------------|--------------|
| 实现层面 | JVM 内置（monitorenter/monitorexit） | Java 类库（AQS） |
| 锁释放 | 自动释放（退出代码块） | 手动 `unlock()`（finally 中） |
| 可中断 | 不可中断 | `lockInterruptibly()` |
| 超时等待 | 不支持 | `tryLock(timeout)` |
| 公平性 | 非公平 | 可选公平/非公平 |
| 条件变量 | 一个（`wait/notify`） | 多个（`Condition`） |
| 锁绑定 | 绑定对象 | 灵活，可绑定多个条件 |
| 性能 | JDK 6+ 优化后相近 | 高竞争下略优 |

### 3.3 生产踩坑经验

**坑 1：unlock 不在 finally 中**

```java
// ❌ 如果中间抛异常，锁永远不会释放 → 死锁
lock.lock();
doSomething();
lock.unlock();

// ✅ 标准写法
lock.lock();
try {
    doSomething();
} finally {
    lock.unlock();
}
```

**坑 2：公平锁性能陷阱**

```java
// ❌ 公平锁在高并发场景下吞吐量远低于非公平锁（3-10 倍差异）
ReentrantLock lock = new ReentrantLock(true);
// 原因：每次获取锁都需要检查等待队列，且发生更多的线程切换

// ✅ 除非业务明确要求公平性（如交易系统），否则用非公平锁
ReentrantLock lock = new ReentrantLock(); // 默认非公平
```

**坑 3：lock 写在 try 外面还是里面？**

```java
// ✅ lock() 应该写在 try 外面
lock.lock();
try { ... } finally { lock.unlock(); }

// ❌ 如果 lock() 写在 try 里面，lock() 本身抛异常时（理论上不会，但防御性编程）
// finally 中的 unlock() 会对一个未加锁的锁执行解锁 → IllegalMonitorStateException
try {
    lock.lock();
    ...
} finally { lock.unlock(); }
```

### 3.4 面试追问点

> **Q1：非公平锁为什么性能更好？**
> A：非公平锁允许线程在获取锁时直接 CAS 尝试，如果成功就无需经历"进入队列 → 阻塞 → 被唤醒 → 出队列"的完整过程，减少了线程上下文切换的开销。上下文切换一次约 1-10 μs，在高吞吐场景非常可观。

> **Q2：ReentrantLock 的重入是怎么实现的？**
> A：通过 AQS 的 `state` 字段。每次加锁 `state + 1`，每次解锁 `state - 1`，当 `state == 0` 时真正释放锁。同时通过 `exclusiveOwnerThread` 记录持有锁的线程。

> **Q3：ReentrantLock 和 ReentrantReadWriteLock 怎么选？**
> A：读多写少的场景用 `ReentrantReadWriteLock`（读读不互斥，读写/写写互斥）。但要注意写锁饥饿问题：如果读操作远多于写操作，写线程可能长期获取不到锁。JDK 8 引入的 `StampedLock` 通过乐观读进一步优化了这个问题。

---

## 4. AQS 原理（AbstractQueuedSynchronizer）

### 4.1 原理详解

AQS 是 `java.util.concurrent` 包的核心基础框架，Doug Lea 的设计杰作。

#### 核心数据结构

```
      +-------+  prev +-------+  prev +-------+
 head | Node  | <---- | Node  | <---- | Node  |  tail
      |  (h)  | ----> |  (t1) | ----> |  (t2) |
      +-------+  next +-------+  next +-------+
      
      volatile int state;  // 同步状态
```

- **state**：`volatile int`，不同子类赋予不同含义
  - `ReentrantLock`：0 = 未锁定，> 0 = 锁定次数（重入计数）
  - `Semaphore`：剩余许可数
  - `CountDownLatch`：剩余计数
- **CLH 变体双向队列**：节点（`Node`）包含 `waitStatus`、`prev`、`next`、`thread` 字段

#### Node 的 waitStatus

| 状态值 | 名称 | 含义 |
|-------|------|------|
| 0 | 初始状态 | 新创建的节点 |
| -1 | SIGNAL | 后继节点需要被唤醒 |
| -2 | CONDITION | 节点在条件队列中等待 |
| -3 | PROPAGATE | 共享模式下，释放会向后传播 |
| 1 | CANCELLED | 节点已取消 |

#### 独占模式 acquire 流程

```java
// AQS#acquire
public final void acquire(int arg) {
    // Step1: 子类实现 tryAcquire 尝试获取
    if (!tryAcquire(arg) &&
        // Step2: 获取失败 → 创建节点加入队尾（addWaiter）
        // Step3: 在队列中自旋/阻塞等待（acquireQueued）
        acquireQueued(addWaiter(Node.EXCLUSIVE), arg))
        // Step4: 如果等待过程中被中断过，补上中断标志
        selfInterrupt();
}

// AQS#acquireQueued 精简逻辑
final boolean acquireQueued(final Node node, int arg) {
    boolean interrupted = false;
    for (;;) {
        final Node p = node.predecessor();
        // 只有前驱是 head 的节点才有资格尝试获取锁
        if (p == head && tryAcquire(arg)) {
            setHead(node);  // 获取成功，当前节点成为新 head
            p.next = null;  // 旧 head 出队
            return interrupted;
        }
        // 判断是否需要阻塞（shouldParkAfterFailedAcquire）
        // 确认前驱节点的 waitStatus 为 SIGNAL 后 → LockSupport.park() 阻塞
        if (shouldParkAfterFailedAcquire(p, node) &&
            parkAndCheckInterrupt())
            interrupted = true;
    }
}
```

#### 独占模式 release 流程

```java
public final boolean release(int arg) {
    if (tryRelease(arg)) {   // 子类实现
        Node h = head;
        if (h != null && h.waitStatus != 0)
            unparkSuccessor(h);  // LockSupport.unpark(后继节点的线程)
        return true;
    }
    return false;
}
```

#### 共享模式（Semaphore / CountDownLatch）

共享模式的核心差异在于：获取锁成功后，如果还有剩余资源，会**传播唤醒**后续节点。

```java
private void doAcquireShared(int arg) {
    final Node node = addWaiter(Node.SHARED);
    for (;;) {
        final Node p = node.predecessor();
        if (p == head) {
            int r = tryAcquireShared(arg);
            if (r >= 0) {
                // 关键！设置新 head 并传播唤醒
                setHeadAndPropagate(node, r);
                p.next = null;
                return;
            }
        }
        if (shouldParkAfterFailedAcquire(p, node) &&
            parkAndCheckInterrupt())
            throw new InterruptedException();
    }
}
```

`setHeadAndPropagate` 是共享模式的精髓：如果 `tryAcquireShared` 返回值 > 0（还有剩余资源），或者后继节点也是共享节点，就会继续唤醒下一个节点，形成连锁唤醒效果。这也是 `PROPAGATE` 状态存在的意义。

### 4.2 基于 AQS 的实现对比

| 同步器 | state 含义 | 模式 | tryAcquire 逻辑 |
|-------|-----------|------|----------------|
| ReentrantLock | 重入次数 | 独占 | state==0 则 CAS(0,1)；已持有则 state+1 |
| Semaphore | 剩余许可 | 共享 | state ≥ 请求数则 CAS(state, state-n) |
| CountDownLatch | 剩余计数 | 共享 | state==0 时获取成功（可以通过） |
| ReentrantReadWriteLock | 高16位=读锁计数，低16位=写锁计数 | 读共享/写独占 | 复杂的状态管理 |

### 4.3 生产踩坑经验

**坑 1：自定义 AQS 时 tryAcquire/tryRelease 的返回值含义不同**

```java
// 独占模式 tryAcquire：返回 boolean（true=获取成功）
// 共享模式 tryAcquireShared：返回 int
//   负数 = 失败
//   0 = 成功但后续获取可能失败（不传播唤醒）
//   正数 = 成功且有剩余资源（传播唤醒后续节点）
```

**坑 2：AQS 使用模板方法模式，但没有用 abstract**

```java
// tryAcquire/tryRelease 默认抛 UnsupportedOperationException
// 子类只需要重写自己需要的模式（独占或共享），不需要全部实现
protected boolean tryAcquire(int arg) {
    throw new UnsupportedOperationException();
}
```

### 4.4 面试追问点

> **Q1：为什么 AQS 用 CLH 变体队列而不是普通队列？**
> A：CLH 队列的核心优势是自旋在前驱节点上，对 NUMA 架构友好。AQS 变体改为显式的双向链表（增加 prev 指针），是为了支持取消节点的快速移除和超时处理。

> **Q2：head 节点是什么？为什么是虚拟节点？**
> A：head 节点代表当前持有锁的线程（或初始空节点）。设计为虚拟节点可以简化边界条件处理——不需要在空队列和非空队列之间做额外判断。第一个入队操作会通过 `enq()` 先创建一个空的 head 节点。

> **Q3：`shouldParkAfterFailedAcquire` 的作用？**
> A：它检查前驱节点的 `waitStatus`。如果前驱是 SIGNAL(-1)，说明前驱释放时会唤醒当前节点，当前节点可以安全地 park；如果前驱已取消(>0)，则跳过已取消的节点；如果前驱是 0 或 PROPAGATE，则 CAS 设置为 SIGNAL，下次循环再 park。这种设计避免了不必要的 park/unpark 开销。

> **Q4：AQS 的 `acquire` 为什么不响应中断而是延迟处理？**
> A：`acquire()` 方法的设计是"不可中断获取"——如果在等待过程中被中断，它不会抛异常退出，而是记录中断标志，获取锁成功后再调用 `selfInterrupt()` 恢复中断状态。这样调用方可以在获取锁之后自行决定如何处理中断。对比 `acquireInterruptibly()` 则会立即响应中断并抛出 `InterruptedException`。

---

## 5. CAS 与 Atomic

### 5.1 原理详解

#### CAS 的底层实现链路

```
Java 层：AtomicInteger.compareAndSet(expect, update)
    ↓
Unsafe 层：Unsafe.compareAndSwapInt(obj, offset, expect, update)
    ↓
JNI 层：native 方法
    ↓
CPU 指令：lock cmpxchg（x86 架构）
```

`lock` 前缀保证了原子性（锁定缓存行或总线），`cmpxchg` 实现比较并交换。在多核处理器中，`lock` 前缀会通过 MESI 缓存一致性协议锁定该缓存行，阻止其他 CPU 同时修改。

```java
// AtomicInteger 核心实现
public class AtomicInteger extends Number {
    private static final Unsafe U = Unsafe.getUnsafe();
    private static final long VALUE = U.objectFieldOffset(
        AtomicInteger.class, "value");
    private volatile int value;
    
    public final boolean compareAndSet(int expectedValue, int newValue) {
        return U.compareAndSetInt(this, VALUE, expectedValue, newValue);
    }
    
    // getAndIncrement 的实现：自旋 CAS
    public final int getAndIncrement() {
        return U.getAndAddInt(this, VALUE, 1);
    }
}

// Unsafe#getAndAddInt
public final int getAndAddInt(Object o, long offset, int delta) {
    int v;
    do {
        v = getIntVolatile(o, offset);  // 读取当前值
    } while (!compareAndSetInt(o, offset, v, v + delta)); // CAS 自旋
    return v;
}
```

#### ABA 问题

```
线程1: 读取值 A → (被挂起)
线程2: A → B → A
线程1: (恢复) CAS(A, C) 成功！但中间状态已经改变
```

**解决方案**：

```java
// 方案一：AtomicStampedReference — 版本号
AtomicStampedReference<Integer> ref = new AtomicStampedReference<>(100, 0);
int[] stampHolder = new int[1];
int value = ref.get(stampHolder);  // 获取值和版本号
int stamp = stampHolder[0];
ref.compareAndSet(value, 200, stamp, stamp + 1); // 比较值+版本号

// 方案二：AtomicMarkableReference — 布尔标记（只关心是否被改过）
AtomicMarkableReference<Integer> ref = new AtomicMarkableReference<>(100, false);
ref.compareAndSet(100, 200, false, true);
```

`AtomicStampedReference` 的内部实现是将引用和版本号封装在一个 `Pair` 对象中，每次更新都创建新的 `Pair`，然后 CAS 替换 `Pair` 引用。这样即使值从 A→B→A，版本号也会从 0→1→2，CAS 检测时会发现版本号不匹配而失败。

#### LongAdder 分段累加优化

`AtomicLong` 在高竞争下性能差（所有线程都在同一个变量上 CAS），`LongAdder` 通过分段减少竞争。

```
LongAdder 内部结构：
  base (long) ← 低竞争时直接 CAS 累加到 base
  cells[] (Cell[]) ← 高竞争时，每个线程映射到不同 Cell 累加

sum() = base + ΣCell[i].value
```

```java
// Cell 类用 @Contended 注解避免伪共享
@jdk.internal.vm.annotation.Contended
static final class Cell {
    volatile long value;
    // ...
}
```

**关键设计**：
1. 初始时只使用 `base`，无竞争时与 `AtomicLong` 一样
2. 当 `base` 的 CAS 失败（说明有竞争），才创建 `cells[]`
3. 线程通过 `Thread.getProbe()` 做哈希映射到不同 Cell
4. Cell 的 CAS 也失败时，扩容 cells 数组（最大为 CPU 核数）
5. 扩容采用 2 倍策略，初始大小为 2

### 5.2 方案对比

| 方案 | 适用场景 | 吞吐量 | 精确度 | 典型使用 |
|-----|---------|--------|-------|---------|
| `AtomicLong` | 低竞争 | 中等 | 精确 | 序列号生成 |
| `LongAdder` | 高竞争写，最终读 | 极高 | 最终一致（sum 非原子） | 统计计数器 |
| `LongAccumulator` | 自定义累加函数 | 极高 | 最终一致 | 最大值/最小值统计 |

### 5.3 生产踩坑经验

**坑 1：CAS 自旋导致 CPU 空转**

```java
// ❌ 高竞争场景下，大量线程 CAS 自旋导致 CPU 飙高
// 典型表现：CPU 使用率 100%，但吞吐量很低

// ✅ 高竞争计数场景用 LongAdder
// ✅ 复杂场景考虑用锁代替 CAS
```

**坑 2：`LongAdder.sum()` 不是精确值**

```java
// ❌ 在并发环境中 sum() 不保证精确
long count = longAdder.sum(); // 不是原子操作，可能读到中间状态

// ✅ 如果需要精确值，必须在无并发写入时调用 sum()，或使用 AtomicLong
```

**坑 3：Unsafe 的使用限制**

```java
// JDK 9+ 中 Unsafe 被移到 jdk.internal.misc 包
// 应用代码不应直接使用 Unsafe，使用 VarHandle（JDK 9+）替代
// VarHandle 提供了类似的 CAS 能力，且类型安全
VarHandle VH = MethodHandles.lookup().findVarHandle(MyClass.class, "value", int.class);
VH.compareAndSet(this, 0, 1);
```

### 5.4 面试追问点

> **Q1：CAS 的 ABA 问题在实际业务中有什么影响？**
> A：典型场景：无锁栈/队列。线程 A 准备 pop 栈顶 A→B→C，被挂起；线程 B pop A，pop B，push D，push A；线程 A 恢复后 CAS 成功（栈顶仍是 A），但 next 指针已经变了，链表结构被破坏。在**链表/指针操作**中 ABA 问题非常致命。

> **Q2：为什么 `@Contended` 能解决伪共享？**
> A：CPU 缓存以缓存行（64 字节）为单位加载。如果两个不相关的变量在同一缓存行上，一个线程修改变量 A 会导致另一个线程的变量 B 所在缓存行失效（MESI 协议），即"伪共享"。`@Contended` 通过在变量前后各填充 128 字节，确保该变量独占缓存行。需要 `-XX:-RestrictContended` 才能在非 JDK 内部类中生效。

> **Q3：CAS 操作本身是原子的，那 CAS 需要加锁吗？**
> A：CAS 不需要额外加锁，CPU 的 `lock cmpxchg` 指令本身就是原子的。但 CAS 只能保证单个变量的原子更新，如果需要原子更新多个变量，仍然需要加锁或使用其他方案（如将多个变量打包到一个 `AtomicReference` 中）。

---

## 6. 并发工具类

### 6.1 CountDownLatch

**原理**：基于 AQS 共享模式。`state` 初始化为计数值。`countDown()` 每次 CAS 减 1，当 `state` 减到 0 时，释放所有等待的线程（通过 `doReleaseShared()` 传播唤醒）。

```java
// 典型场景：主线程等待多个子线程完成
CountDownLatch latch = new CountDownLatch(3);

for (int i = 0; i < 3; i++) {
    executor.execute(() -> {
        try { doWork(); }
        finally { latch.countDown(); }
    });
}
latch.await(10, TimeUnit.SECONDS); // 主线程阻塞，直到计数为 0 或超时
// 注意：CountDownLatch 是一次性的，计数无法重置
```

**进阶场景：模拟并发压测**

```java
// 让 N 个线程同时开始执行
CountDownLatch startGate = new CountDownLatch(1);
CountDownLatch endGate = new CountDownLatch(N);

for (int i = 0; i < N; i++) {
    executor.execute(() -> {
        startGate.await();  // 所有线程在此等待
        try { doTest(); }
        finally { endGate.countDown(); }
    });
}
startGate.countDown();   // 发令枪：所有线程同时开始
endGate.await();         // 等待所有线程结束
```

### 6.2 CyclicBarrier

**原理**：基于 `ReentrantLock` + `Condition` 实现（不是 AQS 共享模式）。所有线程到达屏障点后一起继续执行。

```java
// 典型场景：多线程分阶段计算（如 MapReduce 的 shuffle 阶段）
CyclicBarrier barrier = new CyclicBarrier(3, () -> {
    System.out.println("所有线程到达屏障，执行合并操作");
});

for (int i = 0; i < 3; i++) {
    executor.execute(() -> {
        doPartialWork();
        barrier.await(); // 等待所有线程到达
        doNextPhase();
    });
}
```

CyclicBarrier 内部维护了一个 `generation` 对象，每当所有线程到达屏障后进入下一代（`nextGeneration()`），重置计数器并唤醒所有等待线程。`reset()` 方法也会打破当前代并开启新一代。

### 6.3 CountDownLatch vs CyclicBarrier

| 特性 | CountDownLatch | CyclicBarrier |
|-----|---------------|--------------|
| 底层实现 | AQS 共享模式 | ReentrantLock + Condition |
| 可重用 | ❌ 一次性 | ✅ `reset()` 可重用 |
| 等待方 | 一个或多个线程等待其他线程完成 | 所有线程互相等待到达屏障点 |
| 屏障动作 | 无 | 支持（构造函数传入 Runnable） |
| 计数方式 | 事件计数（countDown） | 线程计数（await） |
| 异常处理 | 某线程异常不影响其他等待者 | 一个线程异常/超时，其他都 BrokenBarrierException |

### 6.4 Semaphore

**原理**：基于 AQS 共享模式。`state` 表示剩余许可数。`acquire()` 减少许可，`release()` 增加许可。

```java
// 典型场景：限流，控制并发数
Semaphore semaphore = new Semaphore(10); // 最多 10 个并发

public void accessResource() {
    semaphore.acquire(); // 获取许可（阻塞）
    try {
        doWork();
    } finally {
        semaphore.release(); // 释放许可
    }
}
```

> **与线程池的区别**：Semaphore 控制的是"并发访问数"而非"线程数"。线程池管理线程生命周期，而 Semaphore 只负责许可的发放和回收。两者可以配合使用：线程池管理线程，Semaphore 控制对共享资源的并发访问。

### 6.5 Phaser（JDK 7+）

Phaser 是 CyclicBarrier 的增强版，支持动态注册/注销参与者，以及多阶段同步。

```java
Phaser phaser = new Phaser(3); // 3个参与者

// 动态注册
phaser.register(); // 参与者 +1

// 到达并等待
phaser.arriveAndAwaitAdvance(); // 等效于 CyclicBarrier.await()

// 到达并注销
phaser.arriveAndDeregister(); // 不再参与后续阶段

// 可以重写 onAdvance 控制阶段终止条件
Phaser phaser = new Phaser(3) {
    @Override
    protected boolean onAdvance(int phase, int registeredParties) {
        return phase >= 5 || registeredParties == 0; // 5 个阶段后终止
    }
};
```

### 6.6 Exchanger

Exchanger 用于两个线程之间交换数据，双方在交换点同步等待。

```java
Exchanger<String> exchanger = new Exchanger<>();

// 线程A
String fromB = exchanger.exchange("data from A"); // 阻塞直到线程B也调用 exchange

// 线程B
String fromA = exchanger.exchange("data from B"); // 交换完成

// 适用场景：遗传算法中交换基因、流水线中两个阶段交换缓冲区
```

### 6.7 面试追问点

> **Q1：CountDownLatch 的 countDown() 可以被同一线程调用多次吗？**
> A：可以。countDown() 只是对 state 做 CAS 减 1，不关心是哪个线程调用。所以一个线程可以多次 countDown，这与 CyclicBarrier 的 await 不同（每个线程只能 await 一次）。

> **Q2：Semaphore 的许可数可以超过初始值吗？**
> A：可以！`release()` 可以在没有 `acquire()` 的情况下调用，这会增加许可数。这是一个容易出 bug 的地方，需要确保 acquire/release 配对使用。

> **Q3：CyclicBarrier 的 BrokenBarrierException 什么时候触发？**
> A：三种情况：(1) 某线程在等待屏障时被中断；(2) 某线程等待超时；(3) 调用了 `reset()` 方法。一旦屏障被破坏，所有正在等待的线程都会收到 `BrokenBarrierException`，需要做异常恢复处理。

---

## 7. ConcurrentHashMap

### 7.1 JDK 1.7 实现

```
Segment[] (默认 16 个)
    └─ Segment extends ReentrantLock
        └─ HashEntry[] table
            └─ HashEntry (key, value, hash, next)
```

- **分段锁**：每个 Segment 独立加锁，最大并发度 = Segment 数量（默认 16）
- **put 操作**：定位 Segment → `Segment.lock()` → 定位 bucket → 插入/更新
- **get 操作**：无锁读取（HashEntry 的 `value` 和 `next` 是 volatile）
- **Segment 个数一旦确定不可扩容**，只有 Segment 内部的 HashEntry 数组可以扩容

### 7.2 JDK 1.8 实现（重大重构）

```
Node[] table
    ├─ Node (hash, key, value, next)        → 链表
    └─ TreeBin → TreeNode                    → 红黑树
```

**核心变化**：
- 放弃分段锁，改用 **Node 数组 + CAS + synchronized（锁单个桶头节点）**
- 链表长度 ≥ 8 且数组长度 ≥ 64 时转为红黑树，≤ 6 时退化回链表

```java
// JDK 1.8 putVal 核心逻辑
final V putVal(K key, V value, boolean onlyIfAbsent) {
    // key 和 value 都不允许 null（与 HashMap 不同！）
    if (key == null || value == null) throw new NullPointerException();
    int hash = spread(key.hashCode()); // 高位扰动
    
    for (Node<K,V>[] tab = table;;) {
        Node<K,V> f; int n, i, fh;
        if (tab == null || (n = tab.length) == 0)
            tab = initTable();  // 延迟初始化（CAS 控制 sizeCtl）
        else if ((f = tabAt(tab, i = (n - 1) & hash)) == null)
            // 桶为空 → CAS 放入新节点（无需加锁）
            if (casTabAt(tab, i, null, new Node<>(hash, key, value)))
                break;
        else if ((fh = f.hash) == MOVED)
            // 正在扩容 → 帮助扩容
            tab = helpTransfer(tab, f);
        else {
            // 桶不为空 → synchronized 锁住桶头节点
            synchronized (f) {
                // 遍历链表或红黑树，插入/更新
            }
        }
    }
    addCount(1L, binCount); // 更新计数
    return null;
}
```

#### 扩容 transfer 并发协助

JDK 1.8 的扩容是**多线程协作**的：

1. 新建一个两倍大小的 `nextTable`
2. 将旧数组按**步长**（stride，最小 16）分给多个线程处理
3. 每个线程负责迁移一段连续的桶
4. 已迁移完的桶放一个 `ForwardingNode`（hash = MOVED），其他线程看到后会帮忙迁移
5. `transferIndex` 是一个共享的游标，线程通过 CAS 领取自己负责的段

这种设计的巧妙之处在于：在扩容过程中，put/get 操作仍然可以正常进行。put 操作遇到 `ForwardingNode` 会帮助迁移；get 操作遇到 `ForwardingNode` 会被转发到新数组查找。

#### size() 计算方式

```java
// 类似 LongAdder 的分段思想
// baseCount: 无竞争时直接累加
// counterCells[]: 有竞争时分散累加
public int size() {
    long n = sumCount();
    return ((n < 0L) ? 0 :
            (n > Integer.MAX_VALUE) ? Integer.MAX_VALUE : (int)n);
}

final long sumCount() {
    CounterCell[] cs = counterCells;
    long sum = baseCount;
    if (cs != null)
        for (CounterCell c : cs)
            sum += c.value;
    return sum;
}
```

> 注意 `size()` 返回 int（最大 `Integer.MAX_VALUE`），如果元素超过 2^31，应使用 `mappingCount()` 返回 long 类型。

### 7.3 方案对比

| 特性 | JDK 1.7 | JDK 1.8 |
|-----|---------|---------|
| 数据结构 | Segment + 数组 + 链表 | 数组 + 链表/红黑树 |
| 锁粒度 | Segment 锁（16 个段） | 桶头节点锁（数组长度个） |
| 锁实现 | ReentrantLock | CAS + synchronized |
| 并发度 | 固定（Segment 数量） | 动态（随数组扩容增长） |
| 查询时间复杂度 | O(n) 链表 | O(log n) 红黑树 |
| 扩容方式 | 每个 Segment 独立扩容 | 全局扩容，多线程协助 |

### 7.4 生产踩坑经验

**坑 1：复合操作非原子**

```java
// ❌ check-then-act 不是原子操作
if (!map.containsKey(key)) {
    map.put(key, value); // 两个操作之间可能被其他线程插入
}

// ✅ 使用原子方法
map.putIfAbsent(key, value);
map.computeIfAbsent(key, k -> createExpensiveValue(k));
```

**坑 2：为什么不允许 null key/value？**

```java
// HashMap 允许 null key/null value
// ConcurrentHashMap 不允许——因为无法区分"key 不存在"和"value 就是 null"
// 在并发场景下，containsKey() + get() 不是原子操作，无法准确判断
```

**坑 3：`computeIfAbsent` 的死锁隐患（JDK 8 bug，JDK 9 修复）**

```java
// ❌ JDK 8 中，如果 mappingFunction 内部又操作了同一个 ConcurrentHashMap
// 可能导致死锁（因为 computeIfAbsent 持有桶锁，递归操作同一个桶会永久阻塞）
map.computeIfAbsent(key, k -> {
    map.computeIfAbsent(anotherKey, k2 -> value); // 可能死锁！
    return someValue;
});
```

### 7.5 面试追问点

> **Q1：为什么链表转红黑树的阈值是 8？**
> A：根据泊松分布，当负载因子为 0.75 时，单个桶中元素数量达到 8 的概率约为 0.00000006（千万分之六）。选择 8 是在空间（TreeNode 是 Node 的两倍大小）和时间（链表遍历 vs 树查找）之间的平衡。退化阈值选 6 而不是 8 是为了避免频繁转换（中间留了 7 作为缓冲）。

> **Q2：JDK 1.8 为什么用 synchronized 而不是 ReentrantLock？**
> A：(1) JDK 6 之后 synchronized 经过锁升级优化，在低竞争时（偏向锁/轻量级锁）性能不输 ReentrantLock；(2) synchronized 是 JVM 内置的，JIT 可以做更多优化（锁消除、锁粗化）；(3) Node 作为锁对象本身就在堆上，不需要额外的 Lock 对象，节省内存。

> **Q3：扩容时 get 操作怎么保证正确性？**
> A：如果桶已经迁移完毕，桶位置放的是 `ForwardingNode`，其 `find()` 方法会去新数组 `nextTable` 中查找；如果桶还没开始迁移，直接在旧数组查找。这样就保证了扩容期间读操作的正确性。

> **Q4：`spread()` 扰动函数的作用？**
> A：`(h ^ (h >>> 16)) & HASH_BITS`，将高 16 位与低 16 位异或，让 hash 值分布更均匀，减少碰撞。`& HASH_BITS`（0x7fffffff）确保结果为正数（负数 hash 有特殊含义：MOVED=-1 表示正在扩容，TREEBIN=-2 表示红黑树节点）。

---

## 8. volatile

### 8.1 原理详解

volatile 提供两个语义：**可见性**和**有序性**（禁止指令重排），但**不保证原子性**。

#### 可见性实现：内存屏障

```
volatile 写操作：
    StoreStore 屏障      ← 确保 volatile 写之前的写操作不会重排到 volatile 写之后
    [volatile 写]
    StoreLoad 屏障       ← 确保 volatile 写对后续 volatile 读可见（最重量级）

volatile 读操作：
    [volatile 读]
    LoadLoad 屏障        ← 确保 volatile 读之后的读操作不会重排到 volatile 读之前
    LoadStore 屏障       ← 确保 volatile 读之后的写操作不会重排到 volatile 读之前
```

在 x86 架构中，只有 StoreLoad 需要真正的内存屏障指令（`mfence` 或 `lock addl $0,(%rsp)`），其他三种通过 x86 的强内存模型天然保证。但在 ARM/POWER 等弱内存模型架构中，所有四种屏障都需要显式指令。

#### happens-before 规则

volatile 写 happens-before 后续对同一 volatile 变量的读。这意味着 volatile 写之前的所有操作对 volatile 读之后的代码都可见。这个传递性是 Java 内存模型（JMM）中非常重要的概念，也是很多并发设计的基础。

#### DCL 单例为什么需要 volatile

```java
public class Singleton {
    // ❌ 不加 volatile 会有问题
    // ✅ 加 volatile 防止指令重排
    private static volatile Singleton INSTANCE;
    
    public static Singleton getInstance() {
        if (INSTANCE == null) {                 // 第一次检查（无锁）
            synchronized (Singleton.class) {
                if (INSTANCE == null) {         // 第二次检查（有锁）
                    INSTANCE = new Singleton(); // 问题出在这行
                }
            }
        }
        return INSTANCE;
    }
}
```

`new Singleton()` 在字节码层面分三步：
1. `memory = allocate();`       — 分配内存
2. `ctorInstance(memory);`      — 调用构造函数初始化
3. `INSTANCE = memory;`         — 将引用指向分配的内存

编译器/CPU 可能将步骤 2 和 3 重排为 1→3→2。如果线程 A 执行到 3（INSTANCE 已非 null）但还没执行 2（对象未初始化完），线程 B 在第一次检查时看到 INSTANCE != null，直接返回一个**未完全初始化**的对象。

volatile 的 StoreStore 屏障确保构造函数执行完毕后才将引用赋值给 INSTANCE。

> **替代方案**：使用静态内部类实现懒加载单例更加简洁安全：
> ```java
> public class Singleton {
>     private static class Holder {
>         static final Singleton INSTANCE = new Singleton();
>     }
>     public static Singleton getInstance() { return Holder.INSTANCE; }
> }
> ```
> 这利用了类加载的线程安全性保证（JVM 内部用锁保护类初始化过程）。

### 8.2 volatile vs synchronized vs Atomic

| 特性 | volatile | synchronized | Atomic |
|-----|---------|-------------|--------|
| 可见性 | ✅ | ✅ | ✅ |
| 原子性 | ❌（单次读/写原子，复合操作不原子） | ✅ | ✅（CAS） |
| 有序性 | ✅ | ✅ | ✅ |
| 阻塞 | ❌ | 可能阻塞 | ❌（自旋） |
| 性能开销 | 极低（只有内存屏障） | 低~高（取决于竞争） | 低~中（取决于竞争） |
| 适用场景 | 状态标志位、DCL | 复合操作、临界区 | 计数器、CAS 更新 |

### 8.3 生产踩坑经验

**坑 1：volatile 不保证原子性**

```java
// ❌ volatile 不能保证 i++ 的原子性
private volatile int count = 0;
public void increment() { count++; } // 读-改-写，非原子

// ✅ 使用 AtomicInteger
private AtomicInteger count = new AtomicInteger(0);
public void increment() { count.incrementAndGet(); }
```

**坑 2：volatile 数组只保证引用可见，不保证元素可见**

```java
// ❌ volatile int[] arr 只保证 arr 引用可见
// arr[0] = 1 的修改对其他线程不一定可见
volatile int[] arr = new int[10];

// ✅ 使用 AtomicIntegerArray
AtomicIntegerArray arr = new AtomicIntegerArray(10);
```

**坑 3：volatile boolean 作为停止标志的经典用法**

```java
// ✅ 标准的线程停止方式
public class Worker implements Runnable {
    private volatile boolean running = true;
    
    public void run() {
        while (running) {
            doWork();
        }
    }
    
    public void stop() { running = false; }
}
// 不加 volatile，循环可能永远不会退出（JIT 可能将 running 优化为寄存器变量）
```

### 8.4 面试追问点

> **Q1：volatile 的 64 位变量写入在 32 位 JVM 上有什么特殊意义？**
> A：在 32 位 JVM 上，对 `long` 和 `double`（64 位）的读写不是原子的（会分两次 32 位操作）。加 volatile 可以保证 64 位变量的读写原子性。在 64 位 JVM 上这个问题不存在。

> **Q2：volatile 读的性能开销是什么？**
> A：在 x86 上，volatile 读几乎没有额外开销（x86 天然保证 LoadLoad/LoadStore 顺序）；volatile 写需要一个 StoreLoad 屏障（约 10-100ns，取决于缓存状态）。所以"读多写少"的场景非常适合 volatile。

> **Q3：happens-before 的传递性怎么理解？**
> A：如果 A happens-before B，B happens-before C，则 A happens-before C。实际应用：线程 A 写普通变量 x=1，然后写 volatile 变量 flag=true；线程 B 读 flag==true 后读 x，一定能看到 x=1。这就是 volatile 的"通信"作用——通过 volatile 变量的写-读建立 happens-before 关系，间接保证了非 volatile 变量的可见性。

---

## 9. ThreadLocal

### 9.1 原理详解

#### 核心数据结构

```
Thread 对象
  └─ ThreadLocalMap threadLocals
       └─ Entry[] table
            └─ Entry extends WeakReference<ThreadLocal<?>>
                 ├─ key: WeakReference<ThreadLocal>  (弱引用)
                 └─ value: Object                     (强引用)
```

```java
// ThreadLocal#get() 核心逻辑
public T get() {
    Thread t = Thread.currentThread();
    ThreadLocalMap map = getMap(t);  // 获取当前线程的 ThreadLocalMap
    if (map != null) {
        ThreadLocalMap.Entry e = map.getEntry(this); // this 就是 ThreadLocal 对象作为 key
        if (e != null) return (T) e.value;
    }
    return setInitialValue(); // 未设置则调用 initialValue()
}

// ThreadLocal#set()
public void set(T value) {
    Thread t = Thread.currentThread();
    ThreadLocalMap map = getMap(t);
    if (map != null)
        map.set(this, value);
    else
        createMap(t, value);
}
```

#### 内存泄漏原因分析

```
ThreadLocal 引用链：
  Thread → ThreadLocalMap → Entry[] → Entry
                                        ├─ key (WeakReference<ThreadLocal>) → ThreadLocal 对象
                                        └─ value (强引用) → 实际值

泄漏场景：
  1. ThreadLocal 对象被设为 null（外部不再持有强引用）
  2. GC 回收 ThreadLocal 对象（因为 Entry.key 是弱引用）
  3. Entry 的 key 变成 null，但 value 仍然被 Entry 强引用
  4. 如果线程一直存活（线程池！），这个 value 永远无法回收
```

> **ThreadLocalMap 的自清理机制**：在 `get()`/`set()`/`remove()` 过程中会调用 `expungeStaleEntry()` 清除 key 为 null 的 Entry。但这是被动清理，不能保证及时。此外，`set()` 方法中还会触发启发式清理（`cleanSomeSlots`），每次扫描 `log2(n)` 个槽位，在性能和清理效果之间做了平衡。

#### 哈希冲突解决

ThreadLocalMap 使用**开放定址法（线性探测）**而非链表法，因为 ThreadLocal 数量通常很少（一个线程通常只有几个 ThreadLocal），线性探测的缓存命中率更高。

```java
// ThreadLocalMap#set
private void set(ThreadLocal<?> key, Object value) {
    Entry[] tab = table;
    int len = tab.length;
    int i = key.threadLocalHashCode & (len - 1);
    
    for (Entry e = tab[i]; e != null; e = tab[i = nextIndex(i, len)]) {
        if (e.get() == key) { e.value = value; return; }  // 找到则更新
        if (e.get() == null) { replaceStaleEntry(key, value, i); return; } // 清理过期
    }
    tab[i] = new Entry(key, value); // 空槽位直接放入
}
```

### 9.2 InheritableThreadLocal vs TransmittableThreadLocal

| 特性 | ThreadLocal | InheritableThreadLocal | TransmittableThreadLocal |
|-----|-----------|----------------------|------------------------|
| 父→子线程传递 | ❌ | ✅（创建子线程时复制） | ✅（提交任务时传递） |
| 线程池场景 | ❌ | ❌（线程复用，只在创建时复制） | ✅ |
| 来源 | JDK | JDK | 阿里巴巴开源 |

```java
// InheritableThreadLocal 的问题：线程池中线程是复用的
// 子线程创建时拷贝父线程的值，但线程复用后不会再拷贝
InheritableThreadLocal<String> itl = new InheritableThreadLocal<>();
itl.set("parent-value");
executor.execute(() -> {
    // 第一次执行可能正确（如果线程是新创建的）
    // 后续复用该线程的任务拿到的是第一次的值，而不是当前父线程的值
    System.out.println(itl.get());
});

// ✅ TransmittableThreadLocal 解决方案
TransmittableThreadLocal<String> ttl = new TransmittableThreadLocal<>();
ttl.set("parent-value");
// 方式一：包装 Runnable
executor.execute(TtlRunnable.get(() -> {
    System.out.println(ttl.get()); // 始终正确
}));
// 方式二：包装线程池（推荐）
ExecutorService ttlExecutor = TtlExecutors.getTtlExecutorService(executor);
```

TTL 的核心原理是在任务提交时**快照**当前线程的所有 TTL 值，在任务执行前**恢复**快照值到工作线程，任务执行后**还原**工作线程原来的值。本质上是一种装饰器模式。

### 9.3 生产踩坑经验

**坑 1：线程池 + ThreadLocal = 内存泄漏**

```java
// ❌ 线程池中线程长期存活，ThreadLocal 的 value 一直不释放
executor.execute(() -> {
    threadLocal.set(new LargeObject()); // 大对象
    doWork();
    // 忘记 remove()，LargeObject 一直驻留内存
});

// ✅ 必须在 finally 中 remove
executor.execute(() -> {
    threadLocal.set(new LargeObject());
    try { doWork(); }
    finally { threadLocal.remove(); } // 必须！
});
```

**坑 2：Spring 的 `@Async` + RequestContextHolder**

```java
// ❌ @Async 方法在另一个线程执行，拿不到 RequestContext
@Async
public void asyncMethod() {
    // RequestContextHolder 基于 ThreadLocal，这里获取为 null
    HttpServletRequest request = ((ServletRequestAttributes)
        RequestContextHolder.getRequestAttributes()).getRequest();
}

// ✅ 手动传递，或使用 TaskDecorator
@Configuration
public class AsyncConfig implements AsyncConfigurer {
    @Override
    public Executor getAsyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setTaskDecorator(runnable -> {
            RequestAttributes context = RequestContextHolder.getRequestAttributes();
            return () -> {
                try {
                    RequestContextHolder.setRequestAttributes(context);
                    runnable.run();
                } finally {
                    RequestContextHolder.resetRequestAttributes();
                }
            };
        });
        return executor;
    }
}
```

**坑 3：ThreadLocal 与 `static` 修饰**

```java
// ✅ ThreadLocal 通常应声明为 static final
// 因为 ThreadLocal 实例本身是所有线程共享的"key"，不需要每个对象一份
private static final ThreadLocal<SimpleDateFormat> DATE_FORMAT =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

// ❌ 如果声明为实例变量，每创建一个对象就多一个 ThreadLocal
// 线程的 ThreadLocalMap 中会积累大量 Entry，导致性能下降
```

### 9.4 面试追问点

> **Q1：为什么 Entry 的 key 用弱引用？**
> A：如果 key 用强引用，即使外部代码不再持有 ThreadLocal 对象的引用，ThreadLocalMap 的 Entry 中仍然持有强引用，ThreadLocal 对象无法被 GC。使用弱引用可以让 ThreadLocal 对象在外部无强引用时被回收，起到"兜底"作用——虽然 value 仍泄漏，但至少可以通过 key==null 检测出过期 Entry。

> **Q2：ThreadLocal 的 hashCode 有什么特殊？**
> A：ThreadLocal 使用斐波那契散列：`HASH_INCREMENT = 0x61c88647`（黄金分割比相关），每创建一个 ThreadLocal，hashCode 递增这个值。这样可以让 Entry 在数组中均匀分布，减少线性探测的冲突。这个魔数对应的是 `(√5 - 1) / 2 × 2^32` 的无符号整数表示。

> **Q3：既然有内存泄漏风险，为什么不把 value 也设为弱引用？**
> A：如果 value 也是弱引用，value 可能在任何时刻被 GC 回收，导致 `get()` 返回 null，这对业务逻辑是不可接受的。设计上是在"泄漏风险"和"数据正确性"之间选择了后者。

---

## 10. CompletableFuture

### 10.1 原理详解

`CompletableFuture` 是 JDK 8 引入的异步编程利器，实现了 `Future` 和 `CompletionStage` 接口。

#### 创建方式

```java
// 有返回值
CompletableFuture<String> cf = CompletableFuture.supplyAsync(
    () -> queryDB(), customExecutor  // 推荐传入自定义线程池
);

// 无返回值
CompletableFuture<Void> cf = CompletableFuture.runAsync(
    () -> sendEmail(), customExecutor
);

// 不传线程池默认使用 ForkJoinPool.commonPool()
// ⚠️ 生产环境强烈建议传自定义线程池，避免共享池被打满
```

#### 链式调用

```java
CompletableFuture<String> result = CompletableFuture
    .supplyAsync(() -> getUserId())        // 异步获取用户 ID
    .thenApply(id -> getUser(id))          // 同步转换（同一线程）
    .thenApplyAsync(user -> format(user))  // 异步转换（另一个线程）
    .thenCompose(name ->                   // flatMap（返回值是 CompletableFuture）
        CompletableFuture.supplyAsync(() -> enrichName(name))
    );
```

| 方法 | 入参 | 返回值 | 说明 |
|-----|------|-------|------|
| `thenApply` | `Function<T, U>` | `CompletableFuture<U>` | 转换结果（同步/map） |
| `thenAccept` | `Consumer<T>` | `CompletableFuture<Void>` | 消费结果 |
| `thenRun` | `Runnable` | `CompletableFuture<Void>` | 执行动作（不用结果） |
| `thenCompose` | `Function<T, CompletableFuture<U>>` | `CompletableFuture<U>` | flatMap |
| `thenCombine` | `CompletableFuture<U>, BiFunction<T,U,V>` | `CompletableFuture<V>` | 合并两个结果 |

> 所有方法都有 `Async` 后缀版本（如 `thenApplyAsync`），区别是是否使用异步线程执行。

#### 组合多个 CompletableFuture

```java
// allOf：等待所有完成
CompletableFuture<Void> all = CompletableFuture.allOf(cf1, cf2, cf3);
all.thenRun(() -> {
    // 所有任务完成后执行
    String r1 = cf1.join();
    String r2 = cf2.join();
    String r3 = cf3.join();
});

// anyOf：等待任意一个完成
CompletableFuture<Object> any = CompletableFuture.anyOf(cf1, cf2, cf3);
any.thenAccept(result -> {
    // 最快完成的那个结果
    System.out.println("First result: " + result);
});
```

#### 异常处理

```java
CompletableFuture<String> cf = CompletableFuture
    .supplyAsync(() -> {
        if (error) throw new RuntimeException("boom");
        return "ok";
    })
    // 方式一：exceptionally — 相当于 catch，返回降级值
    .exceptionally(ex -> {
        log.error("异常", ex);
        return "default";
    })
    // 方式二：handle — 同时处理正常和异常结果
    .handle((result, ex) -> {
        if (ex != null) return "fallback";
        return result.toUpperCase();
    })
    // 方式三：whenComplete — 不改变结果，只做副作用（如记录日志）
    .whenComplete((result, ex) -> {
        if (ex != null) log.error("失败", ex);
        else log.info("成功: {}", result);
    });
```

| 异常处理方法 | 能否恢复 | 入参 | 返回值 |
|------------|---------|------|-------|
| `exceptionally` | ✅ | 只有异常 | 降级值 |
| `handle` | ✅ | 结果 + 异常 | 新值 |
| `whenComplete` | ❌（透传原结果） | 结果 + 异常 | void |

### 10.2 实际应用场景

**场景：商品详情页聚合查询**

```java
public ProductDetail getProductDetail(Long productId) {
    // 三个查询并行
    CompletableFuture<Product> productCF = CompletableFuture
        .supplyAsync(() -> productService.getById(productId), ioExecutor);
    CompletableFuture<List<Review>> reviewCF = CompletableFuture
        .supplyAsync(() -> reviewService.getByProductId(productId), ioExecutor);
    CompletableFuture<Inventory> inventoryCF = CompletableFuture
        .supplyAsync(() -> inventoryService.getStock(productId), ioExecutor);
    
    // 等待全部完成，组装结果
    return CompletableFuture.allOf(productCF, reviewCF, inventoryCF)
        .thenApply(v -> {
            ProductDetail detail = new ProductDetail();
            detail.setProduct(productCF.join());
            detail.setReviews(reviewCF.join());
            detail.setInventory(inventoryCF.join());
            return detail;
        })
        .orTimeout(3, TimeUnit.SECONDS)  // JDK 9+ 超时控制
        .exceptionally(ex -> {
            log.error("商品详情查询失败", ex);
            return ProductDetail.DEFAULT;   // 降级
        })
        .join();
}
```

这个模式在电商和内容平台非常常见，核心要点是：将多个独立的 RPC/DB 查询并行化，通过 `allOf` 汇聚结果，配合超时和降级兜底。相比串行调用，总耗时从 `sum(各调用耗时)` 降为 `max(各调用耗时)`。

### 10.3 生产踩坑经验

**坑 1：默认线程池 ForkJoinPool.commonPool()**

```java
// ❌ 默认使用 ForkJoinPool.commonPool()
// 线程数 = CPU 核数 - 1，且所有未指定线程池的 CompletableFuture 共享
CompletableFuture.supplyAsync(() -> blockingIO());

// 如果大量任务都是 IO 密集型，commonPool 很快被打满
// 一个慢 IO 会阻塞其他所有 CompletableFuture 任务

// ✅ 为 IO 密集型任务创建专用线程池
ExecutorService ioExecutor = new ThreadPoolExecutor(
    20, 50, 60, TimeUnit.SECONDS,
    new LinkedBlockingQueue<>(1000),
    new ThreadFactoryBuilder().setNameFormat("io-pool-%d").build()
);
CompletableFuture.supplyAsync(() -> blockingIO(), ioExecutor);
```

**坑 2：join() vs get()**

```java
// join() 抛出非受检异常（CompletionException）
cf.join(); // 不需要 try-catch

// get() 抛出受检异常（ExecutionException, InterruptedException）
try { cf.get(); } catch (ExecutionException | InterruptedException e) { ... }

// 推荐：链式调用场景用 join()，需要处理中断的场景用 get(timeout)
```

**坑 3：异常链丢失**

```java
// ❌ exceptionally 中只打印了 message，丢失了原始堆栈
.exceptionally(ex -> {
    log.error("失败: " + ex.getMessage()); // 堆栈丢失！
    return null;
})

// ✅ 打印完整异常（注意：异常被包装为 CompletionException，真正原因在 getCause() 中）
.exceptionally(ex -> {
    Throwable cause = (ex instanceof CompletionException) ? ex.getCause() : ex;
    log.error("失败", cause);
    return null;
})
```

**坑 4：忘记处理异常导致静默失败**

```java
// ❌ 没有 exceptionally/handle/whenComplete，异常被吞掉
CompletableFuture.supplyAsync(() -> riskyOperation())
    .thenAccept(result -> process(result));
// 如果 riskyOperation 抛异常，thenAccept 不会执行，但也没有任何错误日志

// ✅ 始终在链末尾添加异常处理
CompletableFuture.supplyAsync(() -> riskyOperation())
    .thenAccept(result -> process(result))
    .exceptionally(ex -> { log.error("链路异常", ex); return null; });
```

### 10.4 面试追问点

> **Q1：`thenApply` 和 `thenCompose` 有什么区别？**
> A：类比 Stream 的 `map` 和 `flatMap`。`thenApply` 的 Function 返回普通值 `U`，结果是 `CompletableFuture<U>`；`thenCompose` 的 Function 返回 `CompletableFuture<U>`，结果也是 `CompletableFuture<U>`（而不是 `CompletableFuture<CompletableFuture<U>>`）。

> **Q2：`thenApply` 和 `thenApplyAsync` 在哪个线程执行？**
> A：`thenApply`：如果前一个阶段已经完成，则在**调用 thenApply 的线程**执行；如果前一个阶段未完成，则在**完成前一阶段的线程**执行。`thenApplyAsync`：始终在指定线程池（默认 ForkJoinPool.commonPool()）的线程中执行。生产环境建议统一使用 Async 版本以获得可预期的线程行为。

> **Q3：如何实现超时控制？**
> A：JDK 9 提供了 `orTimeout()` 和 `completeOnTimeout()`。JDK 8 中可以通过 `CompletableFuture.anyOf(task, timeoutFuture)` 来实现：
> ```java
> // JDK 8 超时方案
> CompletableFuture<String> timeout = new CompletableFuture<>();
> scheduler.schedule(() -> timeout.completeExceptionally(
>     new TimeoutException()), 3, TimeUnit.SECONDS);
> CompletableFuture.anyOf(actualTask, timeout)
>     .thenApply(r -> (String) r);
> ```

> **Q4：`allOf` 返回的是 `CompletableFuture<Void>`，如何优雅地获取所有结果？**
> A：可以封装一个工具方法：
> ```java
> public static <T> CompletableFuture<List<T>> allOfList(
>         List<CompletableFuture<T>> futures) {
>     return CompletableFuture.allOf(futures.toArray(new CompletableFuture[0]))
>         .thenApply(v -> futures.stream()
>             .map(CompletableFuture::join)
>             .collect(Collectors.toList()));
> }
> ```

---

## 总结：面试核心思维导图

```
并发编程
├── 线程管理
│   ├── 线程池 ThreadPoolExecutor（7参数、4拒绝策略、5状态）
│   └── CompletableFuture（异步编排、线程池选择）
├── 锁机制
│   ├── synchronized（锁升级：偏向→轻量→重量）
│   ├── ReentrantLock（公平/非公平、Condition）
│   └── AQS（state + CLH 队列，独占/共享模式）
├── 无锁并发
│   ├── CAS（Unsafe、cmpxchg、ABA 问题）
│   ├── Atomic 系列（AtomicInteger、LongAdder 分段）
│   └── volatile（可见性、有序性、内存屏障）
├── 并发工具
│   ├── CountDownLatch（一次性倒计时）
│   ├── CyclicBarrier（可复用屏障）
│   ├── Semaphore（限流信号量）
│   └── Phaser（分阶段同步）
├── 并发容器
│   └── ConcurrentHashMap（1.7 分段锁 vs 1.8 CAS+sync）
└── 线程隔离
    └── ThreadLocal（弱引用 key、内存泄漏、TTL）
```

> **面试心法**：回答并发问题时，始终围绕三个维度——**原子性、可见性、有序性**。任何并发方案的本质都是在解决这三者中的一个或多个问题。能说清"为什么需要"比"怎么用"更重要。面试官追问的本质是验证你是否真正理解底层原理，而不仅仅是会用 API。建议回答时采用"结论先行 → 原理解释 → 源码佐证 → 场景举例"的结构。

## 相关文章

- [java-interview-map](/posts/java/java-interview-map/)
