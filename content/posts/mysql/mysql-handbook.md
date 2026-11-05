---
title: 数据库专题深度面试手册
date: 2026-11-05
summary: 索引、SQL 优化、事务与隔离级别、MVCC、锁、分库分表、读写分离、Binlog 与大表优化。
interview: false
kind: handbook
---

> 面向 3-5 年+ Java 开发者 | 以 MySQL InnoDB 为核心 | 覆盖阿里/美团/字节/腾讯高频追问

---

## 一、索引原理与优化

### 1.1 B+ 树原理详解

#### 为什么 InnoDB 选择 B+ 树而不是 B 树 / Hash / 红黑树？

InnoDB 的磁盘 I/O 模型决定了索引数据结构的选择。磁盘读取的最小单位是**页（Page，默认 16KB）**，因此索引结构的核心目标是：**用最少的磁盘 I/O 找到目标数据**。

**B+ 树 vs B 树：**
- B 树的非叶子节点也存储数据（data），导致每个节点能容纳的 key 数量减少，树的高度更高，I/O 次数更多。
- B+ 树的非叶子节点只存储 key + 指针，一个 16KB 的页可以存放约 **1170 个指针**（假设主键为 bigint 8B + 指针 6B），三层 B+ 树即可索引约 `1170 × 1170 × 16 ≈ 2 千万行`数据，仅需 **3 次磁盘 I/O**。
- B+ 树的叶子节点通过**双向链表**连接，天然支持范围查询和排序。

**B+ 树 vs Hash 索引：**

| 维度 | B+ 树 | Hash 索引 |
|------|-------|-----------|
| 等值查询 | O(log n)，需 2-3 次 I/O | O(1)，直接定位 |
| 范围查询 | 支持，叶子链表顺序遍历 | **不支持** |
| 排序 | 支持 | 不支持 |
| 最左前缀 | 支持 | 不支持 |
| 哈希冲突 | 无 | 存在退化风险 |

**B+ 树 vs 红黑树：**
红黑树是二叉树，高度为 `O(log2 n)`，千万级数据高度约 23 层，即 23 次 I/O。B+ 树是多路平衡树（扇出因子约 1170），高度仅 3-4 层。

#### 源码关键类
- `page0page.cc`：B+ 树页管理
- `btr0btr.cc`：B+ 树的增删改查操作
- `btr0cur.cc`：B+ 树游标定位

### 1.2 聚簇索引 vs 非聚簇索引

```
聚簇索引（主键索引）          二级索引（非聚簇索引）
┌─────────────┐              ┌─────────────┐
│  非叶子节点   │              │  非叶子节点   │
│  [PK值|指针]  │              │  [索引列|指针] │
└──────┬──────┘              └──────┬──────┘
       │                            │
┌──────▼──────┐              ┌──────▼──────┐
│   叶子节点    │              │   叶子节点    │
│ [PK值|完整行] │              │ [索引列|PK值] │
└─────────────┘              └─────────────┘
```

**回表（Back to Primary Key）：** 通过二级索引找到 PK，再回聚簇索引查完整行。这是二级索引查询性能低于覆盖索引的根本原因。

**为什么 InnoDB 必须有主键？**
如果没有显式定义主键，InnoDB 会选择第一个**非空唯一索引**；若也没有，则自动生成一个 6 字节的隐藏列 `DB_ROW_ID` 作为聚簇索引的 key。

### 1.3 覆盖索引

当查询所需的所有列都包含在索引中时，无需回表，直接从索引中返回数据。

```java
// 建索引：CREATE INDEX idx_name_age ON user(name, age);
// 覆盖索引生效 — EXPLAIN Extra 显示 "Using index"
SELECT name, age FROM user WHERE name = '张三';

// 覆盖索引不生效 — 需要回表查 email 列
SELECT name, age, email FROM user WHERE name = '张三';
```

**生产经验：** 高频查询的字段组合优先考虑覆盖索引，可以将查询性能提升一个数量级。但要注意索引宽度，过宽的索引会降低写性能。

### 1.4 最左前缀匹配原则

联合索引 `(a, b, c)` 在 B+ 树中的排序规则是：**先按 a 排序，a 相同再按 b 排序，b 相同再按 c 排序**。

```sql
-- ✅ 命中索引
WHERE a = 1 AND b = 2 AND c = 3   -- 全部命中
WHERE a = 1 AND b = 2             -- 命中 a, b
WHERE a = 1                       -- 命中 a
WHERE a = 1 AND c = 3             -- 命中 a（c 无法跳跃使用）

-- ❌ 无法命中
WHERE b = 2 AND c = 3             -- 缺少最左列 a
WHERE c = 3                       -- 缺少最左列 a
```

**MySQL 8.0 索引跳跃扫描（Index Skip Scan）：** 当最左列的基数很低时（如性别），优化器可以"跳跃"遍历最左列的不同值，等效于多次等值查询。

### 1.5 索引下推（Index Condition Pushdown，ICP）

MySQL 5.6 引入。在索引遍历过程中，直接在**存储引擎层**对索引包含的列进行条件判断，减少回表次数。

```sql
-- 联合索引 idx(name, age)
SELECT * FROM user WHERE name LIKE '张%' AND age = 25;

-- 无 ICP：存储引擎找到所有 name LIKE '张%' 的行 → 全部回表 → Server 层过滤 age=25
-- 有 ICP：存储引擎找到 name LIKE '张%' 的行 → 直接在索引中判断 age=25 → 只对满足条件的回表
-- EXPLAIN Extra 显示 "Using index condition"
```

### 1.6 索引失效的 N 种场景

| 场景 | 示例 | 原因 |
|------|------|------|
| 函数操作 | `WHERE YEAR(create_time) = 2024` | 对索引列施加函数，破坏 B+ 树有序性 |
| 隐式类型转换 | `WHERE phone = 13800138000`（phone 为 varchar） | MySQL 将 varchar 转为数字比较，等价于 `CAST(phone AS signed)` |
| 前缀模糊 | `WHERE name LIKE '%张'` | B+ 树无法定位起始位置 |
| OR 条件 | `WHERE a = 1 OR b = 2`（b 无索引） | 需全表扫描 b 列 |
| 不等于 | `WHERE status != 1` | 优化器判断扫描行数过多，放弃索引 |
| IS NOT NULL | `WHERE name IS NOT NULL` | 取决于数据分布，优化器可能全扫 |

