---
title: JVM 与性能调优深度面试手册
date: 2026-11-05
summary: 运行时数据区、JMM、GC 算法与收集器、调优参数、类加载、线上排查与 Arthas 实战。
interview: false
kind: handbook
---

> **适用对象**：3-5 年+ Java 开发者 | **目标**：应对阿里/美团/字节/腾讯等大厂深度追问
> 本手册按照 JVM 核心知识体系分为 8 大主题，每个知识点均包含：原理详解、方案对比、代码示例、生产踩坑、面试追问点。

---

## 一、JVM 内存模型（运行时数据区）

### 1.1 原理详解

JVM 运行时数据区（Runtime Data Areas）在 JVM 规范（JSR-269 / JVM Spec §2.5）中定义为五大区域：

**① 程序计数器（Program Counter Register）**

- 线程私有，占用极小内存，记录当前线程执行的字节码指令地址（`bytecodeInterpreter.cpp` 中的 `_pc` 字段）。
- 如果执行 Native 方法，计数器值为 `Undefined`。
- **唯一不会发生 OOM 的区域**。

**② Java 虚拟机栈（JVM Stack）**

- 线程私有，生命周期与线程相同。每个方法调用创建一个**栈帧（Stack Frame）**，内部包含：- **局部变量表（Local Variable Table）**：存放编译期可知的基本类型、对象引用（reference）、returnAddress。slot 复用机制：方法体内超出作用域的变量所占 slot 可被后续变量复用。
- **操作数栈（Operand Stack）**：基于栈的执行引擎核心，`iadd` 等指令从栈顶弹出操作数并压入结果。
- **动态链接（Dynamic Linking）**：持有指向运行时常量池中该栈帧所属方法引用的指针，支持运行时解析。
- **方法返回地址**：正常返回（`Normal Method Invocation Completion`）或异常返回（`Abrupt`）。

**③ 本地方法栈（Native Method Stack）**

- 为 Native 方法服务，HotSpot 中将本地方法栈和虚拟机栈合二为一。

**④ Java 堆（Heap）**

- 线程共享，JVM 管理的最大内存区域。所有对象实例和数组在此分配（JIT 逃逸分析后可能栈上分配）。
- **分代结构**：

```
┌──────────────────────── Java Heap ────────────────────────┐
│  Young Generation (1/3)    │     Old Generation (2/3)     │
│  ┌───────┬──────┬──────┐   │                              │
│  │ Eden  │  S0  │  S1  │   │         Tenured              │
│  │ (8/10)│(1/10)│(1/10)│   │                              │
│  └───────┴──────┴──────┘   │                              │
└────────────────────────────┴──────────────────────────────┘

```

- 默认 `Eden:S0:S1 = 8:1:1`（`-XX:SurvivorRatio=8`），`Young:Old = 1:2`（`-XX:NewRatio=2`）。
- TLAB（Thread-Local Allocation Buffer）：每个线程在 Eden 中预分配一小块私有缓冲区，避免分配时的锁竞争（CAS），通过 `-XX:+UseTLAB` 控制。

**⑤ 方法区（Method Area）/ 元空间（Metaspace）**

- JDK 7 及之前：永久代（PermGen）实现方法区，存放类元信息、常量池、静态变量。
- JDK 8+：**元空间（Metaspace）** 取代永久代，使用本地内存（Native Memory），不再受 `-XX:MaxPermSize` 限制，改用 `-XX:MaxMetaspaceSize`。
- 字符串常量池在 JDK 7 已移至堆中（`StringTable` 在堆中维护）。

**⑥ 直接内存（Direct Memory）**

- 不属于 JVM 运行时数据区，但频繁使用。`DirectByteBuffer` 通过 `Unsafe.allocateMemory()` 在堆外分配，NIO 中大量使用。
- 受 `-XX:MaxDirectMemorySize` 限制，默认等于 `-Xmx`。

### 1.2 内存溢出场景对比

| 溢出类型 | 触发场景 | 关键参数 | 典型报错信息 |
| --- | --- | --- | --- |
| StackOverflowError | 递归过深、大量局部变量 | `-Xss`（默认 512K~1M） | `java.lang.StackOverflowError` |
| OOM: Java heap space | 大对象/内存泄漏/缓存无限增长 | `-Xms` / `-Xmx` | `java.lang.OutOfMemoryError: Java heap space` |
| OOM: Metaspace | 动态生成大量类（CGLIB/反射） | `-XX:MaxMetaspaceSize` | `java.lang.OutOfMemoryError: Metaspace` |
| OOM: Direct buffer | NIO DirectByteBuffer 未释放 | `-XX:MaxDirectMemorySize` | `java.lang.OutOfMemoryError: Direct buffer memory` |
| OOM: GC overhead | GC 占用 98% 时间回收不到 2% 内存 | 自动检测 | `java.lang.OutOfMemoryError: GC overhead limit exceeded` |

### 1.3 代码示例：模拟各类 OOM

```java
// 1. 堆 OOM
public class HeapOOM {
    public static void main(String[] args) {
        // -Xms20m -Xmx20m -XX:+HeapDumpOnOutOfMemoryError
        List<byte[]> list = new ArrayList<>();
        while (true) {
            list.add(new byte[1024 * 1024]); // 每次 1MB
        }
    }
}

// 2. 栈溢出
public class StackSOF {
    private int depth = 0;
    public void recursion() {
        depth++;
        recursion();
    }
    public static void main(String[] args) {
        // -Xss256k
        StackSOF sof = new StackSOF();
        try { sof.recursion(); }
        catch (StackOverflowError e) {
            System.out.println("递归深度: " + sof.depth); // 约 2000~7000
        }
    }
}

// 3. Metaspace OOM
public class MetaspaceOOM {
    public static void main(String[] args) {
        // -XX:MaxMetaspaceSize=10m
        while (true) {
            Enhancer enhancer = new Enhancer();
            enhancer.setSuperclass(Object.class);
            enhancer.setUseCache(false);
            enhancer.setCallback((MethodInterceptor) (o, m, a, p) -> p.invokeSuper(o, a));
            enhancer.create(); // 不断生成新类
        }
    }
}

```

### 1.4 生产踩坑经验

**踩坑1：Metaspace 持续增长导致 Full GC**

- **现象**：线上服务运行一段时间后 Full GC 频繁，但堆内存正常。
- **根因**：Spring AOP + 反射大量动态生成代理类，`ClassLoader` 未被回收导致类元数据堆积。
- **解决**：设置 `-XX:MaxMetaspaceSize=256m` 限制上限 + 排查是否存在 ClassLoader 泄漏。

**踩坑2：DirectByteBuffer 导致进程被 OOM Killer 杀死**

- **现象**：Java 进程突然消失，`dmesg` 显示 OOM Killer。
- **根因**：Netty 使用大量 DirectByteBuffer，未设置 `MaxDirectMemorySize`，堆外内存无限增长。
- **解决**：显式设置 `-XX:MaxDirectMemorySize=512m`，并确保 `ByteBuf.release()` 被正确调用。

### 1.5 面试追问点

