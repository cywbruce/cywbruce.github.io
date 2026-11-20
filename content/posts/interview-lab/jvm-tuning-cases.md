---
title: "JVM 调优案例集面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "调优方法论、OOM 全家桶、GC 诊断与真实案例排查（经验区分器）。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套**线上问题驱动**的递进问题，把候选人真实的"排查与调优决策能力"问出来——不是考 GC 原理背诵，而是考"线上报警了，你到底怎么做"。
> 核心原则：**每一道调优题最终都落到"现象 → 观测数据 → 定位根因 → 干预手段 → 验证闭环"这条主线**。只会背 `-XX` 参数却讲不出排查路径与验证方法的人，基本停留在配置记忆层。
> 配套：本题库与《Java JVM 与 GC 面试题库》（讲内存区域/对象布局/收集器原理）、AQS / ThreadLocal / ThreadPoolExecutor 共同构成"Java 内功面试定级体系"。**本套聚焦"怎么诊断、怎么调、调完怎么验证"**，原理只作背景一句带过，不与原理题重复。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题（调优方法论）](#part-1)
- [Part 2：底层原理题（与调优决策相关的原理）](#part-2)
- [Part 3：核心区分度题（题眼，定级主战场）](#part-3)
- [Part 4：实战与陷阱题（案例驱动）](#part-4)
- [Part 5：2026 新趋势](#part-5)
- [Part 6：能否用调优案例定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：线上 JVM 报警（OOM / GC 频繁 / 接口卡顿），你的整体思路是什么？**

**标准答法（30 秒，涵盖五个得分点）：**

> 第一是**先定性再动手**：先判断是内存泄漏、分配速率过高、线程问题还是代码 bug，靠监控和日志，不靠猜。
>
> 第二是**优先级**：先改代码和架构（修泄漏、降分配速率、改缓存策略），再调 JVM 参数，最后才考虑扩容——调参是最后手段，不是第一反应。
>
> 第三是**可观测性先行**：先开 `-Xlog:gc*`、`-XX:+HeapDumpOnOutOfMemoryError` 和关键监控，没有数据支撑绝不调参。
>
> 第四是**追根因**：用 `jstat`/`jcmd`/`jmap`/Arthas/MAT 把"现象"一步步追到"哪类对象、哪段代码"。
>
> 第五是**验证闭环**：建立基线、压测对比、一次只改一个变量、确认改善且可回滚，最后沉淀成规范。

**评分要点：** 先定性 / 代码优先 / 可观测 / 追根因 / 验证闭环 五个点。能说出"没有数据不调参、一次只改一个变量"的，直接往 Part 1 深挖。

---

<a id="part-1"></a>

## Part 1：基础认知题（调优方法论）

### Q1. JVM 调优的一般流程是什么？什么时候"不该调"？

**标准答案：**
- **流程**：① 定义目标与基线（吞吐/延迟/容量 SLO，记录 GC 频率、RT、P99）；② 采集数据（GC 日志、监控、profiling）；③ 定位瓶颈（分配速率、泄漏、晋升失败还是锁竞争）；④ 先代码后参数再资源；⑤ 压测验证 + 灰度 + 可回滚。
- **不该调**：没有数据凭感觉调；瓶颈不在 JVM（下游慢、SQL 慢、锁竞争，GC 只是表象）；系统正常但"看着 GC 多"、无 SLO 受损；一次改十几个参数无法归因。核心理念：**调优是"用数据消除瓶颈"的工程活动，不是参数玄学**。

**追问 1：为什么说"先代码/架构，再 JVM 参数，最后扩容"？**
> **答案：** 因为绝大多数 GC 问题根因是**分配速率过高或对象生命周期错配**——比如循环里造临时对象、缓存无界增长、线程池队列堆积，这些只能靠改代码/架构解决，调 `-Xmx` 只是延缓 OOM、把 STW 变长。扩容成本最高且掩盖问题。参数只在"代码已合理但收集器行为不适配"时才见效。

**追问 2：什么是"确定性问题"和"可观测性"？为什么强调它们？**
> **答案：** 确定性指**改一个变量、结果可预期可复现**（配合压测和基线），不能靠线上碰运气；可观测性指**任何结论都有数据支撑**（日志/指标/dump）。没有这两点，调优就是"重启大法 + 调大 Xmx"的迷信行为，出问题也无法复盘和回滚。

---

### Q2. 调 JVM 前应该先明确哪些指标和数据？如何建立基线？

**标准答案：**
- **关键指标**：吞吐（TPS）、延迟（均值/P99/P999）、GC（频率、单次耗时、STW 总时长）、内存（堆各区、老年代趋势、元空间、直接内存）、资源（CPU、RSS、线程数）。
- **基线与采集**：**稳定负载 + 当前配置**下采集覆盖一个业务周期的数据作参照（没有基线就无法验证"调完好像快了"）；手段：`-Xlog:gc*`、`jstat -gcutil`、Prometheus/JMX、必要时 JFR/async-profiler。

**追问 1：只盯"GC 次数少"是不是目标错了？**
> **答案：** 是。GC 次数少可能是堆开得极大、单次 STW 巨长，或对象根本没被回收（泄漏）。正确目标应绑定**业务 SLO**：如 Full GC 频次、P99 延迟、单位时间 STW 总时长，而非孤立的 GC 次数。

**追问 2：为什么强调"一次只改一个变量"？**
> **答案：** 同时改 `-Xmx`、收集器、IHOP、线程数，即使变好也无法归因，下次出问题无从复用；变坏更难回滚。单变量 + 压测对比才能建立因果，沉淀为团队规范。

---

<a id="part-2"></a>

## Part 2：底层原理题（与调优决策相关的原理）

> 原理题在《JVM 与 GC》题库已系统讲过；这里只讲**直接影响调优决策**的部分：日志怎么读、屏障的代价何时显现、非堆区域怎么惹祸。

### Q3. 如何读懂 GC 日志？`-Xlog:gc*` 和 `jstat` 的关键字段各是什么含义？

**标准答案：**
- JDK9+ 统一日志 `-Xlog:gc*`（生产建议加 `time,uptime,level,tags:file=gc.log:time,uptime:filecount=5,filesize=100m` 做滚动）。一条 G1 Young GC 日志：
  ```text
  [12.345s][info][gc] GC(42) Pause Young (Allocation Failure) 512M->128M(1024M) 18.6ms
  ```
  关键看：GC 编号(42)、类型(Pause Young/G1 Evacuation Pause)、触发原因(Allocation Failure)、回收前->回收后(堆占用)->堆容量、耗时(18.6ms)。`Pause ...` 表示 STW。
- `jstat -gcutil <pid> 1000` 每秒输出：`E`(Eden 使用率)、`O`(老年代使用率)、`M`(元空间)、`YGC/YGCT`(Young GC 次数/总耗时)、`FGC/FGCT`(Full GC 次数/总耗时)、`GCT`(GC 总耗时)。
- **诊断读法**：O 持续攀升 + FGC 增加 → 泄漏或晋升失败；YGCT 占比高、YG 极频繁 → 分配速率过高；单次 FGCT 很长 → 堆过大或 Full GC 未并发。

**追问 1：日志里 `Allocation Failure` 和 `System.gc()` 触发有何区别？**
> **答案：** `Allocation Failure` 是分配空间不足的被动触发（正常）；`System.gc()` / `G1 Evacuation Pause (System.gc())` 是代码显式调用（如某些框架、Netty 的 `System.gc()`、RMI），属于**可消除的Full GC诱因**，可用 `-XX:+DisableExplicitGC` 或 `-XX:+ExplicitGCInvokesConcurrent` 处理，但要确认依赖它的堆外回收逻辑（DirectBuffer 依赖 System.gc 兜底）。

**追问 2：只看 `jstat` 够吗？什么时候必须看完整 GC 日志或 GCeasy？**
> **答案：** 不够。`jstat` 是聚合采样，看不到单次 STW 分布、触发原因、各阶段耗时、晋升量/失败、Humongous 分配。定位"长尾 STW""偶发 Full GC"必须看详细日志，或用 **GCeasy / GCViewer** 导入日志生成停顿分布、吞吐、晋升曲线，快速发现异常模式。

---

### Q4. 三色标记与读/写屏障对**调优**的实战含义是什么？

**标准答案：**
- 原理（背景）：并发标记用三色抽象，漏标靠屏障解决——CMS 增量更新（写后屏障）、G1 SATB（写前屏障）+ RSet（写后屏障）、ZGC 染色指针 + 读屏障。
- **对调优的实战含义**：
  - **G1 的写屏障成本**：每次跨 Region 写引用都要维护 RSet，写密集、跨 Region 引用多的应用，RSet 内存（可达堆 5%~20%）与写屏障开销显著，是小堆/写密集场景 G1 未必优的原因。
  - **SATB 的代价**：并发标记期间记录被覆盖的旧引用，高引用变更率会抬高并发标记负担，可能引发并发失败 → to-space exhausted → Full GC。
  - **ZGC 的读屏障成本**：每次从堆读引用都多一道检查，读密集负载有 CPU 开销；换来的是并发整理、亚毫秒停顿。所以"读多还是写多、堆多大、尾延迟多敏感"决定选 G1 还是 ZGC。

**追问 1：为什么 G1 会出现 `to-space exhausted` / 并发失败，调什么？**
> **答案：** 并发标记结束到 Mixed GC 之间，存活对象复制需要空闲 Region 作 to-space；若回收赶不上分配（残留垃圾多、晋升快），空闲 Region 耗尽即 `to-space exhausted`，退化为 STW Full GC。应对：降低 IHOP 让并发周期早启动、增大堆或 `-XX:G1ReservePercent`、降低分配速率、增大并发线程 `-XX:ConcGCThreads`。

**追问 2：ZGC 也有"分配停顿"吗？怎么表现？**
> **答案：** 有。ZGC 并发回收期间若分配过快、可回收内存不足，会触发 **Allocation Stall**（分配线程阻塞等待 GC 完成），表现为线程莫名卡顿但 GC 日志里 STW 极短。解决方向是降分配速率、增大堆/并行度、或在更高分配速率下确认分代 ZGC 是否跟得上。

---

### Q5. TLAB/PLAB、元空间、直接内存这些"非堆/隐性区域"怎么引发线上问题？

**标准答案：**
- **TLAB**（Eden 内线程私有分配缓冲，默认开）：小对象无锁分配；TLAB 浪费（线程退出时未用完被丢弃）会抬高实际分配速率。`-XX:+PrintTLAB` / JFR 可观测。
- **PLAB**（G1 晋升时的线程本地缓冲）：PLAB  sizing 不当会造成**晋升浪费**，让老年代占用虚高、过早触发 Mixed/Full GC。
- **元空间 / 直接内存**：元空间存类元数据，动态生成类（CGLIB、反射、JSP）、重复部署致 ClassLoader 泄漏 → `Metaspace OOM`，用 `jcmd VM.metaspace`/`GC.class_histogram` 查、设 `-XX:MaxMetaspaceSize`；直接内存经 Cleaner + 虚引用释放、受 `-XX:MaxDirectMemorySize` 限制，Netty 引用计数泄漏会 OOM（`Direct buffer memory`），用 `BufferPoolMXBean`/NMT 观测。

**追问 1：`MaxDirectMemorySize` 不设会怎样？**
> **答案：** 默认值约等于 `-Xmx`（或由 `Runtime.maxMemory()` 推导），堆外与堆共享物理内存预算。容器里若不设，DirectBuffer + 堆 + 元空间 + 线程栈加起来可能超过 cgroup 限额被 OOM-Kill，所以容器化部署应显式设定并计入总预算。

**追问 2：为什么堆外内存泄漏"GC 日志看不出异常"？**
> **答案：** 因为 DirectBuffer/Unsafe 分配的内存在堆外，堆占用和 GC 行为可能都很正常，但进程 RSS 持续上涨、最终 OOM 或被 Kill。必须靠 NMT、BufferPool MXBean、RSS 监控才能发现——这也说明调优不能只盯 GC 日志。

---

<a id="part-3"></a>

## Part 3：核心区分度题（题眼，定级主战场）

> **这一部分是全题的题眼**——能否把"现象"系统化地定位到"根因类别"并给出取舍，直接决定 L3 还是 L4/L5。

### Q6. 高并发下 Young GC 非常频繁，你的定位路径是什么？增大年轻代 vs 降低分配速率怎么取舍？

**标准答案：** （能完整讲下来基本是 L3+）
1. **确认现象 + 算速率**：`jstat -gcutil` 看 YGC 每秒次数、YGCT 占比，GC 日志看每次分配/回收量与耗时；`分配速率 ≈ 每次 Young GC 的 Eden 回收量 × 频率`，用量化代替"感觉频繁"。
3. **找分配热点**：JFR / async-profiler 分配剖析（`alloc` 事件）或 Arthas 定位哪段代码在疯狂造对象。
4. **分情况干预**：
   - 若是**短命对象、分配速率本质就高**（正常业务量）：增大年轻代 `-Xmn`/`-XX:NewRatio`（G1 下靠自适应，勿手动设 Xmn）可**降低频率但单次耗时变长**，总量不变——治标。
   - 若是**无意义临时对象**（字符串拼接、装箱、重复序列化）：改代码降低分配速率才是治本。
   - 若是**对象过早晋升**：Survivor 太小/年龄阈值太低，调 SurvivorRatio、MaxTenuringThreshold。

**追问 1：为什么"增大年轻代"只是延缓、不解决根本问题？**
> **答案：** Young GC 的根源是分配速率×时间。年轻代变大只是让 Eden 更晚填满，频率下降但每次回收的存活对象和耗时上升，单位时间 STW 总量和吞吐消耗基本不变；若对象本可优化掉，扩容等于用更多内存养垃圾。

**追问 2：怎么区分 Young GC 频繁和"分配速率正常但 Eden 设太小"？**
> **答案：** 看每次 GC 后 Eden 是否被充分使用、存活对象比例。若 Eden 很小、每次只回收少量对象就触发，属于配置问题，增大 Eden/年轻代有效；若 Eden 已较大、每次回收大量垃圾仍很频繁，说明分配速率确实高，要从代码/并发模型入手。

---

### Q7. Full GC 频繁的根因如何系统分类和定位？

**标准答案：** 按"谁触发了 Full GC"分桶排查：
| 根因类别 | 典型信号 | 定位手段 | 干预 |
|---|---|---|---|
| 内存泄漏 | O 持续攀升不回落，FGC 后仍高 | dump 堆看支配树/GC Roots 链 | 修代码泄漏 |
| 晋升失败/过早晋升 | Young GC 后 O 陡增、Promotion failed | GC 日志晋升量、Survivor 大小 | 调新生代/Survivor/阈值 |
| 元空间不足 | `Metadata GC Threshold` 触发 | `VM.metaspace`、类直方图 | 查重复部署/动态类、设上限 |
| `System.gc()` | 日志显式标记 | grep 日志/代码 | DisableExplicitGC/改框架 |
| 大对象/Humongous | G1 Humongous 分配日志 | Region 大小 vs 对象大小 | 调 Region/拆大对象 |
| 堆外压力 | 堆正常但 RSS 高 | NMT、BufferPool | 修堆外泄漏 |
| 并发失败 | `concurrent mode failure`/to-space exhausted | 完整 GC 日志 | 调 IHOP/堆/并发线程 |

**追问 1：看到 Full GC 就调大 `-Xmx`，为什么可能是错的？**
> **答案：** 若是泄漏，调大只是推迟 OOM、拉长单次 STW；若是 `System.gc()` 或元空间触发，加堆完全无效。必须先按上表定位根因，再决定动作——这正是"先诊断后调参"的体现。

**追问 2：如何判断是"缓慢泄漏"还是"突发流量打满"？**
> **答案：** 看老年代占用随时间的**趋势**：缓慢泄漏是阶梯式上升、GC 后回落点逐次抬高（锯齿基线漂移）；突发打满是尖峰、流量回落后能回落。前者要 dump heap 找泄漏，后者要做容量/限流/削峰。

---

### Q8. 接口 P99 突然飙高、怀疑"长 STW"，怎么定位是不是 GC 造成的？

**标准答案：**
- **关联时间戳**：把 P99 尖峰的时间点与 GC 日志的 `Pause` 时间段对齐——若高度吻合，GC 是嫌疑；若 GC 正常而 RT 高，查业务/下游/锁。
- **量化 STW**：GCeasy/GCViewer 统计单位时间 STW 总时长和最大单次停顿；只有"最大单次停顿"和"累计停顿"都超标才会实质影响 P99。
- **区分 GC 类型**：Young GC 偶发几十毫秒通常可接受；Full GC 秒级停顿、或频繁 Mixed GC、或 ZGC 的 Allocation Stall 才是大头。
- **非 GC 的 STW**：还要排查偏向锁撤销（安全点）、`System.gc()`、大数组复制、JIT 反优化、线程栈膨胀等。

**追问 1：GC 日志显示停顿都很短，但 P99 仍高，往哪查？**
> **答案：** 说明瓶颈大概率不在 GC。查：① 锁竞争/死锁（`jstack`、Arthas `thread`）；② 下游依赖抖动；③ 安全点停顿（如计数循环导致的 safepoint 延迟）；④ 容器 CPU throttling（cgroup quota 被打满）。用 async-profiler 火焰图 + `-XX:+PrintSafepointStatistics` 辅助。

**追问 2：为什么"平均停顿"会骗人，必须看 P99/P999 停顿？**
> **答案：** 少量极端长停顿对均值影响小，却直接决定用户感知的长尾延迟。SLO 通常约束 P99/P999，因此评估 GC 要看停顿分布与最大值，而非平均值。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题（案例驱动）

> **本套重头戏**：每题按"现象 → 排查路径 → 根因 → 调优方案 → 验证"展开。

### Q9. OOM 全家桶：常见 OOM 类型、现象、dump/日志特征与解法分别是什么？

**标准答案：** （一页表格考察是否真正分得清）

| 类型 | 报错/现象 | 关键证据 | 常见根因 | 解法 |
|---|---|---|---|---|
| 堆 OOM | `Java heap space` | dump 中某类对象 retained heap 暴涨 | 泄漏/缓存无界/大对象 | 修泄漏、限缓存、必要时加堆 |
| GC 开销超限 | `GC overhead limit exceeded` | GC 占 ~98% 时间仅回收 <2% | 堆太小或泄漏致无效 GC | 修泄漏/加堆；可临时关 `UseGCOverheadLimit` 但治标 |
| 元空间 OOM | `Metaspace` / `Metadata GC Threshold` | 类数量异常、ClassLoader 堆积 | 动态生成类、重复部署 | 查泄漏、设 MaxMetaspaceSize |
| 直接内存 OOM | `Direct buffer memory` | BufferPool/RSS 涨、堆正常 | Netty 引用计数泄漏、Unsafe | 查泄漏、设 MaxDirectMemorySize |
| 栈溢出 | `StackOverflowError` | 线程栈深、递归调用链 | 深递归/错误实现 | 修递归、适度调 `-Xss` |
| 无法创建线程 | `unable to create new native thread` | 线程数爆、OS 限额 | 线程泄漏/Xss 过大/ulimit | 修线程池、减 Xss、调系统限制 |

**追问 1：`Java heap space` OOM 一定要加 `-Xmx` 吗？**
> **答案：** 不一定。先看 dump：若是某业务对象异常堆积（泄漏/缓存无界），加堆只是延缓；若确属业务合理存活量超出堆，才加堆。务必先确认根因，避免"越 OOM 越加堆、STW 越来越长"。

**追问 2：`StackOverflowError` 和 `unable to create new native thread` 都与栈有关，区别在哪？**
> **答案：** 前者是**单个线程栈深度超限**（递归太深），调大 `-Xss` 可缓解但根因常是算法/递归错误；后者是**线程总数受限于内存/OS 配置**（线程数 ≈ (可用内存−Xmx−元空间)/Xss），Xss 越大可创建线程越少。一个是"深度"，一个是"数量"，方向不同。

---

### Q10. 案例：某服务运行几天后 Full GC 越来越频繁，最终 OOM。请讲完整排查过程。

**标准答案：**
1. **现象与数据**：`jstat -gcutil` 观察老年代 O 占用每次 FGC 后回落点逐次抬高（锯齿基线漂移），判定疑似缓慢泄漏。
2. **保留现场**：配置 `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/data/dump` 自动 dump；也可手动 `jcmd <pid> GC.heap_dump`（注意 STW 与磁盘 IO）。
3. **离线分析**：用 **MAT** 看 Leak Suspects 报告；用**直方图按 retained heap 排序**找异常类；对可疑对象看 **支配树** 与 **Path to GC Roots（排除弱/软引用）** 定位持有链；再取"正常时"与"泄漏时"两份 dump 做**直方图对比**，看哪类对象增量最大。
4. **根因与修复**：常见如静态 Map 缓存无淘汰、ThreadLocal 未 remove、监听器未注销。修复代码（加 TTL/容量上限、finally 中 remove）。
5. **验证**：压测回放同样时长，观察老年代回落点是否稳定、FGC 是否归零；灰度上线持续监控。

**追问 1：MAT 的 shallow heap 和 retained heap 有什么区别？为什么定位泄漏看 retained？**
> **答案：** shallow heap 是对象自身占用（不含引用对象）；retained heap 是该对象被回收后能连带释放的总内存（支配的子树）。泄漏对象本身可能很小却通过强引用链"吊住"一大片，所以按 retained heap 排序才能找到真正的"内存黑洞"。

**追问 2：为什么"Path to GC Roots"要排除软/弱/虚引用？**
> **答案：** 软/弱/虚引用不阻止对象被 GC，不构成真正的"存活持有"。只有强引用链（静态字段、栈局部变量、常量等）才是对象无法回收的原因，排除弱引用才能看到真正的泄漏持有者。

---

### Q11. 案例：用了线程池 + ThreadLocal 后偶发 OOM；另一个服务用了无界队列线程池也 OOM。分别怎么分析？

**标准答案：**
- **ThreadLocal 泄漏**：`ThreadLocalMap` 的 Entry key 是弱引用、value 是强引用；线程池线程长期复用不销毁，若用完不 `remove()`，key 被回收成 null 但 value 一直被持有 → 泄漏。现象：dump 中 `ThreadLocalMap$Entry` 的 value 大量堆积、持有链指向线程池线程。解法：`finally` 中 `threadLocal.remove()`；避免存大对象；配合线程池做清理钩子。
- **线程池队列堆积 OOM**：无界 `LinkedBlockingQueue` + 任务生产快于消费 → 任务对象在队列中无限堆积占堆。现象：dump 中大量 Runnable/任务对象、FutureTask，支配链指向队列。解法：改用有界队列 + 合理拒绝策略（降级/丢弃+监控）、限流削峰、按 `CPU 密集 ≈ CPU核数`、`IO 密集 ≈ 核数×(1+等待/计算)` 估算线程数。

**追问 1：既然 key 是弱引用会被回收，为什么 value 还会泄漏？**
> **答案：** key 弱引用只保证 ThreadLocal 对象本身可被回收，但 value 是强引用且生命周期跟线程；线程池线程长期存活，value 既不被回收、又因 key 为 null 无法通过 get/set 访问，形成"无效强引用"泄漏。所以弱引用没能解决问题，必须靠 `remove()`。

**追问 2：这两个案例 root cause 有什么共性？**
> **答案：** 共性都是**对象生命周期被"长期存活的容器"意外延长**——线程池线程/队列成了事实上的"全局根"。这提示排查 OOM 时要特别关注静态容器、线程池、缓存、单例这些长生命周期持有者，而非只看单条业务调用。

---

### Q12. 案例 A：Netty 服务运行一段时间后 `Direct buffer memory` OOM；案例 B：容器里的 Java 进程内存涨到 limit 被 OOM-Kill 但 GC 正常。怎么查？

**标准答案：**
- **案例 A（Netty 堆外泄漏）**：现象是堆正常、RSS 持续涨、报 Direct buffer memory。排查：看 `BufferPoolMXBean` 的 direct 计数/容量、`jcmd VM.native_memory`；常见根因是 **ByteBuf 未正确 release（引用计数泄漏）**、SSL/handler 未释放。用 Netty 的 `LeakDetector`（设 `PARANOID`）打印泄漏栈；解法是修正引用计数（谁申请谁 release、SimpleChannelInboundHandler 自动释放）、`-Dio.netty.leakDetection.level=paranoid` 定位、设 `-XX:MaxDirectMemorySize`。
- **案例 B（容器超限被 Kill）**：现象是 GC 日志正常但进程被 OOM-Killer 杀掉（dmesg 有记录）。根因是 JVM 总内存预算超过 cgroup limit：堆 + 元空间 + 直接内存 + 线程栈 + JIT/code cache + JVM 自身。JDK10+ 默认 `UseContainerSupport` 会根据 cgroup 限额设堆，但**直接内存/元空间/线程栈仍需手动纳入预算**。解法：`-Xmx` 设为 limit 的 ~60%–70%，显式设 `-XX:MaxMetaspaceSize`、`-XX:MaxDirectMemorySize`、`-Xss` 和线程数上限，预留 headroom。

**追问 1：容器里 `Xmx` 该设多少？为什么不能顶着 limit 设？**
> **答案：** 要给堆外各项留空间，通常设为 limit 的 60%–70%（视堆外占比调整）。顶着 limit 设会让堆外一涨就触碰 cgroup 上限被 Kill——注意被 Kill 时不是 Java OOM、不会有 dump，只能靠 dmesg/RSS 监控发现。

**追问 2：`UseContainerSupport` 在版本上有什么注意点？**
> **答案：** JDK 10+ 引入并默认开启，让 JVM 读取 cgroup 的 CPU/内存限额来设置堆与并行度；较新版本（约 JDK 19 起）该行为默认强制开启、不再支持关闭。保守做法：明确所用 JDK 版本行为，并仍显式设定各项内存参数，不把容量规划完全交给默认值。

---

### Q13. 案例：G1 下调了 `MaxGCPauseMillis` 反而更慢；另一个老系统还在用 CMS 要迁移；什么时候该换 ZGC？

**标准答案：**
- **G1 调优误区**：`MaxGCPauseMillis`（默认 200ms）是**软目标**。设得过小（如 20ms）会迫使 G1 缩小年轻代、增加 GC 频率，吞吐骤降、YGC 暴增。正确做法是设**合理可达的目标**（如 100–200ms），配合 `-XX:InitiatingHeapOccupancyPercent`(IHOP，默认约45%) 让并发周期早启动、Region 大小 `-XX:G1HeapRegionSize` 规避 Humongous；**G1 下不要手动设 `-Xmn`/`-XX:NewRatio`**（破坏自适应）。
- **CMS 迁移**：CMS 在 JDK 9 标记废弃、JDK 14 移除，`-XX:+UseConcMarkSweepGC` 已不可用。迁移路径：一般业务用默认 **G1**（无碎片、停顿可预测）；超大堆/极严尾延迟用 **ZGC**。注意去掉 CMS 专属参数，重新压测验证。
- **何时换 ZGC**：堆很大（数十 GB~TB）、P99/P999 要求亚毫秒~几毫秒、G1 的 STW 已无法满足。代价：读屏障 + 并发线程带来额外 CPU（吞吐常略低于 G1）、因不支持压缩指针同类数据占内存更多（新版本已有改进）。需压测评估 CPU 余量。

**追问 1：把 `MaxGCPauseMillis` 从 200ms 调到 50ms，可能发生什么？**
> **答案：** G1 为达成更短停顿会缩小年轻代（Eden 变小）→ Young GC 频率大幅上升 → 吞吐下降、CPU 更多耗在 GC；若仍达不到目标它也不会"硬保证"。所以"调小停顿目标"不是免费午餐，要在延迟收益与吞吐损失间权衡。

**追问 2：ZGC 停顿已达亚毫秒，是不是所有场景都该用？**
> **答案：** 不是。中小堆、吞吐优先、CPU 紧张的常规业务，G1 通常综合更优（无读屏障开销、吞吐更高）。ZGC 的价值只在"大堆 + 极低尾延迟"场景才抵得过其 CPU/内存成本。选型要看 SLO 与资源预算，而非追新。

---

### Q14. 工具链串讲：CPU 飙到 100%、疑似死锁、偶发长尾，分别用什么工具、怎么串起来？

**标准答案：**
- **基础工具链**：`jps`（进程号）→ `jstat`（GC 统计）→ `jinfo`（在线看/改参数）→ `jstack`（线程栈/死锁）→ `jmap`（堆 dump/直方图）→ `jcmd`（统一诊断：GC.heap_dump、VM.metaspace、VM.native_memory、Thread.dump_to_file）。
- **CPU 100% 排查**：`top` 找 PID → `top -H -p PID` 找高 CPU 线程 TID 转 16 进制 → `jstack PID | grep <tid>` 看栈（业务死循环/正则回溯/GC 线程）。Arthas `thread -n 5` 一步看最忙线程栈，`profiler`/trace 定位热点方法。
- **死锁**：`jstack` 末尾直接报 `Found one Java-level deadlock` 及等待链；Arthas `thread -b` 找阻塞源头。
- **偶发长尾/热点**：async-profiler 生成**火焰图**（CPU/分配/锁），比采样 jstack 更直观；GCeasy/GCViewer 分析 GC 日志；Arthas `dashboard`/`monitor`/`trace`/`watch` 在线观测无需重启。

**追问 1：生产环境直接用 `jmap -dump` 有什么风险？怎么规避？**
> **答案：** dump 会触发 STW 且写出超大文件，可能拖垮线上服务/打满磁盘。规避：优先用 `-XX:+HeapDumpOnOutOfMemoryError` 在 OOM 时自动留现场；需要主动 dump 时选低峰、摘流量、用 `jcmd GC.heap_dump` 并写到独立磁盘；或先用 `jmap -histo` 看直方图做轻量判断。

**追问 2：Arthas 和 async-profiler 各适合什么场景？**
> **答案：** Arthas 适合**在线交互式诊断**（看线程、方法耗时 trace、观察参数/返回值、改日志级别），覆盖"快速定位"；async-profiler 低开销、生成火焰图，适合**CPU/分配/锁热点的统计性剖析**和找长尾根因。两者互补：先 Arthas 定方向，再火焰图看全局分布。

---

<a id="part-5"></a>

## Part 5：2026 新趋势（加分题）

> 考察技术视野与**事实准确性**，不确定细节用保守表述，不编造参数。

### Q15. JDK 21→25 有哪些与"调优/排障"相关的演进？虚拟线程对排障带来什么变化？

**标准答案：**
- **分代 ZGC 成唯一形态，但默认 GC 仍是 G1（最易混点，必须辨析）**：演进链 JEP 439（JDK21 分代可选）→ JEP 474（JDK23 分代默认）→ JEP 490（JDK24 移除非分代）→ **JDK 25（2025-09 LTS）ZGC 只剩分代形态**。但"分代 ZGC 默认"指**启用 ZGC 后只有分代模式**，**整个 JDK 的默认收集器仍是 G1**，用 ZGC 仍需显式 `-XX:+UseZGC`。
- **JEP 519 紧凑对象头 / JEP 521 分代 Shenandoah（均 JDK25）**：紧凑对象头（opt-in `-XX:+UseCompactObjectHeaders`）把 64 位对象头从 96/128 位压到 64 位，降堆占用、提升局部性，对小对象密集应用有收益；分代 Shenandoah 为产品特性但默认仍单代，需显式开启，长生命周期对象多的负载单代未必更差。
- **虚拟线程对内存与排障的影响**：单个虚拟线程很轻（不占 1MB 平台栈），百万级可行；GC 压力主要来自**高分配速率**而非线程数。排障变化：`jstack` 输出**不再包含虚拟线程**（不作为本地线程），需用 `jcmd <pid> Thread.dump_to_file` 导出；线程不池化后 ThreadLocal 泄漏风险上升，推荐 Scoped Values（JEP 506 转正）。
- **容器感知 / CDS / GraalVM Native Image**：容器感知（UseContainerSupport）已默认开启；AppCDS 与 JDK 24 JEP 483（AOT 类加载与链接）用于**降启动时间、降内存占用**；GraalVM Native Image AOT 编译为本地可执行文件，**没有 HotSpot 的 JIT 与分代堆调优范式**，收益是启动快、内存低，代价是峰值吞吐/反射兼容差异——调优从"运行时调 JVM"转向"构建期配置 + 原生镜像特性分析"。

**追问 1：JDK 25 的默认垃圾收集器到底是什么？为什么这个点常考？**
> **答案：** 是 **G1**。常有人把"分代 ZGC 成默认"误读成"JDK 默认 GC 变 ZGC"。能区分"ZGC 内部形态默认"与"JDK 层面默认收集器"两个层次，是 L5 视野的可靠信号。

**追问 2：虚拟线程普及后，为什么排障不能只靠 jstack？**
> **答案：** 因为虚拟线程是用户态调度、数量巨大，且不映射为平台线程，`jstack` 不再 dump 它们。要用 `jcmd Thread.dump_to_file`（支持 JSON、含虚拟线程）结合 JFR 事件来分析海量虚拟线程的阻塞与分配，排查思路从"看线程栈"转向"看事件与资源限流"。

---

<a id="part-6"></a>

## Part 6：能否用调优案例定级？如何定级？

### 结论先行

**可以，调优案例是区分度最高的探针之一**——因为它天然分层：会配参数 → 懂方法论 → 能读日志/用工具 → 能独立排查真实问题 → 能做选型与容量规划。但案例题对**没有真实线上经验**的候选人极难伪装，结合岗位使用：招初中级问到 Part 1/2 即可，招性能/SRE/中间件岗才需 Part 4 以上。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 会配 `-Xmx`，知道 OOM 大概有哪些，说不出排查路径 |
| **中级（L2）** | 2–5 年 | Part 2 | 能读 GC 日志/jstat，知道各类 OOM 区别，会用常见工具 |
| **中高级（L3）** | 5–8 年 | Part 3 | 能系统定位 Young/Full GC 频繁、长 STW，懂取舍 |
| **高级（L4）** | 8 年+ | Part 4 | 能独立讲通多个真实案例（现象→根因→方案→验证），用 MAT/火焰图 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 掌握版本演进与选型，能做容量规划、辨析"默认"语义、规避 JVM 之外瓶颈 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"先定性→代码优先→可观测→追根因→验证闭环"→ 至少 L2；只会"重启 + 加 Xmx"→ 从 Part 1 问起。

**第二步：沿案例追问链下探。** 重点追问"为什么"和"怎么验证"：为什么加堆可能是错的（泄漏/System.gc/元空间触发时无效）？为什么 retained heap 比 shallow heap 重要？调完怎么证明有效（基线 + 压测 + 单变量 + 灰度）？

**第三步：三类信号防背题。** ① **真实性**：能否讲出具体案例（现象、命令、日志片段、数值、改的代码），细节越具体越可信；② **方法论**：是否坚持"先数据后调参、单变量验证、可回滚"；③ **权衡能力**：能否讲清"增大年轻代治标不治本"、G1 vs ZGC 取舍、堆 vs 堆外预算。

**第四步：按最深层级定级，不按正确率。** 结合岗位：业务开发问到 Part 3 足够；性能/SRE/架构岗需 Part 4 实战与 Part 5 演进。

---

### 面试官避坑提醒

- **别用"背参数"代替"查问题"**：问默认值意义不大，不如给一段 GC 日志让他诊断；**把"能否独立讲通一个真实案例"作为 L4 分水岭**：能讲出现象→工具→根因→修复→验证完整链路的人一定是真做过。
- **警惕把 GC 当万能替罪羊**：优秀候选人会先排除下游、锁、容器 CPU throttling 等非 GC 因素；**重视"验证"环节**：能主动提基线/压测/灰度/回滚，是工程成熟度的体现。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**

1. 线上报警整体思路？→（先定性/代码优先/可观测/追根因/验证闭环）
2. 调优前看什么指标、怎么建基线？→（SLO/GC/内存/资源；稳定负载采样）
3. GC 日志与 jstat 怎么读？→（`-Xlog:gc*`；E/O/M、YGCT/FGCT、单次停顿分布）
4. 屏障对调优的含义？→（G1 RSet 写开销、SATB 并发失败、ZGC 读屏障与 Allocation Stall）
5. 非堆区域怎么惹祸？→（TLAB/PLAB 浪费、元空间重复部署、直接内存/Netty 泄漏）
6. Young GC 频繁怎么定位与取舍？→（算分配速率→找热点；增大年轻代治标、降分配速率治本）
7. Full GC 频繁根因分类？→（泄漏/晋升/元空间/System.gc/大对象/堆外/并发失败）
8. OOM 全家桶能分清吗？→（heap/GC overhead/Metaspace/Direct buffer/StackOverflow/native thread）
9. 内存泄漏怎么查？→（dump + MAT 支配树/GC Roots 路径 + 直方图对比；ThreadLocal/线程池）
10. Netty 堆外泄漏与容器被 Kill？→（LeakDetector/NMT；cgroup 预算、Xmx 设 60–70%）
11. G1 调优误区与 ZGC 选型？→（软目标别设太小、别手动 Xmn；CMS 已移除；大堆低延迟才换 ZGC）
12. 工具链怎么串？→（jps/jstat/jstack/jmap/jcmd、Arthas、async-profiler 火焰图、GCeasy）
13. JDK25 演进辨析？→（分代 ZGC 唯一但默认仍 G1、JEP519/521、虚拟线程 jstack 变化、GraalVM）

**定级速判：**
- 答到第 1–5 问 → L2
- 答到第 6–8 问 → L3
- 答到第 9–12 问 + 真实案例 → L4
- 答到第 13 问 + 体系化选型与辨析 → L5

**一票否决信号：** 把"调大 Xmx / 重启"当万能解、看到 Full GC 不先定位根因、断言"JDK 默认 GC 是 ZGC"却无法辨析、只会罗列参数讲不出任何验证手段 → 无论年限，最高 L2。

---

*资料整理于 2026-11-19，参考《深入理解 Java 虚拟机》（周志明）、OpenJDK/HotSpot 官方文档与 GC 调优指南、JDK Unified Logging 与 JFR 文档、Arthas / async-profiler / Eclipse MAT / GCeasy 官方资料、JEP 439/474/490/519/521/506/483 及 Oracle Java 25 发布公告（2025-09-16），并结合 2026 年 Java 面试趋势整理。*