**生产踩坑：**
```java
// 坑：MyBatis 中 #{} 与 ${} 的区别在此处也有影响
// #{param} → PreparedStatement，类型安全
// ${param} → 字符串拼接，可能导致隐式转换
// 排查方法：EXPLAIN + SHOW WARNINGS 看优化器改写后的真实 SQL
```

### 1.7 联合索引设计原则

1. **等值查询列在前，范围查询列在后**（范围查询后的列无法使用索引）
2. **高区分度（Cardinality）列在前**（`SELECT COUNT(DISTINCT col)/COUNT(*) FROM t`）
3. **考虑覆盖索引**：将 SELECT 中的列也包含进索引
4. **避免冗余索引**：`(a, b)` 已包含 `(a)` 的功能


### 1.8 索引合并（Index Merge）

当查询条件涉及多个单列索引时，MySQL 可能使用索引合并优化：

```sql
-- 表有两个独立索引：idx_age(age), idx_city(city)
SELECT * FROM user WHERE age = 25 OR city = '北京';
-- EXPLAIN Extra: Using union(idx_age, idx_city); Using where
```

**三种索引合并策略：**
- **Union（并集）：** 多个索引结果取并集，用于 OR 条件
- **Intersection（交集）：** 多个索引结果取交集，用于 AND 条件
- **Sort-Union：** 先排序再取并集，用于范围 OR 条件

**生产建议：** 出现 Index Merge 通常说明索引设计不够合理。大多数场景下，一个合理的联合索引比多个单列索引的索引合并性能更好。

### 面试追问点

> **Q：一张表最多建多少索引合适？**
> A：没有硬性限制（InnoDB 最多 64 个二级索引），但生产中一般不超过 5-6 个。每个索引都是一棵 B+ 树，会增加写操作开销（INSERT/UPDATE/DELETE 需维护所有索引树）。核心原则是"用查询驱动索引设计"。

> **Q：为什么推荐自增主键？**
> A：自增主键保证新记录总是插入到 B+ 树的最右侧叶子节点，避免**页分裂**（Page Split）。UUID 等随机主键会导致频繁页分裂和页内碎片，写入性能下降 3-5 倍。同时，自增主键占用空间小（4B/8B），二级索引叶子节点存储的 PK 也更小。

> **Q：为什么有时候 EXPLAIN 显示可以走索引但优化器不走？**
> A：优化器是基于**成本模型**（Cost-Based Optimizer）决策的。当回表行数超过总行数的约 **20-30%** 时，全表扫描的顺序 I/O 可能比走索引的随机 I/O 更快。可通过 `FORCE INDEX` 强制走索引，但不推荐。

---

## 二、SQL 优化

### 2.1 EXPLAIN 各字段深度解析

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 100 AND status = 1;
```

| 字段 | 关键值 | 含义 |
|------|--------|------|
| **type** | `system > const > eq_ref > ref > range > index > ALL` | 访问类型，从最优到最差 |
| **key** | 实际使用的索引名 | NULL 表示未走索引 |
| **rows** | 预估扫描行数 | 基于统计信息，非精确值 |
| **filtered** | 存储引擎返回后经 Server 层过滤剩余的百分比 | rows × filtered% = 最终行数 |
| **Extra** | `Using index` / `Using index condition` / `Using where` / `Using filesort` / `Using temporary` | 最核心的优化线索 |

**type 详解：**
- `const`：主键或唯一索引等值查询，最多返回一行
- `eq_ref`：Join 中被驱动表使用主键/唯一索引等值匹配
- `ref`：非唯一索引等值查询
- `range`：索引范围扫描（BETWEEN / IN / > / <）
- `index`：全索引扫描（遍历整棵索引树，但不回表）
- `ALL`：全表扫描，最需优化

### 2.2 慢查询定位与优化流程

```
1. 开启慢查询日志
   SET GLOBAL slow_query_log = 'ON';
   SET GLOBAL long_query_time = 1;  -- 阈值 1 秒

2. 分析慢查询日志
   mysqldumpslow -s t -t 10 /var/log/mysql/slow.log
   -- 或使用 pt-query-digest

3. EXPLAIN 分析执行计划

4. 优化手段：
   → 添加/调整索引
   → 改写 SQL（子查询 → Join、OR → UNION）
   → 分页优化（深分页用延迟关联）
   → 减少返回列（避免 SELECT *）
```

### 2.3 Join 原理

**Simple Nested-Loop Join（SNLJ）：**
```
for each row in 驱动表 t1:
    for each row in 被驱动表 t2:
        if t1.key == t2.key: output
```
时间复杂度 O(M × N)，实际 InnoDB 不使用此算法。

**Block Nested-Loop Join（BNL）MySQL 5.6-5.7：**
```
将驱动表的数据批量读入 join_buffer（默认 256KB）
for each batch in join_buffer:
    for each row in 被驱动表:
        对 batch 中的每行做匹配
```
减少了被驱动表的扫描次数：`ceil(M / buffer_size) × N`。

**Hash Join（MySQL 8.0.18+）：**
```
1. Build 阶段：将较小表的 Join 列构建 Hash 表（放入 join_buffer）
2. Probe 阶段：扫描较大表，用 Hash 探测匹配行
```
时间复杂度 O(M + N)，MySQL 8.0.20 后完全取代了 BNL。

| 算法 | 时间复杂度 | 前提 | MySQL 版本 |
|------|-----------|------|------------|
| SNLJ | O(M × N) | — | 理论模型 |
| Index NLJ | O(M × log N) | 被驱动表有索引 | 全版本 |
| BNL | O(M × N / buffer) | 无索引时兜底 | 5.6-8.0.18 |
| Hash Join | O(M + N) | 等值 Join | 8.0.18+ |

**生产经验：** 永远让**小表驱动大表**，并确保被驱动表的 Join 列有索引。`STRAIGHT_JOIN` 可以强制指定驱动表顺序。

### 2.4 子查询优化为 Join

```sql
-- 慢：子查询在 WHERE 中逐行执行（dependent subquery）
SELECT * FROM orders
WHERE user_id IN (SELECT id FROM users WHERE city = '北京');

-- 快：改写为 Join
SELECT o.* FROM orders o
INNER JOIN users u ON o.user_id = u.id
WHERE u.city = '北京';
```

MySQL 5.6+ 对 `IN` 子查询会自动进行 **Semi-Join 优化**（Materialization / FirstMatch / LooseScan），但复杂子查询仍建议手动改写。

### 2.5 分页优化 — 延迟关联

```sql
-- 慢：深分页，OFFSET 越大越慢（需扫描并丢弃前 N 行）
SELECT * FROM orders ORDER BY id LIMIT 1000000, 10;