> **Q1：TLAB 的作用是什么？为什么要有 TLAB？** A：TLAB 是 Thread-Local Allocation Buffer，在 Eden 区为每个线程预分配一小块区域。对象分配时直接在 TLAB 上进行指针碰撞（Bump-the-Pointer），不需要全局锁/CAS，极大提高分配效率。TLAB 用完后才需要同步机制申请新 TLAB。

> **Q2：JDK 8 为什么用 Metaspace 替代 PermGen？** A：① PermGen 大小固定，容易 OOM，调参困难；② 字符串常量池在 PermGen 中导致内存浪费；③ PermGen 中的类卸载条件苛刻（ClassLoader 被回收、类无实例、Class 对象无引用）；④ Metaspace 使用本地内存，可以按需自动扩容，且内存回收与类卸载解耦更清晰。

> **Q3：对象一定分配在堆上吗？** A：不一定。JIT 编译器的**逃逸分析**（Escape Analysis, `-XX:+DoEscapeAnalysis` 默认开启）可以判断对象是否逃逸出方法/线程，如果未逃逸，可能进行**栈上分配**（实际 HotSpot 通过标量替换实现）或**锁消除**。

---

## 二、Java 内存模型（JMM）

### 2.1 原理详解

JMM（Java Memory Model，JSR-133）定义了线程与内存交互的抽象规范，核心目标是：**在保证多线程程序可见性、有序性、原子性的前提下，允许编译器/处理器做优化**。

**主内存与工作内存**

```
┌─────────┐       ┌─────────┐       ┌─────────┐
│ Thread A │       │ Thread B │       │ Thread C │
│ Working  │       │ Working  │       │ Working  │
│ Memory   │       │ Memory   │       │ Memory   │
└────┬─────┘       └────┬─────┘       └────┬─────┘
     │  read/load       │  read/load       │
     │  store/write     │  store/write     │
     ▼                  ▼                  ▼
┌──────────────────────────────────────────────────┐
│                  Main Memory                     │
│          (共享变量的"权威"副本)                     │
└──────────────────────────────────────────────────┘

```

JMM 定义了 8 种原子操作：`lock`, `unlock`, `read`, `load`, `use`, `assign`, `store`, `write`。

**happens-before 8 条规则**

| 规则 | 含义 |
| --- | --- |
| 1. 程序次序规则 | 同一线程中，按代码顺序，前面的操作 happens-before 后面的操作 |
| 2. 监视器锁规则 | unlock 操作 happens-before 后续对同一把锁的 lock 操作 |
| 3. volatile 变量规则 | volatile 写 happens-before 后续对同一 volatile 变量的读 |
| 4. 传递性规则 | 如果 A hb B，B hb C，则 A hb C |
| 5. 线程启动规则 | `Thread.start()` happens-before 该线程内的任意操作 |
| 6. 线程终止规则 | 线程中的所有操作 happens-before `Thread.join()` 返回 |
| 7. 线程中断规则 | `interrupt()` 调用 happens-before 被中断线程检测到中断 |
| 8. 对象终结规则 | 构造函数完成 happens-before `finalize()` 开始 |

### 2.2 volatile 的内存语义

volatile 的底层通过**内存屏障（Memory Barrier）**实现：

| 操作 | 屏障类型 | 作用 |
| --- | --- | --- |
| volatile 读之后 | LoadLoad + LoadStore | 禁止后续读写重排到 volatile 读之前 |
| volatile 写之前 | StoreStore | 禁止前面的写重排到 volatile 写之后 |
| volatile 写之后 | StoreLoad | 刷新写缓冲区，禁止后续读重排到 volatile 写之前（最重量级） |

在 x86 架构下，只需要在 volatile 写之后插入 `StoreLoad` 屏障（`lock addl $0x0, (%rsp)`），因为 x86 本身保证 `StoreStore`、`LoadLoad`、`LoadStore` 有序。

### 2.3 代码示例：DCL 单例与指令重排序

```java
public class Singleton {
    // 必须加 volatile！防止指令重排序
    private static volatile Singleton instance;

    public static Singleton getInstance() {
        if (instance == null) {                // 第一次检查（无锁）
            synchronized (Singleton.class) {
                if (instance == null) {        // 第二次检查（持锁）
                    instance = new Singleton(); // 关键：非原子操作
                }
            }
        }
        return instance;
    }
}

```

**为什么不加 volatile 会出问题？** `instance = new Singleton()` 字节码层面分三步：

1. `allocate memory`（分配内存）
2. `invokespecial <init>`（调用构造函数）
3. `astore`（将引用赋值给 instance）

编译器/处理器可能将步骤 2 和 3 重排序为 `1→3→2`，此时线程 B 在第一次检查时看到 `instance != null`，但对象尚未初始化完毕，导致使用到半初始化对象。

### 2.4 生产踩坑经验

**踩坑：volatile 数组的陷阱**

```java
volatile int[] arr = new int[10];
arr[0] = 1; // ⚠️ 这不是 volatile 写！

```

- `volatile` 只保证**引用本身**的可见性，不保证数组元素的可见性。
- 解决方案：使用 `AtomicIntegerArray` 或每次修改后重新赋值引用 `arr = arr`。

### 2.5 面试追问点

> **Q1：happens-before 与时间先后的关系？** A：happens-before 不等于时间上的先后。hb 是 JMM 的逻辑约束——A hb B 意味着 A 的执行结果对 B 可见。时间上 A 先于 B 执行，不一定 A hb B；反过来 A hb B 也不意味着 A 在时间上先执行（编译器可以重排只要不违反 hb 语义）。

> **Q2：volatile 能保证原子性吗？** A：不能。`volatile int count; count++` 不是原子操作（`getfield` → `iadd` → `putfield`）。需要 `AtomicInteger` 或 `synchronized`。volatile 只保证可见性和禁止重排序。

> **Q3：final 字段的内存语义？** A：JSR-133 规定，对 final 字段的写入（在构造函数内）以及对该 final 字段所引用对象的写入，在构造函数结束时都会插入 `StoreStore` 屏障，确保其他线程在看到对象引用时，final 字段一定是初始化完成的。这就是为什么"不要在构造函数中将 `this` 逸出"。

---

## 三、垃圾回收算法

### 3.1 原理详解

**对象存活判定**

| 算法 | 原理 | 优点 | 缺点 |
| --- | --- | --- | --- |
| 引用计数法 | 每个对象维护引用计数器，+1/-1 | 实时、实现简单 | **无法处理循环引用**；计数器维护开销 |
| 可达性分析 | 从 GC Roots 出发遍历对象图 | 能处理循环引用 | 需要 STW 或复杂的并发标记 |

**GC Roots 包括**：

- 虚拟机栈（栈帧中的局部变量表）中引用的对象
- 方法区中类静态属性引用的对象
- 方法区中常量引用的对象
- 本地方法栈中 JNI 引用的对象
- JVM 内部引用（如基本类型的 Class 对象、系统 ClassLoader）
- 所有被 synchronized 持有的对象
- JMXBean、JVMTI 注册的回调等

**三大垃圾回收算法**

**① 标记-清除（Mark-Sweep）**

```
标记前:  [ A ][ B ][ C ][ D ][ E ][ F ]
标记后:  [ A ][ × ][ C ][ × ][ E ][ × ]  (B/D/F 标记为垃圾)
清除后:  [ A ][   ][ C ][   ][ E ][   ]  (产生内存碎片！)

```

