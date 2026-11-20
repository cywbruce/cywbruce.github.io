---
title: "Java 集合框架面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "HashMap 底层、容量与树化阈值、ConcurrentHashMap、fail-fast 与数据结构选型。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **Java 集合框架（Collection / Map 体系、HashMap 底层、并发容器）** 的真实深度"问出来"。
> 核心原则：**集合框架的每一道题，最终都会落到"数据结构选型 + 时间/空间权衡 + 并发安全"这条主线**。只会调 add/put 却讲不清 HashMap 为什么是"数组+链表+红黑树"的人，基本停留在 API 记忆层。
> 配套：本题库与 AQS / ThreadLocal / ThreadPoolExecutor 三套共同构成"Java 基础与并发面试定级体系"。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题](#part-1)
- [Part 2：底层原理题（HashMap 核心结构）](#part-2)
- [Part 3：核心区分度题（并发与 ConcurrentHashMap）](#part-3)
- [Part 4：实战与陷阱题](#part-4)
- [Part 5：2026 新趋势：JDK 21+ 集合演进](#part-5)
- [Part 6：能否用集合框架定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 Java 集合框架的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> Java 集合框架整体上分 **Collection 和 Map 两大体系**：Collection 下又有 List（有序可重复）、Set（无序不可重复）、Queue（队列）三支；Map 是独立的键值对体系，不继承 Collection。
>
> 每一种集合本质都是**一种数据结构 + 一种时间/空间权衡**：ArrayList 是动态数组、LinkedList 是双向链表、HashMap 是哈希表、TreeMap 是红黑树。
>
> 面试最核心的 HashMap，JDK8 底层是 **数组 + 链表 + 红黑树**：用 `(n-1) & hash` 定位桶，容量保持 **2 的幂** 以便均匀分布和高效扩容；负载因子默认 **0.75**；链表长度到 8 且数组容量≥64 才树化，降到 6 再退回链表。
>
> 线程安全方面，普通集合是 **fail-fast** 的，并发修改会抛 ConcurrentModificationException；要保证并发安全用 **ConcurrentHashMap**（JDK8 用 CAS + synchronized 锁单个桶）或 CopyOnWriteArrayList，而不是 Hashtable / synchronizedMap。
>
> 设计上处处是权衡：为什么负载因子是 0.75、为什么 8 转树/6 退树、为什么容量是 2 的幂，本质都是**在空间占用和查询效率之间取折中**。

**评分要点：** 两大体系 / 数据结构选型 / HashMap 数组+链表+红黑树 / 负载因子与 2 的幂 / fail-fast 与并发容器 这几个点，对应入门到高级。能讲清 HashMap 为什么这样设计的，直接往 Part 2 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题

### Q1. Java 集合框架的整体体系是怎样的？Collection 和 Map 有什么区别？

**标准答案：**
- Java 集合框架位于 `java.util` 包，顶层分 **Collection** 和 **Map** 两大根接口。
- **Collection** 存储"单一元素"，下分三支：**List**（有序可重复：ArrayList、LinkedList、Vector）、**Set**（无序不可重复：HashSet、LinkedHashSet、TreeSet）、**Queue / Deque**（队列/双端队列：ArrayDeque、PriorityQueue、LinkedList）。
- **Map** 存储"键值对（key-value）"，key 唯一、value 可重复，典型 HashMap、LinkedHashMap、TreeMap、ConcurrentHashMap。
- 关键区别：**Map 不继承 Collection**，它是另一套独立的顶层接口；Collection 一次 add 加一个元素，Map 的 put 加一对映射。

**追问 1：说几个容易混淆的"集合认知误区"。**
> **答案：** ① **数组不是集合**：长度固定、可存基本类型和对象；集合只能存对象（基本类型要装箱）且长度可变。② **Map 不实现 Collection**：不能直接用 Iterator 遍历 Map，要转 `entrySet()` / `keySet()` / `values()`。③ **Properties 继承 Hashtable**，是遗留的 Map，常用于配置文件。④ **Vector / Stack / Hashtable** 是 JDK1.0 遗留的同步容器，已不推荐使用。

**追问 2：List、Set、Queue 各自适合什么场景？**
> **答案：** List 适合"有顺序、允许重复、按下标访问"的场景（如列表展示）；Set 适合"去重、判存在"的场景（如标签、白名单）；Queue 适合"先进先出/优先级"的场景（如任务队列、BFS）。选型本质是看**是否需要顺序、是否允许重复、访问方式**。

---

### Q2. ArrayList 和 LinkedList 有什么区别？实际开发怎么选？

**标准答案：**
- **ArrayList**：底层是**动态数组**；随机访问 O(1)（下标定位），尾部增删 O(1)（均摊），中间插入/删除 O(n)（要移动元素）；默认容量 10，扩容 1.5 倍（`oldCapacity + (oldCapacity >> 1)`）。
- **LinkedList**：底层是**双向链表**；随机访问 O(n)（要遍历），头尾增删 O(1)，中间增删理论 O(1) 但需先遍历定位（实际仍是 O(n)）；节点有 prev / next 指针，内存开销大、缓存局部性差。
- 实际开发**绝大多数选 ArrayList**：遍历/随机访问远多于中间增删，且连续内存对 CPU 缓存友好。LinkedList 只在明确的"双端队列"场景有价值，但通常 ArrayDeque 更优。

**追问 1：LinkedList 中间插入真的是 O(1) 吗？**
> **答案：** 不是。理论上"已知节点位置"时插入是 O(1)，但 `add(index, e)` 需要先从头/尾遍历到 index 位置（O(n)），所以整体仍是 O(n)。只有拿到 ListIterator 定位后的插入才是真正的 O(1)。这是很多人答错的陷阱。

**追问 2：ArrayList 扩容为什么是 1.5 倍而不是翻倍？**
> **答案：** 1.5 倍是**空间和时间折中**：翻倍扩容次数少但更浪费内存；1.5 倍更省空间，代价是扩容稍频繁。源码用 `oldCapacity + (oldCapacity >> 1)` 位运算实现，高效。相比之下 HashMap 是翻倍，因为要维持 2 的幂。

**追问 3：为什么有了 ArrayList 还保留 LinkedList？**
> **答案：** LinkedList 同时实现 **List 和 Deque 双接口**，可作双端队列用；且头尾增删稳定 O(1)、无需扩容。但现代 JDK 中队列场景更推荐 ArrayDeque（数组实现、无节点开销、缓存友好），LinkedList 的使用场景已被大幅压缩。

---

<a id="part-2"></a>

## Part 2：底层原理题（HashMap 核心结构）

> 这是"会用 Map"和"懂哈希表设计"的分水岭，L2→L3 的关键。

### Q3. HashMap 的底层数据结构是什么？put 的大致流程是怎样的？

**标准答案：**
- JDK8 的 HashMap 底层是 **数组（Node[] table）+ 链表 + 红黑树**：
  - 数组每个位置叫一个"桶（bucket）"。
  - 哈希冲突的元素以链表串联；链表过长（≥8 且容量≥64）转成红黑树。
- 关键字段：`table`（数组）、`size`（元素个数）、`threshold`（扩容阈值 = capacity × loadFactor）、`loadFactor`（默认 0.75）、`DEFAULT_INITIAL_CAPACITY`（默认 16）。
- **put 流程**：
  1. 计算 key 的 hash：`(h = key.hashCode()) ^ (h >>> 16)`，高 16 位与低 16 位异或，让高位也参与寻址，减少冲突。
  2. 若 table 为空，先 resize 初始化（懒加载）。
  3. 用 `(n - 1) & hash` 定位桶（n 为数组长度）。
  4. 桶为空则直接新建 Node 放入。
  5. 桶非空：先比较首节点 hash 和 key（相同则覆盖 value）；否则遍历链表/红黑树，找到相同 key 则覆盖，没有则**尾插**新节点，插入后若链表长度≥8 则尝试树化。
  6. `size++`，若 `size > threshold` 则 resize 扩容。

**追问 1：为什么 hash 算法要 `h ^ (h >>> 16)`？直接用 hashCode 不行吗？**
> **答案：** 因为数组长度 n 通常较小（如 16），`(n-1) & hash` 只用到 hash 的**低位**。若只依赖低位，高位相同、低位分布集中的 key（如某些自定义 hashCode）会全挤到同一桶，冲突严重。把高 16 位异或到低 16 位，让**高位信息也参与低位寻址**，显著降低冲突。这是"扰动函数"：JDK8 只做一次异或（JDK7 做了 4 次），JDK8 认为一次足够且更高效。

**追问 2：为什么用 `(n-1) & hash` 而不是 `hash % n`？**
> **答案：** 当 n 是 2 的幂时，`(n-1) & hash` 在数学上等价于 `hash % n`，但**位运算比取模快得多**。这也是 HashMap 强制容量必须是 2 的幂的原因——构造函数传入非 2 的幂容量会被向上取整到最近的 2 的幂（如传 10 变 16）。

---

### Q4. HashMap 为什么要扩容？负载因子为什么是 0.75？扩容时元素如何迁移？

**标准答案：**
- **扩容触发与原因**：当 `size > threshold`（capacity × loadFactor）时 resize，容量变为 **2 倍**；因为元素越多冲突越严重、查询退化，扩容让元素更分散，维持接近 O(1) 的查找。
- **负载因子 0.75 的原因**：这是**空间与时间的折中**。
  - 负载因子太大（如 1.0）：数组填得很满才扩容，省空间，但冲突剧增、查询变慢。
  - 负载因子太小（如 0.5）：冲突少、查询快，但数组大量空闲、频繁扩容浪费空间。
  - 0.75 是基于**泊松分布**统计的经验值：默认容量 16 下，链表长度达到 8 的概率极低（约千万分之一），能很好平衡冲突与空间。
- **JDK8 扩容迁移优化**：因为容量是 2 的幂，扩容后元素新位置只有两种可能——**原位置** 或 **原位置 + 旧容量**。判断依据是 `(e.hash & oldCap) == 0`：为 0 留原位，非 0 移到 `oldCap + 原索引`。**无需重新计算 hash**，且用尾插法保持链表相对顺序，避免 JDK7 的死循环。

**追问 1：为什么链表转红黑树的阈值是 8，而转回链表的阈值是 6？**
> **答案：** ① 选 8 是因为泊松分布下链表长度达到 8 的概率极低（约 0.0000006），说明哈希分布已异常，树化是"兜底"。② 红黑树查询 O(log n) 优于链表 O(n)，但**节点内存更大、插入维护成本高**，只在万不得已时树化。③ 转回阈值设为 **6 而非 8**，留出**缓冲区间（7）**，防止长度在 8 附近反复横跳时频繁"树化/退化"造成抖动。④ 还有约束：数组容量 **≥64**（MIN_TREEIFY_CAPACITY）才树化，容量不足时优先扩容。

**追问 2：红黑树相比链表好在哪？为什么不用 AVL 树或普通二叉搜索树？**
> **答案：** 普通 BST 在有序插入时退化为链表 O(n)；红黑树是**自平衡二叉搜索树**，通过颜色与旋转保持大致平衡，查询稳定 O(log n)。相比 AVL 树（严格平衡），红黑树平衡要求较宽松，**插入/删除旋转次数更少**，更适合 HashMap 这种增删频繁的场景（读多写少才更适合 AVL）。

**追问 3：为什么容量必须是 2 的幂？强行用奇数容量会怎样？**
> **答案：** 2 的幂保证 `(n-1)` 二进制全为 1，使 `(n-1) & hash` 均匀映射到每个桶；也让扩容迁移只需判断一个 bit。若用奇数，n-1 末尾有 0，部分桶永远用不到（分布不均），且无法用位运算等价取模。所以 HashMap 的 `tableSizeFor()` 会把任意容量向上取整为 2 的幂。

---

<a id="part-3"></a>

## Part 3：核心区分度题（并发与 ConcurrentHashMap）

> **这一部分是全题的题眼**——能否讲清 HashMap 的并发问题与 ConcurrentHashMap 的实现，直接决定 L2 还是 L3/L4。定级主要看这里。

### Q5. HashMap 在并发场景下有什么问题？为什么会出现死循环和数据丢失？

**标准答案：**
- HashMap **不是线程安全的**，并发 put 有两类典型问题（以 JDK7 的 resize 最典型）：
  - **死循环（CPU 100%）**：JDK7 扩容用**头插法**迁移链表，会把链表顺序反转。多线程同时扩容、交替操作同一链表时，可能形成**环形链表**，导致 get 遍历时陷入无限循环。
  - **数据丢失**：多个线程同时 put 到同一桶，或同时触发 resize，可能造成元素覆盖、size 统计错乱、部分节点丢失。
- JDK8 改进：迁移改为**尾插法**（保持链表顺序），**修复了死循环**；但 HashMap 依然**不安全**——并发 put 仍可能造成数据覆盖（两线程同时命中空桶，后写覆盖先写）。并发场景绝不能用 HashMap。

**追问 1：JDK8 修复了死循环，是不是就能在并发下安全使用了？**
> **答案：** 不是。死循环只是 resize 头插法的特定问题，JDK8 改成尾插法消除了它，但**数据覆盖、可见性、size 不准确**依然存在。例如两个线程同时判断某 bucket 为空并插入，就会互相覆盖。JDK8 的改进只是"不会死循环"，不等于"线程安全"，并发必须用 ConcurrentHashMap 或外部加锁。

**追问 2：HashMap 的哪些操作在并发下特别危险？**
> **答案：** ① put 触发的 resize（JDK7 死循环）；② 同时 put 相同/不同 key 导致覆盖或链表断裂；③ put 与 get 并发，get 可能读到扩容中途的不完整状态；④ 迭代时其他线程修改，抛 ConcurrentModificationException（fail-fast）。根源都是 HashMap 没有任何同步/可见性保障。

---

### Q6. ConcurrentHashMap 在 JDK7 和 JDK8 的实现有什么本质区别？为什么放弃分段锁？

**标准答案：** （能讲清演进动机是 L3+ 的标志）

| 对比维度 | JDK7 ConcurrentHashMap | JDK8 ConcurrentHashMap |
|---------|------------------------|------------------------|
| 底层结构 | Segment[] 分段数组 + HashEntry 链表 | Node[] 数组 + 链表 + 红黑树（同 HashMap） |
| 加锁方式 | **分段锁（Segment 继承 ReentrantLock）** | **CAS + synchronized 锁单个桶的首节点** |
| 锁粒度 | 一个 Segment（默认 16 段，锁一段含多个桶） | 一个桶（首节点），粒度更细 |
| 并发度 | 固定为 Segment 数（默认 16，运行时不可改） | 约等于数组长度，更高 |

- **JDK7 实现**：把数据分成若干 Segment，每个 Segment 是一把独立锁，不同 Segment 可并发写；同一 Segment 内写要竞争锁。
- **JDK8 实现**：彻底去掉 Segment，结构向 HashMap 看齐；put 时若桶为空用 **CAS** 无锁插入，桶非空则对**首节点 synchronized** 加锁后操作。

**为什么放弃分段锁？**
1. **锁粒度更细**：分段锁锁住一整段（多个桶），JDK8 细化到单个桶，并发冲突概率大幅降低。
2. **结构与 HashMap 统一**：省去 Segment 额外层级，代码更简洁、内存占用更低（不用为每个 Segment 建数组）。
3. **synchronized 已足够快**：JDK6 后 JVM 对 synchronized 做了大量优化（偏向锁、轻量级锁、自适应自旋、锁粗化/消除），在细粒度短临界区场景性能不输 ReentrantLock，且无需手动管理锁。

**追问 1：ConcurrentHashMap 的 put 流程具体是怎样的？**
> **答案：** ① key/value 为 null 直接 NPE（不允许 null）；② 计算 hash，table 为空则 CAS 设置 sizeCtl 初始化数组；③ 定位桶，桶为空则用 CAS 把新 Node 放入（无锁）；④ 桶非空且首节点 hash = -1（ForwardingNode，正在扩容）则协助扩容；⑤ 否则 synchronized 锁首节点，遍历链表/红黑树，找到相同 key 覆盖，否则尾插，链表过长则树化；⑥ 最后 `addCount` 更新计数并检查扩容。

**追问 2：为什么 ConcurrentHashMap 的 key 和 value 都不允许为 null？**
> **答案：** 并发场景下 null 会造成**语义二义性**：get(key) 返回 null 时，无法区分"key 不存在"还是"value 本身就是 null"（`containsKey` 在并发下也无法原子判断）。为避免歧义，ConcurrentHashMap 直接禁止 null key/value。HashMap 则允许一个 null key 和多个 null value，因为单线程下语义可控。

---

### Q7. ConcurrentHashMap 如何扩容？size() 是怎么统计的？

**标准答案：**
- **多线程协同扩容（transfer）**：
  - 一个线程触发扩容时，先把 table 扩容为 2 倍并开始迁移；迁移中的桶放一个 **ForwardingNode（hash = -1）** 作为标记。
  - 其他线程 put 时若发现首节点是 ForwardingNode，会**加入协助迁移**而非阻塞等待。
  - 迁移任务按桶区间切分（通过 `transferIndex` CAS 分配），每个线程领取一段（stride，默认 16）逐段迁移，全部完成才切换新 table。
  - 好处：把扩容这个重操作**分摊给多个并发线程**，避免单线程扩容成为瓶颈。
- **size 统计**：
  - JDK7：每个 Segment 有独立 count，全局 size 是各段 count 之和；为保证准确，统计时会多次尝试（比较 modCount 是否变化，变了就重来）。
  - JDK8：用 **baseCount + CounterCell[]**（类似 **LongAdder** 的分段计数思想）。并发更新先 CAS 累加 baseCount，失败则随机落到某个 CounterCell 里 CAS 累加；`size()` 返回 baseCount 与所有 CounterCell 的和。高并发下比单一计数器竞争小、更准确高效。

**追问 1：什么是 ForwardingNode？它起什么作用？**
> **答案：** ForwardingNode 是扩容时放在**已迁移桶**上的特殊节点，hash 固定为 -1，内部持有新 table 引用。作用有二：① **标记**该桶已迁移完成；② 其他线程 get 到它会转发到新 table 查找，put 到它会**主动协助扩容**。这是实现多线程协同扩容的关键机制。

**追问 2：size() 返回的值是绝对精确的吗？**
> **答案：** 高并发下 size() 返回的是**近似准确值**——统计瞬间可能有线程继续 put/remove，baseCount 与 CounterCell 可能在读取时变化。它不保证强一致，但对"监控、容量估算"完全够用。若需强一致全局快照就要加全局锁、牺牲并发性，而 ConcurrentHashMap 的设计目标本就不是强一致 size。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题

### Q8. HashSet、LinkedHashMap、TreeMap 的底层是什么？有什么区别？如何用 List 去重？

**标准答案：**
- **HashSet**：底层是 **HashMap**，元素作 key、value 是固定 `PRESENT` 对象；无序、允许 null、线程不安全，靠 hashCode + equals 判重。
- **LinkedHashMap**：继承 HashMap，额外维护**双向链表**记录顺序；默认插入顺序，`accessOrder=true` 则按访问顺序（get 也调整），可重写 `removeEldestEntry` 实现 **LRU 缓存**。
- **TreeMap**：底层**红黑树**，按 key 自然排序（Comparable）或 Comparator 排序，查询/增删 O(log n)，实现 SortedMap / NavigableMap，支持 firstKey、lastKey、subMap、floorKey 等导航方法。
- **三者选型**：快且无序用 HashSet/HashMap；保持插入/访问顺序用 LinkedHashMap；按 key 排序或范围查询用 TreeMap。

**追问 1：HashSet 如何保证元素不重复？为什么重写 equals 必须重写 hashCode？**
> **答案：** HashSet 借 HashMap 的 key 机制去重：先算 hash 定位桶，再用 equals 比较。若只重写 equals 不重写 hashCode，两个"相等"对象会因 hashCode 不同而落到不同桶，导致 HashSet 认为是不同元素而重复存入。所以 **equals 相等的对象必须有相同 hashCode**，这是 Java 对象契约，也是哈希集合正确工作的前提。

**追问 2：List 去重有哪些方法？各自特点？**
> **答案：** ① `new ArrayList<>(new HashSet<>(list))`：简单但不保序；② `new LinkedHashSet<>(list)`：**保序去重**，最常用；③ `new TreeSet<>(list)`：去重且排序（元素须可比较）；④ Java 8 Stream：`list.stream().distinct().collect(toList())`：保序、声明式，底层也是 LinkedHashSet 思想。去重都依赖元素 equals/hashCode 正确实现。

---

### Q9. fail-fast 和 fail-safe 有什么区别？遍历时删除元素怎么才安全？

**标准答案：**
- **fail-fast（快速失败）**：
  - 代表：ArrayList、HashMap 等**普通集合**。
  - 迭代器持有 `expectedModCount`，遍历时若检测到 `modCount != expectedModCount`（集合被结构性修改：增删），立即抛 **ConcurrentModificationException**。
  - 注意：它是 **best-effort（尽力而为）**，不保证一定抛出，不能依赖它做正确性保证，只用于"尽早暴露 bug"。
- **fail-safe（安全失败）**：
  - 代表：ConcurrentHashMap、CopyOnWriteArrayList 等**并发容器**。
  - 遍历基于**快照或弱一致性视图**，遍历期间集合被修改**不抛异常**；迭代器可能看不到最新修改（弱一致性），但不会 fail-fast。
- **遍历时安全删除**：
  - 用 `Iterator.remove()`（会同步更新 expectedModCount，不抛异常）；
  - Java 8+ 用 `collection.removeIf(predicate)`；
  - 或用 Stream 过滤生成**新集合**，而非在原集合上改；
  - 并发场景用 ConcurrentHashMap 的 `keySet().remove()` / CopyOnWriteArrayList。

**追问 1：为什么 foreach 里直接 list.remove() 会抛异常，而 Iterator.remove() 不会？**
> **答案：** foreach 底层就是用 Iterator 遍历，但删除调用的是**集合自身的 remove()**，它只改 modCount，不改 Iterator 的 expectedModCount，于是下次迭代检测到不一致就抛 ConcurrentModificationException。而 `Iterator.remove()` 删除后会**同步把 expectedModCount 更新为新的 modCount**，两者保持一致，所以安全。

**追问 2：fail-safe 的"弱一致性"具体指什么？**
> **答案：** 指迭代器反映的是**创建那一刻（或某中间状态）的快照**，遍历中其他线程的修改**可见性不保证**——可能看到也可能看不到最新值，但不抛异常。如 ConcurrentHashMap 迭代器是弱一致的，CopyOnWriteArrayList 基于不可变数组快照（遍历时完全看不到后续修改）。这是用"一致性强度"换"并发遍历不中断"的权衡。

---

### Q10. Collections 工具类常用的方法有哪些？HashMap 有哪些线程安全的替代方案？

**标准答案：**
- **Collections 工具类**（注意与 Collection 接口区分：Collection 是接口，Collections 是工具类）：
  - 排序/查找：`sort`、`reverse`、`shuffle`、`binarySearch`、`rotate`、`swap`、`max/min`、`fill`、`copy`。
  - 不可变视图：`unmodifiableList/Set/Map`（只读包装，修改抛 UnsupportedOperationException）。
  - 同步包装：`synchronizedList/Map/Set`（每个方法加 synchronized，全表锁，性能差）；单例/空集合：`singletonList`、`emptyList`、`nCopies`。
- **HashMap 的线程安全替代方案**（按推荐度）：
  1. **ConcurrentHashMap**（首选）：CAS + synchronized 单桶锁，并发度高，适合高并发读写。
  2. **Collections.synchronizedMap(new HashMap<>())**：所有方法 synchronized 串行化，简单但性能低。
  3. **Hashtable**：遗留类，全表 synchronized，不允许 null key/value，已不推荐。
  4. **外部显式加锁**：用 `synchronized` / `ReentrantLock` 包住 HashMap 操作，灵活但须自己保证所有访问路径都加锁。

**追问 1：Collections.synchronizedMap 和 ConcurrentHashMap 性能差距为什么这么大？**
> **答案：** synchronizedMap 对**整个 Map 加一把全局锁**，所有读写互斥串行，并发度 = 1；ConcurrentHashMap 把锁粒度细化到**单个桶**（JDK8 甚至 CAS 无锁读/插空桶），不同桶可并发读写，并发度≈数组长度。锁粒度决定了二者在高并发下的性能鸿沟。

**追问 2：Collections.unmodifiableList 返回的集合"真的"不可变吗？**
> **答案：** 它返回的是**不可修改的视图（包装）**，不是副本：对包装对象 add/remove/set 抛异常，但若**原集合被外部改动，视图会看到变化**。所以不是严格不可变。真正的不可变集合是 JDK9+ 的 `List.of` / `Set.of` / `Map.of`，自身不可变且拒绝 null。这是"视图只读"与"对象不可变"的区别。

---

<a id="part-5"></a>

## Part 5：2026 新趋势：JDK 21+ 集合演进

> 加分题，考察候选人的技术视野。

### Q11. JDK 21 在集合框架上有哪些重要演进？虚拟线程下用 ConcurrentHashMap 要注意什么？

**标准答案：**
- **JEP 431：Sequenced Collections（序列集合）** —— JDK 21 正式引入，是集合框架多年最大的一次 API 演进：
  - 新增三个接口：**SequencedCollection**、**SequencedSet**、**SequencedMap**，统一表达"有明确顺序"的集合。
  - `List`、`Deque` 实现 SequencedCollection；`LinkedHashSet` 实现 SequencedSet；`LinkedHashMap` 实现 SequencedMap。
  - 新增统一方法：`reversed()`（逆序视图）、`getFirst()`/`getLast()`、`addFirst()`/`addLast()`、`removeFirst()`/`removeLast()`。以前 List 用 get(0)/get(size-1)、Deque 用 peekFirst/peekLast，现在有了统一语义。
- **不可变集合（Immutable Collections）**：
  - JDK9 引入 `List.of()` / `Set.of()` / `Map.of()` / `Map.ofEntries()`，JDK21 继续完善；**真正不可变**、拒绝 null、防拷贝安全，是 `Collections.unmodifiableXxx`（仅视图）的更优替代。
  - 配合 SequencedCollection，`reversed()` 对不可变序列集合也返回不可变逆序视图，函数式风格更完整。
- **虚拟线程（JEP 444，JDK21 正式）下 ConcurrentHashMap 的注意点**：
  - ConcurrentHashMap 对桶的写用 **synchronized**（平台级 monitor）。虚拟线程在 synchronized 块内发生阻塞/竞争时可能 **pin 住载体线程（carrier thread）**，使其无法调度其他虚拟线程，削弱可扩展性（该 pinning 问题在 JDK24 的 **JEP 491** 中已大幅解决）。
  - 大量虚拟线程同时竞争**热点 key（同一桶）**会退化为串行，成为瓶颈。应尽量让 key 分散、缩短临界区，或把热点状态用 `LongAdder` / `Atomic` / ThreadLocal 分片转移，而不是靠 ConcurrentHashMap 扛热点写。

**追问 1：SequencedCollection 的 reversed() 返回的是新集合还是视图？修改原集合会怎样？**
> **答案：** 返回的是**逆序视图（view）**，不是副本。对视图的修改会反映到原集合，反之亦然（若原集合可变），如 `list.reversed().add(x)` 等价于在原 list 头部插入 x。对不可变集合，reversed() 返回不可变逆序视图。注意：不要在遍历原集合时通过逆序视图修改它，仍会触发 fail-fast。

**追问 2：虚拟线程时代，为什么"热点桶竞争"比传统线程池更值得关注？**
> **答案：** 传统线程池线程数有限（如 200），竞争规模有上限；虚拟线程可瞬间创建上百万个，一旦大量虚拟线程争抢 ConcurrentHashMap 同一个桶（synchronized），就会形成严重串行点和 carrier pinning，把高并发系统"压扁"成串行瓶颈。所以虚拟线程下更强调**减少共享可变状态、打散热点 key**，这正是无共享设计在虚拟线程时代更受重视的原因。

---

<a id="part-6"></a>

## Part 6：能否用集合框架定级？如何定级？

### 结论先行

**可以，集合框架是 Java 基础里区分度最高的探针之一**——它天然分层：会用 API → 知道底层数据结构 → 懂 HashMap 扩容/hash 设计 → 懂并发容器实现 → 懂体系演进与选型。集合人人都会用，但**真正讲清"为什么这样设计"的人极少**，正好用来拉开差距。但要注意：HashMap 源码较深，对初中级候选人不要一上来就问源码，否则只会考出背诵。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 会用 List/Set/Map 常用 API，知道 ArrayList 是数组、HashMap 存键值对；说不清底层与扩容 |
| **中级（L2）** | 2–5 年 | Part 2 | 知道 HashMap 是数组+链表+红黑树、负载因子 0.75、2 的幂、简单扩容过程 |
| **中高级（L3）** | 5–8 年 | Part 3 | 能讲清 hash 扰动、扩容迁移、8/6 树化阈值、HashMap 并发死循环、ConcurrentHashMap JDK7/8 差异 |
| **高级（L4）** | 8 年+ | Part 4 | 能说清协同扩容 transfer、size 计数、fail-fast/fail-safe 本质、并发容器选型与生产踩坑 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 理解 JDK21 SequencedCollection 等演进、不可变集合、虚拟线程下并发容器的取舍与体系化选型 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"Collection/Map 两大体系 + HashMap 数组+链表+红黑树 + 负载因子"→ 至少 L2；只知道"HashMap 存键值对、List 有 ArrayList/LinkedList"→ 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追问"为什么"：
- 为什么负载因子是 0.75 而不是 1？（空间/时间折中 + 泊松分布）
- 为什么容量是 2 的幂？（均匀寻址 + 高效扩容迁移）
- 为什么 8 转树、6 退树？（防抖动缓冲带）
- 为什么 ConcurrentHashMap 弃用分段锁？（锁粒度 + synchronized 优化）

**第三步：三类信号防背题。**
1. **真实性**：能否结合生产经历讲出 HashMap 并发踩坑、ConcurrentHashMap 选型、fail-fast 异常的实战案例。
2. **抽象能力**：能否把 HashMap / HashSet / LinkedHashMap / ConcurrentHashMap 统一到"哈希表 + 链表/树 + 不同并发策略"的框架下理解——这是理解集合设计思想的关键。
3. **权衡能力**：能否讲清负载因子、树化阈值、锁粒度、fail-fast vs fail-safe 背后的时间/空间/并发取舍。

**第四步：按最深层级定级，不按正确率。** 结合岗位难度调整追问深度——业务开发问到 Part 3/4 足够，基础架构/中间件团队才需要 Part 5 的演进与虚拟线程理解。

---

### 面试官避坑提醒

- **不要对所有人问到源码级**——HashMap 源码（红黑树、transfer）复杂，很多优秀中级工程师没背源码但理解设计思想。区分"理解设计"和"背过源码"，前者更有价值。
- **把"HashMap 并发问题 + ConcurrentHashMap 实现"作为 L3/L4 分水岭**：能讲清 JDK7 死循环成因、JDK8 CAS+synchronized、协同扩容的人，一定是真懂并发容器。
- **警惕"背结论不懂原理"**：能背"负载因子 0.75、8 转树"但说不出为什么的，最多 L2。一定要追"为什么"。
- **结合岗位**：CRUD 业务开发问到 Part 2/3 即可；高并发/中间件/基础架构岗位才需要 Part 4/5 的深度。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**

1. 集合框架两大体系？→（Collection：List/Set/Queue；Map 独立）
2. ArrayList vs LinkedList？→（动态数组 O(1) 随机访问 vs 双向链表；实际多选 ArrayList）
3. HashMap 底层结构？→（数组+链表+红黑树；`(n-1)&hash` 定位）
4. hash 算法与 2 的幂？→（`h^(h>>>16)` 扰动；2 的幂便于均匀寻址与扩容）
5. 负载因子与树化？→（0.75 折中；8 转树/6 退树防抖动；容量≥64 才树化）
6. 扩容迁移？→（2 倍扩容；`(e.hash & oldCap)==0` 决定原位或 +oldCap，无需重算 hash）
7. HashMap 并发问题？→（JDK7 头插法死循环；JDK8 尾插法修死循环但仍数据覆盖不安全）
8. ConcurrentHashMap JDK7 vs JDK8？→（分段锁 vs CAS+synchronized 单桶；弃用分段锁因粒度粗、synchronized 优化）
9. 协同扩容与 size？→（ForwardingNode 标记 + 多线程协助迁移；baseCount+CounterCell 类 LongAdder）
10. HashSet/LinkedHashMap/TreeMap？→（HashMap 包装 / 双向链表保序或 LRU / 红黑树排序）
11. fail-fast vs fail-safe？→（普通集合抛 CME / 并发容器弱一致；用 Iterator.remove 安全删除）
12. 线程安全替代方案？→（ConcurrentHashMap 首选 > synchronizedMap > Hashtable）
13. JDK21 新趋势？→（JEP431 SequencedCollection、不可变集合、虚拟线程下热点桶 pinning 与 JEP491）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–8 问 → L3
- 答到第 9–12 问 + 能讲清并发选型 → L4
- 答到第 13 问 + 体系化权衡 → L5

**一票否决信号：** 认为"HashMap 是线程安全的"、说不清"为什么容量是 2 的幂 / 负载因子 0.75"、认为"JDK8 HashMap 修了死循环就能并发用"、把 fail-fast 说成"一定会抛异常" → 无论年限，最高 L2。

---

*资料整理于 2026-11-19，参考 JDK 源码（HashMap / ConcurrentHashMap / ArrayList）、《Java 并发编程实战》、JEP 431（JDK21 Sequenced Collections）、JEP 444（虚拟线程）、JEP 491（JDK24 synchronized 无 pinning）及 2026 年 Java 面试趋势资料。*