-- 快：延迟关联，先通过覆盖索引拿到主键，再回表
SELECT o.* FROM orders o
INNER JOIN (
    SELECT id FROM orders ORDER BY id LIMIT 1000000, 10
) AS tmp ON o.id = tmp.id;

-- 更快：游标分页（需要上一页最后一条的 ID）
SELECT * FROM orders WHERE id > #{lastId} ORDER BY id LIMIT 10;
```

### 面试追问点

> **Q：EXPLAIN 中的 rows 为什么不准？**
> A：rows 基于**索引统计信息（Cardinality）**估算，通过采样 `innodb_stats_persistent_sample_pages`（默认 20 页）计算。数据分布不均匀时误差较大。可通过 `ANALYZE TABLE` 重新采样更新统计信息。

> **Q：Using filesort 一定很慢吗？**
> A：不一定。filesort 有两种模式：**双路排序**（回表两次）和**单路排序**（一次读取所有列到 sort_buffer）。如果 sort_buffer_size 足够大、排序数据量小，filesort 在内存中完成，速度很快。慢的是需要**磁盘临时文件排序**的场景。

---

## 三、事务与隔离级别

### 3.1 ACID 详解

| 特性 | 实现机制 | 说明 |
|------|---------|------|
| **A（原子性）** | Undo Log | 事务回滚时通过 undo log 回退数据到事务开始前的状态 |
| **C（一致性）** | 由 A + I + D 共同保证 | 一致性是目标，其他三个是手段 |
| **I（隔离性）** | MVCC + 锁 | 并发事务之间互不干扰 |
| **D（持久性）** | Redo Log + WAL | 事务提交前先写 redo log，即使崩溃也可恢复 |

**Redo Log 的 WAL 机制：**
```
1. 修改 Buffer Pool 中的数据页（脏页）
2. 写 Redo Log Buffer
3. 事务提交时，将 Redo Log Buffer 刷盘（由 innodb_flush_log_at_trx_commit 控制）
   = 0：每秒刷盘，可能丢 1 秒数据
   = 1：每次提交都刷盘（默认，最安全）
   = 2：写到 OS Buffer，OS 崩溃可能丢数据
4. 后台线程定期将脏页刷回磁盘（Checkpoint）
```

### 3.2 四个隔离级别

| 隔离级别 | 脏读 | 不可重复读 | 幻读 | 实现方式 |
|---------|------|-----------|------|---------|
| READ UNCOMMITTED | ✅ | ✅ | ✅ | 无锁，读取最新值 |
| READ COMMITTED（RC） | ❌ | ✅ | ✅ | **每次 SELECT 生成新 ReadView** |
| REPEATABLE READ（RR） | ❌ | ❌ | ❌* | **事务首次 SELECT 生成 ReadView** + 临键锁 |
| SERIALIZABLE | ❌ | ❌ | ❌ | 读加共享锁，写加排他锁 |

> *InnoDB 在 RR 级别通过 MVCC + Next-Key Lock 解决了**大部分**幻读场景，但特定场景仍可能出现（如事务中先快照读再当前读）。

### 3.3 脏读 / 不可重复读 / 幻读

```java
// 脏读：事务 A 读到事务 B 未提交的数据
// TX-A: SELECT balance FROM account WHERE id = 1; → 100
// TX-B: UPDATE account SET balance = 200 WHERE id = 1; (未提交)
// TX-A: SELECT balance FROM account WHERE id = 1; → 200 ← 脏读

// 不可重复读：同一事务中两次读取同一行，结果不同（UPDATE）
// TX-A: SELECT balance → 100
// TX-B: UPDATE balance = 200; COMMIT;
// TX-A: SELECT balance → 200 ← 不可重复读

// 幻读：同一事务中两次范围查询，结果行数不同（INSERT）
// TX-A: SELECT COUNT(*) WHERE age > 20 → 5
// TX-B: INSERT (age=25); COMMIT;
// TX-A: SELECT COUNT(*) WHERE age > 20 → 6 ← 幻读
```

### 3.4 InnoDB RR 如何解决幻读

**快照读（普通 SELECT）：** 通过 MVCC 解决。ReadView 在事务首次读时创建，之后的读都基于该快照，看不到其他事务的新插入行。

**当前读（SELECT ... FOR UPDATE / INSERT / UPDATE / DELETE）：** 通过 **Next-Key Lock（临键锁）** 解决。锁住索引记录及其前面的间隙，阻止其他事务在该范围内插入新行。

**仍可出现幻读的特殊场景：**
```sql
-- TX-A (RR)
BEGIN;
SELECT * FROM t WHERE id = 5;  -- 快照读，未找到行

-- TX-B
INSERT INTO t(id) VALUES(5); COMMIT;

-- TX-A
UPDATE t SET name = 'x' WHERE id = 5;  -- 当前读，发现了 TX-B 插入的行并更新成功！
SELECT * FROM t WHERE id = 5;  -- 快照读，居然能看到 id=5 了！（因为自己修改了该行）
```


### 3.5 Redo Log 与 Crash Recovery

**Redo Log 结构：**
InnoDB 的 Redo Log 是固定大小的环形结构，由 `innodb_log_file_size` 和 `innodb_log_files_in_group` 控制（默认 2 个文件，每个 48MB）。

```
┌────────────────────────────────────────────┐
│  ib_logfile0           ib_logfile1          │
│  ┌──────────┐          ┌──────────┐         │
│  │          │          │          │         │
│  │  write   │→→→→→→→→ │  write   │→→ 回到0 │
│  │  pos ▼   │          │          │         │
│  │          │          │          │         │
│  │checkpoint│          │          │         │
│  │  pos ▲   │          │          │         │
│  └──────────┘          └──────────┘         │
└────────────────────────────────────────────┘
write pos：当前写入位置（向前推进）
checkpoint：已刷盘脏页的位置（向前推进）
write pos 追上 checkpoint → 需要暂停写入，先刷脏页推进 checkpoint
```

**Crash Recovery 流程：**
1. 读取 Redo Log 中 checkpoint 之后的所有记录
2. 对于每条 redo 记录，检查对应的数据页 LSN
3. 如果页面 LSN < redo LSN，则重做（redo）该操作
4. 完成后扫描 Undo Log，回滚所有未提交的事务

**生产调优：** `innodb_log_file_size` 设置过小会导致频繁 checkpoint，写性能下降；设置过大会导致 crash recovery 时间变长。建议设置为能容纳 **1 小时高峰写入量**的大小。MySQL 8.0.30+ 支持动态调整。

### 面试追问点

> **Q：互联网公司为什么常用 RC 而非 RR？**
> A：(1) RC 下，锁的范围更小（没有 Gap Lock），并发性能更好；(2) RC 下 Semi-Consistent Read 允许读到已提交的最新版本，减少锁等待；(3) RR 的 Gap Lock 容易引发死锁；(4) 幻读问题可在应用层通过唯一索引等方式解决。阿里巴巴 MySQL 规约默认推荐 RC。

---

## 四、MVCC 原理

### 4.1 隐藏字段

InnoDB 每行记录包含三个隐藏字段：

| 字段 | 大小 | 说明 |
|------|------|------|
| `DB_TRX_ID` | 6B | 最近修改该行的事务 ID |
| `DB_ROLL_PTR` | 7B | 回滚指针，指向 Undo Log 中该行的上一个版本 |
| `DB_ROW_ID` | 6B | 隐藏自增行 ID（无主键时自动生成） |

### 4.2 Undo Log 版本链

每次修改一行数据，旧版本被写入 Undo Log，通过 `DB_ROLL_PTR` 串成链表：

```
当前行 [data_v3, trx_id=300, roll_ptr → ]
    ↓