- **缺点**：内存碎片导致大对象分配失败，触发额外 GC。

**② 标记-复制（Mark-Copy）**

```
From 空间:  [ A ][ × ][ C ][ × ][ E ]
                  ↓ 将存活对象复制到 To 空间
To   空间:  [ A ][ C ][ E ]           (紧凑排列，无碎片)
然后 From 和 To 互换角色

```

- **优点**：无碎片、分配效率高（指针碰撞）。
- **缺点**：可用内存减半。适用于新生代（存活率低，复制开销小）。
- HotSpot 的 Eden + 2 个 Survivor 将"浪费"从 50% 降低到了 10%。

**③ 标记-整理（Mark-Compact）**

```
标记后:  [ A ][ × ][ C ][ × ][ E ]
整理后:  [ A ][ C ][ E ][         ]  (存活对象向一端移动)

```

- **优点**：无碎片。
- **缺点**：移动对象需要更新引用，必须 STW；开销高于 Mark-Sweep。
- 适用于老年代（存活率高，复制代价大）。

### 3.2 分代收集理论

基于两个假说：

1. **弱分代假说**：绝大多数对象都是朝生夕灭的 → 新生代用 Mark-Copy。
2. **强分代假说**：熬过多次 GC 的对象越难消亡 → 老年代用 Mark-Sweep 或 Mark-Compact。

**跨代引用问题**：老年代对象引用新生代对象，Minor GC 时不能只扫描新生代。

- 解决：**记忆集（Remembered Set）+ 卡表（Card Table）**。将老年代按 512 字节划分为"卡页"，如果某卡页中有对象引用新生代，将对应卡表项标记为 dirty。Minor GC 时只需扫描 dirty card 对应的区域，而非整个老年代。

### 3.3 面试追问点

> **Q1：为什么新生代用复制算法而不是标记-整理？** A：新生代对象存活率极低（经验值约 2%），复制的开销极小。而标记-整理需要两次遍历（标记+移动），且移动对象要更新所有引用，STW 时间更长。

> **Q2：什么是安全点（Safepoint）和安全区域（Safe Region）？** A：GC 发生前需要所有线程到达安全点才能 STW。安全点是字节码指令中"可被 GC 安全中断"的特定位置（如方法调用、循环回边、异常跳转）。对于 Sleep/Blocked 状态的线程，使用安全区域——在进入安全区域时标记自己，在离开安全区域前检查 GC 是否完成。

> **Q3：卡表的写屏障开销有多大？如何优化？** A：每次引用类型字段赋值都会触发写屏障（Write Barrier）更新卡表，大约增加 2-3 条指令的开销。JDK 7u4+ 引入了**条件卡表标记**（`-XX:+UseCondCardMark`）：先检查卡表项是否已经为 dirty，如果已经是 dirty 就不再写入，减少 false sharing（多核场景下多个线程频繁写同一 cache line 导致的性能下降）。

---

## 四、垃圾收集器

### 4.1 收集器全景对比

| 收集器 | 分代 | 算法 | 线程 | 特点 | 适用场景 |
| --- | --- | --- | --- | --- | --- |
| Serial | Young | Copy | 单线程 | 简单高效、STW | 客户端/小堆 |
| ParNew | Young | Copy | 多线程 | Serial 多线程版本 | 配合 CMS |
| Parallel Scavenge | Young | Copy | 多线程 | **吞吐量优先** | 后台批处理 |
| Serial Old | Old | Mark-Compact | 单线程 | CMS 失败后备 | 客户端 |
| Parallel Old | Old | Mark-Compact | 多线程 | 配合 Parallel Scavenge | 吞吐量优先 |
| **CMS** | Old | Mark-Sweep | 并发 | **低停顿** | Web 应用 |
| **G1** | 全堆 | Region + Copy/Compact | 并发 | **可控停顿** | 大堆（6G+） |
| **ZGC** | 全堆 | 染色指针 + 读屏障 | 并发 | **亚毫秒停顿** | 超大堆（TB 级） |
| Shenandoah | 全堆 | Brooks Pointer | 并发 | 类似 ZGC | OpenJDK |

### 4.2 CMS 详解

CMS（Concurrent Mark Sweep）四个阶段：

```
应用线程: ═══════╗        ╔═══════════════╗       ╔════════
                 ║        ║               ║       ║
GC线程:          ║  ┌─────╨───────┐  ┌────╨───┐  ║
           初始标记│  │  并发标记    │  │重新标记│  │并发清除│
           (STW) │  │(与应用并发)  │  │(STW)  │  │(并发)  │
                 ║  └─────────────┘  └────────┘  ║
                 ╚════════════════════════════════╝

```

1. **初始标记（Initial Mark）**：STW，仅标记 GC Roots 直接关联的对象，速度很快。
2. **并发标记（Concurrent Mark）**：与应用线程并发，从 GC Roots 遍历整个对象图。
3. **重新标记（Remark）**：STW，使用**增量更新（Incremental Update）**修正并发标记期间变化的引用。
4. **并发清除（Concurrent Sweep）**：与应用线程并发，清除标记为死亡的对象。

**CMS 的致命缺陷**：

- **CPU 敏感**：并发阶段占用 CPU（默认启动线程数 `(CPU+3)/4`），CPU 核少时影响应用。
- **浮动垃圾**：并发清除阶段产生的新垃圾只能下次 GC 处理，需要预留足够空间（`-XX:CMSInitiatingOccupancyFraction=75`）。
- **内存碎片**：Mark-Sweep 不整理内存。碎片严重时触发 `Concurrent Mode Failure`，退化为 Serial Old 进行 Full GC。

### 4.3 G1 详解

G1（Garbage First）将堆划分为大小相等的 **Region**（1~32MB，通常 2048 个），每个 Region 可以动态充当 Eden/Survivor/Old/Humongous。

```
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│  E  │  E  │  S  │  O  │  H  │  H  │  O  │  E  │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  O  │  O  │  E  │  S  │  O  │  O  │  E  │  O  │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  E  │  O  │  O  │  O  │  E  │  S  │  O  │  O  │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┴─────┘
E=Eden  S=Survivor  O=Old  H=Humongous

```

**Humongous Region**：大于 Region 50% 的对象直接分配在 Humongous Region（连续的多个 Region），在 Full GC 或 Concurrent Cycle 中回收。

**G1 的回收阶段**：

1. **Young GC**：所有 Eden Region 存活对象复制到 Survivor Region，年龄够了晋升到 Old。
2. **Mixed GC（核心）**：- 初始标记（STW，搭载在 Young GC 中）
- 并发标记（使用 **SATB 快照**）
- 最终标记（STW）
- 筛选回收（STW）：根据每个 Region 的**回收价值**（垃圾占比 × 回收耗时）排序，优先回收价值高的 Region，在用户指定的停顿时间内尽可能多收集。

**SATB（Snapshot-At-The-Beginning）**：

- 并发标记开始时对整个对象图打一个逻辑快照。
- 并发期间，所有引用删除操作都通过**写屏障（Write Barrier）**记录到 SATB 队列中。
- 最终标记阶段处理 SATB 队列，确保快照时存活的对象不会被错杀。
- 代价：可能产生浮动垃圾（快照时存活但后来死掉的对象，要下次回收）。

