---
title: 面向对象设计题（LRU · 哈希表 · 停车场 · 呼叫中心 · 聊天服务 · 扑克牌）
date: 2026-11-05
summary: primer 里的 6 道面向对象设计题，给出类图思路和 Java 实现：LRU 缓存、哈希表、停车场、呼叫中心、聊天服务、扑克牌（21 点），每题附追问。
kind: primer
---

面向对象设计（OOD）题考的是：**能不能从需求里抽出合适的类、职责和关系，并写出可扩展的代码。** 答题步骤是：澄清需求 → 找出核心对象（名词）→ 定义行为（动词）→ 画类图或写接口 → 写核心代码 → 讨论扩展。题目来自 [system-design-primer](https://github.com/donnemartin/system-design-primer/blob/master/README-zh-Hans.md)，代码改写为 Java。

---

### 1. 设计 LRU 缓存（中级）

**主问：** 实现一个 LRU 缓存，`get` 和 `put` 都要 O(1)，容量满了以后淘汰最久没被访问的数据。

**参考答案：** 哈希表加双向链表。哈希表负责 O(1) 定位节点；双向链表维护访问顺序，最近访问的放在头部，淘汰时删除尾部。

```java
class LRUCache<K, V> {
    private final class Node { K k; V v; Node prev, next; Node(K k, V v){this.k=k;this.v=v;} }
    private final int cap;
    private final Map<K, Node> map = new HashMap<>();
    private final Node head = new Node(null, null), tail = new Node(null, null); // 哨兵节点

    LRUCache(int cap) { this.cap = cap; head.next = tail; tail.prev = head; }

    public V get(K k) {
        Node n = map.get(k);
        if (n == null) return null;
        unlink(n); addFirst(n);
        return n.v;
    }

    public void put(K k, V v) {
        Node n = map.get(k);
        if (n != null) { n.v = v; unlink(n); addFirst(n); return; }
        if (map.size() == cap) { Node lru = tail.prev; unlink(lru); map.remove(lru.k); }
        n = new Node(k, v); map.put(k, n); addFirst(n);
    }

    private void unlink(Node n) { n.prev.next = n.next; n.next.prev = n.prev; }
    private void addFirst(Node n) { n.next = head.next; n.prev = head; head.next.prev = n; head.next = n; }
}
```

**快捷写法：** 继承 `LinkedHashMap`，构造时传入 `accessOrder=true`，再重写 `removeEldestEntry` 方法。面试时一般要求手写上面这个版本。

**追问：**

1. 怎么改成线程安全？（整体加锁最简单；高并发时按 Key 分段加锁；或者直接用 Caffeine，它用的是 W-TinyLFU 算法）
2. LRU 和 LFU 有什么区别？（LFU 按访问频次淘汰，能抵抗偶发的批量扫描把热点数据挤出去；实现上需要按频次分桶）
3. Redis 的 LRU 是精确的吗？（不是。Redis 是随机抽样一批 Key，从中淘汰最久没访问的，属于近似 LRU，用来节省内存）

### 2. 设计哈希表（中级）

**主问：** 不用语言内置的 Map，自己实现一个哈希表，支持 `put`、`get`、`remove`。

**参考答案：**
- **结构：** 数组加链表（拉链法）。下标 = `hash(key) & (capacity - 1)`，容量取 2 的幂，这样可以用位运算代替取模。
- **扩容：** 元素个数超过「容量 × 负载因子（0.75）」时，容量翻倍并重新分配所有元素。
- **冲突处理：**
  - 拉链法：同一个下标的元素用链表串起来，Java 8 在链表长度超过 8 时改成红黑树；
  - 开放寻址法：冲突时往后找空位（线性探测、二次探测），对 CPU 缓存更友好，但删除时要做标记。

```java
class MyHashMap<K, V> {
    static class Entry<K, V> { final K k; V v; Entry<K, V> next; Entry(K k, V v, Entry<K, V> n){this.k=k;this.v=v;this.next=n;} }
    private Entry<K, V>[] table = new Entry[16];
    private int size;

    private int idx(Object k, int len) { int h = k.hashCode(); return (h ^ (h >>> 16)) & (len - 1); }

    public V get(K k) {
        for (Entry<K, V> e = table[idx(k, table.length)]; e != null; e = e.next) if (e.k.equals(k)) return e.v;
        return null;
    }

    public void put(K k, V v) {
        int i = idx(k, table.length);
        for (Entry<K, V> e = table[i]; e != null; e = e.next) if (e.k.equals(k)) { e.v = v; return; }
        table[i] = new Entry<>(k, v, table[i]);
        if (++size > table.length * 3 / 4) resize();
    }

    private void resize() {
        Entry<K, V>[] old = table; table = new Entry[old.length << 1];
        for (Entry<K, V> head : old)
            for (Entry<K, V> e = head; e != null; ) { Entry<K, V> nx = e.next; int i = idx(e.k, table.length); e.next = table[i]; table[i] = e; e = nx; }
    }
}
```

**追问：** 为什么要做 `h ^ (h >>> 16)`？（把高 16 位的信息混到低位里。容量较小时，下标只取决于低几位，不混合的话高位的差异就被浪费了，冲突会更多）

### 3. 设计停车场（初级～中级）

**主问：** 设计一个停车场系统：有多层，车位分摩托车、普通车、大车三种；车辆进场时分配车位，出场时计费。

**参考答案：**

```text
ParkingLot ── 1..* ── Level ── 1..* ── ParkingSpot(size, isFree)
Vehicle(abstract)：Motorcycle / Car / Bus  —— canFitIn(spot)
Ticket(vehicle, spot, entryTime) ；FeeStrategy(计费策略)
```

```java
enum SpotSize { SMALL, COMPACT, LARGE }

abstract class Vehicle {
    abstract SpotSize size();
    boolean canFitIn(ParkingSpot s) { return s.size.ordinal() >= size().ordinal(); }
}
class Car extends Vehicle { SpotSize size() { return SpotSize.COMPACT; } }

class ParkingSpot {
    final SpotSize size; Vehicle vehicle;
    ParkingSpot(SpotSize s) { size = s; }
    boolean isFree() { return vehicle == null; }
}

class ParkingLot {
    private final List<ParkingSpot> spots;
    private final FeeStrategy fee;
    private final Map<String, Ticket> active = new ConcurrentHashMap<>();

    synchronized Ticket park(String plate, Vehicle v) {
        ParkingSpot s = spots.stream().filter(p -> p.isFree() && v.canFitIn(p))
            .min(Comparator.comparing(p -> p.size)).orElseThrow(() -> new IllegalStateException("满了"));
        s.vehicle = v;
        Ticket t = new Ticket(plate, s, Instant.now());
        active.put(plate, t);
        return t;
    }

    synchronized long leave(String plate) {
        Ticket t = active.remove(plate);
        t.spot().vehicle = null;
        return fee.calc(t.entry(), Instant.now(), t.spot().size);
    }
}
interface FeeStrategy { long calc(Instant in, Instant out, SpotSize size); }
record Ticket(String plate, ParkingSpot spot, Instant entry) {}
```

**设计要点：**
- 车辆类型用继承或枚举表示，`canFitIn` 把「哪种车能停哪种车位」的规则封装起来。
- 计费用**策略模式**，按小时计费、包月、节假日费率都可以替换。
- 空闲车位查询的优化：按车位类型维护各自的空闲队列，分配是 O(1)，不用每次遍历所有车位。

**追问：**
1. 大巴要占连续 5 个车位怎么办？（每层按排组织车位，寻找连续的空闲车位）
2. 多个入口同时进车，会不会把同一个车位分给两辆车？（分配操作加锁，或者对车位做 CAS 抢占；分布式部署时用数据库的条件更新）

### 4. 设计呼叫中心（中级）

**主问：** 呼叫中心有三级员工：接线员、主管、经理。来电先分配给空闲的接线员，接线员处理不了就升级给主管，主管处理不了再升级给经理。都忙的时候排队等待。

**参考答案：**
- **核心对象：** `Employee`（抽象类，有级别和是否空闲两个属性）、`Operator`、`Supervisor`、`Director`、`Call`（来电，带当前级别）、`CallCenter`（负责分配和排队）。
- **分配逻辑：** 按 `call.level` 从对应级别的员工里找空闲的人；没有空闲的就放进对应级别的等待队列；员工处理完一个来电，就从队列里取下一个。
- **升级：** 员工调用 `escalate(call)`，把来电级别加一，重新分配。这就是**责任链模式**的思想。

```java
abstract class Employee {
    final Rank rank; volatile Call current;
    Employee(Rank r) { rank = r; }
    void take(Call c) { current = c; }
    void finish(CallCenter cc) { current = null; cc.onFree(this); }
    void escalate(CallCenter cc) { Call c = current; current = null; c.rank = c.rank.next(); cc.dispatch(c); cc.onFree(this); }
}
enum Rank { OPERATOR, SUPERVISOR, DIRECTOR; Rank next() { return values()[Math.min(ordinal() + 1, 2)]; } }

class CallCenter {
    private final Map<Rank, List<Employee>> staff;
    private final Map<Rank, Queue<Call>> waiting = new EnumMap<>(Rank.class);

    synchronized void dispatch(Call c) {
        staff.get(c.rank).stream().filter(e -> e.current == null).findFirst()
            .ifPresentOrElse(e -> e.take(c), () -> waiting.computeIfAbsent(c.rank, r -> new ArrayDeque<>()).add(c));
    }
    synchronized void onFree(Employee e) {
        Call next = waiting.getOrDefault(e.rank, new ArrayDeque<>()).poll();
        if (next != null) e.take(next);
    }
}
```

**追问：** 想按技能分配来电（比如英语客服、VIP 客户优先）怎么改？（给员工加技能标签，来电带上所需技能和优先级，等待队列改成优先级队列，分配逻辑抽成可替换的策略）

### 5. 设计聊天服务（中级～高级）

**主问：** 设计一个聊天服务的核心对象模型：用户可以加好友、发起私聊和群聊、发送消息、查看历史记录。

**参考答案：**

```text
User(id, name, friends, chats)
  ├─ sendFriendRequest / accept / reject
Chat(abstract, id, members, messages)
  ├─ PrivateChat（固定两人）
  └─ GroupChat（add/remove member, owner）
Message(id, sender, chatId, content, timestamp, status)
FriendRequest(from, to, status: PENDING/ACCEPTED/REJECTED)
UserService / ChatService（应用服务：编排、权限校验）
```

**设计要点：**
- `PrivateChat` 和 `GroupChat` 继承同一个 `Chat`，共享发送消息、获取历史记录这些行为；群聊额外有成员管理和群主权限。
- 消息的状态流转：已发送 → 已送达 → 已读，可以用状态模式表示。
- 好友申请的状态也是一个小状态机。
- **分层：** 领域对象只负责业务规则，比如「非好友不能发起私聊」；连接管理、推送、存储放在基础设施层。这样领域模型不依赖 WebSocket 这类技术细节。

**扩展到系统设计：**
- 长连接网关维护用户和连接的对应关系；
- 消息先落库再推送，按会话 ID 分片存储；
- 用户离线时走推送通道；
- 多端同步靠消息序号（seq），客户端按序号增量拉取。

详见 [架构师分级题 · IM](/posts/architect/architect-tiered-interview/#q8)。

**追问：** 群聊有 1 万人，发一条消息要存 1 万份吗？（不用。消息只存一份，每个成员只记录自己读到的位置（已读序号）；推送时按在线状态做扩散）

### 6. 设计扑克牌游戏（21 点）（初级～中级）

**主问：** 设计一副通用的扑克牌，并在它的基础上实现 21 点游戏。

**参考答案：**

```java
enum Suit { HEART, SPADE, CLUB, DIAMOND }
record Card(Suit suit, int rank) {}  // rank 1..13

class Deck {
    private final Deque<Card> cards = new ArrayDeque<>();
    Deck() {
        List<Card> all = new ArrayList<>();
        for (Suit s : Suit.values()) for (int r = 1; r <= 13; r++) all.add(new Card(s, r));
        Collections.shuffle(all);
        cards.addAll(all);
    }
    Card deal() { return cards.pop(); }
}

class Hand {
    protected final List<Card> cards = new ArrayList<>();
    void add(Card c) { cards.add(c); }
}

class BlackjackHand extends Hand {
    int score() {   // A 可以算 1 或 11，取不爆牌的最大值
        int sum = 0, aces = 0;
        for (Card c : cards) { int v = Math.min(c.rank(), 10); if (c.rank() == 1) { aces++; v = 11; } sum += v; }
        while (sum > 21 && aces-- > 0) sum -= 10;
        return sum;
    }
    boolean busted() { return score() > 21; }
}
```

**设计要点：** `Card`、`Deck`、`Hand` 是**通用**的；21 点的计分规则放在子类 `BlackjackHand` 里。以后要实现德州扑克，只需要再写一个 `PokerHand`，前面的通用部分不用改，这就是开闭原则。

**追问：** 怎么保证洗牌是公平的？（用 Fisher–Yates 算法，`Collections.shuffle` 就是这个实现；线上的真钱游戏还要用安全随机数 `SecureRandom`，并接受审计）

---

## 面试官评分要点

| 维度 | 初级 | 中级 | 高级 |
| --- | --- | --- | --- |
| 需求澄清 | 直接写代码 | 先问清边界条件 | 主动区分核心需求和扩展需求 |
| 抽象 | 写出一个大类 | 职责拆分合理 | 能用上合适的模式（策略、状态、责任链），而且不过度设计 |
| 代码 | 能运行 | 能处理边界，命名清晰 | 考虑并发、可测试性，便于扩展 |
| 扩展讨论 | 没有 | 能回答追问 | 能从对象模型推广到系统设计 |

## 相关文章

- [系统设计入门导读](/posts/system-design/overview/)
- [设计模式核心面试题](/posts/design-patterns/patterns-interview/)
- [系统设计题（primer 版）](/posts/system-design/design-questions/)