Undo Log [data_v2, trx_id=200, roll_ptr → ]
    ↓
Undo Log [data_v1, trx_id=100, roll_ptr = NULL]
```

### 4.3 ReadView 生成机制

ReadView 是事务在做快照读时生成的"视力范围"，包含四个关键字段：

```java
class ReadView {
    long m_low_limit_id;    // 创建 ReadView 时，系统中下一个待分配的事务 ID（高水位）
    long m_up_limit_id;     // 创建 ReadView 时，活跃事务列表中最小的事务 ID（低水位）
    long[] m_ids;           // 创建 ReadView 时，所有活跃（未提交）的事务 ID 列表
    long m_creator_trx_id;  // 创建该 ReadView 的事务 ID
}
```

**RC vs RR 的核心区别：**
- **RC：** 每次 `SELECT` 都创建新的 ReadView
- **RR：** 仅在事务第一次 `SELECT` 时创建 ReadView，后续复用

### 4.4 可见性判断算法

```java
boolean isVisible(long trx_id, ReadView view) {
    // 1. 如果是自己修改的，可见
    if (trx_id == view.m_creator_trx_id) return true;

    // 2. 如果 trx_id < 低水位，说明在 ReadView 创建前已提交，可见
    if (trx_id < view.m_up_limit_id) return true;

    // 3. 如果 trx_id >= 高水位，说明在 ReadView 创建后才开启，不可见
    if (trx_id >= view.m_low_limit_id) return false;

    // 4. trx_id 在 [低水位, 高水位) 区间内
    //    如果在活跃列表中 → 未提交，不可见
    //    如果不在活跃列表中 → 已提交，可见
    return !view.m_ids.contains(trx_id);
}

// 如果当前版本不可见，沿 Undo Log 版本链往前找，直到找到可见版本
```

**源码位置：** `storage/innobase/read/read0read.cc` 中的 `ReadView::changes_visible()` 方法。

### 生产踩坑经验

**长事务的危害：**
- 长事务持有 ReadView 不释放，导致 Undo Log 无法被 Purge 线程回收
- 表现为：Undo Log 文件膨胀、回滚段空间占满、查询变慢
- 排查方式：`SELECT * FROM information_schema.innodb_trx ORDER BY trx_started;`
- 解决：设置 `innodb_undo_log_truncate = ON`，监控长事务并告警

### 面试追问点

> **Q：MVCC 能完全替代锁吗？**
> A：不能。MVCC 只用于**快照读**（普通 SELECT）。对于**当前读**（SELECT ... FOR UPDATE / INSERT / UPDATE / DELETE），仍需加锁。MVCC 和锁是互补关系：MVCC 解决读-写冲突，锁解决写-写冲突。

> **Q：Undo Log 什么时候被删除？**
> A：当没有任何活跃事务的 ReadView 需要访问该 Undo Log 版本时，由后台 **Purge 线程**异步清理。这就是长事务导致 Undo Log 膨胀的原因——只要有一个旧 ReadView 存在，它之后的所有 Undo Log 版本都不能清理。

---

## 五、锁机制

### 5.1 锁的分类体系

```
InnoDB 锁
├── 全局锁：FLUSH TABLES WITH READ LOCK（FTWRL）— 全库只读，用于全库备份
├── 表级锁
│   ├── 表锁：LOCK TABLES t READ/WRITE
│   ├── 元数据锁（MDL）：自动加，防止 DDL 与 DML 并发
│   └── 意向锁（IS/IX）：表级标记，加行锁前先加意向锁，避免表锁检查全表
└── 行级锁（InnoDB 特有）
    ├── Record Lock：锁定索引记录
    ├── Gap Lock：锁定索引记录之间的间隙（左开右开）
    ├── Next-Key Lock：Record Lock + Gap Lock（左开右闭）
    └── Insert Intention Lock：插入意向锁，Gap Lock 的特殊形式
```

### 5.2 行锁的加锁规则（关键！）

以 RR 隔离级别为例，加锁基本单位是 **Next-Key Lock**，在特定条件下退化：

| 场景 | 加锁类型 | 退化条件 |
|------|---------|---------|
| 唯一索引等值查询，命中 | Record Lock | Next-Key Lock 退化为 Record Lock |
| 唯一索引等值查询，未命中 | Gap Lock | Next-Key Lock 退化为 Gap Lock |
| 非唯一索引等值查询，命中 | Next-Key Lock + Gap Lock（向右遍历到第一个不满足条件的值时退化为 Gap Lock） | — |
| 非唯一索引范围查询 | Next-Key Lock | — |
| 无索引 | 锁住全表所有行（退化为表锁效果） | — |

```sql
-- 示例表：id(PK), age(普通索引), name
-- 数据：(1,10,'a'), (5,20,'b'), (10,30,'c'), (15,40,'d')

-- 场景 1：唯一索引等值命中
SELECT * FROM t WHERE id = 5 FOR UPDATE;
-- 加锁：id=5 的 Record Lock

-- 场景 2：唯一索引等值未命中
SELECT * FROM t WHERE id = 7 FOR UPDATE;
-- 加锁：(5, 10) 的 Gap Lock