### 4.4 ZGC 详解

ZGC（Z Garbage Collector，JDK 11+）目标：**在任意堆大小下保持亚毫秒级停顿**。

**三大核心技术**：

**① 染色指针（Colored Pointers）** 在 64 位指针中借用 4 个 bit 存储 GC 元数据：

```
64位指针布局:
┌──────────┬───┬───┬───┬───┬──────────────────────────────────┐
│ unused   │ F │ R │ M1│ M0│        Object Address (42 bit)    │
│ (16 bit) │   │   │   │   │        支持 4TB 地址空间            │
└──────────┴───┴───┴───┴───┴──────────────────────────────────┘
F = Finalizable  R = Remapped  M1/M0 = Marked0/Marked1

```

**② 读屏障（Load Barrier）**

- 在每次从堆中加载对象引用时插入一段检查代码（类似 `if (ref.color != expected) slow_path()`）。
- 如果颜色不对（说明对象已被移动或正在标记中），触发 slow path 修正引用。
- 注意：这是**读屏障**而非写屏障，这是 ZGC 区别于 G1/CMS 的关键。

**③ 多重映射（Multi-Mapping）**

- 同一块物理内存通过 mmap 映射到三个虚拟地址（对应 Marked0、Marked1、Remapped 三个视图）。
- 不同阶段通过切换颜色位实现指针的"重着色"，不需要修改所有引用。

**ZGC 的 GC 阶段**（几乎全部并发）：

1. 暂停标记开始（STW，极短）
2. 并发标记
3. 暂停标记结束（STW，极短）
4. 并发转移准备（选择 Relocation Set）
5. 暂停转移开始（STW，极短）
6. 并发转移
7. 并发重映射（Concurrent Remap，可合并到下一次标记阶段）

### 4.5 三色标记法

并发标记的基础理论——三色标记（Tri-color Marking）：

| 颜色 | 含义 |
| --- | --- |
| **白色** | 尚未访问，GC 结束后仍为白色则回收 |
| **灰色** | 自身已访问，但子引用尚未全部扫描 |
| **黑色** | 自身和子引用全部扫描完成 |

**并发标记的问题——"对象消失"**： 当且仅当以下两个条件同时满足时，存活对象会被错误回收：

1. 赋值器插入了从黑色到白色的新引用
2. 赋值器删除了灰色到该白色对象的所有直接/间接引用

**两种解决方案**：

| 方案 | 原理 | 使用者 | 特点 |
| --- | --- | --- | --- |
| 增量更新（Incremental Update） | 记录新增的黑→白引用，重新标记时从这些黑色对象重新扫描 | CMS | 破坏条件 1 |
| 原始快照（SATB） | 记录删除的灰→白引用，将被删引用的对象标记为灰色 | G1, Shenandoah | 破坏条件 2 |

### 4.6 生产踩坑经验

**踩坑1：G1 的 Humongous 分配导致 Full GC**

- **现象**：G1 下 Full GC 频繁，但 Old 区使用率不高。
- **根因**：大量短生命周期的大对象（如序列化 buffer > Region/2）直接分配到 Humongous Region，只有在 Concurrent Cycle 或 Full GC 时才能回收。
- **解决**：增大 Region 大小（`-XX:G1HeapRegionSize=16m`），或优化业务减少大对象分配。JDK 8u60+ 可在 Young GC 时回收 Humongous（如果无引用）。

**踩坑2：CMS Concurrent Mode Failure**

- **现象**：GC 日志出现 `Concurrent Mode Failure`，停顿时间骤增。
- **根因**：并发清除期间老年代空间不足以容纳新晋升的对象，退化为 Serial Old。
- **解决**：降低 `CMSInitiatingOccupancyFraction`（如 68→60），让 CMS 更早触发；或者直接迁移到 G1。

### 4.7 面试追问点

> **Q1：G1 和 CMS 的核心区别？** A：① G1 是 Region 化分区收集，CMS 是传统分代；② G1 用 SATB，CMS 用增量更新；③ G1 可以做 Mixed GC 选择性回收价值高的 Region，CMS 只能整体回收老年代；④ G1 是 Mark-Copy/Compact，不产生碎片，CMS 是 Mark-Sweep，有碎片；⑤ G1 可以通过 `-XX:MaxGCPauseMillis` 指定期望停顿时间。

> **Q2：什么时候应该选择 ZGC 而不是 G1？** A：① 堆非常大（数十GB 到 TB 级别），G1 的停顿可能达到数百毫秒；② 对延迟极其敏感的系统（如量化交易、实时推荐），要求 p99 停顿 < 10ms；③ JDK 版本 ≥ 15（ZGC 在 JDK 15 中正式 production-ready）。注意 ZGC 的读屏障有约 4% 的吞吐量损耗。

> **Q3：为什么 ZGC 用读屏障而 G1/CMS 用写屏障？** A：G1/CMS 关注的是引用变更（写操作），通过写屏障记录引用变化来辅助并发标记和跨代引用维护。ZGC 需要在对象转移后修正指针（染色指针的颜色状态），这个修正发生在**加载引用**的时刻，因此必须用读屏障。读屏障使 ZGC 做到了完全并发的对象转移，无需 STW 修正所有指针。

---

## 五、GC 调优实战

### 5.1 常用 JVM 参数

```bash
# 堆大小（建议 -Xms == -Xmx 避免运行时扩容）
-Xms4g -Xmx4g

# 新生代大小
-XX:NewRatio=2              # Old:Young = 2:1
-XX:NewSize=1g -XX:MaxNewSize=1g   # 直接指定
-XX:SurvivorRatio=8         # Eden:S0:S1 = 8:1:1

# 收集器选择
-XX:+UseG1GC                # 使用 G1
-XX:MaxGCPauseMillis=200    # G1 目标停顿时间
-XX:G1HeapRegionSize=8m     # Region 大小（1~32MB，必须 2 的幂）

# CMS 相关（JDK 8）
-XX:+UseConcMarkSweepGC
-XX:CMSInitiatingOccupancyFraction=75
-XX:+UseCMSCompactAtFullCollection
-XX:CMSFullGCsBeforeCompaction=5

# Metaspace
-XX:MetaspaceSize=256m      # 初始阈值（达到时触发 Full GC）
-XX:MaxMetaspaceSize=512m

# GC 日志（JDK 8）
-XX:+PrintGCDetails -XX:+PrintGCDateStamps
-XX:+PrintHeapAtGC -Xloggc:/path/to/gc.log

# GC 日志（JDK 9+，统一日志框架）
-Xlog:gc*:file=gc.log:time,uptime,level,tags:filecount=10,filesize=100m

# OOM 自动 Dump
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/path/to/dumps/

```

### 5.2 GC 日志分析

典型 G1 GC 日志：

