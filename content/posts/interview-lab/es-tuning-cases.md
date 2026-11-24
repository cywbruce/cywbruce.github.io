---
title: "Elasticsearch 调优案例集面试题库（含追问链与定级指南）"
date: 2026-11-22
order: 705
summary: "查询慢、写入拒绝、集群红黄三类线上问题的完整排查案例：深分页、分片规划、段合并、缓存与断路器、容量规划。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套"看现象 → 看指标 → 定位层级 → 验证根因 → 修复预防"的递进案例，把候选人的 **ES 线上排障与调优实战能力**问出来。
> 核心原则：**本套聚焦"线上 ES 出问题时怎么定位、怎么验证、怎么证明改好了"**，不重复倒排索引 / 分词 / 分布式原理的"是什么"（那是原理分册的事）。只会背"调大堆内存、加分片、refresh 调大"却讲不出一次完整排查过程与量化结果的人，基本停留在参数记忆层。
> 板块定位：**G 实战深水区，⭐经验区分器，案例题权重高于原理题**。配套：与 ES 原理分册互补——原理讲机制，本套讲案例；按 L1–L5 统一标尺定级。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题（调优方法论与观测手段）](#part-1)
- [Part 2：底层原理题（与调优决策相关的原理）](#part-2)
- [Part 3：核心区分度题（题眼，定级主战场）](#part-3)
- [Part 4：实战案例题（本套重点，案例驱动）](#part-4)
- [Part 5：2026 新趋势（9.x 向量与 ES|QL，保守表述）](#part-5)
- [Part 6：能否用本套定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：线上 ES 查询变慢 / 写入被拒 / 集群变红，你从哪几个角度排查？**（标准答法 30 秒，五个得分点）

**标准答案：**
> 第一步 **看现象**：分清属于哪类——查询慢/超时、写入慢/拒绝（429）、集群不稳（red/yellow），看延迟 P99、拒绝数、报错类型、`_cluster/health`。
> 第二步 **看指标**：`_cat/health`、`_cat/shards`、`_cat/allocation`、`_cat/thread_pool`、`_nodes/stats`、`_nodes/hot_threads`、慢日志、`_segments`、Profile API——用数据说话，不靠猜。
> 第三步 **定位层级**：是 mapping 设计（text/keyword/nested）、查询写法（深分页/filter/排序）、分片规划、JVM/GC、磁盘/IO，还是索引生命周期（ILM）。
> 第四步 **验证根因**：用 Profile 看 query/rewrite/collect 各阶段耗时、用 `_cluster/allocation/explain` 看未分配原因、灰度复现，避免"猜个参数改了就算"。
> 第五步 **修复并预防**：回滚/改 DSL/调 refresh/扩容量，建立性能基线，补慢日志、水位与拒绝告警防复发。

**评分要点：** 看现象 / 看指标 / 定位层级 / 验证根因 / 修复预防五点。能说"先定位再验证闭环"的直接往 Part 4 追问真实案例；只答"加内存、加分片"的从 Part 1 问起。

---

<a id="part-1"></a>

## Part 1：基础认知题（调优方法论与观测手段）

### Q1. ES 调优有哪些常见维度？为什么必须"先定位再调"？

**标准答案：** 五个维度：① **查询**（DSL 写法、filter 缓存、分页、排序字段）；② **写入**（bulk 大小/并发、refresh_interval、translog、merge 限流）；③ **集群**（分片规划、节点角色、水位线、allocation）；④ **存储**（压缩、段数量、冷热分层、ILM）；⑤ **相关性**（分词、打分、字段建模）。必须先定位再调，因为**症状与根因常常错位**：查询慢可能是磁盘 IO 或 GC 长停，写入 429 可能是 bulk 太大或磁盘满，red 可能是节点掉线。盲目调参的危害：参数间相互制约（调大 refresh 提速写入却牺牲实时性）、掩盖真因致故障复发、引发新问题（堆过大触发长 GC、分片加多拖垮协调节点）、无法用数据证明收益与回滚。

**追问 1：为什么说"调参空间在收敛，设计才是上限"？**
> **答案：** 运行期参数多是"兜底/取舍"（refresh、translog、merge 都是在实时性、吞吐、可靠性间权衡），真正决定天花板的是**建索引前的设计**：字段类型、是否 nested、分片数与单分片大小、routing、ILM。设计错了，后期调参只是"在错误地基上装修"。

**追问 2：接手一个"很慢"的集群，第一步做什么、不做什么？**
> **答案：** 先复现并量化现象（哪种慢、P50/P99、哪个索引/接口），把指标拉出来；不做的是一上来就改配置、重启节点、加机器——没有基线和现象的"优化"既无法验证也无法回滚。

---

### Q2. 有哪些关键观测手段？各自能回答什么问题？

**标准答案：**

| 手段 | 命令/入口 | 主要回答 |
|------|-----------|---------|
| 集群/节点快照 | `GET _cat/health?v`、`_cat/nodes?v`、`_cat/indices?v` | 健康色、负载、索引规模 |
| 分片与分配 | `_cat/shards?v`、`_cat/allocation?v`、`_cluster/allocation/explain` | 未分配原因、分片分布、磁盘占用 |
| 节点指标 | `_nodes/stats`、`_nodes/hot_threads` | JVM/GC、线程池队列、CPU 热点栈 |
| 线程池 | `GET _cat/thread_pool/write?v` | write/search 队列、拒绝数（429 来源） |
| 慢日志 | `index.search.slowlog.threshold.query.warn`、`index.indexing.slowlog.threshold.index.warn` | 真正慢的 DSL |
| 查询剖析 | `GET idx/_search { "profile": true, ... }` | query/rewrite/collect 耗时 |
| 段与缓存 | `GET idx/_segments`、`_nodes/stats/breaker`、`_cache/stats` | 段数、断路器、缓存命中 |

慢日志告诉你"哪个慢"，Profile/hot_threads 告诉你"为什么慢"，二者配合才能定位。

**追问 1：临时开慢日志会影响线上吗？怎么安全开？**
> **答案：** 会额外写磁盘、增加开销，生产要**按需、短暂、分级**：先设较高 warn 阈值（query warn 5s、info 1s）抓最慢的，定位后及时调回；避免全量 info 长时间开启。

**追问 2：`hot_threads` 看到大量 `merge` 或 `GCTaskThread` 说明什么？**
> **答案：** 大量 `merge` 说明后台段合并吃满 IO/CPU，在拖慢查询/写入（检查 merge 限流）；GC 线程占比高伴随长 pause，说明堆压力/GC 是瓶颈（结合 `_nodes/stats/jvm` 的 GC count/time）。hot_threads 是**当下线程栈快照**，需多次采样确认。

---

### Q3. 原理复盘：refresh / merge / translog 与性能的关系？

**标准答案：** 三者是 ES"近实时 + 可靠 + 段结构"的三大机制，也是调优核心杠杆。**refresh**：把内存 buffer 写成新 segment 并打开供搜索，默认 `refresh_interval: 1s`（近实时）；每次 refresh 产生新段 → 段越多查询越慢、merge 压力越大，批量导入时设 `refresh_interval: -1` 或 30s，导入完恢复并 `_refresh` 可大幅提吞吐。**translog**：写内存同时落 translog 保证可靠，默认 `durability: request`（每次 fsync）最稳最慢；`async` + `sync_interval: 5s` 提吞吐但宕机可能丢几秒；flush 会触发 refresh 并清 translog。**merge**：后台把小段合并成大段、清理 `.del` 标记，TieredMergePolicy 按层合并，吞 IO 需限流。**权衡三角**：实时性 ↔ 写入吞吐 ↔ 查询性能不能兼得，调优就是按场景取舍。

**追问 1：bulk 写入后立刻搜不到，是 refresh 的问题吗？怎么解决？**
> **答案：** 是。写入默认最多 1s 后才可见。需"写后即读"可在 bulk 加 `?refresh=true`（立即 refresh，代价高）或 `?refresh=wait_for`（等到下次 refresh 再返回）；日志场景通常接受 1s 延迟，不必强求。

**追问 2：为什么"段越多查询越慢"？force_merge 能根治吗？**
> **答案：** 每个段都要做词典/倒排查找并归并，段多 = 更多句柄、比较、堆开销。`_forcemerge?max_num_segments=1` 能把只读索引压成 1 段、查询变快，但**代价大**：大量 IO/CPU、旧段占双份磁盘、合并后难再增量写入——只适合**不再写入的冷/只读索引**且低峰执行。

---

<a id="part-2"></a>

## Part 2：底层原理题（与调优决策相关的原理）

> 聚焦"做调优决策时必须懂的原理"，不重讲倒排索引与分布式机制（见原理分册）。这是 L2→L3 的关键。

### Q4. 查询执行原理：query then fetch 两阶段、scatter-gather 是什么？

**标准答案：** 搜索分两阶段，**协调节点**调度。① **Query 阶段**：请求 scatter 到相关分片，各分片**本地打分**（BM25）、按 sort 取 top `from+size`，把 doc id+score+sort 值 gather 回协调节点；协调节点**全局排序归并**得最终 top N。② **Fetch 阶段**：协调节点按最终 N 个 doc 所属分片再发 fetch 取 `_source`/docvalue fields 组装返回。**关键推论**：每分片都要返回 `from+size` 条，协调节点处理 `分片数 × (from+size)` 条——这是 `index.max_result_window` 默认 10000 的根因，也是分片越多、深分页越贵的根源；打分在分片本地，协调节点只归并、不重算分（除少量 rescore）。

**追问 1：`from=9990, size=10` 为什么说很贵？**
> **答案：** 每分片都要查出并排序前 10000 条，协调节点收 `分片数 × 10000` 条再全局归并丢弃前 9990 条——翻得越深，无用排序/传输越大，超 10000 直接报错（案例一原理根源）。

**追问 2：什么是 `dfs_query_then_fetch`？何时用？**
> **答案：** 默认各分片用**本地词频**打分，分片间统计不均会致打分不一致。`dfs_query_then_fetch` 先做分布式词频统计再打分、更准但多一次往返，适合分片多、数据分散且对打分精度敏感场景，一般不建议默认开启。

---

### Q5. 三种缓存（query cache / request cache / fielddata cache）如何区分与失效？

**标准答案：**

| 缓存 | 范围 | 内容 | 生效条件 | 失效 |
|------|------|------|---------|------|
| **Node query cache** | 节点级 | filter 命中 bitset | `filter` 上下文、`index.queries.cache.enabled` | 段变化后按段失效 |
| **Shard request cache** | 分片级 | 整请求结果（含 aggs） | `size:0`、`index.requests.cache.enable` | 分片 refresh 后失效 |
| **Fielddata cache** | 节点/字段 | text fielddata 进**堆** | text 做 sort/aggs | 常驻，受 fielddata breaker 限 |

要点：① 把"过滤条件"从 `query/match` 改为 `filter` 才能命中 query cache 且不打分；② `size:0` 的聚合才能用 request cache，刷新频繁会频繁失效；③ **fielddata 是"不得已"**——text 上排序/聚合把 term 载入堆、易触发断路器，正解是 keyword + doc_values（列式、off-heap）。

**追问 1：为什么把 `match` 改成 `filter` 能提速？**
> **答案：** `filter` 不算相关性分（省 BM25），结果 bitset 被 query cache 复用；对是非型条件（状态、时间范围）语义等价。注意 filter 不影响 `_score`，若该条件本就参与打分则不能替换。

**追问 2：global ordinals 与 fielddata 什么关系？**
> **答案：** keyword 做 terms 聚合/排序时用 **global ordinals** 把字符串映射成整数加速，默认查询时构建（首次慢、之后缓存）；`eager_global_ordinals: true` 在 refresh 时提前构建、让首次聚合变快但增加 refresh 成本。它走 doc_values（磁盘/off-heap），比 text fielddata 健康。

---

### Q6. 段合并（merge）策略与 force_merge 的代价？

**标准答案：** 默认 **TieredMergePolicy（分层合并）**：大小相近的段分"层（tier）"，每层满了合并成更大段，兼顾成本与段数。参数：`index.merge.policy.segments_per_tier`、`index.merge.policy.max_merged_segment`（默认 5gb）、`index.merge.scheduler.max_thread_count`。合并会**清 `.del` 删除标记**、减少段数，但吞 IO/CPU——写入密集时与查询抢资源，ES 会动态限流。`_forcemerge` 强制合并到 `max_num_segments`，显著减少段数、提升查询，但**代价高昂**：长时间大量 IO/CPU、需约双份磁盘、产生超大段后不利增量合并与迁移，故**只对只读/冷索引用**、低峰执行。

**追问 1：为什么删除文档后磁盘没立刻变小？**
> **答案：** Lucene 删除是"标记删除"（`.del` 记 doc id），段文件不会立刻重写；只有该段被合并时才真正物理清除。想尽快释放可对只读索引 `_forcemerge`（清删除标记），但要付 IO 与空间代价。

**追问 2：merge 限流调大一定提速吗？**
> **答案：** 不一定。调大 `max_thread_count` 让段合并更快、段数更少，但在 HDD/共享存储或写入密集时会抢光 IO、反拖写入与查询（write 队列堆积、429）。SSD/只读批量导入后可适当调大；线上混合负载要保守，以 IO 与拒绝率为准。

---

### Q7. 断路器（circuit breaker）、JVM heap/GC 有哪些关键边界？

**标准答案：** **断路器**防止单请求撑爆堆：父断路器约 95% heap，`request` 约 40%（请求预估超限抛 `CircuitBreakingException`）、`fielddata` 约 15%，in-flight requests breaker；超限返回 429/异常，是"保护机制"而非错误配置，根因多在查询/字段设计。**heap 与压缩指针**：堆建议**不超物理内存 50% 且 ≤ 31GB**——约 32GB 是压缩指针（CompressedOops）失效边界，超过后引用从 4 字节变 8 字节、同等数据更占内存、GC 更差；设 `-Xms == -Xmx`（如 `-Xmx31g`）。**GC**：默认 **G1GC**，频繁 Full GC/长 STW 多因堆不足、fielddata/聚合吃堆、批量过大。**off-heap/OS 页缓存**：Lucene 段与 doc_values 依赖**操作系统页缓存**而非堆，堆外留足内存给 OS cache 是关键——"堆不是越大越好"。

**追问 1：堆从 31GB 加到 40GB 为什么可能更慢？**
> **答案：** ① 超压缩指针边界，引用变宽、对象更大、有效堆缩水；② 物理内存被堆挤占，留给 Lucene/OS 页缓存的更少、段与 doc_values 命中下降；③ 更大堆的 G1 回收周期更长、Full GC 停顿更久。故有"31GB 黄金上限"说法。

**追问 2：看到 429 / `CircuitBreakingException` 怎么定位？**
> **答案：** 看 `_nodes/stats/breaker` 各 breaker 的 `estimated`/`limit`/`tripped`，结合慢日志找触发请求：超大 terms 聚合、超长 terms 查询、还是 text fielddata？对症——缩小聚合基数、给 keyword 加 doc_values、改分页，必要时调 breaker 上限（治标），不要一上来加堆。

---

### Q8. 磁盘水位线（watermark）与分片设计的成本？

**标准答案：** **磁盘水位**：默认 low=85%、high=90%、flood_stage=95%。超 low 不再往该节点分配分片；超 high 触发**分片迁移**；超 flood stage 置 `index.blocks.read_only_allow_delete=true`（索引**只读**、写入被拒）保护节点。可用字节值配置以适配大盘。**分片成本**：每个分片是独立 Lucene index，有各自 segment、词典、句柄、线程与内存开销。**过多**：协调节点 gather 归并更多分片、片段更小、merge 效率差、元数据/恢复成本上升（"改更多分片反而更慢"）；**过少**：单片过大（上百 GB）不利并行、恢复慢、无法扩展。经验单分片约 **10–50GB**（日志可 20–50GB+），分片数与节点/内存匹配。

**追问 1：磁盘达 flood stage 后如何恢复写入？**
> **答案：** 先**降水位**（删旧数据/扩盘/缩副本）到 85% 以下，再解除只读 `PUT idx/_settings {"index.blocks.read_only_allow_delete":null}`。仅解 block 不降水位，副本仍无法分配、很快再次只读——案例三复盘重点。

**追问 2：如何估算索引该设几个分片？**
> **答案：** 估数据总量（含副本与增长），按单分片 10–50GB 反推：分片数 ≈ 主分片总数据量 / 目标单分片大小。如日增 100GB、保留 30 天约 3TB，按 30GB/片约 100 主分片，结合节点数均匀分配；用 rollover 避免单索引无限增大。**分片数一旦设定不可直接改**（需 reindex/shrink），建索引前就要规划。

---

<a id="part-3"></a>

## Part 3：核心区分度题（题眼，定级主战场）

> 全题**题眼**——能否按"现象→指标→层级→根因"系统性排查查询慢、写入慢、红黄，直接决定 L2 还是 L3/L4。

### Q9. 如何系统性定位"查询慢"？

**标准答案：** 先量化（哪个接口/DSL、P50/P99、QPS、哪个索引）。再分层：① **资源瓶颈**：`_cat/nodes` 看 CPU/负载、`hot_threads` 看是否 GC/merge 抢资源、`_cat/thread_pool/search` 看队列——若整体都慢先查 JVM/GC/IO 而非单条 DSL。② **Profile 分阶段**：query 慢多是条件/分词/段多；aggs/collect 慢多是高基数聚合、global ordinals、fielddata。③ **查写法**：该用 `filter` 的用 filter；terms/聚合字段是否误用 text；是否深分页；是否 `script`/前缀 `wildcard`/超大 terms。④ **查设计**：`_segments` 段数是否过多、分片是否合理、是否需 routing 收敛。⑤ **验证**：改写后对比 Profile 与慢日志，灰度看 P99 是否回落。

**追问 1：Profile 里 `rewrite` 耗时很高，通常什么问题？**
> **答案：** rewrite 处理 query 改写（多词 terms、`prefix`/`wildcard` 展开、多分片 rewrite）。高耗时常见于**terms 字典巨大**、通配展开成海量词项、分布式 rewrite 往返；对策：减小 terms 列表、避免通配前缀、用 `term` 精确匹配、减少分片。

**追问 2：`collect` 阶段慢怎么进一步定位？**
> **答案：** collect 负责收集命中、构建 sort 与聚合。高基数 terms 聚合、多层 aggs、对 text 聚合触发 fielddata、global ordinals 首次构建、超大 top-K 排序都会拖慢它。看 Profile 的 `aggregations`/`collector` 明细，对症用 `sampler`/`cardinality` 近似、给 keyword 设 `eager_global_ordinals`、把 text 改 keyword。

---

### Q10. 如何定位"写入慢 / 429"？

**标准答案：** 先区分是报错 429、写入延迟高还是拒绝丢数据。链条：① **线程池**：`_cat/thread_pool/write?v` 看 `queue`/`rejected`，队列满直接 429，说明写入超能力。② **bulk**：单批太大（几十 MB+）压垮 JVM/IO、太小则请求暴增，经验 **5–15MB/批**压测找拐点；并发过高打满队列，需降并发+客户端限流/退避。③ **refresh**：1s refresh 每秒造段，导入期设 `-1`/30s。④ **translog**：`durability: request` 每次 fsync 最慢，可丢秒级数据的日志用 `async`。⑤ **merge**：抢 IO 时写入慢（hot_threads 看 merge），检查限流。⑥ **磁盘/资源**：水位接近 flood、CPU/IO 打满、GC 长停都表现为写入慢。

**追问 1：遇 429 客户端怎么改，而非只调服务端？**
> **答案：** 客户端做**限流 + 指数退避重试**：捕获 429 随机抖动后重试、避免"重试风暴"，同时减小 bulk 批量与并发。服务端调大 `thread_pool.write.queue_size`（治标）或扩容节点（治本）。

**追问 2：如何证明 bulk 批量调对了？**
> **答案：** 用不同 bulk 大小/并发压测，记录 **ingest 吞吐（docs/s）、拒绝数、CPU/IO、GC pause** 曲线，取吞吐最高且拒绝为 0、资源未饱和的拐点为基线；上线后持续监控这些指标，而非凭"感觉快了"。

---

### Q11. 如何定位"集群 red / yellow"？

**标准答案：** 看现象：`_cluster/health?level=shards` 与 `_cat/shards`——**yellow = 副本未分配**（主分片都在、数据完整但无冗余）；**red = 主分片缺失**（部分数据不可用）。核心工具 **`GET _cluster/allocation/explain`** 直接给未分配原因。常见：节点掉线（`NODE_LEFT`）、磁盘满（flood 触发只读与分配失败，案例三）、分片太多/资源不足（`NODE_ALLOCATED_DECLINED`）、分配规则冲突（`index.routing.allocation.*`/awareness/tier）、人为关分配（`allocation.enable=none`，滚动重启后忘开）。对策对症：恢复节点/扩容/降水位/调规则/`retry_failed`；**切忌一 red 就重启节点**（可能扩大数据缺口）。

**追问 1：`allocation explain` 显示 `ALLOCATED_DECLINED` 且原因是磁盘，下一步？**
> **答案：** 看哪个 decider 拒绝（常见 `disk_threshold_decider`），确认磁盘使用率与水位：若 flood 引发只读，先清/扩盘降水位，再解 `read_only_allow_delete`，最后 `_cluster/reroute?retry_failed=true` 重试。只看 health 颜色不做 explain 是盲修。

**追问 2：yellow 一定没事吗？**
> **答案：** yellow 数据可用但**无副本冗余**，再挂一节点就可能丢数据变 red，属"带病运行"。短期可容忍（单节点开发/滚动重启），生产要尽快查明副本未分配原因（节点数不足、规则、磁盘）恢复 green，排查同样用 allocation explain。

---

### Q12. mapping / 索引设计如何决定性能上限？ILM 与相关性评估怎么做？

**标准答案：** **mapping 决定上限**：① 精确匹配/排序/聚合用 `keyword`（doc_values、列式、off-heap），全文检索才用 `text`，可 `fields` 并存；② `nested` 每对象存为隐藏独立文档、查询需 join，**数量爆炸既慢又占空间**，能扁平化 `flattened`/数组 keyword 就别用；③ **字段爆炸**撑爆集群状态与堆，建议 `dynamic: strict` 或限制；④ `_source` 可 `includes/excludes` 裁剪，`store` 仅在需单独取回时用；⑤ 不需聚合的字段可关 `doc_values`/`norms` 省空间。**ILM 冷热分层**：hot（SSD 读写、rollover）→ warm（force merge、shrink、只读）→ cold（少副本）→ frozen（searchable snapshot 按需加载），靠 data tier 落在不同节点；日志用 **data stream + ILM + rollover + 保留期删除** + `index.codec: best_compression`。**相关性量化**：建 **judgment list**（人工标注 query-doc 0–3 级），用 **NDCG@K**（越相关排越前分越高、位置折损）、Precision@K、MRR 对比改前改后，可用 ranking evaluation API 跑批量评估，**不凭"感觉更准"**。

**追问 1：`text` 字段做排序为什么危险？正确做法？**
> **答案：** text 被分词，排序/聚合要把**全部 term 载入堆的 fielddata**，占内存大、易触发 breaker（案例四）。正解：加 `.keyword` 子字段（`ignore_above` 设阈值），排序/聚合用 `字段名.keyword` 走 doc_values。

**追问 2：ILM 里 rollover 比"按天建索引"好在哪？**
> **答案：** rollover 按**条件**（文档数/主分片大小/时长）滚动，避免"某天暴增致单索引过大"或"某天太少产生海量小索引"；配合 data stream 写入别名无感切换、自动分层与删除、分片更均匀。按天建是固定粒度，不够弹性。

---

<a id="part-4"></a>

## Part 4：实战案例题（本套重点，案例驱动）

> 给出现场现象，让候选人按"现象 → 排查 → 根因 → 修复 → 量化结果 → 预防"完整复述。能否给出命令、参数与**前后量化数字**，是 L4 分水岭。

### Q13. 案例一：商品搜索翻到第 1 万页就超时

**标准答案：**
**现象 / 排查：** 商品列表 `from=10000,size=20` 翻页，前几页 50ms、深页 30s 超时报 `max_result_window`；慢日志确认深分页 DSL，Profile 看 query 不慢、慢在 collect 与协调归并，`_cat/shards` 显示 12 主分片。
**根因 / 修复：** 每片返回约 10020 条、协调归并 `12×10020` 条再丢弃——越深越爆炸且超 window；改 **`search_after` + PIT**（稳定 tiebreaker 排序 + `"pit":{"id":...,"keep_alive":"2m"}` 续页），仅支持上一页/下一页。
**量化 / 预防：** 第 1 万页 P99 从 30s 超时降到约 80ms、传输降两个数量级；产品改"加载更多"、限制最大页码、代码评审禁 `from` 超阈值。

**追问 1：`search_after` 为何需要稳定 tiebreaker，且要用 PIT？**
> **答案：** 排序字段值重复会致翻页边界不稳、重复/漏数据，需加唯一字段作 tiebreaker；PIT（point in time）提供**跨请求一致性快照**，避免翻页期间数据变动致错乱，比 scroll 更轻（不保留全量上下文）。

**追问 2：scroll 也能深分页，为什么不用？**
> **答案：** scroll 适合**全量导出/离线遍历**（快照上下文），占资源、非实时、不能跳页/回翻，在线交互不如 search_after。在线"下一页"首选 search_after+PIT，批量导出才用 scroll。

---

### Q14. 案例二：写入吞吐上不去且频繁 429

**标准答案：**
**现象 / 排查：** bulk 大量 429（`rejected execution`）、吞吐卡 3 万 docs/s、`write` 队列满；`_cat/thread_pool/write?v` 见 rejected 递增，`hot_threads` 见大量 indexing/merge，配置为单批 50MB、并发 32、refresh 1s。
**根因 / 修复：** 批量过大压垮 JVM/IO + 并发打满队列 + 1s refresh 造小段致 merge 抢 IO；降到 **10MB/批、并发 8 + 指数退避**，导入期 `refresh_interval:-1`，translog 改 `async`，merge 保守限流。
**量化 / 预防：** 吞吐 3 万→约 12 万 docs/s、拒绝归零、CPU/IO<70%；压测定拐点固化客户端、退避重试、策略写入 SOP。

**追问 1：调大 `thread_pool.write.queue_size` 就能解决 429 吗？**
> **答案：** 治标不治本。加大队列只把拒绝推迟，排队请求增多会增大延迟、吃堆、最终仍满。根因是**处理能力 < 写入速度**，正解是减批量/并发+退避、优化 refresh/translog、必要时扩容节点。

**追问 2：`durability: async` 的代价？什么场景不能用？**
> **答案：** 宕机可能丢 `sync_interval`（默认 5s）内未落盘的写，牺牲持久性换吞吐。**金融交易/订单等关键数据不能用**，必须 `request`；日志、监控、可重建数据可接受，取舍要和业务方确认。

---

### Q15. 案例三：集群突然变 red 且写入被拒

**标准答案：**
**现象 / 排查：** 夜间集群 red、写入报 `403 read-only`/429、多主分片未分配；`_cat/allocation?v` 见某节点磁盘 97%，`_cluster/allocation/explain` 显示 `disk_threshold_decider`，索引 `read_only_allow_delete=true`。
**根因 / 修复：** 磁盘超 **flood 95%** 触发索引只读、拒绝分配 → red；应急清盘/降副本到 85% 以下、解 `read_only_allow_delete`、`_cluster/reroute?retry_failed=true`；根治上 data stream + ILM 自动删除 + 水位告警。
**量化 / 预防：** 30 分钟恢复 green、拒绝归零、磁盘稳在 70%；三级水位告警（80% 预警）、ILM 保留期、容量规划、禁"red 就重启"。

**追问 1：为什么"只解除只读 block"不够？**
> **答案：** block 是 flood stage 的**结果**非原因。磁盘仍 >95% 则分片依旧无法分配，解除后很快再次只读。必须**先降水位**（删数据/扩盘/缩副本），再解 block、再 retry 分配，顺序不能反。

**追问 2：red 时直接重启磁盘满节点对吗？**
> **答案：** 不对。重启不腾磁盘，反让该节点分片先变 unassigned、增恢复负担与数据风险。正确路径是降水位 + 恢复分配；若节点真宕机，先确认数据能否从副本恢复，而非盲目重启。

---

### Q16. 案例四：加了个排序字段，查询从 50ms 变 5s

**标准答案：**
**现象 / 排查：** 加"按标签排序"后查询 50ms→5s、偶发 fielddata 断路器异常；Profile 看 sort/collect 飙升，`_nodes/stats/fielddata` 内存暴涨，mapping 显示 `tags` 是 **`text` 类型**。
**根因 / 修复：** text 排序把全部 term 载入**堆的 fielddata**、占内存触发 breaker 且 refresh 后重建；加 `tags.keyword`（`ignore_above:256`）、排序改用它走 **doc_values**，必要时 `eager_global_ordinals`，旧索引 reindex。
**量化 / 预防：** 查询回到约 60ms、fielddata 近 0、异常消失；建索引规范要求需排序/聚合的字符串配 `.keyword`、上线前 mapping 校验、监控 fielddata。

**追问 1：doc_values 为什么比 fielddata 健康？**
> **答案：** doc_values 在**建索引时**按列写到磁盘（随段不可变），查询走 OS 页缓存（off-heap）、可顺序读、不占堆；fielddata 是**查询时**在堆里动态构建，占堆、受 GC 与断路器限制。doc_values 默认对 keyword/数值/日期开启。

**追问 2：标签数量特别多（上千）还能用 keyword 排序吗？**
> **答案：** 技术可行，但高基数 keyword 的 global ordinals/排序内存与耗时仍上升；应评估是否真需"按标签排序"（业务常无意义）。若只是过滤，改 `filter` 命中 query cache；若是嵌套结构，警惕 nested 爆炸（nested 每对象是隐藏文档、数量爆炸既慢又占空间，能用 `flattened`/数组 keyword 就别用）。

---

### Q17. 案例五：索引从 5 分片改成 20 分片反而更慢

**标准答案：**
**现象 / 排查：** 主分片 5→20 后 P99 80ms→300ms、segment 与堆上升；Profile 见各片本地 query 快、慢在协调 gather/归并，`_cat/shards` 见 20 片、`_segments` 见总段数增多单段变小。
**根因 / 修复：** 分片过多致协调归并 20 份结果、每片变小 merge 效率差、固定开销放大 4 倍；用 `_shrink`/`reindex` 回到**合理分片数（如 6）**、按单分片 10–50GB 重规划。
**量化 / 预防：** P99 300ms→约 70ms、segment 降约 60%；建索引前按数据量估分片一次定好、容量评审、写入规范。

**追问 1：shrink 为何要求先把副本设为 0、索引只读？**
> **答案：** shrink 要求所有主分片集中到一节点且索引只读（保证合并期间不再写入），用 `index.routing.allocation.require._name` 挪分片、`index.blocks.write=true` 后执行，让 Lucene 安全把多分片段合成更少分片。

**追问 2：分片过少的危害？什么情况该加分片？**
> **答案：** 过少则单片过大（上百 GB），无法利用多节点并行、恢复/迁移慢、查询并行度不足。加的信号：单片超 50GB、节点 CPU/IO 有富余但查询并行度不足、数据持续增长。分片数是"并行度"与"固定开销"的平衡点。

---

### Q18. 案例六：用了 IK 分词，中文却搜不到

**标准答案：**
**现象 / 排查：** 标题含"保温杯"却搜不到，`match_phrase` 无结果；`_analyze` 见索引用 `ik_max_word` 切成 `保/温/保温/保温杯/杯`，查询用不同 analyzer 只切 `保温/杯` 词项对不上，词库无新词。
**根因 / 修复：** 索引期与查询期分词粒度不一致（phrase 还要求位置完全匹配）；索引 `ik_max_word` + 查询 `ik_smart`、普通检索用 `match` 而非 `match_phrase`、业务词入 IK 扩展词库热更新。
**量化 / 预防：** 召回率 0→98%、误召回下降；明确 analyzer 映射并写文档、上线前 `_analyze` 验收、词库版本管理。

**追问 1：`ik_max_word` 和 `ik_smart` 怎么选？**
> **答案：** `ik_max_word` 最细粒度穷举词，**索引期**用提高召回；`ik_smart` 最粗粒度智能切分，**查询期**用提高精度减噪音。经典搭配"索引 max_word + 查询 smart"。需短语精确匹配则两边同一 analyzer 并考虑位置。

**追问 2：新词（品牌名）搜不到，除改词库还有啥办法？**
> **答案：** 可加 `synonyms`（同义词/别名映射）、用 `ngram`/`edge_ngram` 部分匹配兜底、专有名词走 `term`/`keyword` 精确匹配；但根本是把词库补全并保持索引/查询一致。改词库后需 **reindex** 才能让已索引文档按新词切分。

---

### Q19. 案例七：日志场景把存储撑爆

**标准答案：**
**现象 / 排查：** 日志集群磁盘 3 个月涨到 90%、老日志在热节点；`_cat/indices` 见单个巨大索引、无 ILM（`_ilm/explain` 未管理）、refresh 1s、副本 1、codec 默认、无保留期。
**根因 / 修复：** 无 ILM/保留期只进不出 + 全放 hot + 未用 best_compression/未降副本；建 **data stream + ILM**（hot rollover→7 天 warm shrink/force merge→30 天 cold 降副本→90 天删）、`index.codec: best_compression`、历史用 searchable snapshot。
**量化 / 预防：** 存储成本降约 60%、热节点回 50%；日志强制接入 data stream+ILM、保留期与容量告警、定期审计。

**追问 1：best_compression 的代价？为何非所有场景都开？**
> **答案：** `best_compression`（DEFLATE）比默认 LZ4 压缩率高、省盘，但**写入/查询解压更耗 CPU**、会变慢。适合写入少、查询少的归档冷数据；热数据/高查询用默认 LZ4 换速度，压缩比与 CPU 是取舍。

**追问 2：frozen tier / searchable snapshot 为什么省钱？**
> **答案：** 把快照存廉价对象存储、本地只留少量元数据，查询时按需拉取所需段、副本可设 0。牺牲**查询延迟**（首次访问要拉数据）换存储成本，适合偶尔审计的历史数据。9.x 部分相关能力（如列式存储）仍属技术预览，以官方文档为准（见 Part 5）。

---

### Q20. 案例八：向量检索把内存吃满

**标准答案：**
**现象 / 排查：** 上线语义检索后内存打满、频繁 OOM/429、延迟飘高；`_cat/nodes` 见内存吃紧，`dense_vector`+**HNSW**（`index.knn:true`）、768 维、数据上亿、副本 1。
**根因 / 修复：** HNSW 把向量与图结构**常驻内存**，float32 上亿×768 维数百 GB 级 + 图与副本放大；用 **bfloat16/int8 量化**、减副本合理分片、评估 9.x **DiskBBQ**（以官方为准）、过滤用 **ACORN**、TopK 做 on-disk rescoring。
**量化 / 预防：** 内存降约 60–70%、OOM/429 消失、召回经评测可接受；上线前容量规划（维度×数量×字节×副本）、离线评测召回/延迟、跟进 9.x（以 GA 状态为准）。

**追问 1：HNSW 为何吃内存？量化收益与代价？**
> **答案：** HNSW 在内存存每向量完整浮点值 + 多层近邻图连接（M、efConstruction 越大图越密），规模越大内存越线性增长。量化（bfloat16 减半、int8 降约 4 倍）省内存、可进页缓存/磁盘，代价是**精度损失**，需靠 rescoring 与离线评测把召回拉回可接受范围。

**追问 2：这些新特性（DiskBBQ/ACORN/bfloat16）能当稳定能力用吗？**
> **答案：** 要谨慎。ES 9.3（2026-02）引入这些向量能力，但部分（如 DiskBBQ、9.5 列式/VectorDB index mode）处**技术预览/快速演进**，**须核对官方文档的 GA 状态、版本支持与限制**，不可当生产稳定承诺。明确"以官方为准、不编造指标"是加分项。

---

<a id="part-5"></a>

## Part 5：2026 新趋势（9.x 向量与 ES|QL，保守表述）

> 加分题，考察技术视野。**以下为已核实方向，涉及版本/GA 状态以官方文档为准，不编造数字**；答"以官方为准、部分为技术预览"是加分项。

### Q21. ES 9.x 在索引效率、向量检索、语义检索上有哪些演进？

**标准答案：** **9.x 分支**：ES 9 系列（**9.3 于 2026-02 发布**）基于 **Lucene 10**，索引压缩与检索效率提升，升级需关注与 8.x 的迁移兼容。**向量检索（以官方文档为准）**：**DiskBBQ** 在磁盘上搜索量化向量、大幅降低 HNSW 全内存开销；**ACORN** 加速带过滤的向量搜索；`dense_vector` 支持 **bfloat16** 与 **on-disk rescoring**（量化粗排 + 磁盘精排，平衡内存与精度）。**语义检索**：**`semantic_text`** 自动调用 embedding 生成向量并索引，降低手动搭向量流水线门槛（注意推理成本与延迟）。**技术预览（须标注、以官方为准）**：9.5 的 **Columnar Mode（列式存储）** / **VectorDB index mode** 等处**技术预览/演进中**，不宜当生产稳定承诺。**核心观点**：自动化与量化让**调参空间收敛**，但**设计阶段的索引规划与数据建模**（字段类型、分片、生命周期、是否量化）仍是性能上限的决定因素。

**追问 1：这些向量新特性会让"懂调优"不重要吗？**
> **答案：** 不会，反更依赖设计判断。DiskBBQ/量化/自动 embedding 降低的是手调参数门槛，但**要不要量化、用哪种向量索引、分片与副本怎么配、召回与延迟如何权衡、成本怎么规划**都需工程判断。工具越自动，越要求理解原理与场景。

**追问 2：候选人说"9.5 列式存储已稳定可用于生产"，你怎么看？**
> **答案：** 这是**过度断言**。9.5 相关能力（Columnar Mode / VectorDB index mode）在 2026 年属技术预览/快速演进，是否 GA、支持哪些场景、限制都以官方文档为准。明确"技术预览、需核实官方状态、不编造指标"是稳健专业的表现。

---

### Q22. ES|QL 等新查询方式对调优意味着什么？

**标准答案：** **ES|QL** 管道式语法（如 `FROM logs | WHERE status>=500 | EVAL dur=... | STATS count() BY service | LOOKUP JOIN ...`）带来：① **LOOKUP JOIN** 用小型维表 enrich 数据，部分替代复杂 DSL 与应用端拼装；② **时序聚合**更适合日志/指标；③ **Inline Stats** 一次查询完成多步计算。**意义**：原本靠复杂 DSL / 多次往返 / 客户端处理的工作可用一条 ES|QL 完成，减少协调与传输、更易读易调优。同时 **semantic_text、自动校准（auto tuning）、Agent Builder 可观测**等降低调优门槛。但 ES|QL 仍在演进，功能与性能以官方文档为准，不能盲信"一定更快"，要实测对比。

**追问 1：ES|QL 会取代 DSL 吗？**
> **答案：** 短期**互补**：ES|QL 在分析/聚合/enrich 更简洁，但精确控制打分、复杂嵌套查询、底层调优参数仍需 DSL，大量存量系统基于 DSL。合理态度是"按场景选、实测为准"，而非断言谁取代谁。

**追问 2：如何客观比较 ES|QL 与等价 DSL 的性能？**
> **答案：** 同一数据集、同一语义分别跑多次取 P50/P99 与吞吐，结合 `_profile`/查询日志看各阶段耗时与返回数据量，关注版本对该场景的优化程度，用数据而非"新东西更快"的主观判断下结论。

---

<a id="part-6"></a>

## Part 6：能否用本套定级？如何定级？

### 结论先行

**可以，ES 调优案例集是后端/搜索/运维面试里区分度极高的探针**——天然可证伪：会不会看指标、能不能讲出一次完整排查与前后量化数字，背"优化清单"的人一问案例就露馅。但它**高度依赖真实线上经验**，对没处理过故障的初中级问深了只会得到标准答案；招初中级问到 Part 1/2 即可，用 Part 4 案例做鉴别。本套属 **G 实战深水区、⭐经验区分器，案例题权重高于原理题**。

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 知道要看慢日志/_cat，说不出排查层级与验证方法 |
| **中级（L2）** | 2–5 年 | Part 2 | 懂 Profile/三种缓存/refresh/分片基本概念，但缺体系 |
| **中高级（L3）** | 5–8 年 | Part 3 | 能按层次排查查询慢/写入慢/集群红黄，用 allocation explain 定位 |
| **高级（L4）** | 8 年+ | Part 4 | 有多个真实案例的完整排查（现象→根因→修复→量化），能讲清取舍 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 能做集群/索引架构设计、成本容量规划，跟进 9.x 向量与 ES|QL 演进 |

### 定级操作方法

**第一步：Part 0 摸底。** 能说"现象→指标→层级→根因→修复预防"闭环 → 至少 L2；只会"加内存、加分片、调 refresh" → 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追问"为什么/怎么验证"：深分页为何越翻越慢（每片返回 from+size、协调归并放大）？5 分片改 20 为何更慢（分片固定开销 + gather + 段变小）？text 排序为何慢（fielddata 进堆）？为何只解除只读 block 不够（flood 未消、分片仍无法分配）？

**第三步：三类信号防背题。** ① **真实性**：能否说出命令（`_cat/...`、`allocation/explain`、Profile）与前后数字（"5s→60ms、429 归零、P99 300ms→70ms"）；② **抽象能力**：能否沉淀为"现象→指标→层级→根因→修复→预防"方法论与基线；③ **权衡能力**：能否讲清实时性↔吞吐↔查询、堆↔页缓存、内存↔精度的取舍及"何时不该调"。

**第四步：按最深层级定级，不按正确率。** 结合岗位调整深度：业务/搜索开发问到 Part 3 足够，SRE/中间件/平台架构才需 Part 4 排障与 Part 5 演进视野。

### 面试官避坑提醒

- **不要对所有人问到向量量化与 9.5 技术预览**——很多优秀工程师排障扎实但没跟进最新向量特性，区分"能实战"和"背新词"，前者更有价值。
- **把"能完整复述一个带量化结果的案例"作为 L4 分水岭**：能给命令、根因与前后数字的人一定真处理过。
- **务必问"新特性 GA 状态"**：把预览当稳定能力吹嘘、或编造性能数字，是"背新词型"信号，反之"以官方为准"是专业表现。
- **结合岗位**：业务开发问到 Part 3 即可；SRE/搜索平台/架构团队才需 Part 4 全量案例与 Part 5 演进。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**排障主线（照着问）：**
1. 看现象 →（查询慢/写入 429/集群红黄；延迟 P99、拒绝数、health 状态）
2. 看指标 →（`_cat/*`、`_nodes/stats`、`hot_threads`、慢日志、`_segments`、Profile）
3. 定位层级 →（mapping 设计、查询写法、分片规划、JVM/GC、磁盘 IO、ILM）
4. 验证根因 →（Profile 分阶段、`allocation/explain`、灰度复现、性能基线）
5. 修复预防 →（改 DSL/调 refresh/扩容量/加 ILM + 告警，可回滚）

**核心技术判据：**
- 查询两阶段 query→fetch、scatter-gather、分片打分与协调归并 →（深分页为何贵、分片为何不能过多）
- 三缓存：query cache（filter bitset）/request cache（size:0、refresh 失效）/fielddata（text 进堆，改 keyword+doc_values）
- refresh/translog/merge 三角权衡 →（实时性 ↔ 吞吐 ↔ 查询性能）
- 断路器 + heap≤31GB（压缩指针）+ 留内存给 OS 页缓存 →（加堆未必更快）
- 水位 85%/90%/95% →（flood 触发只读，先降水位再解 block）

**定级速判：**
- 答到第 1–2 段 + 知道看慢日志/_cat → L2
- 答到第 3 段 + 能按层次排查三类问题 → L3
- 能完整讲 Part 4 案例 + 给出命令与量化结果 → L4
- 有架构设计/容量规划 + 跟进 9.x 向量与 ES|QL 演进 → L5

**一票否决信号：** 认为"靠加内存能解决所有慢查询"、"分片越多越快"、"出了 red 就重启节点"、"把所有字段设成 text"、"深分页用 from+size 加大窗口"、"把技术预览当稳定能力/编造性能数字"，或讲不出一次真实排查与验证过程 → 无论年限，最高 L2。

---

*资料整理于 2026-11-22，参考 Elasticsearch 官方文档（查询执行与 Profile、缓存体系、段合并、断路器、磁盘水位与分片分配、ILM 与 data stream、ES|QL、semantic_text、9.x 向量检索相关章节与发布说明）及 2026 年后端/搜索/SRE 面试趋势资料。涉及版本与功能 GA 状态以官方文档为准，部分 9.5 能力为技术预览；题目与答案基于公开技术资料整理，用于面试评估参考。*