-- 场景 3：非唯一索引等值
SELECT * FROM t WHERE age = 20 FOR UPDATE;
-- 加锁：age 索引上 (10, 20] 的 Next-Key Lock + (20, 30) 的 Gap Lock
-- 同时：id=5 的 Record Lock（回主键索引锁行）
```

### 5.3 死锁案例分析

```sql
-- 经典死锁场景：两个事务以不同顺序更新两行
-- TX-A:
BEGIN;
UPDATE t SET name = 'x' WHERE id = 1;  -- 锁住 id=1
UPDATE t SET name = 'y' WHERE id = 5;  -- 等待 id=5（TX-B 持有）

-- TX-B:
BEGIN;
UPDATE t SET name = 'x' WHERE id = 5;  -- 锁住 id=5
UPDATE t SET name = 'y' WHERE id = 1;  -- 等待 id=1（TX-A 持有）→ 死锁！
```

**死锁检测：** InnoDB 使用 **Wait-for Graph（等待图）** 算法检测环路。参数 `innodb_deadlock_detect = ON`（默认开启）。检测到死锁后，**回滚持有锁最少（undo log 最少）的事务**。

**死锁排查：**
```sql
-- 查看最近的死锁信息
SHOW ENGINE INNODB STATUS\G
-- 关注 LATEST DETECTED DEADLOCK 部分

-- 设置死锁日志
SET GLOBAL innodb_print_all_deadlocks = ON;  -- 输出到 error log
```

**生产经验 — 避免死锁的方法：**
1. 固定资源获取顺序（如按 ID 升序更新）
2. 尽量使用索引访问数据，减少锁范围
3. 缩短事务时长，减少锁持有时间
4. 使用 RC 隔离级别（没有 Gap Lock，死锁概率大幅降低）

### 5.4 意向锁（Intention Lock）

意向锁是**表级锁**，用于快速判断表中是否有行锁：
- **IS（Intention Shared）：** 事务准备对某行加共享锁前，先在表上加 IS 锁
- **IX（Intention Exclusive）：** 事务准备对某行加排他锁前，先在表上加 IX 锁

意向锁之间互不冲突。意向锁的存在是为了避免加表锁时逐行扫描是否有行锁。


### 5.5 在线加锁场景模拟

以下是一个在生产环境中频繁出现的锁等待案例分析：

```sql
-- 业务场景：扣减库存
-- 表结构：product(id PK, stock INT, version INT)
-- 索引：PRIMARY KEY(id)

-- 方案 1：悲观锁
BEGIN;
SELECT stock FROM product WHERE id = 1 FOR UPDATE;  -- 加 X 锁
-- 应用层判断 stock > 0
UPDATE product SET stock = stock - 1 WHERE id = 1;
COMMIT;
-- 问题：高并发下锁等待严重

-- 方案 2：乐观锁（CAS）
UPDATE product SET stock = stock - 1, version = version + 1
WHERE id = 1 AND version = #{oldVersion};
-- 如果 affected rows = 0，说明被其他事务修改，需重试
-- 问题：高冲突时重试频繁，浪费 CPU

-- 方案 3：无锁方案（直接原子扣减 + 判断）
UPDATE product SET stock = stock - 1
WHERE id = 1 AND stock > 0;
-- 利用数据库行锁的原子性，无需额外 SELECT
-- 最佳方案：减少了一次查询，锁持有时间最短
```

**方案对比：**

| 方案 | 锁类型 | 并发度 | 适用场景 |
|------|--------|--------|---------|
| 悲观锁 | 行级排他锁 | 低 | 冲突频率高、业务逻辑复杂 |
| 乐观锁 | 无锁（CAS 重试） | 中 | 冲突频率低 |
| 原子扣减 | 行级排他锁（极短） | 高 | 简单扣减场景 |

### 面试追问点

> **Q：高并发 INSERT 场景下，Gap Lock 会导致什么问题？**
> A：Gap Lock 会阻塞其他事务在同一间隙的 INSERT，即使插入的值不同。这在批量插入场景下会严重降低并发。解决方案：(1) 使用 RC 隔离级别；(2) 设置 `innodb_locks_unsafe_for_binlog = 1`（5.7，不推荐）；(3) 合理设计唯一索引减少间隙范围。

> **Q：innodb_deadlock_detect 关闭后怎么处理死锁？**
> A：通过 `innodb_lock_wait_timeout`（默认 50s）超时回滚。高并发场景下（如秒杀），死锁检测本身的开销很大（O(n²) 遍历等待图），关闭检测 + 缩短超时时间是一种可行方案。

---

## 六、分库分表

### 6.1 垂直拆分 vs 水平拆分

| 维度 | 垂直拆分 | 水平拆分 |
|------|---------|---------|
| 定义 | 按列拆分（不同列放不同表/库） | 按行拆分（同一表结构按规则分散到多个表/库） |
| 典型场景 | 宽表拆成核心表 + 扩展表；微服务按业务拆库 | 单表行数过大（>2000 万行或 >10GB） |
| 优点 | 降低单行大小，提升缓存命中率 | 解决单表容量瓶颈 |
| 缺点 | 跨表 Join | 分布式事务、跨片查询、全局排序 |

### 6.2 分片键选择原则

1. **离散度高**：避免数据倾斜（如用 user_id 而非 status）
2. **查询覆盖**：绝大部分查询条件包含分片键
3. **稳定不变**：分片键值不应修改（否则需跨片迁移数据）

```java
// 常见分片策略
// 1. Hash 取模
int shardIndex = userId.hashCode() % 16;  // 16 张分表

// 2. 范围分片
// user_id 1-1000万 → shard_0, 1000万-2000万 → shard_1
// 优点：扩容方便  缺点：热点集中