```
[2024-01-15T10:30:15.123+0800] GC(42) Pause Young (Normal) (G1 Evacuation Pause)
[2024-01-15T10:30:15.123+0800] GC(42)   Eden regions: 24->0(24)
[2024-01-15T10:30:15.123+0800] GC(42)   Survivor regions: 3->3(4)
[2024-01-15T10:30:15.123+0800] GC(42)   Old regions: 18->20
[2024-01-15T10:30:15.123+0800] GC(42)   Humongous regions: 2->1
[2024-01-15T10:30:15.123+0800] GC(42) Pause Young (Normal) 188M->95M(512M) 12.345ms

```

**关键指标**：

- `Eden regions: 24->0`：Young GC 回收了所有 Eden Region。
- `Old regions: 18->20`：老年代增加了 2 个 Region（对象晋升）。
- `188M->95M(512M) 12.345ms`：堆使用从 188M 降到 95M，总堆 512M，耗时 12.345ms。

### 5.3 Full GC 频繁排查思路

```
Full GC 频繁排查流程:

1. 查看 GC 日志
   ├─ Full GC 原因是什么？
   │   ├─ Metadata GC Threshold → Metaspace 不足
   │   ├─ Allocation Failure → 堆空间不足
   │   ├─ Ergonomics → 自适应策略触发
   │   └─ System.gc() → 代码显式调用
   │
2. 分析堆内存
   ├─ GC 后老年代是否释放？
   │   ├─ 释放很少 → 内存泄漏，需要 dump 分析
   │   └─ 释放很多 → 对象晋升太快 / 老年代太小
   │
3. 进一步定位
   ├─ jmap -histo:live <pid> → 查看对象分布
   ├─ jmap -dump:live,format=b,file=heap.hprof <pid>
   └─ MAT 分析 → Dominator Tree → Leak Suspects

```

### 5.4 代码示例：模拟内存泄漏

```java
public class MemoryLeakDemo {
    // 经典泄漏场景：静态集合持有对象引用
    private static final Map<String, byte[]> cache = new HashMap<>();

    public void processRequest(String key) {
        byte[] data = new byte[1024 * 1024]; // 1MB
        cache.put(key, data);
        // 忘记移除！每次请求都在增长
    }

    // 修复方案1：使用 LRU 缓存
    private static final Map<String, byte[]> lruCache =
        new LinkedHashMap<>(16, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<String, byte[]> e) {
                return size() > 100;
            }
        };

    // 修复方案2：使用 WeakReference
    private static final Map<String, WeakReference<byte[]>> weakCache =
        new ConcurrentHashMap<>();
}

```

### 5.5 生产踩坑经验

**踩坑1：System.gc() 引发的 Full GC**

- **现象**：定期出现 Full GC，且 GC 日志中原因为 `System.gc()`。
- **根因**：NIO 框架或第三方库调用了 `System.gc()` 来触发 DirectByteBuffer 的回收（`Bits.reserveMemory()` 中调用）。
- **解决**：`-XX:+DisableExplicitGC` 禁止显式 GC，但需要确保 DirectByteBuffer 有其他回收机制；或使用 `-XX:+ExplicitGCInvokesConcurrent` 让显式 GC 走并发回收（CMS/G1）。

**踩坑2：新生代过小导致频繁 Young GC 和过早晋升**

- **现象**：Young GC 每秒数十次，老年代增长快，很快触发 Full GC。
- **根因**：默认 `NewRatio=2` 在大堆场景下新生代可能只有 1~2G，分配速度快于回收。
- **解决**：增大新生代（`-XX:NewSize=2g -XX:MaxNewSize=2g`）或让 G1 自动管理。

### 5.6 面试追问点

> **Q1：线上服务 Full GC 频繁，你的排查步骤？** A：① 首先看 GC 日志确认 Full GC 频率和原因；② `jstat -gcutil <pid> 1000` 观察各区域使用率变化趋势；③ 如果老年代回收后占用仍然很高，说明有泄漏，用 `jmap -dump` 导出堆快照；④ 用 MAT/VisualVM 打开 dump，查看 Dominator Tree 找到占用内存最大的对象，通过 GC Roots 引用链定位泄漏代码；⑤ 如果老年代回收后占用正常，可能是新生代太小导致过多对象直接晋升，调大新生代或降低晋升年龄阈值。

> **Q2：**`-XX:MetaspaceSize=256m`** 的含义是什么？是初始大小吗？** A：不是初始大小！`MetaspaceSize` 是第一次触发 Full GC 的阈值（高水位线）。Metaspace 初始大小由 JVM 动态决定（通常 20MB 左右），当使用量达到 `MetaspaceSize` 时触发 Full GC 并调整阈值。`MaxMetaspaceSize` 才是硬上限。

> **Q3：**`-Xms`** 和 **`-Xmx`** 为什么建议设成一样？** A：① 避免堆的动态扩缩容导致额外的 Full GC（扩容前先 GC 尝试释放空间）；② 减少 OS 的内存分配/回收开销；③ 避免因内存不足时才扩容导致的延迟抖动。生产环境几乎总是设为相同值。

---

## 六、类加载机制

### 6.1 类的生命周期

```
加载(Loading) → 验证(Verification) → 准备(Preparation) → 解析(Resolution) → 初始化(Initialization)
                 └─────────────── 连接(Linking) ──────────────┘
→ 使用(Using) → 卸载(Unloading)

```

**各阶段详解**：

| 阶段 | 核心动作 | 关键细节 |
| --- | --- | --- |
| **加载** | 读取 .class 二进制流 → Class 对象 | 可以从 JAR/网络/动态生成（Proxy）等获取 |
| **验证** | 文件格式/元数据/字节码/符号引用验证 | 确保不会危害 JVM，`CAFEBABE` 魔数检查 |
| **准备** | 为**类变量**分配内存并设零值 | `static int a = 123` 此时 `a = 0`，而非 123；`static final int b = 123` 此时 `b = 123`（编译期常量直接赋值） |
| **解析** | 符号引用 → 直接引用 | `CONSTANT_Class_info` → 内存地址 |
| **初始化** | 执行 `<clinit>()` 方法 | 收集所有类变量赋值 + static 块，保证**多线程安全**（JVM 加锁） |

`<clinit>()`** 的线程安全性**——这是**枚举单例**和**静态内部类单例**线程安全的根本保障：

```java
// 利用类加载机制实现线程安全的延迟初始化
public class Singleton {
    private Singleton() {}
    private static class Holder {
        static final Singleton INSTANCE = new Singleton();
        // <clinit>() 由 JVM 保证只执行一次且线程安全
    }
    public static Singleton getInstance() {
        return Holder.INSTANCE; // 触发 Holder 类的初始化
    }
}

```

### 6.2 双亲委派模型

```
                    ┌───────────────────────┐
                    │ Bootstrap ClassLoader  │  加载 $JAVA_HOME/lib
                    │   (C++ 实现, null)     │  rt.jar, resources.jar 等
                    └───────────┬───────────┘
                                │ parent
                    ┌───────────┴───────────┐
                    │ Extension ClassLoader  │  加载 $JAVA_HOME/lib/ext
                    │ (ExtClassLoader)       │  JDK 9+: PlatformClassLoader
                    └───────────┬───────────┘
                                │ parent
                    ┌───────────┴───────────┐
                    │ Application ClassLoader│  加载 classpath
                    │ (AppClassLoader)       │
                    └───────────┬───────────┘
                                │ parent
                    ┌───────────┴───────────┐
                    │  Custom ClassLoader    │  用户自定义
                    └───────────────────────┘

```

**双亲委派的核心逻辑**（`ClassLoader.loadClass()`）：

```java
protected Class<?> loadClass(String name, boolean resolve) throws ClassNotFoundException {
    synchronized (getClassLoadingLock(name)) {
        // 1. 检查是否已加载
        Class<?> c = findLoadedClass(name);
        if (c == null) {
            try {
                // 2. 委派给父加载器
                if (parent != null) {
                    c = parent.loadClass(name, false);
                } else {
                    c = findBootstrapClassOrNull(name);
                }
            } catch (ClassNotFoundException e) { }
            if (c == null) {
                // 3. 父加载器无法加载，自己尝试
                c = findClass(name);
            }
        }
        if (resolve) { resolveClass(c); }
        return c;
    }
}

```

**为什么需要双亲委派？**

- **安全性**：防止用户自定义 `java.lang.String` 替换核心类。
- **唯一性**：确保同一个类只被加载一次（同一个 ClassLoader + 全限定类名确定唯一性）。

### 6.3 打破双亲委派的场景

| 场景 | 方式 | 原因 |
| --- | --- | --- |
| **SPI ServiceLoader** | Thread Context ClassLoader | Bootstrap CL 加载的接口（如 JDBC `Driver`）需要加载 classpath 中的实现类，但 Bootstrap CL 看不到 classpath |
| **OSGi** | 网状类加载器 | 模块化要求不同 Bundle 使用不同版本的同一类 |
| **Tomcat** | 自定义 WebappClassLoader | 每个 Web 应用需要隔离（同名类可以共存），且 JSP 热替换 |
| **热部署** | 自定义 ClassLoader | 抛弃旧 ClassLoader，创建新的重新加载修改后的类 |

### 6.4 Tomcat 类加载器架构

```
                Bootstrap ClassLoader
                        │
                Extension ClassLoader
                        │
                Application ClassLoader
                        │
                ┌───────┴───────┐
                │   Common CL   │  (Tomcat 和所有 WebApp 共享, lib/)
                ├───────┬───────┤
                │       │       │
            Catalina  Shared   │
               CL       CL    │
                        │      │
                   ┌────┴────┐ │
                   │         │ │
                WebApp1    WebApp2    ← 每个 WebApp 独立 CL
                  CL         CL        先自己加载，再委派给父加载器（打破双亲委派）
                   │
                  Jsp CL              ← JSP 热替换：每个 JSP 一个 CL，修改后丢弃重建

```

**Tomcat 的 WebappClassLoader 加载顺序**：

1. 先检查是否已加载
2. 尝试使用 Bootstrap CL（防止覆盖核心类）
3. **先自己加载**（打破双亲委派！`/WEB-INF/classes` 和 `/WEB-INF/lib`）
4. 委派给父加载器

### 6.5 生产踩坑经验

**踩坑：不同 ClassLoader 导致的 ClassCastException**

- **现象**：两个看起来相同的类在类型转换时抛 `ClassCastException`。
- **根因**：同一个类被不同的 ClassLoader 加载了两次，JVM 认为它们是不同的类型。
- **常见场景**：热部署框架中旧 ClassLoader 加载的对象传递给新 ClassLoader 加载的代码。
- **解决**：确保接口/父类由公共的父 ClassLoader 加载；避免在 ClassLoader 边界传递具体实现类实例。

### 6.6 面试追问点

> **Q1：同一个类被不同 ClassLoader 加载，它们相等吗？** A：不相等。`instanceof`、`isAssignableFrom()`、`equals()` 都返回 false。类的唯一性由**全限定名 + 类加载器**共同确定。这就是为什么 Tomcat 中不同 WebApp 可以使用不同版本的同一个库。

> **Q2：JDBC 是怎么打破双亲委派的？** A：`java.sql.DriverManager` 由 Bootstrap CL 加载，但需要加载 classpath 下的驱动实现（如 `com.mysql.cj.jdbc.Driver`）。它通过 `Thread.currentThread().getContextClassLoader()` 获取线程上下文类加载器（默认是 AppClassLoader），然后用这个 CL 通过 `ServiceLoader.load(Driver.class)` 加载 `META-INF/services/java.sql.Driver` 中配置的实现类。

> **Q3：类的初始化时机有哪些？（5 种主动引用）** A：① `new`/`getstatic`/`putstatic`/`invokestatic`（访问/设置静态字段、调用静态方法）；② 反射调用（`Class.forName()`）；③ 子类初始化前先初始化父类；④ `main` 方法所在类；⑤ JDK 7+ `MethodHandle` 解析的 `REF_getStatic` 等。注意：`SubClass.parentStaticField` 只会触发父类初始化，不会触发子类初始化。

---

## 七、线上问题排查

### 7.1 CPU 飙高排查（经典五步法）

```bash
# Step 1: 找到 CPU 最高的 Java 进程
top -c    # 找到 PID，假设是 12345

# Step 2: 找到该进程中 CPU 最高的线程
top -Hp 12345    # 找到线程 TID，假设是 12378

# Step 3: 将线程 ID 转为 16 进制
printf "%x\n" 12378    # 输出 305a

# Step 4: 导出线程栈
jstack 12345 > thread_dump.txt

# Step 5: 搜索线程 ID
grep -A 30 "nid=0x305a" thread_dump.txt

```

**常见 CPU 飙高原因**：

| 原因 | 特征 | 解决方案 |
| --- | --- | --- |
| 死循环 | 某线程持续 RUNNABLE，栈顶不变 | 检查循环退出条件 |
| 频繁 GC | GC 线程占用高 CPU | 排查内存问题 |
| 正则回溯 | `java.util.regex` 栈帧 | 优化正则表达式，避免贪婪匹配嵌套 |
| 锁竞争激烈 | 大量线程 BLOCKED | 减少锁粒度 / 使用无锁结构 |
| 序列化/反序列化 | JSON/Protobuf 大对象 | 优化对象大小，使用流式解析 |

### 7.2 OOM 排查

```bash
# 1. 启动参数（提前配置！）
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/data/dumps/
-XX:OnOutOfMemoryError="kill -9 %p"  # 可选：OOM 后自动重启

# 2. 手动 dump（线上慎用，会 STW）
jmap -dump:live,format=b,file=heap.hprof <pid>

# 3. MAT 分析关键步骤
# Leak Suspects Report → 查看可疑点
# Dominator Tree → 按 Retained Heap 排序，找到占用最大的对象
# Path to GC Roots → exclude weak/soft references → 找到泄漏链路
# OQL 查询: SELECT * FROM java.util.HashMap WHERE size > 10000

```

**MAT 核心概念**：

- **Shallow Heap**：对象自身占用的内存（对象头 + 字段）。
- **Retained Heap**：对象被回收后能释放的总内存（包括其独占引用的子对象）。
- **Dominator Tree**：支配树，展示对象间的"支配"关系，Retained Heap 大的对象是重点排查目标。

### 7.3 Arthas 常用命令