// 3. 基因法（订单号中嵌入 user_id 的分片信息）
// order_id 的低 4 位 = user_id % 16，这样通过 order_id 也能定位分片
long orderId = snowflakeId << 4 | (userId % 16);
```

### 6.3 ShardingSphere-JDBC vs ShardingSphere-Proxy

| 维度 | JDBC（客户端分片） | Proxy（代理层分片） |
|------|-------------------|-------------------|
| 架构 | JAR 包嵌入应用 | 独立代理服务 |
| 性能 | 无网络转发，性能高 | 多一层网络开销 |
| 侵入性 | 需要改依赖 | 对应用透明 |
| 运维 | 版本升级需重启应用 | 独立升级 |
| 适用 | Java 应用 | 多语言、DBA 管理 |

### 6.4 跨库 Join 解决方案

| 方案 | 适用场景 | 缺点 |
|------|---------|------|
| **字段冗余** | 高频查询字段（如 user_name 冗余到订单表） | 数据一致性维护成本 |
| **全局表 / 广播表** | 字典表、配置表（数据量小、变更少） | 每个库都存一份 |
| **ER 分片** | 有父子关系的表按同一分片键分片 | 设计时需规划 |
| **应用层组装** | 复杂查询 | 增加代码复杂度和 RPC 调用 |

### 6.5 分布式主键方案

| 方案 | 优点 | 缺点 |
|------|------|------|
| UUID | 简单、无中心 | 无序（页分裂）、占 36B、不利于索引 |
| 数据库自增（步长） | 简单、有序 | 依赖数据库、扩容时需调整步长 |
| Redis INCR | 有序、高性能 | 依赖 Redis 可用性 |
| **Snowflake** | 有序、高性能、无中心依赖 | 时钟回拨问题 |
| Leaf（美团） | 兼容号段模式和 Snowflake | 需要部署服务 |

```java
// Snowflake 结构（64 位）
// 0 | 41位时间戳 | 10位机器ID | 12位序列号
// ↓ 约可用69年   ↓ 1024台    ↓ 每毫秒4096个
public long nextId() {
    long timestamp = System.currentTimeMillis();
    if (timestamp < lastTimestamp) {
        throw new RuntimeException("时钟回拨！拒绝生成 ID");
    }
    if (timestamp == lastTimestamp) {
        sequence = (sequence + 1) & 0xFFF; // 12 位掩码
        if (sequence == 0) {
            timestamp = waitNextMillis(lastTimestamp);
        }
    } else {
        sequence = 0;
    }
    lastTimestamp = timestamp;
    return ((timestamp - epoch) << 22) | (workerId << 12) | sequence;
}
```

### 6.6 全局排序分页

分布式环境下的 `ORDER BY ... LIMIT M, N` 是一个经典难题：

```
方案 1：归并排序（ShardingSphere 默认）
  每个分片执行 ORDER BY ... LIMIT 0, M+N
  应用层归并排序后取第 M+1 到 M+N 行
  → 深分页时每个分片返回海量数据，内存压力大

方案 2：禁止深分页 + 游标方案
  记录上一页最后一条的排序值
  WHERE sort_col > #{lastValue} ORDER BY sort_col LIMIT N
  → 只适用于无跳页的场景

方案 3：二次查询法
  第一次：各分片查 LIMIT M/n, N（n 为分片数），取排序边界值
  第二次：各分片查 WHERE sort_col BETWEEN min AND max，应用层归并
```

### 面试追问点

> **Q：分表后如何做全局 COUNT？**
> A：(1) 各分片 COUNT 后求和；(2) 维护一张独立的计数表（异步更新）；(3) 使用 ES 等搜索引擎做实时统计。

> **Q：分库后如何保证分布式事务？**
> A：(1) 最终一致性方案优先：本地消息表 + MQ + 补偿；(2) Seata AT 模式：通过 undo_log 自动回滚；(3) TCC：显式编写 Try/Confirm/Cancel 三个方法；(4) 避免跨库事务 — 合理的分片键设计能让 90% 以上的业务在单片内完成。

---

## 七、读写分离

### 7.1 主从复制原理

```
Master                          Slave
  │                               │
  │ 1. 写操作记录到 Binlog         │
  │──────────────────────────────→│ 2. I/O Thread 拉取 Binlog
  │                               │    写入 Relay Log
  │                               │ 3. SQL Thread 读取 Relay Log
  │                               │    执行 SQL，应用到从库
```

**核心组件：**
- Master：**Binlog Dump Thread**（将 binlog 发给 Slave）
- Slave：**I/O Thread**（接收 binlog → Relay Log） + **SQL Thread**（回放 Relay Log）

### 7.2 异步 / 半同步 / 全同步

| 模式 | 流程 | 数据安全 | 性能 |
|------|------|---------|------|
| **异步** | Master 写完 Binlog 即返回客户端 | 可能丢数据 | 最高 |
| **半同步** | Master 等待至少一个 Slave 确认收到 Binlog（写入 Relay Log） | 基本不丢 | 中等 |
| **全同步** | Master 等待所有 Slave 回放完成 | 不丢 | 最低 |

**增强半同步（After Sync）MySQL 5.7+：**
Master 在写入 Binlog 后、Commit 前等待 Slave ACK，避免了 Phantom Read（Master 已提交但 Slave 未收到）。

### 7.3 主从延迟问题与解决

**延迟原因：**
1. Slave 的 SQL Thread 是**单线程**回放（5.6 之前）
2. Master 大事务（如批量 UPDATE 100 万行）
3. Slave 机器配置低 / 磁盘 I/O 慢
4. 网络延迟

**解决方案：**

| 方案 | 说明 | 适用场景 |
|------|------|---------|
| **强制走主库** | 关键读操作（如支付后查余额）直接查主库 | 强一致性业务 |
| **等待 GTID** | `SELECT WAIT_FOR_EXECUTED_GTID_SET(gtid, timeout)` | 写后立即读 |
| **判断延迟** | `SHOW SLAVE STATUS` 的 `Seconds_Behind_Master = 0` | 延迟容忍型 |
| **并行复制** | `slave_parallel_workers > 0`，5.7 基于组提交，8.0 基于 writeset | 根本优化 |
| **中间件路由** | 写操作后 N 秒内路由到主库 | ShardingSphere Hint |

```java
// Spring 中实现读写分离 — 基于 AbstractRoutingDataSource
public class DynamicDataSource extends AbstractRoutingDataSource {
    @Override
    protected Object determineCurrentLookupKey() {
        return DynamicDataSourceContextHolder.getDataSourceType();
        // 返回 "master" 或 "slave"
    }
}

// 通过 AOP + 自定义注解实现
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface ReadOnly {}