```bash
# 安装并附着到目标进程
java -jar arthas-boot.jar

# 1. dashboard - 全局概览
dashboard
# 实时查看线程、内存、GC 信息

# 2. thread - 线程分析
thread          # 列出所有线程
thread -n 3     # CPU 使用率 Top 3 线程
thread -b       # 查找阻塞其他线程的线程（死锁检测）
thread <id>     # 查看指定线程栈

# 3. watch - 方法监控（最常用！）
watch com.example.UserService getUser '{params, returnObj, throwExp}' -n 5 -x 3
# 监控 getUser 方法的入参、返回值、异常，打印 5 次，对象展开 3 层

# 4. trace - 方法调用链路耗时
trace com.example.UserService getUser '#cost > 100'
# 只输出耗时超过 100ms 的调用，展示内部调用链路及各环节耗时

# 5. stack - 调用来源追踪
stack com.example.dao.UserMapper selectById
# 查看 selectById 被谁调用的（反向追踪调用链）

# 6. jad - 反编译
jad com.example.UserService
# 线上确认代码版本是否正确（排除部署问题）

# 7. sc/sm - 搜索类和方法
sc -d com.example.UserService    # 查看类的详细信息（ClassLoader、jar 位置）
sm com.example.UserService *     # 列出所有方法

# 8. heapdump - 内存快照
heapdump /tmp/heap.hprof

```

### 7.4 代码示例：线上死锁排查

```java
// 死锁示例
public class DeadlockDemo {
    private static final Object lockA = new Object();
    private static final Object lockB = new Object();

    public static void main(String[] args) {
        new Thread(() -> {
            synchronized (lockA) {
                try { Thread.sleep(100); } catch (Exception e) {}
                synchronized (lockB) { System.out.println("Thread-1"); }
            }
        }, "Thread-1").start();

        new Thread(() -> {
            synchronized (lockB) {
                try { Thread.sleep(100); } catch (Exception e) {}
                synchronized (lockA) { System.out.println("Thread-2"); }
            }
        }, "Thread-2").start();
    }
}

```

```bash
# jstack 输出中会明确提示死锁
$ jstack <pid>
Found one Java-level deadlock:
=============================
"Thread-1":
  waiting to lock monitor 0x00007f8b4c003f08 (object 0x000000076ab2c6d0, a java.lang.Object),
  which is held by "Thread-2"
"Thread-2":
  waiting to lock monitor 0x00007f8b4c006358 (object 0x000000076ab2c6c0, a java.lang.Object),
  which is held by "Thread-1"

```

### 7.5 生产踩坑经验

**踩坑1：正则表达式回溯导致 CPU 100%**

- **现象**：某个接口偶现超时，CPU 飙高，jstack 显示线程卡在 `java.util.regex.Pattern$GroupHead.match`。
- **根因**：正则 `(a+)+b` 类型的嵌套量词遇到不匹配的输入时产生指数级回溯（灾难性回溯）。
- **解决**：① 重写正则避免嵌套量词；② 使用占有量词 `(a++)+b` 或原子组；③ 设置匹配超时（Java 无内置支持，需要外部线程控制）；④ 对用户输入做长度限制。

**踩坑2：线程池任务堆积导致 OOM**

- **现象**：服务 OOM，dump 分析发现大量 `LinkedBlockingQueue$Node`。
- **根因**：使用 `Executors.newFixedThreadPool()`，其默认队列是无界的 `LinkedBlockingQueue`，请求量远超处理能力时任务无限堆积。
- **解决**：自定义 `ThreadPoolExecutor`，使用有界队列，配置合理的拒绝策略。

### 7.6 面试追问点

> **Q1：线上服务响应变慢，怎么排查？** A：分层排查——① 先看监控指标（CPU/Memory/GC/网络/磁盘 IO）确定瓶颈层面；② CPU 高则按 CPU 排查流程；③ GC 频繁则看 GC 日志；④ 都正常则看线程 dump，是否有大量 BLOCKED/WAITING（锁竞争/数据库连接池耗尽/远程调用超时）；⑤ 用 Arthas trace 定位到具体慢方法。

> **Q2：生产环境可以直接用 jmap -dump 吗？** A：非常慎用！`jmap -dump` 触发 Full GC 并 STW，堆越大停顿越久（8G 堆可能 STW 十几秒）。建议：① 提前配置 `-XX:+HeapDumpOnOutOfMemoryError`；② 如果必须手动 dump，先摘流量；③ 考虑使用 `gcore` 生成 core dump 再离线转换为 hprof，或用 Arthas 的 `heapdump`。

> **Q3：Arthas 的 watch 和 trace 命令在生产环境有风险吗？** A：有一定风险。① watch/trace 通过字节码增强（ASM）在运行时修改类的字节码，如果条件表达式写错可能抛异常影响业务；② 高并发方法如果输出量大会影响性能；③ 建议使用 `-n` 限制输出次数，使用条件表达式过滤，操作完立即 `reset` 恢复字节码。

---

## 八、对象内存布局

### 8.1 原理详解

HotSpot 中，一个 Java 对象在堆中的内存布局分为三部分：

```
┌──────────────────────────────────────────────┐
│              对象头 (Object Header)            │
│  ┌────────────────────────────────────────┐  │
│  │         Mark Word (8 bytes / 64bit)     │  │  ← 存储 hashCode、GC 年龄、锁状态
│  ├────────────────────────────────────────┤  │
│  │     Klass Pointer (4 bytes 压缩/8 bytes) │  │  ← 指向类元数据
│  ├────────────────────────────────────────┤  │
│  │   [Array Length] (4 bytes, 仅数组对象)    │  │
│  └────────────────────────────────────────┘  │
├──────────────────────────────────────────────┤
│            实例数据 (Instance Data)            │
│     字段按类型宽度排列，相同宽度的归类存放        │
│     分配策略: long/double → int/float          │
│              → short/char → byte/boolean       │
│              → oops (对象引用)                  │
├──────────────────────────────────────────────┤
│            对齐填充 (Padding)                  │
│     保证对象大小是 8 字节的整数倍                │
└──────────────────────────────────────────────┘

```

### 8.2 Mark Word 详解（64 位 JVM）

Mark Word 是对象头中最复杂的部分，其内容随锁状态变化而变化：

| 锁状态 | 存储内容 | 标志位 |
| --- | --- | --- |
| **无锁** | `unused:25 | hashCode:31 | unused:1 | age:4 | biased_lock:0 | lock:01` | `01` |
| **偏向锁** | `thread:54 | epoch:2 | unused:1 | age:4 | biased_lock:1 | lock:01` | `01` |
| **轻量级锁** | `ptr_to_lock_record:62 | lock:00` | `00` |
| **重量级锁** | `ptr_to_heavyweight_monitor:62 | lock:10` | `10` |
| **GC 标记** | 空（用于 GC 转移） | `11` |

**锁升级过程**：

```
无锁 → 偏向锁 → 轻量级锁 → 重量级锁
     (单线程)  (CAS 自旋)  (OS 互斥量)
     不可逆（JDK 15 默认禁用偏向锁: -XX:-UseBiasedLocking）

```

**偏向锁**：第一个获取锁的线程将其 Thread ID 写入 Mark Word，后续该线程进入/退出同步块不需要 CAS，只需检查 Mark Word 中的 Thread ID 是否一致。