@Around("@annotation(readOnly)")
public Object around(ProceedingJoinPoint point, ReadOnly readOnly) {
    DynamicDataSourceContextHolder.setDataSourceType("slave");
    try {
        return point.proceed();
    } finally {
        DynamicDataSourceContextHolder.clear();
    }
}
```

### 面试追问点

> **Q：MySQL 5.7 的并行复制原理？**
> A：基于**组提交（Group Commit）**。在 Master 上同一组提交（同一个 binlog group）的事务，在 Slave 上可以并行回放。通过 `slave_parallel_type = LOGICAL_CLOCK` 开启。MySQL 8.0 进一步引入 **WriteSet 并行复制**，只要事务修改的行集合不冲突，即可并行，无需属于同一组提交。

---

## 八、Binlog

### 8.1 三种模式对比

| 模式 | 记录内容 | 优点 | 缺点 |
|------|---------|------|------|
| **STATEMENT** | SQL 语句原文 | 日志量小 | 不确定函数（NOW()、RAND()）导致主从不一致 |
| **ROW** | 每行数据的变更（Before/After Image） | 精确还原 | 日志量大（批量 UPDATE 产生海量日志） |
| **MIXED** | 默认用 STATEMENT，不确定语句自动切 ROW | 折中 | 仍有不一致风险 |

**生产推荐：ROW 模式**。虽然日志量大，但精确性是最重要的。配合 `binlog_row_image = MINIMAL` 可减少日志量（只记录变更列）。

### 8.2 Canal 工作原理

```
┌─────────┐    Binlog     ┌─────────┐      ┌─────────┐
│  MySQL  │ ──────────→  │  Canal  │ ───→ │  消费端  │
│ (Master)│              │ (伪Slave)│      │(ES/Redis)│
└─────────┘              └─────────┘      └─────────┘
```

**Canal 核心流程：**
1. Canal 伪装成 MySQL Slave，向 Master 发送 dump 协议请求
2. Master 收到请求后，推送 Binlog 给 Canal
3. Canal 解析 Binlog（ROW 模式下解析每行变更），生成结构化消息
4. 下游消费端（MQ / 直接消费）获取变更事件，同步到 ES、Redis、数据仓库等

```java
// Canal Client 代码示例
CanalConnector connector = CanalConnectors.newSingleConnector(
    new InetSocketAddress("127.0.0.1", 11111), "example", "", "");
connector.connect();
connector.subscribe(".*\\..*");  // 订阅所有库表

while (true) {
    Message message = connector.getWithoutAck(100);
    for (CanalEntry.Entry entry : message.getEntries()) {
        CanalEntry.RowChange rowChange = CanalEntry.RowChange.parseFrom(entry.getStoreValue());
        for (CanalEntry.RowData rowData : rowChange.getRowDatasList()) {
            if (rowChange.getEventType() == CanalEntry.EventType.INSERT) {
                // 处理新增：rowData.getAfterColumnsList()
            } else if (rowChange.getEventType() == CanalEntry.EventType.UPDATE) {
                // 处理更新：before vs after
            }
        }
    }
    connector.ack(message.getId());
}
```

### 8.3 Binlog 在数据恢复中的应用

```bash
# 基于时间点恢复（Point-in-Time Recovery）
# 1. 恢复全量备份
mysql -u root -p < full_backup.sql

# 2. 使用 mysqlbinlog 回放增量 Binlog
mysqlbinlog --start-datetime="2024-01-01 10:00:00" \
            --stop-datetime="2024-01-01 11:00:00" \
            mysql-bin.000123 | mysql -u root -p

# 3. 跳过误操作的时间点，继续回放后续 Binlog
```


### 8.4 Binlog 与数据审计

在金融、电商等合规场景下，Binlog 可用于数据变更审计：

```java
// 基于 Canal 实现变更审计日志
// 记录：谁（通过 SQL 注释或连接属性）、什么时间、改了哪张表的哪些字段、旧值和新值
public class AuditLogHandler implements CanalEventHandler {
    @Override
    public void handle(CanalEntry.Entry entry) {
        CanalEntry.RowChange rowChange = parseRowChange(entry);
        for (CanalEntry.RowData rowData : rowChange.getRowDatasList()) {
            AuditLog log = new AuditLog();
            log.setTableName(entry.getHeader().getTableName());
            log.setEventType(rowChange.getEventType().name());
            log.setTimestamp(entry.getHeader().getExecuteTime());
            log.setBeforeColumns(toMap(rowData.getBeforeColumnsList()));
            log.setAfterColumns(toMap(rowData.getAfterColumnsList()));
            // 写入审计表或 ES
            auditLogRepository.save(log);
        }
    }
}
```

**Binlog 在缓存一致性中的应用：**

数据库与缓存双写一致性是经典问题。基于 Binlog 的异步更新方案是目前业界最可靠的做法：

```
写请求 → 更新 DB → DB 产生 Binlog
                        ↓
                    Canal 监听
                        ↓
                  发送消息到 MQ
                        ↓
                消费端删除/更新 Redis 缓存
```

相比"先更 DB 再删缓存"的双删方案，Binlog 方案的优势是：(1) 解耦业务代码和缓存逻辑；(2) 即使应用层删缓存失败，Binlog 仍会触发；(3) 可以做到最终一致性保证。

### 面试追问点

> **Q：Binlog 和 Redo Log 有什么区别？**
> A：(1) **归属不同**：Binlog 是 Server 层的，所有引擎通用；Redo Log 是 InnoDB 引擎层的。(2) **内容不同**：Binlog 记录逻辑日志（SQL 或行变更）；Redo Log 记录物理日志（某页某偏移量修改了什么）。(3) **写入时机**：Binlog 在事务提交时一次性写入；Redo Log 在事务执行过程中不断写入。(4) **大小**：Binlog 追加写，文件会一直增长；Redo Log 循环写，空间固定。

> **Q：两阶段提交（2PC）是怎么保证 Binlog 和 Redo Log 一致性的？**
> A：InnoDB 使用内部 XA 事务协议：(1) **Prepare 阶段**：写 Redo Log，标记为 Prepare 状态；(2) **Commit 阶段**：写 Binlog → 写 Redo Log Commit 标记。崩溃恢复时：Redo Log Prepare + Binlog 完整 → 提交；Redo Log Prepare + Binlog 不完整 → 回滚。

---

## 九、大表优化

### 9.1 垂直拆分（冷热分离）

```sql
-- 原表：字段多、行大
CREATE TABLE product (
    id BIGINT PRIMARY KEY,
    name VARCHAR(200),        -- 热数据
    price DECIMAL(10,2),      -- 热数据
    description TEXT,          -- 冷数据（大字段，查询少）
    specs JSON,                -- 冷数据
    create_time DATETIME
);

-- 拆分后
CREATE TABLE product_base (
    id BIGINT PRIMARY KEY,
    name VARCHAR(200),
    price DECIMAL(10,2),
    create_time DATETIME
);