**轻量级锁**：竞争时，线程在栈帧中创建 Lock Record，用 CAS 将 Mark Word 替换为指向 Lock Record 的指针。如果 CAS 失败，先自旋（自适应自旋），自旋超过阈值则膨胀为重量级锁。

**重量级锁**：基于操作系统的 Mutex Lock 实现（`ObjectMonitor` in `objectMonitor.cpp`），包含 `_owner`（持锁线程）、`_EntryList`（阻塞队列）、`_WaitSet`（等待队列），涉及用户态/内核态切换。

### 8.3 代码示例：使用 JOL 查看对象布局

```java
// 依赖：org.openjdk.jol:jol-core:0.16
import org.openjdk.jol.info.ClassLayout;

public class ObjectLayoutDemo {
    private boolean flag;    // 1 byte
    private int count;       // 4 bytes
    private long timestamp;  // 8 bytes
    private String name;     // 4 bytes (压缩指针)

    public static void main(String[] args) {
        ObjectLayoutDemo obj = new ObjectLayoutDemo();
        System.out.println(ClassLayout.parseInstance(obj).toPrintable());
    }
}
/*
输出示例 (64-bit, 开启压缩指针):
OFF  SZ      TYPE DESCRIPTION              VALUE
  0   8           (object header: Mark Word)  0x0000000000000001 (无锁)
  8   4           (object header: Klass Ptr)  0x00c05808
 12   4       int ObjectLayoutDemo.count     0
 16   8      long ObjectLayoutDemo.timestamp 0
 24   1   boolean ObjectLayoutDemo.flag      false
 25   3           (alignment gap)
 28   4    String  ObjectLayoutDemo.name      null
 32   0           (object size = 32 bytes, 无需额外 padding)
*/

```

### 8.4 实例数据大小计算

| 类型 | 大小 | 备注 |
| --- | --- | --- |
| boolean / byte | 1 byte |  |
| short / char | 2 bytes |  |
| int / float | 4 bytes |  |
| long / double | 8 bytes |  |
| 对象引用 (oops) | 4 bytes (压缩) / 8 bytes | `-XX:+UseCompressedOops` 默认开启 |
| 对象头 | 12 bytes (压缩) / 16 bytes | Mark Word 8B + Klass Ptr 4B/8B |

**一个空 Object 占多少内存？**

- 对象头 12 bytes + 对齐填充 4 bytes = **16 bytes**。

**一个 **`new Integer(1)`** 占多少内存？**

- 对象头 12 bytes + int 字段 4 bytes = 16 bytes。
- 对比基本类型 `int` 只占 4 bytes → 这就是为什么高性能场景要避免装箱。

### 8.5 生产踩坑经验

**踩坑1：Boolean 数组比预期大很多**

- `boolean[]` 中每个元素实际占 1 byte（而非 1 bit）。100 万个 boolean 占约 1MB 而非 125KB。
- 解决：使用 `BitSet`（底层用 `long[]`，每 bit 一个 boolean）。

**踩坑2：指针压缩陷阱**

- 堆 ≤ 32GB 时默认开启压缩指针（`-XX:+UseCompressedOops`），引用占 4 bytes。
- 堆 > 32GB 时压缩指针失效，引用变 8 bytes，**所有对象引用字段都增大**。
- 所以 `-Xmx` 从 31G 增加到 33G 时，实际可用堆可能反而减少！建议堆大小控制在 32GB 以内或直接拉大到 48GB+。

**踩坑3：偏向锁导致 STW**

- JDK 15 之前默认开启偏向锁，但偏向锁的撤销需要在安全点执行（STW）。
- 在大量短生命周期锁竞争的场景（如连接池），频繁的偏向锁撤销反而增加停顿。
- 解决：`-XX:-UseBiasedLocking` 关闭偏向锁（JDK 15+ 默认关闭）。

### 8.6 面试追问点

> **Q1：synchronized 锁升级的完整过程？** A：① **无锁** → ② **偏向锁**：第一个线程进入同步块，CAS 将 Thread ID 写入 Mark Word → ③ **轻量级锁**：第二个线程竞争，偏向锁撤销（等待安全点），两个线程都创建 Lock Record 并 CAS 竞争 → ④ **重量级锁**：CAS 自旋超过阈值（自适应：成功过则多旋，失败过则少旋甚至直接膨胀），膨胀为 ObjectMonitor，未获锁线程进入 _EntryList 阻塞。**锁只能升级不能降级**（为了简化实现和 GC 安全）。

> **Q2：对齐填充的意义是什么？** A：① **硬件效率**：CPU 按 cache line（通常 64 bytes）读取内存，8 字节对齐可以减少跨 cache line 读取；② **压缩指针**：`UseCompressedOops` 利用对齐补零，将 35 位地址右移 3 位存入 32 位，左移回来恢复原始地址，正因为对象都是 8 字节对齐的所以低 3 位一定为 0。

> **Q3：**`hashCode()`** 和偏向锁的冲突？** A：无锁状态的 Mark Word 存储 hashCode（首次调用 `hashCode()` 或 `System.identityHashCode()` 后写入），偏向锁状态的 Mark Word 存储 Thread ID，两者共用同一空间。因此：① 如果对象已计算过 hashCode（identity hash），则无法进入偏向锁状态，直接走轻量级锁；② 如果处于偏向锁状态时调用 hashCode，偏向锁会被撤销并膨胀为重量级锁（因为轻量级锁的 Lock Record 也没有空间存 hashCode，只有 ObjectMonitor 有字段存储）。

---

## 附录：高频面试速查表

| 问题 | 核心回答要点 |
| --- | --- |
| JVM 内存区域划分 | 5 大区域 + 直接内存，重点区分线程私有/共享 |
| JDK 8 内存变化 | 永久代→元空间（本地内存），字符串常量池→堆 |
| GC Roots 有哪些 | 栈引用、静态属性、常量、JNI、synchronized、系统类 |
| CMS 四阶段 | 初始标记(STW)→并发标记→重新标记(STW)→并发清除 |
| G1 核心特性 | Region 化、Mixed GC、SATB、可控停顿、无碎片 |
| ZGC 核心技术 | 染色指针 + 读屏障 + 多重映射，亚毫秒停顿 |
| 类加载双亲委派 | 自底向上委托，自顶向下尝试，保证安全性和唯一性 |
| 打破双亲委派 | SPI/Tomcat/OSGi/热部署，重写 findClass 而非 loadClass |
| 对象内存布局 | 对象头(Mark Word + Klass) + 实例数据 + 对齐填充 |
| 锁升级过程 | 无锁→偏向锁→轻量级锁→重量级锁，不可降级 |
| CPU 飙高排查 | top→top -Hp→printf hex→jstack→grep nid |
| OOM 排查 | HeapDump→MAT→Dominator Tree→GC Roots 引用链 |

---

> **最后忠告**：JVM 面试不是背概念，面试官追问的本质是考察你的**系统性思维**和**实战经验**。每个知识点都要想清楚：它解决了什么问题？为什么这样设计？有什么权衡？你在项目中遇到过什么相关问题？

## 相关文章

- [jvm-knowledge-map](/posts/java/jvm-knowledge-map/)