CREATE TABLE product_ext (
    id BIGINT PRIMARY KEY,
    description TEXT,
    specs JSON
);
```

**收益：** 核心查询只访问 product_base，行更短 → 每页存更多行 → Buffer Pool 缓存效率提升。

### 9.2 水平分表

```sql
-- 按月分表
CREATE TABLE orders_202401 LIKE orders;
CREATE TABLE orders_202402 LIKE orders;
-- ...

-- 或使用 MySQL 原生分区表（谨慎使用）
CREATE TABLE orders (
    id BIGINT,
    user_id BIGINT,
    create_time DATETIME,
    PRIMARY KEY (id, create_time)
) PARTITION BY RANGE (TO_DAYS(create_time)) (
    PARTITION p202401 VALUES LESS THAN (TO_DAYS('2024-02-01')),
    PARTITION p202402 VALUES LESS THAN (TO_DAYS('2024-03-01'))
);
```

**注意：** 分区表的 PRIMARY KEY 和 UNIQUE KEY 必须包含分区键，设计时有约束。

### 9.3 归档方案

```
热数据（近3个月）     → 在线库 MySQL（SSD）
温数据（3-12个月）    → 归档库 MySQL（HDD）或 TiDB
冷数据（1年以上）     → 对象存储（S3）/ Hive / 数据湖

归档流程：
1. 定时任务扫描超过阈值的数据
2. 批量 INSERT INTO 归档表 SELECT ... LIMIT 1000（小批量，避免大事务）
3. 批量 DELETE 原表（同样小批量 + LIMIT）
4. 验证归档完整性
5. 通知业务方切换查询入口
```

### 9.4 在线 DDL — pt-online-schema-change vs gh-ost

**为什么需要在线 DDL 工具？**

MySQL 原生的 `ALTER TABLE` 在大表上可能锁表数分钟到数小时。虽然 5.6+ 支持 Online DDL（Inplace），但部分操作（如修改列类型）仍需要 Copy 方式，会阻塞 DML。

**pt-online-schema-change（pt-osc）原理：**
```
1. 创建新表（与原表结构相同但包含 DDL 变更）
2. 在原表上创建 3 个触发器（INSERT/UPDATE/DELETE）
   将增量变更同步到新表
3. 分批 Copy 原表数据到新表（chunk by chunk）
4. Copy 完成后，RENAME TABLE 原表为 _old，新表为原表名
5. 删除旧表和触发器
```

**gh-ost（GitHub Online Schema Transmogrifier）原理：**
```
1. 创建 Ghost 表（包含 DDL 变更）
2. 不使用触发器！而是连接到从库（或主库）作为 Binlog 消费者
3. 从 Binlog 中捕获原表的增量变更，应用到 Ghost 表
4. 同时分批 Copy 存量数据
5. Cut-over：原子性的表名切换
```

| 维度 | pt-osc | gh-ost |
|------|--------|--------|
| 增量同步 | 触发器 | Binlog 解析 |
| 对主库负载 | 触发器有额外开销 | 无触发器，更轻量 |
| 可暂停/恢复 | 不支持 | **支持**（通过 socket 命令） |
| 可回滚 | 不方便 | 交换回原表即可 |
| 外键支持 | 支持 | 不支持 |
| 实际选择 | 老项目多见 | **业界主流**（GitHub/美团/字节） |

```bash
# gh-ost 使用示例
gh-ost \
  --host=127.0.0.1 \
  --port=3306 \
  --user=root \
  --password=xxx \
  --database=mydb \
  --table=orders \
  --alter="ADD COLUMN remark VARCHAR(500) DEFAULT ''" \
  --chunk-size=1000 \
  --max-load="Threads_running=25" \
  --critical-load="Threads_running=50" \
  --execute
```

### 生产踩坑经验

**pt-osc 触发器导致死锁：**
- 大量并发 INSERT 时，触发器和正常 DML 可能竞争同一行锁
- 解决：在低峰期执行，或使用 gh-ost

**gh-ost 的 Cut-over 阶段：**
- 需要短暂的表锁（通常毫秒级），但在超高并发下可能等待较长
- 监控 `--postpone-cut-over-flag-file` 参数，选择合适时机

**大表 DELETE 优化：**
```sql
-- 错误：直接 DELETE 大量数据，产生大事务 + 大量 Undo Log
DELETE FROM orders WHERE create_time < '2023-01-01';

-- 正确：小批量循环删除
REPEAT
    DELETE FROM orders WHERE create_time < '2023-01-01' LIMIT 1000;
    SELECT SLEEP(0.1);  -- 给从库同步留时间
UNTIL ROW_COUNT() = 0 END REPEAT;
```

### 面试追问点

> **Q：2000 万行是分表阈值吗？**
> A：这个数字不是绝对的。它取决于：(1) 行宽度——VARCHAR(200) 的表和 TEXT 大字段的表承载能力差距很大；(2) 查询模式——如果都是主键查询，B+ 树三层就够了，5000 万行也无压力；(3) 写入量——高写入场景下锁竞争才是瓶颈。核心判断标准是：**B+ 树高度是否增加到 4 层（导致多一次 I/O）、查询响应时间是否达到不可接受的水平**。

> **Q：分表后历史数据如何迁移？**
> A：(1) 双写方案：新写入同时写原表和新表，灰度切换；(2) 数据同步工具（Canal/DataX）进行全量+增量同步；(3) 校验工具对比新老表数据一致性。关键是**不停机迁移**——先双写、再灰度读、最后切写。

---

## 总结 — 面试高频考点速查

| 主题 | Top 3 追问 |
|------|-----------|
| 索引 | B+ 树层高计算、索引失效场景、覆盖索引 vs 回表 |
| SQL 优化 | EXPLAIN type 排序、Join 算法演进、深分页方案 |
| 事务 | RC vs RR 区别、RR 下的幻读场景、互联网公司为什么用 RC |
| MVCC | ReadView 可见性算法、RC/RR 的 ReadView 生成差异 |
| 锁 | Next-Key Lock 加锁规则、死锁案例分析、Gap Lock 的作用 |
| 分库分表 | 分片键设计、跨库 Join 方案、分布式主键 |
| 读写分离 | 主从延迟解决、半同步原理、并行复制 |
| Binlog | ROW vs STATEMENT、两阶段提交、Canal 原理 |
| 大表优化 | gh-ost vs pt-osc、冷热分离、在线 DDL |

> **记住：面试不是背答案，而是展示"你为什么知道这些"——最好结合实际项目场景来回答，说出踩过的坑、做过的优化、看过的源码。**

## 相关文章

- [mysql-interview-map](/posts/mysql/mysql-interview-map/)
