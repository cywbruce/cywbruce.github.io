---
title: "面试官速查表合集 · 42 套一页纸（快速浏览版）"
date: 2026-11-26
summary: "从 42 套题库抽取的全部面试官速查表：递进主线、定级速判、一票否决信号，按 A–I 体系顺序排列，附一票否决总表与跨主题定级矩阵。"
kind: handbook
interview: false
order: 2
---

# 面试官速查表合集 · 42 套一页纸
> 从 42 套面试题库的「附录：面试官速查表」**原样抽取**，按体系 A–I 顺序排列，供面试前速览、现场照着问、集中背诵。
> 每套速查表统一为三段：**主线（递进 / 排障，照着问）→ 定级速判 → 一票否决信号**。配套完整追问链与答案见对应题库单册。
> 整理日期：2026-11-26 · 共 42 套 · 九大板块。

---

## 快速导航
| 板块 | 主题（点击直达） |
| --- | --- |
| 板块 A：并发编程（7 套） | [ThreadLocal](#qa-101) · [synchronized 与锁升级](#qa-102) · [AQS](#qa-103) · [线程池](#qa-104) · [volatile 与 JMM](#qa-105) · [CAS 与原子类](#qa-106) · [死锁排查](#qa-107) |
| 板块 B：JVM 与语言基础（2 套） | [JVM 与 GC](#qa-201) · [基础与语法核心](#qa-202) |
| 板块 C：集合框架（1 套） | [集合框架](#qa-301) |
| 板块 D：技术栈（6 套） | [MySQL](#qa-401) · [Redis](#qa-402) · [Spring](#qa-403) · [消息队列](#qa-404) · [Elasticsearch](#qa-405) · [Dubbo](#qa-406) |
| 板块 E：计算机基础（3 套） | [计算机网络](#qa-501) · [操作系统](#qa-502) · [设计模式](#qa-503) |
| 板块 F：分布式（3 套） | [分布式事务](#qa-601) · [服务治理](#qa-602) · [分布式 ID](#qa-603) |
| 板块 G：实战深水区（6 套）⭐ 经验区分器 | [Redis 进阶实战](#qa-701) · [JVM 调优案例集](#qa-702) · [SQL 优化案例集](#qa-703) · [DDD 领域建模](#qa-704) · [ES 调优案例集](#qa-705) · [Dubbo 调优案例集](#qa-706) |
| 板块 H：前端与全栈（6 套） | [TypeScript](#qa-801) · [React](#qa-802) · [Vue 3](#qa-803) · [浏览器原理](#qa-804) · [前端工程化](#qa-805) · [Node.js 与 SSR](#qa-806) |
| 板块 I：AI Agent 开发（8 套）⭐ 2026 增量 | [LLM 基础与提示工程](#qa-901) · [Agent 架构与推理模式](#qa-902) · [MCP 协议](#qa-903) · [RAG 检索增强](#qa-904) · [AI 编码 Agent 与 IDE](#qa-905) · [Agent 框架与编排](#qa-906) · [Agent 评测与可观测性](#qa-907) · [Agent 安全与生产实践](#qa-908) |

### 一票否决信号速查总表（42 套）
> 命中任一条，无论年限最高 L2。面试时听到这些表述直接判低。

| 主题 | 一票否决信号 |
| --- | --- |
| [ThreadLocal](#qa-101) | 说"ThreadLocal 是线程安全的银弹"、说不清为什么要 remove、认为 remove 可省略 → 无论年限，最高 L2。 |
| [synchronized 与锁升级](#qa-102) | 说不清锁的是什么对象、认为 synchronized 不能重入、坚持"虚拟线程绝对不能用 synchronized"且说不出 JDK 版本区别 → 无论年限，最高 L2。 |
| [AQS](#qa-103) | 认为"AQS 就是 ReentrantLock 的别名"、说不清 state 和队列的关系、认为 acquire 一定响应中断 → 无论年限，最高 L2。 |
| [线程池](#qa-104) | 只会 newFixedThreadPool 且不知其风险、说不清 execute 流程、认为线程池线程越多越好 → 无论年限，最高 L2。 |
| [volatile 与 JMM](#qa-105) | 认为 volatile 能保证 i++ 原子性、讲不清 DCL 为什么要 volatile、说不出任何 happens-before 规则 → 无论年限，最高 L2。 |
| [CAS 与原子类](#qa-106) | 认为 CAS 是"无冲突"的、说不出 ABA 是什么、认为 LongAdder 能替代 AtomicLong 做序列号 → 无论年限，最高 L2。 |
| [死锁排查](#qa-107) | 只会背四条件但不会用 jstack、认为 CPU 高就是死锁、说不出任何避免死锁的工程手段 → 无论年限，最高 L2。 |
| [JVM 与 GC](#qa-201) | 认为"引用计数能解决所有问题"、说不清 GC Roots 与可达性分析、断言"ZGC 停顿为零"或"JDK 默认 GC 是 ZGC"却无法辨析 → 无论年限，最高 L2。 |
| [基础与语法核心](#qa-202) | 认为"Java 是引用传递"却讲不清副本机制、认为"hashCode 相等就一定要 equals 相等"、说"String 底层是 final char[] 且 JDK9 后没变过"、把 Record/虚拟线程说成很早就有 → 无论年限，基础项最高 L2。 |
| [集合框架](#qa-301) | 认为"HashMap 是线程安全的"、说不清"为什么容量是 2 的幂 / 负载因子 0.75"、认为"JDK8 HashMap 修了死循环就能并发用"、把 fail-fast 说成"一定会抛异常" → 无论年限，最高 L2。 |
| [MySQL](#qa-401) | 认为"索引越多越好"、"MySQL 索引用 B 树/红黑树实现"、"MVCC 不需要 undo log"、"redo log 和 binlog 是同一个东西"、讲不清聚簇索引与回表的关系 → 无论年限，最高 L2。 |
| [Redis](#qa-402) | 认为"Redis 是多线程执行命令的"、说不清穿透/击穿/雪崩区别、认为"缓存与 DB 一定能强一致"、混淆过期删除与内存淘汰 → 无论年限，最高 L2。 |
| [Spring](#qa-403) | 认为"@Transactional 加在任何方法上都生效"、说不清 IOC 与 DI 关系、认为"singleton Bean 天然线程安全"、循环依赖只会说"Spring 自动解决"却讲不出三级缓存 → 无论年限，最高 L2。 |
| [消息队列](#qa-404) | 认为"用了 MQ 就不用考虑一致性"、分不清"至少一次/幂等/恰好一次"、说不出消息丢失可能发生在哪个环节、认为"消费者越多消费越快（与分区数无关）" → 无论年限，最高 L2。 |
| [Elasticsearch](#qa-405) | 认为"ES 是数据库替代品、能替代 MySQL 事务"、认为"text 字段可以直接聚合排序"、认为"主分片数可以随时改"、认为"refresh 就是立即持久化到磁盘"、认为"from+size 深分页没问题"、认为"term 查询会分词"、认为"副本只做备份不能提供查询"→ 无论年限，最高 L2。 |
| [Dubbo](#qa-406) | 认为"Dubbo 只是注解配置、没什么原理"、"SPI 就是 JDK SPI 换个目录"、"@Adaptive 是编译时生成固定实现"、"Consumer 直接调 Provider 不经过 Invoker/Cluster"、"所有协议都适合大文件传输"、"注册中心挂了服务立刻不可调用" → 无论年限，最高 L2。 |
| [计算机网络](#qa-501) | 认为"三次握手两次也行""TIME_WAIT 是 bug 必须消灭""UDP 没用所以 HTTP/3 不可能基于 UDP""GET 和 POST 都不幂等""HTTPS 只用非对称加密传所有数据"——出现这类根本性概念错误，无论年限，最高 L2。 |
| [操作系统](#qa-502) | 认为"协程由内核调度"、"select 是异步 I/O"、"epoll 默认边缘触发"、"被 OOM Killer 杀是 Java 抛 OutOfMemoryError"、"load 高就一定 CPU 忙" → 无论年限，最高 L2。 |
| [设计模式](#qa-503) | 认为"设计模式越多越高级"、把装饰器/适配器/代理混为一谈且说不清意图差异、说不清 DCL 为何要 volatile、把 Record/Sealed/switch 模式匹配的正式版年份张冠李戴 → 无论年限，最高 L2。 |
| [分布式事务](#qa-601) | 认为"Seata AT 是强一致且无任何问题"、"加了 @GlobalTransactional 就一定不会不一致"、"TCC 不需要处理幂等"、"2PC 不会有数据不一致"、"分布式事务有银弹方案" → 无论年限，最高 L2。 |
| [服务治理](#qa-602) | 认为"注册中心挂了整个系统立刻不能用"、把 Nacos 等同于"只能 AP 或只能 CP"、混淆熔断与降级、认为 Failover 可无脑用于写操作、说不清 SPI 与 JDK SPI 区别 → 无论年限，最高 L2。 |
| [分布式 ID](#qa-603) | 认为"雪花算法绝对全局有序"、"Leaf 强依赖 ZK"、"有了数据库自增就不需要分布式 ID"、说不清时钟回拨为何危险 → 无论年限，最高 L2。 |
| [Redis 进阶实战](#qa-701) | 认为"UNLINK 和 DEL 一样"、说不清 mem_fragmentation_ratio >1 与 <1 区别、认为"延迟双删能保证强一致"、认为"Lua 写脚本超时可 SCRIPT KILL"、混淆 Redis 锁与 etcd 锁一致性 → 无论年限，最高 L2。 |
| [JVM 调优案例集](#qa-702) | 把"调大 Xmx / 重启"当万能解、看到 Full GC 不先定位根因、断言"JDK 默认 GC 是 ZGC"却无法辨析、只会罗列参数讲不出任何验证手段 → 无论年限，最高 L2。 |
| [SQL 优化案例集](#qa-703) | 认为"LIMIT 一定减少扫描"、"索引越多越好"、"EXPLAIN 的 rows 是真实值"、"count 各引擎一样"、"优化就是加索引"，或讲不出一条真实慢 SQL 的验证过程 → 无论年限，最高 L2。 |
| [DDD 领域建模](#qa-704) | 把 DDD 等同于分层架构或 JPA 注解、认为"所有系统都该上 DDD"、把聚合当数据表随便拆、领域模型全是 setter 还声称做了 DDD → 无论年限，最高 L2。 |
| [ES 调优案例集](#qa-705) | 认为"靠加内存能解决所有慢查询"、"分片越多越快"、"出了 red 就重启节点"、"把所有字段设成 text"、"深分页用 from+size 加大窗口"、"把技术预览当稳定能力/编造性能数字"，或讲不出一次真实排查与验证过程 → 无论年限，最高 L2。 |
| [Dubbo 调优案例集](#qa-706) | 认为"超时就调大 retries"、"线程池打满就加线程数不问根因"、"注册中心挂了服务立刻不可用"、"重试不用管幂等"、"泛化调用报序列化错就加超时"，或讲不出一次真实排查与验证过程 → 无论年限，最高 L2。 |
| [TypeScript](#qa-801) | 认为"TS 会在运行时做类型检查"、"类型注解会被编译进 JS"、"any 和 unknown 差不多"、说不清结构化类型、认为"类型体操越多越专业"→ 无论年限，最高 L2。 |
| [React](#qa-802) | 认为"虚拟 DOM 一定比直接操作 DOM 快"、说不清 state 如何驱动渲染、认为"Hooks 可随便放进 if"、认为"key 用 index 无所谓"、编造 React 19 不存在的 API 或错误版本日期 → 无论年限，最高 L2。 |
| [Vue 3](#qa-803) | 认为"用了 Proxy 就不会有响应式丢失"、"ref 和 reactive 完全等价"、"computed 每次读取都重算"、"setup 里能用 this"、"Vapor Mode 已全面取代虚拟 DOM"、"history 模式刷新一定不 404" → 无论年限，最高 L2。 |
| [浏览器原理](#qa-804) | 认为"重绘一定重排"、"setTimeout 比 Promise.then 先执行"、"强缓存会发请求问服务器"、"GPU 加速一定更快"、"INP 就是 FID 的别名"、"CORS 是为了防 XSS" → 无论年限，最高 L2。 |
| [前端工程化](#qa-805) | 认为"Vite 完全没有打包、生产也不用构建"、说不清 CJS 与 ESM 的加载时机差异、认为"pnpm 只是装得快"、把"计划中的 Rolldown 默认集成"说成"Vite 7 已默认" → 无论年限，最高 L2。 |
| [Node.js 与 SSR](#qa-806) | 认为"Node 是多线程并行执行 JS"、"setTimeout(0) 一定先于 setImmediate"、"水合就是客户端重新渲染整棵 DOM"、"Stream 一次把整个文件读入内存"、"require 每次都重新加载模块"、"SSR 一定比 CSR 快" → 无论年限，最高 L2。 |
| [LLM 基础与提示工程](#qa-901) | 把 token 等同于字符、认为 system prompt 是绝对安全边界、认为 temperature=0 就"完全确定/无随机"、认为结构化输出就是"让模型注意输出 JSON"、把"换模型不用改 prompt"当常识 → 无论年限，最高 L2。 |
| [Agent 架构与推理模式](#qa-902) | 认为"Agent 就是 while 循环调 LLM、没什么技术含量"、"给足工具就一定比工作流好"、"Function Calling 等于模型真的在执行代码"、"记忆就是全塞进 prompt"、说不清循环控制流与终止条件 → 无论年限，最高 L2。 |
| [MCP 协议](#qa-903) | 认为"MCP 是一个具体的 AI 模型"、"tools 和 resources 都是给模型随便调用的"、"stdio 传输需要走 OAuth"、"把 MCP 和 Function Calling 完全等同"、认为"server 返回数据天然可信"→ 无论年限，最高 L2。 |
| [RAG 检索增强](#qa-904) | 认为"RAG 能彻底消除幻觉"、"向量库越大越好/切分越小越好"、"语义相似就等于答案正确"、"RAG 和微调是同一件事"、"接个向量库就完事"→ 无论年限，最高 L2。 |
| [AI 编码 Agent 与 IDE](#qa-905) | 认为"ACP 是要取代 MCP 的"、"给 Agent 最高权限最省事"、"把权限弹窗全关掉没风险"、"规则文件里的指令绝对可信"、说不清 ACP 与 MCP 谁管谁 → 无论年限，最高 L2。 |
| [Agent 框架与编排](#qa-906) | 认为"框架用得越复杂越专业"、"多 Agent 一定比单 Agent 效果好"、"把 Chain 等同于 Agent"、"认为框架屏蔽差异后就不用理解底层原理"、说不清循环/状态/恢复如何设计 → 无论年限，最高 L2。 |
| [Agent 评测与可观测性](#qa-907) | 认为"Agent 用普通单测断言输出就够了"、"评测分数高就等于线上效果好"、"LLM-as-judge 完全客观可信、无需校准"、"只看最终答案不看轨迹/成本"→ 无论年限，最高 L2。 |
| [Agent 安全与生产实践](#qa-908) | 认为"在 system prompt 里写句警告就能防提示注入"、"提示注入已被彻底解决"、"为了省事给 Agent 全部权限并关闭所有审批"、"认为 Agent 生成的代码/命令天然可信"、说不出直接与间接注入的区别 → 无论年限，最高 L2。 |

### 跨主题定级速查矩阵

把候选人在各主题上"答到的最深 Part"填进来，横向对比能看出能力是否均衡：

| 主题 \ 级别        | L1   | L2 | L3 | L4     | L5     |
| -------------- | ---- | -- | -- | ------ | ------ |
| ThreadLocal    | P0–1 | P2 | P3 | P4     | P5     |
| synchronized   | P0–1 | P2 | P3 | P4     | P5     |
| AQS            | P0–1 | P2 | P3 | P4     | P5     |
| 线程池            | P0–1 | P2 | P3 | P4     | P5     |
| volatile+JMM   | P0–1 | P2 | P3 | P4     | P5     |
| CAS+原子类        | P0–1 | P2 | P3 | P4     | P5     |
| 死锁排查           | P0–1 | P2 | P3 | P4     | P5     |
| JVM+GC         | P0–1 | P2 | P3 | P4     | P5     |
| 基础语法           | P0–1 | P2 | P3 | P4     | P5     |
| 集合框架           | P0–1 | P2 | P3 | P4     | P5     |
| MySQL          | P0–1 | P2 | P3 | P4     | P5     |
| Redis          | P0–1 | P2 | P3 | P4     | P5     |
| Spring         | P0–1 | P2 | P3 | P4     | P5     |
| 消息队列           | P0–1 | P2 | P3 | P4     | P5     |
| Elasticsearch    | P0–1 | P2 | P3 | P4 | P5 |
| Dubbo          | P0–1 | P2 | P3 | P4 | P5 |
| 计算机网络          | P0–1 | P2 | P3 | P4     | P5     |
| 操作系统           | P0–1 | P2 | P3 | P4     | P5     |
| 设计模式           | P0–1 | P2 | P3 | P4     | P5     |
| 分布式事务          | P0–1 | P2 | P3 | P4     | P5     |
| 服务治理           | P0–1 | P2 | P3 | P4     | P5     |
| 分布式 ID         | P0–1 | P2 | P3 | P4     | P5     |
| **Redis 进阶实战** | P0–1 | P2 | P3 | **P4** | P5     |
| **JVM 调优案例**   | P0–1 | P2 | P3 | **P4** | P5     |
| **SQL 优化案例**   | P0–1 | P2 | P3 | **P4** | P5     |
| **DDD 领域建模**   | P0–1 | P2 | P3 | P4     | **P5** |
| **ES 调优案例**   | P0–1 | P2 | P3 | **P4** | P5 |
| **Dubbo 调优案例** | P0–1 | P2 | P3 | **P4** | P5 |
| TypeScript    | P0–1 | P2 | P3 | P4 | P5 |
| React         | P0–1 | P2 | P3 | P4 | P5 |
| Vue 3         | P0–1 | P2 | P3 | P4 | P5 |
| 浏览器原理         | P0–1 | P2 | P3 | P4 | P5 |
| 前端工程化         | P0–1 | P2 | P3 | P4 | P5 |
| Node.js 与 SSR | P0–1 | P2 | P3 | P4 | P5 |
| LLM 基础与提示工程   | P0–1 | P2 | P3 | P4 | P5 |
| Agent 架构与推理模式 | P0–1 | P2 | P3 | P4 | P5 |
| MCP 协议         | P0–1 | P2 | P3 | P4 | P5 |
| RAG 检索增强       | P0–1 | P2 | P3 | P4 | P5 |
| **AI 编码 Agent** | P0–1 | P2 | P3 | **P4** | P5 |
| Agent 框架与编排    | P0–1 | P2 | P3 | P4 | P5 |
| **Agent 评测可观测** | P0–1 | P2 | P3 | **P4** | P5 |
| **Agent 安全实践**  | P0–1 | P2 | P3 | **P4** | P5 |

---

## 板块 A：并发编程（7 套）

<a id="qa-101"></a>

### A1 · ThreadLocal

**递进主线（照着问）：**

1. 什么是 ThreadLocal？→（线程隔离，每线程独立副本）
2. 数据存在哪？→（Thread 的 ThreadLocalMap，不是 ThreadLocal 自己）
3. key 是什么引用？→（弱引用）
4. 为什么用弱引用？→（兜底，让 key 可被 GC）
5. 那为什么还会内存泄漏？→（key 为 null 但 value 被强引用，线程活着就释放不了）
6. 什么时候最危险？→（线程池，线程长期复用）
7. 除了泄漏还有什么问题？→（数据串线/脏读）
8. 怎么解决？→（try-finally 里 remove）
9. remove 和 set(null) 区别？→（前者删整个 Entry，后者只置 value 为 null）
10. 父子线程/线程池传递？→（InheritableThreadLocal 有坑，线程池用 TTL）
11. 虚拟线程下呢？→（内存膨胀，用 ScopedValue 替代）

**定级速判：**
- 答到第 2 问 → L1/L2
- 答到第 5–8 问 → L3
- 答到第 9–10 问 + 有实战 → L4
- 答到第 11 问 + 有抽象和权衡 → L5

**一票否决信号：** 说"ThreadLocal 是线程安全的银弹"、说不清为什么要 remove、认为 remove 可省略 → 无论年限，最高 L2。

<a id="qa-102"></a>

### A2 · synchronized 与锁升级

**递进主线（照着问）：**

1. 三种用法锁的分别是什么？→（实例 this / 类 Class / 指定 obj）
2. 可重入吗？异常会释放吗？→（可重入，计数器；异常自动 monitorexit 释放）
3. 保证哪些特性？→（互斥+可见+有序；对比 volatile 不保证原子性）
4. 底层原理？→（字节码 monitorenter/exit；JVM Monitor；对象头）
5. 锁存在哪？→（对象头 Mark Word 分时复用）
6. 什么是锁升级？完整过程？→（偏向→轻量 CAS 自旋→重量，单向）
7. 自旋的代价？自适应自旋？→（空转耗 CPU；按历史经验动态调整）
8. JVM 还有哪些优化？→（锁粗化、锁消除、逃逸分析）
9. wait/notify 为什么要在同步块？为什么用 while？→（原子性+防虚假唤醒）
10. DCL 为什么加 volatile？→（禁止 ①③② 重排）
11. 虚拟线程下 synchronized？→（JDK21-23 pinning；JDK24 JEP491 解决）

**定级速判：**
- 答到第 3–4 问 → L1/L2
- 答到第 6–7 问 → L3
- 答到第 8–10 问 + 有实战 → L4
- 答到第 11 问 + 有版本权衡和抽象 → L5

**一票否决信号：** 说不清锁的是什么对象、认为 synchronized 不能重入、坚持"虚拟线程绝对不能用 synchronized"且说不出 JDK 版本区别 → 无论年限，最高 L2。

<a id="qa-103"></a>

### A3 · AQS

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

<a id="qa-104"></a>

### A4 · 线程池

**递进主线（照着问）：**

1. 为什么用线程池？→（复用降开销、管理、限流）
2. 7 大参数？→（核心/最大线程数、keepAlive、队列、工厂、拒绝策略）
3. 为什么不用 Executors？→（无界队列/无限线程 → OOM）
4. execute 执行流程？→（核心线程→队列→最大线程→拒绝）
5. 为什么入队后二次检查？→（防止状态变化导致任务无人执行）
6. ctl 状态机？→（高3位状态+低29位线程数，原子判断）
7. shutdown vs shutdownNow？→（平滑处理队列 vs 立即中断）
8. 线程如何复用？→（getTask 循环从队列取任务）
9. 队列/拒绝策略选择？→（有界为主；关键业务自定义拒绝不丢任务）
10. 线程数怎么设？→（CPU密集≈核数；IO密集≈核数×2 或压测）
11. 任务抛异常/监控？→（submit+Future、UncaughtExceptionHandler、指标埋点）
12. 虚拟线程取代吗？→（不取代；IO密集用虚拟线程，CPU密集仍需池化限流）

**定级速判：**
- 答到第 2–3 问 → L1/L2
- 答到第 4–6 问 → L2/L3
- 答到第 7–9 问 → L3
- 答到第 10–11 问 + 有实战 → L4
- 答到第 12 问 + 体系化设计 → L5

**一票否决信号：** 只会 newFixedThreadPool 且不知其风险、说不清 execute 流程、认为线程池线程越多越好 → 无论年限，最高 L2。

<a id="qa-105"></a>

### A5 · volatile 与 JMM

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

<a id="qa-106"></a>

### A6 · CAS 与原子类

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

<a id="qa-107"></a>

### A7 · 死锁排查

**递进主线（照着问）：**

1. 什么是死锁？四条件？→（互相等待无法推进；互斥/请求保持/不可剥夺/循环等待）
2. 死锁/活锁/饥饿区别？→（全卡死/反复重试无进展/个别饿死）
3. 处理死锁四策略？→（预防破坏条件/避免银行家算法/检测/恢复）
4. 工程如何避免？→（按序加锁、tryLock 超时、减小锁粒度）
5. 线上如何排查？→（jstack/jcmd dump，找 BLOCKED，看锁持有等待，找环）
6. 为什么抓多份 dump？→（排除瞬时竞争误判）
7. CPU 高是死锁吗？→（死锁 CPU 低+线程卡住；CPU 高是死循环/GC）
8. Arthas 排查？→（thread -b 找阻塞线程，在线诊断无需重启）
9. 数据库死锁？→（不同顺序更新行；SHOW ENGINE INNODB STATUS；按序更新）
10. 分布式锁死锁？→（设过期时间、看门狗续期、Lua 原子释放）
11. 虚拟线程与死锁？→（pinning 伪死锁 JDK24 修复；经典资源死锁仍在）
12. 虚拟线程 dump？→（jcmd Thread.dump_to_file -format=json；pinning 用 JFR）

**定级速判：**
- 答到第 2–4 问 → L1/L2
- 答到第 5–6 问 → L2/L3
- 答到第 7–9 问 → L3/L4
- 答到第 10–11 问 + 有实战 → L4
- 答到第 12 问 + 体系化设计 → L5

**一票否决信号：** 只会背四条件但不会用 jstack、认为 CPU 高就是死锁、说不出任何避免死锁的工程手段 → 无论年限，最高 L2。

---

## 板块 B：JVM 与语言基础（2 套）

<a id="qa-201"></a>

### B1 · JVM 与 GC

**递进主线（照着问）：**

1. JVM 内存分区？→（程序计数器/栈/本地方法栈私有；堆/方法区共享；JDK8 元空间替代永久代）
2. 对象怎么创建、布局、访问？→（加载检查→分配/零值→对象头→`<init>`；对象头/实例数据/对齐；句柄 vs 直接指针；TLAB）
3. GC 怎么判活？→（可达性分析 + GC Roots；强软弱虚；finalize 自救）
4. 三种基础算法？→（标记清除有碎片/复制无碎片但费空间/标记整理移动；分代理论与跨代引用）
5. CMS 流程与缺陷？→（初始/并发/重新标记/并发清除；三色标记 + 增量更新；并发失败）
6. G1 原理？→（Region + SATB + RSet + Mixed GC + MaxGCPauseMillis 可预测停顿）
7. ZGC 原理？→（染色指针 + 读屏障 + 并发整理；亚毫秒；不支持压缩指针）
8. 类加载与双亲委派？→（加载/连接/初始化；委派向上保安全；SPI/Tomcat 破坏）
9. OOM 怎么排查调参？→（日志/jstat/jmap/MAT/Arthas；-Xms/-Xmx/收集器参数）
10. GC 问题定位套路？→（现象→工具→GC 日志→dump→引用链→定位）
11. JDK 21/25 演进？→（分代 ZGC JEP439→474→490；JDK25 LTS；分代 Shenandoah JEP521；紧凑对象头 JEP519；虚拟线程）

**定级速判：**
- 答到第 2–4 问 → L2
- 答到第 5–7 问 → L3
- 答到第 8–10 问 + 有实战 → L4
- 答到第 11 问 + 体系化辨析 → L5

**一票否决信号：** 认为"引用计数能解决所有问题"、说不清 GC Roots 与可达性分析、断言"ZGC 停顿为零"或"JDK 默认 GC 是 ZGC"却无法辨析 → 无论年限，最高 L2。

<a id="qa-202"></a>

### B2 · 基础与语法核心

**递进主线（照着问）：**

1. == 和 equals 区别？→（基本类型比值、引用比地址；equals 默认也是 ==）
2. final / finally / finalize？→（修饰符 / 必执行块 / GC回调已废弃）
3. 异常体系？→（Error vs Exception、受检 vs 非受检、try-with-resources、异常链）
4. String 为什么不可变？→（final byte[]+coder、常量池/线程安全/hash缓存；SB vs SBF）
5. 常量池与 intern？→（池位置 JDK7 入堆；new String("ab") 最多两个对象）
6. 值传递还是引用传递？→（只有值传递；引用副本指向同一对象）
7. 重写 equals 为何必须重写 hashCode？→（契约；HashMap 先定位桶再 equals）
8. 泛型擦除与通配符？→（擦除到上界、桥接方法；extends 生产者 / super 消费者 / PECS）
9. 自动装箱与 Integer 缓存池？→（-128~127 valueOf 复用；127 与 128 的 == 差异）
10. JDK 代理 vs CGLIB？→（接口 vs 继承；final 方法无法代理致增强失效）
11. Java 8 新特性坑？→（Lambda effectively final/无自己 this、Stream 一次性/惰性、Optional orElse）
12. JDK 21–25 演进？→（Record16 / Sealed17 / 模式匹配switch21 / 虚拟线程21 / Valhalla 未定版）

**定级速判：**
- 答到第 1–3 问 → L1
- 答到第 4–6 问 → L2
- 答到第 7–9 问 → L3
- 答到第 10–11 问 + 有实战踩坑 → L4
- 答到第 12 问 + 版本准确 + 体系化权衡 → L5

**一票否决信号：** 认为"Java 是引用传递"却讲不清副本机制、认为"hashCode 相等就一定要 equals 相等"、说"String 底层是 final char[] 且 JDK9 后没变过"、把 Record/虚拟线程说成很早就有 → 无论年限，基础项最高 L2。

---

## 板块 C：集合框架（1 套）

<a id="qa-301"></a>

### C1 · 集合框架

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

## 板块 D：技术栈（6 套）

<a id="qa-401"></a>

### D1 · MySQL

**递进主线（照着问）：**

1. 一条 SQL 怎么执行？→（连接→解析→优化→执行→引擎；8.0 无查询缓存）
2. InnoDB vs MyISAM？→（事务/行锁/聚簇索引/crash-safe）
3. 为什么用 B+树？→（矮胖少 IO、叶子链表范围查；对比 B树/红黑树/哈希）
4. 聚簇/二级索引、回表、覆盖？→（叶子存整行 vs 存主键；覆盖免回表）
5. ACID 与四隔离级别？→（undo/redo/锁+MVCC；RC 不可重复读）
6. MVCC 怎么实现？→（undo 版本链 + ReadView；RC 每次生成、RR 首次生成）
7. 快照读 vs 当前读？→（SELECT vs FOR UPDATE；RR 当前读仍可能幻读）
8. 联合索引/最左前缀/ICP？→（从左有序不跳列；索引层先过滤减回表）
9. 锁与 next-key lock？→（S/X、意向锁、Gap+Record；锁范围防幻读）
10. explain 看什么？索引失效场景？→（type/key/rows/Extra；函数/隐式转换/%前缀）
11. 深分页与 count 优化？→（游标续查/延迟关联；计数表/Redis）
12. 死锁排查/大事务/主从延迟？→（innodb status/data_locks；固定顺序、拆大事务、并行复制）
13. MySQL 8.x 新特性？→（直方图、不可见索引、函数索引、Instant DDL）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–9 问 → L3
- 答到第 10–12 问 + 有实战案例 → L4
- 答到第 13 问 + 体系化选型权衡 → L5

**一票否决信号：** 认为"索引越多越好"、"MySQL 索引用 B 树/红黑树实现"、"MVCC 不需要 undo log"、"redo log 和 binlog 是同一个东西"、讲不清聚簇索引与回表的关系 → 无论年限，最高 L2。

<a id="qa-402"></a>

### D2 · Redis

**递进主线（照着问）：**
1. 是什么？五种结构？→（内存 KV；String/Hash/List/Set/ZSet）
2. 为何快？单线程为何不慢？→（内存 + 单线程命令执行 + IO 多路复用 + 高效编码）
3. 底层编码？→（SDS、listpack、quicklist、hashtable、skiplist；listpack 解决级联更新）
4. ZSet 为何跳表不用红黑树？→（范围查询、实现简单、rank + hashtable 互补）
5. 持久化？→（RDB 快、AOF 少丢、混合；fork + COW）
6. 过期删除与内存淘汰？→（惰性+定期；8 种策略，LRU/LFU）
7. 缓存三兄弟？→（穿透：布隆/空值；击穿：互斥锁/逻辑过期；雪崩：随机 TTL/多级缓存）
8. 分布式锁？→（SET NX EX + Lua 原子释放 + 看门狗 + Redisson）
9. 高可用？→（主从全量/增量、哨兵故障转移、Cluster 16384 槽、脑裂防治）
10. 双写一致性？→（先 DB 后删缓存 + 延迟双删 + binlog 补偿 + 过期兜底）
11. 大 key/热 key？→（拆分/本地缓存/多副本；SCAN 代 KEYS、UNLINK 代 DEL）
12. Pipeline/Multi/Lua？→（RTT vs 原子性 vs 服务端逻辑）
13. 6/7/8 演进？→（多线程 IO、Client Tracking、Functions、Multi-Part AOF、Vector Set Beta）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–9 问 → L3
- 答到第 10–12 问 + 有实战排障 → L4
- 答到第 13 问 + 体系化权衡与技术选型 → L5

**一票否决信号：** 认为"Redis 是多线程执行命令的"、说不清穿透/击穿/雪崩区别、认为"缓存与 DB 一定能强一致"、混淆过期删除与内存淘汰 → 无论年限，最高 L2。

<a id="qa-403"></a>

### D3 · Spring

**递进主线（照着问）：**

1. Spring 核心是什么？→（IOC + AOP；IOC 是思想、DI 是实现）
2. 注入方式？作用域？→（构造器推荐；singleton 默认、线程不安全）
3. BeanFactory vs FactoryBean？@Autowired vs @Resource？→（容器 vs 工厂 Bean；byType vs byName）
4. Bean 生命周期？→（实例化 → 属性填充 → Aware → BPP 前置 → 初始化 → BPP 后置(AOP) → 销毁）
5. 循环依赖怎么解决？→（三级缓存；singletonFactories 的 ObjectFactory 延迟生成代理）
6. 为什么三级不能二级？→（AOP 代理的对象一致性 + 代理唯一性）
7. AOP 通知与代理？→（五类通知；JDK 基于接口 / CGLIB 基于继承；Boot 默认 CGLIB）
8. 事务传播/隔离？→（7 种传播；REQUIRES_NEW vs NESTED；隔离交给数据库）
9. 事务失效场景？→（自调用/非 public/吞异常/受检异常/多线程/final/未托管…）
10. @Transactional 原理？→（AOP 环绕 + TransactionInterceptor + ThreadLocal 绑连接）
11. MVC 流程与九大组件？→（DispatcherServlet 中枢；HandlerMapping/Adapter/ViewResolver…）
12. 自动配置原理？→（@EnableAutoConfiguration + imports + @Conditional；用户配置优先）
13. Spring 6 / Boot 3–4 演进？→（Java 17 + Jakarta、AOT/原生镜像、虚拟线程、ProblemDetail）

**定级速判：**
- 答到第 2–4 问 → L2
- 答到第 5–9 问 → L3
- 答到第 10–12 问 + 有生产排障细节 → L4
- 答到第 13 问 + 体系化演进视野 → L5

**一票否决信号：** 认为"@Transactional 加在任何方法上都生效"、说不清 IOC 与 DI 关系、认为"singleton Bean 天然线程安全"、循环依赖只会说"Spring 自动解决"却讲不出三级缓存 → 无论年限，最高 L2。

<a id="qa-404"></a>

### D4 · 消息队列

**递进主线（照着问）：**

1. 为什么用 MQ？→（解耦/异步/削峰 + 可用性/一致性/复杂度三大代价）
2. 有哪些角色？Queue vs Topic？→（Producer/Broker/Consumer；消费者组组间广播、组内竞争）
3. 三大产品怎么选？→（Kafka 高吞吐流处理 / RabbitMQ 灵活路由 / RocketMQ 事务消息）
4. Kafka 核心架构？→（Topic/Partition/副本/ISR/offset/消费者组 + 顺序写/零拷贝/分区并行）
5. RabbitMQ Exchange 四种类型？→（direct 精确 / topic 通配 / fanout 广播 / headers）
6. RocketMQ 特色？→（事务消息 Half+回查、顺序消息、18 级延迟）
7. 消息如何不丢？→（生产端 confirm+acks / Broker 持久化+副本 / 消费端手动 ack）
8. 重复消费怎么办？→（唯一 ID+SETNX/唯一键/状态机 CAS 做幂等）
9. 如何保证顺序？→（同 key 同分区/队列 + 串行消费，局部有序）
10. 消息积压怎么处理？→（定位原因、扩分区再扩消费者、批量、降级转移）
11. 事务与最终一致？→（本地消息表 / 事务消息 / 最大努力通知）
12. 高可用与演进？→（ISR/Quorum Queue/Dledger；KRaft 去 ZK、分层存储）

**定级速判：**
- 答到第 1–3 问 → L1/L2
- 答到第 4–6 问 → L2
- 答到第 7–10 问（可靠性主线）→ L3
- 答到第 11 问 + 有生产排障/一致性实战 → L4
- 答到第 12 问 + 能做选型与体系化设计 → L5

**一票否决信号：** 认为"用了 MQ 就不用考虑一致性"、分不清"至少一次/幂等/恰好一次"、说不出消息丢失可能发生在哪个环节、认为"消费者越多消费越快（与分区数无关）" → 无论年限，最高 L2。

<a id="qa-405"></a>

### D5 · Elasticsearch

**递进主线（照着问）：**
1. ES 是什么？→（基于 Lucene 的分布式搜索与分析引擎，RESTful）
2. 典型场景 / 与 MySQL 区别？→（全文搜索 / 日志 ELK / 向量；倒排 vs B+ 树、相关度 vs 精确、非数据库替代品）
3. 核心概念？→（index/document/field、type 已废弃、主分片 / 副本、节点角色）
4. 倒排索引直觉？→（term → posting list；FST 前缀字典、skip list）
5. analyzer？→（character filter → tokenizer → token filter；索引与查询须一致）
6. 分词器差异？→（standard 中文逐字；IK max_word / smart）
7. NRT 机制？→（translog → buffer → refresh 成 segment → flush 落盘 → merge；refresh ≠ 持久化）
8. 分片路由？→（`hash(routing) % primary_shards`；主分片数建后不可改；quorum）
9. 相关性与列式存储？→（BM25 TF/IDF + 饱和 / 长度归一；doc_values vs fielddata）
10. mapping 设计？→（text vs keyword、multi-field、dynamic 坑、nested vs parent-child）
11. 查询 DSL？→（match 分词 vs term 精确、match_phrase、bool、filter 不打分可缓存）
12. 深分页？→（from+size 窗口限制、scroll 快照、search_after 游标 + tiebreaker）
13. 聚合？→（bucket / metric / pipeline、Terms 精度、cardinality 近似）
14. 调优与同步？→（boost / function_score / 同义词；双写 / binlog 订阅；分片副本估算）
15. 实战陷阱？→（分词选错、fielddata 报错、深分页 OOM、yellow/red、磁盘水位线、alias 零停机 reindex）
16. 新趋势？→（9.x / Lucene 10、向量与混合检索 DiskBBQ/ACORN/semantic_text、ES|QL、Columnar Mode 技术预览、PromQL GA）

**定级速判：**
- 答到第 2–6 问 → L2
- 答到第 7–11 问 + 能讲清原理与设计 → L3
- 答到第 12–15 问 + 有生产落地与故障处理 → L4
- 答到第 16 问 + 架构设计 / 选型 / 跟进 9.x 演进 → L5

**一票否决信号：** 认为"ES 是数据库替代品、能替代 MySQL 事务"、认为"text 字段可以直接聚合排序"、认为"主分片数可以随时改"、认为"refresh 就是立即持久化到磁盘"、认为"from+size 深分页没问题"、认为"term 查询会分词"、认为"副本只做备份不能提供查询"→ 无论年限，最高 L2。

<a id="qa-406"></a>

### D6 · Dubbo

**递进主线（照着问）：**
1. Dubbo 是什么？定位？→（高性能 Java RPC：通信+发现+治理+可观测）
2. 与 gRPC/Thrift 差异？→（Java 生态+内置治理 / HTTP2+Protobuf / 跨语言 IDL）
3. 四类角色 + 特有调用链？→（Proxy→Cluster→Directory→Router→LB→Invoker）
4. 接口级 vs 应用级发现？→（实例×接口 → 实例级；接口-应用映射 + 元数据自省；迁移三阶段）
5. Invoker 统一模型？→（`Result invoke(Invocation)`；一切皆 Invoker，可组合可包装）
6. URL 驱动？→（协议/地址/超时等拼成 URL 跨层传递；扩展点读参决策）
7. 暴露/引用链路？→（export：ProxyFactory→Invoker→Exporter→注册；refer：订阅→Directory→Cluster→Proxy）
8. Dubbo SPI？→（key=value 按需加载 + 缓存 + IoC/AOP + @Activate + @Adaptive 生成代理按 URL 选）
9. 协议与序列化？→（dubbo2 TCP+Hessian2 / Triple HTTP2 / REST；报文头 16B + Request ID 支撑异步）
10. Directory/Router/Cluster/LB 分工？→（有哪些 / 哪些可用 / 怎么容错 / 调哪一个）
11. Filter 链？→（invoke 前后织入；自定义 trace/鉴权/日志；order 影响断链）
12. 泛化调用？→（GenericService + 类型数组，无接口 jar；网关/测试平台）
13. 异步/回调/隐式参数/Mock？→（CompletableFuture+Request ID；RpcContext attachment；force/fail:return）
14. SPI 扩展实战？→（实现接口+注册文件+配置启用；文件名=接口全名）
15. 实战排障？→（重试幂等/粘滞、Hessian 不一致、异步丢上下文、线程池打满、缓存与推送）
16. 2026 新趋势？→（3.3.x/3.3.7、Triple X 南北东西合流、AOT、Loom、Affinity Router/方法级限流）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–10 问 + 能画调用链、讲 SPI 原理 → L3
- 答到第 11–15 问 + 能排障/写扩展 → L4
- 答到第 16 问 + 内核定制与选型视野 → L5

**一票否决信号：** 认为"Dubbo 只是注解配置、没什么原理"、"SPI 就是 JDK SPI 换个目录"、"@Adaptive 是编译时生成固定实现"、"Consumer 直接调 Provider 不经过 Invoker/Cluster"、"所有协议都适合大文件传输"、"注册中心挂了服务立刻不可调用" → 无论年限，最高 L2。

---

## 板块 E：计算机基础（3 套）

<a id="qa-501"></a>

### E1 · 计算机网络

**递进主线（照着问）：**
1. TCP/IP 如何分层？TCP vs UDP？→（OSI 七层/TCP/IP 四层；封装分用；可靠字节流 vs 无连接报文）
2. 三次握手？为何三次？→（双向确认+同步 ISN；防旧报文；SYN Flood/Cookie）
3. 四次挥手？TIME_WAIT 为何 2MSL？→（全双工分别关；ACK 可达+旧报文消散；CLOSE_WAIT 是应用 bug）
4. TCP 可靠传输与滑动窗口？→（seq/ack、超时+快重传、校验和；rwnd 约束，窗口=min(rwnd,cwnd)）
5. 拥塞控制四算法？→（慢开始指数、拥塞避免线性、快重传、快恢复；超时降 1、3ACK 减半）
6. 粘包拆包？→（字节流无边界；定长/分隔符/长度字段/Netty 解码器）
7. 网络层与 DNS/CDN？→（子网/CIDR、NAT、ARP、ICMP、路由、MTU/分片；递归+迭代、根/顶级域/权威、CNAME 边缘调度）
8. HTTP 版本演进与 HTTPS？→（长连接、多路复用、队头阻塞、HPACK/QPACK；幂等/状态码；非对称协商+对称传输、TLS1.2 vs 1.3、证书链、HSTS）
9. 会话与缓存？→（Cookie/Session/JWT；强/协商缓存 304；206 断点续传；WebSocket 101）
10. URL 到页面+排查+端口耗尽？→（DNS→TCP/TLS→HTTP→渲染；ping/ss/tcpdump；四元组与源端口）
11. 2026 新趋势？→（HTTP/3/QUIC、TLS1.3、后量子混合密钥、IPv6、BBR）
**定级速判：**
- 答到第 1–4 问 → L2
- 答到第 5–6 问 → L3
- 答到第 7–10 问 + 有线上实战 → L4
- 答到第 11 问 + 体系化演进判断 → L5

**一票否决信号：** 认为"三次握手两次也行""TIME_WAIT 是 bug 必须消灭""UDP 没用所以 HTTP/3 不可能基于 UDP""GET 和 POST 都不幂等""HTTPS 只用非对称加密传所有数据"——出现这类根本性概念错误，无论年限，最高 L2。

<a id="qa-502"></a>

### E2 · 操作系统

**递进主线（照着问）：**

1. 进程/线程/协程区别？PCB 是什么？→（资源/调度单位；PCB 是进程唯一标识）
2. 进程五态？僵尸 vs 孤儿？→（Z 占 PID 要 wait 回收；孤儿被 init 收养）
3. 上下文切换做了什么、为何开销大？→（保存恢复现场 + 换页表致 TLB 失效 + 态切换）
4. 调度算法有哪些、MFQ/CFS 为何胜出？→（兼顾长短作业与交互，无需预知运行时间）
5. 用户态/内核态、系统调用 vs 中断 vs 异常？→（syscall 主动陷入；中断异步、异常同步）
6. 分页/分段/段页式、页表与 TLB？→（页无外部碎片、段便于保护；TLB 加速转换）
7. 虚拟内存/请求分页/置换算法/抖动/碎片？→（LRU 近似最优；Clock 工程常用；抖动因页框太少）
8. 死锁四条件与预防/避免/检测恢复？→（破坏条件/银行家安全序列/资源图/剥夺回滚）
9. IPC 方式选型？→（共享内存最快但需同步；socket 可跨主机）
10. MESI/伪共享/内存屏障？→（四状态；64字节缓存行；`@Contended` 填充；volatile 靠屏障）
11. 同步异步/阻塞非阻塞、select/poll/epoll、LT/ET、零拷贝？→（epoll O(1)、ET 配非阻塞读到 EAGAIN；sendfile/mmap/DMA）
12. CPU 100% / load high / OOM Killer / inode 怎么查？→（进程→线程→栈；load 含 D 状态；dmesg；df -i）
13. 2026 演进？→（io_uring 异步批处理、eBPF 可观测、cgroup v2 统一层级、EEVDF 替 CFS、RISC-V）

**定级速判：**
- 答到第 1–5 问 → L2
- 答到第 6–11 问 + 能联系 Java → L3
- 答到第 12 问 + 真实排障细节 → L4
- 答到第 13 问 + 体系化权衡与选型 → L5

**一票否决信号：** 认为"协程由内核调度"、"select 是异步 I/O"、"epoll 默认边缘触发"、"被 OOM Killer 杀是 Java 抛 OutOfMemoryError"、"load 高就一定 CPU 忙" → 无论年限，最高 L2。

<a id="qa-503"></a>

### E3 · 设计模式

**递进主线（照着问）：**

1. 谈设计模式理解？→（23 种三类 + 设计原则 + 封装变化 + 框架落地）
2. 23 种如何分类？六大原则？→（创建/结构/行为；SOLID+迪米特+合成复用，开闭核心）
3. 单例有哪几种写法？→（饿汉/懒汉/DCL/静态内部类/枚举）
4. DCL 为何 volatile？反射/序列化如何破坏单例？→（防重排避免半初始化对象；setAccessible/readResolve；枚举最安全）
5. 简单/工厂方法/抽象工厂区别？→（一厂多品 → 一品一厂 → 一厂一族）
6. JDK 代理 vs CGLIB？→（接口/继承；Spring AOP 选择；Boot2 默认 CGLIB）
7. 装饰器/适配器/代理辨析？→（加功能/转接口/控访问，意图不同结构相似）
8. Spring 用了哪些模式？行为型如何区分？→（工厂/单例/代理/模板/观察者/适配器/策略/职责链；策略选一个、状态自己变）
9. if-else 如何重构？何时不该用模式？→（策略+Map/工厂/模板/责任链；YAGNI、三次法则）
10. 建造者 + @Builder？其余模式？→（分步构造不可变对象；观察者/命令/迭代器/访问者等意图）
11. 函数式/Sealed/云原生演进？→（Lambda 简化策略；Sealed+模式匹配简化访问者；架构级模式）

**定级速判：**
- 答到第 2–4 问 → L2
- 答到第 5–8 问 → L3
- 答到第 9–10 问 + 有真实重构/取舍 → L4
- 答到第 11 问 + 体系化归纳与版本事实准确 → L5

**一票否决信号：** 认为"设计模式越多越高级"、把装饰器/适配器/代理混为一谈且说不清意图差异、说不清 DCL 为何要 volatile、把 Record/Sealed/switch 模式匹配的正式版年份张冠李戴 → 无论年限，最高 L2。

---

## 板块 F：分布式（3 套）

<a id="qa-601"></a>

### F1 · 分布式事务

**递进主线（照着问）：**

1. 什么是分布式事务？为什么本地 ACID 不够？→（跨库/跨服务，单库 ACID 作用域有限）
2. CAP / BASE / PACELC？→（C/A 不可兼得；BASE 取最终一致；PACELC 补充延迟取舍）
3. 强一致 vs 最终一致怎么选？→（资金强一致；通知积分最终一致；分级拆解）
4. 2PC 流程与三大问题？→（Prepare/Commit；阻塞、单点、数据不一致）
5. 3PC 改进与缺陷？→（拆三段+超时；分区下默认提交仍可能不一致）
6. XA 与 2PC 关系？为何不裸用？→（规范 vs 算法；性能差、DB 支持有限）
7. TCC 三阶段 + 三大难题？→（Try/Confirm/Cancel；空回滚/幂等/悬挂靠状态表+状态机）
8. SAGA 原理与取舍？→（正向+补偿，长事务，无隔离）
9. Seata 三角色与 XID 流程？→（TC/TM/RM；开全局事务→XID传播→分支注册→决议）
10. 四种模式对比与混用？→（AT/TCC/SAGA/XA；AT 默认，可混用）
11. AT 内核：undo_log/全局锁/隔离级别？→（一阶段本地提交+留痕；全局锁防脏写；默认读未提交）
12. TC 高可用/存储/事务分组？→（集群+db/redis 共享存储；file 不能集群；vgroup 隔离）
13. 选型与分级一致性？→（核心强一致，非核心最终一致）
14. 2026 演进？→（Apache 孵化、2.x 统一 API/Saga 增强、GraalVM、国产库、Transaction Mesh）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–9 问 → L3
- 答到第 10–13 问 + 能讲三大难题/AT 内核 + 有实战 → L4
- 答到第 14 问 + 体系化选型与分级一致性 → L5

**一票否决信号：** 认为"Seata AT 是强一致且无任何问题"、"加了 @GlobalTransactional 就一定不会不一致"、"TCC 不需要处理幂等"、"2PC 不会有数据不一致"、"分布式事务有银弹方案" → 无论年限，最高 L2。

<a id="qa-602"></a>

### F2 · 服务治理

**递进主线（照着问）：**
1. 什么是 RPC？完整调用链？→（注册发现→动态代理→序列化→网络传输→反射调用）
2. RPC vs HTTP？gRPC/Thrift/Dubbo 对比？→（TCP 精简 vs HTTP 通用；HTTP2+Protobuf / Thrift 二进制 / Hessian2）
3. Dubbo 分层？Nacos 角色？→（10 层 + Invoker 核心；注册中心 + 配置中心）
4. 暴露/引用流程？→（export：代理→Invoker→Exporter→注册；refer：订阅→Directory/Router/LB→代理）
5. Dubbo 报文头？→（16B：魔数2+标志1+状态1+请求ID8+长度4+Body）
6. Nacos 注册中心？→（临时/持久实例、心跳、Distro AP / Raft CP、可切换；Nacos 是 AP+CP）
7. Nacos 配置中心？→（Namespace/Group/DataId、长轮询/gRPC 推送、热更新）
8. Nacos vs Eureka/Consul/ZK？→（Nacos AP+CP；Eureka AP；ZK/Consul CP）
9. Dubbo SPI？→（key=value、按需加载、IoC/AOP、@Activate/@Adaptive）
10. 负载均衡+容错？→（Random/RR/LeastActive/ConsistentHash；Failover/Failfast/Failsafe/Failback/Forking/Broadcast）
11. 雪崩与熔断降级限流？→（限流控入口、熔断切调用、降级给兜底；Sentinel/Hystrix/Resilience4j）
12. 实战排障？→（注册中心挂靠缓存禁重启、配置查定位与连接、超时辨真假、线程池打满扩容限流）
13. 灰度/压测/追踪？→（标签路由灰度、影子库压测、TraceId+SkyWalking）
14. 2026 新趋势？→（应用级发现、Triple 兼容 gRPC、Mesh/Proxyless、Serverless 治理下沉）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–11 问 → L3
- 答到第 12–13 问 + 有实战排障 → L4
- 答到第 14 问 + 体系化权衡与技术选型 → L5

**一票否决信号：** 认为"注册中心挂了整个系统立刻不能用"、把 Nacos 等同于"只能 AP 或只能 CP"、混淆熔断与降级、认为 Failover 可无脑用于写操作、说不清 SPI 与 JDK SPI 区别 → 无论年限，最高 L2。

<a id="qa-603"></a>

### F3 · 分布式 ID

**递进主线（照着问）：**

1. 为什么需要分布式 ID？有哪些要求？→（分库分表后自增失效；全局唯一+趋势递增+高可用）
2. 常见方案有哪些？→（UUID / DB 自增 / 多主 / 号段 / Redis / 雪花）
3. UUID 为什么不适合做聚簇主键？→（无序导致索引分裂、太长、无时间）
4. 号段模式原理与双 buffer？→（批量取段缓存本地；提前异步加载消毛刺）
5. 雪花 64 位结构？→（1 符号位 + 41 时间戳 + 10 机器位 + 12 序列号）
6. 是绝对递增吗？→（趋势递增，非全局单调）
7. 什么是时钟回拨？怎么处理？→（时间倒退致重复；等待/抛异常/借位/逻辑时钟）
8. workerId 怎么分配？冲突后果？→（ZK/DB/配置中心；重复则主键冲突）
9. Leaf 强依赖 ZK 吗？→（segment 不依赖；snowflake 弱依赖，本地缓存兜底）
10. 实战：取模路由/订单号/前端精度/容灾？→（低位取模、混淆防推测、Long 转 String、去单点）
11. 2026 新趋势？→（UUIDv7 / RFC 9562 时间有序、云原生免协调发号）

**定级速判：**
- 答到第 2–4 问 → L2
- 答到第 5–8 问 → L3
- 答到第 9–10 问 + 能结合实战 → L4
- 答到第 11 问 + 体系化权衡 → L5

**一票否决信号：** 认为"雪花算法绝对全局有序"、"Leaf 强依赖 ZK"、"有了数据库自增就不需要分布式 ID"、说不清时钟回拨为何危险 → 无论年限，最高 L2。

---

## 板块 G：实战深水区（6 套）⭐ 经验区分器

<a id="qa-701"></a>

### G1 · Redis 进阶实战

**递进主线（照着问）：**
1. 生产实战核心？→（可观测 → 稳定 → 正确 → 性能 → 架构）
2. 典型误用？→（当 DB、KEYS、大 Key、无 TTL、SETNX+EXPIRE、淘汰误删）
3. 监控指标？→（P99 延迟、slowlog、INFO memory/clients/stats）
4. lazyfree？→（UNLINK / ASYNC + 后台释放，避免阻塞）
5. 碎片率？→（rss/used；>1.5 碎片、<1 swap 更危险；activedefrag）
6. RESP3？→（push / 客户端缓存基础，HELLO 3，兼容坑）
7. 变慢排查？→（slowlog → latency doctor → bigkeys → fork/AOF → 网络）
8. 内存 OOM？→（used/rss、缓冲区、maxmemory、COW 余量）
9. 一致性进阶？→（脏窗口、延迟双删、Canal+MQ、最终一致）
10. 大 Key？→（阈值、--bigkeys/MEMORY USAGE/RDB、UNLINK、拆分）
11. 热 Key？→（MONITOR 慎用、--hotkeys、本地缓存、打散、云方案）
12. 分布式锁？→（Redlock 争议、看门狗、Hash 可重入、等待 / 死锁）
13. 案例？→（击穿打挂 DB、Pipeline/Lua 坑、误删恢复）
14. 8.0 / 趋势？→（AGPLv3、Vector Set Beta、client tracking、IO 多线程、AI）

**定级速判：**
- 答到第 2–6 问 → L2
- 答到第 7–9 问 → L3
- 答到第 10–13 问 + 有实战复盘 → L4
- 答到第 14 问 + 体系化取舍 → L5

**一票否决信号：** 认为"UNLINK 和 DEL 一样"、说不清 mem_fragmentation_ratio >1 与 <1 区别、认为"延迟双删能保证强一致"、认为"Lua 写脚本超时可 SCRIPT KILL"、混淆 Redis 锁与 etcd 锁一致性 → 无论年限，最高 L2。

<a id="qa-702"></a>

### G2 · JVM 调优案例集

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

<a id="qa-703"></a>

### G3 · SQL 优化案例集

**递进主线（照着问）：**

1. 拿到慢 SQL 怎么优化？→（定位 Top SQL → EXPLAIN → 诊断 → 改写 / 索引 → 验证基线）
2. 什么时候不该优化？→（收益小 / 瓶颈在锁或下游 / 过度改写；顺序：业务 → SQL → 索引 → 表结构 → 缓存）
3. EXPLAIN 看什么？type 排序？→（type / key / key_len / rows / Extra；system>const>eq_ref>ref>range>index>ALL）
4. key_len 怎么算？rows 准吗？→（列字节 + 变长 2 + NULL 1；rows 是估算，ANALYZE 给真实值）
5. Extra 各值？→（Using index / filesort / temporary / join buffer / Backward index scan）
6. EXPLAIN ANALYZE 与慢日志分析？→（真实执行；pt-query-digest 按总耗时找 Top SQL）
7. 优化器为何选错索引？→（成本模型 / 统计过期 / 倾斜；ANALYZE / 直方图 / FORCE INDEX）
8. 索引失效场景？→（隐式转换 / 函数 / LIKE %前缀 / OR / 范围后列 / 最左前缀 / 字符集 / 计算）
9. 联合索引顺序与覆盖 / 前缀索引？→（等值左范围右、高频优先；覆盖免回表；前缀省空间）
10. 深分页怎么改？→（游标续查 / 延迟关联；LIMIT 未必减少扫描）
11. ORDER BY / GROUP BY 怎么优化？→（索引消除 filesort / temporary；松散索引扫描）
12. JOIN / IN EXISTS / 子查询 / OR？→（小表驱动大表 + 被驱动表索引；按 EXPLAIN 实测选）
13. COUNT(*) 优化？→（计数表 / Redis；引擎差异；TABLE_ROWS 是估算）
14. CPU 100% 排查？锁等待识别？→（pt-query-digest + EXPLAIN；PROCESSLIST State=Waiting for lock）
15. 表结构 / DDL？→（字段类型 / 大字段拆表 / 分区裁剪 / Online DDL INSTANT）
16. 8.x 新特性服务优化？→（降序 / 函数 / 不可见索引、直方图、Instant DDL、并行查询、窗口函数）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–9 问 → L3
- 答到第 10–14 问 + 有实战案例 → L4
- 答到第 15–16 问 + 体系化权衡 → L5

**一票否决信号：** 认为"LIMIT 一定减少扫描"、"索引越多越好"、"EXPLAIN 的 rows 是真实值"、"count 各引擎一样"、"优化就是加索引"，或讲不出一条真实慢 SQL 的验证过程 → 无论年限，最高 L2。

<a id="qa-704"></a>

### G4 · DDD 领域建模

**递进主线（照着问）：**

1. DDD 解决什么？何时不用？→（复杂业务；CRUD 不用）
2. 统一语言？→（领域专家与开发同一套词，BC 内成立）
3. 战略 vs 战术？→（战略：UL/BC/上下文映射；战术：实体/值对象/聚合/服务/仓储/事件）
4. 实体 vs 值对象？→（身份 vs 属性；不可变、按值相等）
5. 聚合与聚合根？→（一致性/事务边界、不变量、小聚合、按 ID 引用）
6. 领域事件与事务？→（同事务落库 + outbox + 幂等 → 最终一致）
7. 服务三分与仓储工厂？→（领域/应用/基础设施；仓储以聚合为单位）
8. 限界上下文？→（语义+团队边界，战略核心）
9. 上下文映射？→（合作/共享内核/客户供应商/ACL/OHS+PL/另谋他路）
10. 康威与微服务？→（边界指导拆分；BC≠微服务，逻辑 vs 部署边界）
11. 充血 vs 贫血？→（行为与数据内聚，守护不变量）
12. 现场建模？→（事件风暴 → BC → 聚合决策表 → 值对象 → 最终一致）
13. 2026 趋势？→（DDD+微服务/EDA，CQRS/ES+Kafka，AI 辅助探索）

**定级速判：**
- 答到第 4–6 问 → L2
- 答到第 7–11 问 → L3
- 答到第 12 问、能现场建模 → L4
- 答到第 13 问 + 体系化归纳取舍 → L5

**一票否决信号：** 把 DDD 等同于分层架构或 JPA 注解、认为"所有系统都该上 DDD"、把聚合当数据表随便拆、领域模型全是 setter 还声称做了 DDD → 无论年限，最高 L2。

<a id="qa-705"></a>

### G5 · ES 调优案例集

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

<a id="qa-706"></a>

### G6 · Dubbo 调优案例集

**排障主线（照着问）：**
1. 看现象 →（超时/报错/性能/注册异常；报错类型、P99、QPS、重试次数）
2. 看手段 →（日志、`telnet 22222` 的 ls/count/invoke/trace、Dubbo Admin、AccessLog/慢调用、Micrometer/Actuator）
3. 定位层级 →（路由/集群重试/协议长连接/业务线程池/序列化/注册中心元数据）
4. 验证根因 →（trace+AccessLog 对比耗时、jstack dump、GC 日志、灰度复现、区分真假超时）
5. 修复预防 →（扩容/限流/隔离/幂等/切协议 + 前后量化 + 告警基线，可回滚）

**四类问题 ↔ 典型层级/命令：**
- 调用失败/超时 →（Cluster Failover/Failfast、retries、timeout；`trace`/`count`/重试率）
- 性能瓶颈 →（业务线程池 `AbortPolicyWithReport` dump、序列化、长连接队头阻塞；`status -l`/jstack/响应体大小）
- 注册发现异常 →（地址推送、本地缓存 `~/.dubbo`、服务自省元数据；`ls`/Admin/缓存文件）
- 扩展与兼容 →（SPI、泛化、Hessian2/Protobuf、version/group；`invoke` 直连验证/契约测试）

**定级速判：**
- 答到第 1–2 段 + 知道看日志/qos → L2
- 答到第 3 段 + 能按层次排查三类问题 → L3
- 能完整讲 Part 4 案例 + 给出命令与量化结果 → L4
- 有容量规划/内核定制 + 跟进 Triple X/AOT/Loom 演进 → L5

**一票否决信号：** 认为"超时就调大 retries"、"线程池打满就加线程数不问根因"、"注册中心挂了服务立刻不可用"、"重试不用管幂等"、"泛化调用报序列化错就加超时"，或讲不出一次真实排查与验证过程 → 无论年限，最高 L2。

---

## 板块 H：前端与全栈（6 套）

<a id="qa-801"></a>

### H1 · TypeScript

**递进主线（照着问）：**
1. TS 是什么？→（JS 超集，编译期静态类型，编译后擦除为纯 JS）
2. 结构化 vs 名义？→（看结构/成员，鸭子类型；名义手段：`#`、`unique symbol`、brand）
3. 类型是什么？编译期 vs 运行时？→（值的集合/约束；边界需运行时校验）
4. any/unknown/never/void？→（unknown 是安全版 any，须先收窄；never 穷尽/排除）
5. 拓宽与收窄？→（`as const` 锁字面量；typeof/instanceof/真值/可辨识联合收窄）
6. 泛型本质？→（类型参数化，保留关联；`extends` 约束、默认值、`keyof` 约束）
7. 工具类型怎么实现？→（keyof + 映射 + 条件 + infer 四件套）
8. 条件类型/分发/infer？→（`T extends U?X:Y`；裸参数分发，`[T]` 关闭；infer 解构）
9. 手写 `UnionToIntersection`？→（函数参数逆变位置 infer 得交叉）
10. interface vs type？→（声明合并；对象 vs 任意类型）
11. tsconfig / .d.ts / enum？→（strict 家族、noEmit/declaration；const enum 陷阱与 as const 替代）
12. 类型体操的度？→（公共 API 才值得；边界用 unknown；复杂类型拖慢编译）
13. 新趋势？→（satisfies 校验不拓宽、const 参数、NoInfer、Go 编译器提速约 10 倍目标/预览阶段）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–8 问 + 能手写工具类型 → L3
- 答到第 9–12 问 + 能写复杂类型、懂取舍 → L4
- 答到第 13 问 + 团队级规范/选型视野 → L5

**一票否决信号：** 认为"TS 会在运行时做类型检查"、"类型注解会被编译进 JS"、"any 和 unknown 差不多"、说不清结构化类型、认为"类型体操越多越专业"→ 无论年限，最高 L2。

<a id="qa-802"></a>

### H2 · React

**递进主线（照着问）：**

1. 谈谈对 React 的理解？→（UI=f(state)、声明式、组件化、单向数据流、虚拟 DOM、Fiber、Hooks）
2. UI=f(state) 意味着什么？→（状态驱动渲染、render 要纯、副作用放 effect）
3. JSX 本质？→（createElement/jsx-runtime 语法糖，产出 React 元素对象）
4. 虚拟 DOM 必需吗？→（非必需；React 运行时 diff vs Vue 编译优化/Svelte 无虚拟 DOM）
5. 为什么需要 Fiber？→（Stack 不可中断；Fiber 链表可中断；节点结构）
6. 双缓冲 + render/commit？→（current/WIP 切换；render 可中断打 flags，commit 同步改 DOM）
7. 时间切片 + Lane？→（Scheduler/MessageChannel；二进制位表优先级；startTransition）
8. 合成事件？→（SyntheticEvent、委托到 root、17 从 document 改 root、无事件池）
9. Hooks 为何不能条件调用？→（memoizedState 链表靠顺序对应）
10. 多次 setState / 函数式更新？→（异步批处理，React18 全场景批处理）
11. diff + key？→（同层比较、type 不同重建、key 稳身份、别用 index）
12. useEffect 依赖/清理 + LayoutEffect？→（异步 vs 同步绘制前；StrictMode 双调用）
13. stale closure / 受控非受控 / Context 坑 / 重渲染优化？→（Part 4 案例）
14. React 19 / Compiler / 并发演进？→（Actions、RSC、自动 memo、可中断+优先级）

**定级速判：**
- 答到第 2–4 问 → L2
- 答到第 5–12 问 → L3
- 答到第 13 问 + 能讲真实排查案例 → L4
- 答到第 14 问 + 体系化选型权衡 → L5

**一票否决信号：** 认为"虚拟 DOM 一定比直接操作 DOM 快"、说不清 state 如何驱动渲染、认为"Hooks 可随便放进 if"、认为"key 用 index 无所谓"、编造 React 19 不存在的 API 或错误版本日期 → 无论年限，最高 L2。

<a id="qa-803"></a>

### H3 · Vue 3

**递进主线（照着问）：**

1. Vue 3 相比 Vue 2 改了什么？→（Proxy、Composition API、编译优化、Tree-shaking、TS）
2. 为何用 Proxy 替代 defineProperty？→（数组/动态属性/嵌套性能；懒代理）
3. reactive vs ref？→（Proxy 代理对象 / .value 包装基本类型；模板自动解包）
4. 响应式链路？→（get→track、set→trigger；WeakMap<target,Map<key,Set<effect>>>）
5. Reflect 的作用？→（receiver 保证 this 指向代理，避免依赖收集错误）
6. computed 为何缓存？→（lazy effect + dirty 标记，依赖不变不重算）
7. watch vs watchEffect？→（显式源/懒/有旧值 vs 自动/立即/无旧值；flush）
8. 响应式丢失怎么防？→（解构丢 Proxy 拦截；toRefs/toRef、响应性 props 解构）
9. diff 优化？→（双端指针 + LIS + PatchFlag + 静态提升；key 用于身份复用）
10. 模板编译？→（parse→transform→generate；template→AST→render function）
11. setup 生命周期？→（beforeCreate 前、无 this；组合式钩子先于选项式）
12. Pinia vs Vuex？→（去掉 mutations、actions 统一改 state、TS 友好）
13. 路由与守卫？→（hash vs history；beforeEach→beforeEnter→beforeRouteEnter）
14. 新趋势？→（3.5 重构、useTemplateRef、Vapor 渐进可用、Vite 快在 ESM/esbuild/HMR）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–8 问 → L3
- 答到第 9–13 问 + 能讲真实踩坑 → L4
- 答到第 14 问 + 体系化选型权衡 → L5

**一票否决信号：** 认为"用了 Proxy 就不会有响应式丢失"、"ref 和 reactive 完全等价"、"computed 每次读取都重算"、"setup 里能用 this"、"Vapor Mode 已全面取代虚拟 DOM"、"history 模式刷新一定不 404" → 无论年限，最高 L2。

<a id="qa-804"></a>

### H4 · 浏览器原理

**递进主线（照着问）：**

1. 浏览器有哪些进程/线程？站点隔离解决什么？→（多进程隔离；防侧信道）
2. 从 URL 到像素的流水线？→（DOM/CSSOM→Render Tree→Layout→Paint→Composite）
3. 重排 vs 重绘？强制同步布局？→（几何变=重排，外观变=重绘；读写分离）
4. 为何 transform/opacity 不重排？层爆炸？→（合成层只改变换；过度提升反噬）
5. 事件循环一轮流程？微任务为何本轮清空？→（宏→微→渲染；语义连续）
6. Promise.then vs setTimeout？rAF 时机？async/await？Node 差异？→（微先宏后；rAF 渲染前；await=微任务；nextTick 优先）
7. V8 如何执行？隐藏类/内联缓存？GC 分代？→（解释+JIT；稳定形状；新生代/老生代）
8. 常见内存泄漏与排查？→（闭包/定时器/监听/游离 DOM；Heap Snapshot 对比）
9. 强/协商缓存？缓存位置？F5/Ctrl+F5？→（Cache-Control/ETag；SW>Memory>Disk>Push）
10. Core Web Vitals 三项与达标线？INP 为何取代 FID？→（LCP 2.5s/INP 200ms/CLS 0.1）
11. 长任务如何排查拆解？→（火焰图/PerformanceObserver；yield/Worker）
12. XSS/CSRF/CSP/CORS/点击劫持？→（编码转义/Token/白名单/受控放宽/frame-ancestors）
13. 2026 新趋势？→（INP 上位；View Transitions；Speculation Rules 预渲染）

**定级速判：**
- 答到第 2–4 问 → L2
- 答到第 5–9 问 → L3
- 答到第 10–12 问 + 有真实调优/排障经历 → L4
- 答到第 13 问 + 体系化权衡 → L5

**一票否决信号：** 认为"重绘一定重排"、"setTimeout 比 Promise.then 先执行"、"强缓存会发请求问服务器"、"GPU 加速一定更快"、"INP 就是 FID 的别名"、"CORS 是为了防 XSS" → 无论年限，最高 L2。

<a id="qa-805"></a>

### H5 · 前端工程化

**递进主线（照着问）：**

1. 什么是前端工程化？→（模块化/构建/包管理/转译/产物性能）
2. CJS vs ESM？→（运行时 vs 编译期、值拷贝 vs 实时绑定）
3. ESM 为何是趋势 / Tree Shaking 前提？→（静态分析、sideEffects、main/module/exports）
4. Webpack 流程 + loader/plugin？→（依赖图、loader 转换单文件、plugin 监听 Tapable 钩子）
5. Vite 为什么快？→（原生 ESM 免打包、esbuild 预构建、精准 HMR、prod 用 Rollup）
6. pnpm 为何省磁盘 / 幽灵依赖？→（硬链接+符号链接+content-addressable store、严格隔离）
7. Babel 原理 / SWC 提速？→（parse→transform→generate、preset/plugin、core-js；Rust/Go）
8. code splitting / contenthash / source map？→（懒加载、内容指纹长缓存、source map 泄露风险）
9. 首屏大 / 构建慢怎么排查？→（先量化、按需加载、换原生工具、缓存）
10. 依赖冲突 / 缓存失效 / 迁移 Vite 坑？→（overrides、contenthash、环境变量/插件替代）
11. 2026 新趋势？→（Rust 工具链、Rolldown 逐步集成、Lightning CSS、bundleless 共存）

**定级速判：**
- 答到第 2–4 问 → L2
- 答到第 5–7 问 + 能讲原理 → L3
- 答到第 8–10 问 + 有实战复盘 → L4
- 答到第 11 问 + 体系化演进判断 → L5

**一票否决信号：** 认为"Vite 完全没有打包、生产也不用构建"、说不清 CJS 与 ESM 的加载时机差异、认为"pnpm 只是装得快"、把"计划中的 Rolldown 默认集成"说成"Vite 7 已默认" → 无论年限，最高 L2。

<a id="qa-806"></a>

### H6 · Node.js 与 SSR

**递进主线（照着问）：**

1. Node 是什么？→（V8 + libuv，事件驱动非阻塞 I/O，I/O 密集而非 CPU 密集，单线程指 JS 主线程）
2. CSR/SSR/SSG/ISR 区别？→（渲染时机、首屏/SEO、服务器成本三角取舍）
3. 事件循环 6 阶段？→（timers/pending/idle-prepare/poll/check/close，poll 是核心）
4. microtask / nextTick / setTimeout / setImmediate 顺序？→（nextTick > microtask；阶段间清空；I/O 内 setImmediate 先）
5. require 缓存与解析？ESM 差异？→（同步+缓存+单例；live binding；__dirname vs import.meta）
6. Stream 与背压？→（四种流；write 返回 false + drain；分块省内存）
7. AsyncLocalStorage 与上下文传播？→（跨异步链；≈ScopedValue>ThreadLocal；防全局串请求）
8. SSR 同构与水合？mismatch？→（同份代码两端跑；hydrate 复用 DOM；确定性+useEffect）
9. Node 中间层/BFF 价值？SSR 代价？→（聚合/鉴权/直出；服务器压力+复杂度）
10. 中间件模型？→（Express 线性 next；Koa 洋葱 await next；NestJS 模块化+DI）
11. 优雅关闭/多进程/排障？→（SIGTERM 收尾；cluster 多核；CPU profile+堆快照对比）
12. 2026 新趋势？→（RSC 与 SSR 互补；App Router/Nuxt 4；Edge SSR 受限；原生 TS 类型剥离）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–9 问 → L3
- 答到第 10–11 问 + 有实战排障细节 → L4
- 答到第 12 问 + 体系化选型权衡 → L5

**一票否决信号：** 认为"Node 是多线程并行执行 JS"、"setTimeout(0) 一定先于 setImmediate"、"水合就是客户端重新渲染整棵 DOM"、"Stream 一次把整个文件读入内存"、"require 每次都重新加载模块"、"SSR 一定比 CSR 快" → 无论年限，最高 L2。

---

## 板块 I：AI Agent 开发（8 套）⭐ 2026 增量

<a id="qa-901"></a>

### I1 · LLM 基础与提示工程

**递进主线（照着问）：**
1. LLM 是什么？→（Transformer 自回归概率模型，逐 token 采样，输出是概率分布）
2. 提示工程是什么、为何需要？→（不改权重，组织输入引导输出分布；权重冻结才有空间）
3. token 与分词？→（BPE 子词，非字符/单词；计费/上下文/KV Cache 都按 token；strawberries 数 r 会错）
4. messages 角色与 chat 模板？→（system/user/assistant/tool；模板错则模型读不懂结构）
5. 采样参数？→（temperature 缩放 softmax logits，top_p 按累计概率、top_k 按数量，max_tokens/seed）
6. 训练并行 vs 生成串行？→（因果掩码屏蔽未来 + 真值已知可并行；自回归无未来真值只能逐步）
7. 上下文窗口本质？→（位置编码范围 + KV Cache 显存 + O(n²) 计算；lost in the middle）
8. system 优先级为何建议性？→（同一 token 序列、无硬边界；对齐来自 SFT/RLHF，是倾向非保证）
9. 提示范式差异？→（Zero/Few-shot、CoT、ReAct：往上下文放示例/推理/行动闭环）
10. 结构化输出？→（JSON mode 只保合法；schema + constrained decoding 在解码层屏蔽非法 token 才可靠）
11. Prompt 成本与换模型失效？→（token 计价 + 缓存；prompt 与模型版本隐式耦合，换模型要重评）
12. 提示注入？→（外部不可信内容冒充指令；无硬边界，需多层防护）
13. 实战陷阱？→（示例顺序偏见、扮演专家的局限、温度设错事故、版本管理/降级重试）
14. 新趋势？→（长上下文 + context engineering、推理模型不需手写 CoT、缓存、多模态、结构化输出标配——以官方为准）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–10 问 + 能讲清原理与结构化输出方案 → L3
- 答到第 11–13 问 + 有成本/稳定性/评测实战 → L4
- 答到第 14 问 + 团队级规范与选型视野 → L5

**一票否决信号：** 把 token 等同于字符、认为 system prompt 是绝对安全边界、认为 temperature=0 就"完全确定/无随机"、认为结构化输出就是"让模型注意输出 JSON"、把"换模型不用改 prompt"当常识 → 无论年限，最高 L2。

<a id="qa-902"></a>

### I2 · Agent 架构与推理模式

**递进主线（照着问）：**
1. Agent 是什么？→（LLM 大脑+工具手脚+循环神经+记忆经验；自主规划多步达成目标）
2. 与 workflow/chatbot/RPA 区别？→（workflow 人定路径，Agent 机器找路径；光谱非对立）
3. 四要素？→（规划、工具、记忆、执行循环；循环是神经中枢、最易被忽略）
4. Function Calling？→（输出结构化调用意图，宿主执行并回填；模型不执行代码）
5. 幻觉式工具调用？→（参数/工具/能力幻觉；语言生成与精确调用的鸿沟）
6. ReAct？→（Thought/Action/Observation 交替，边想边做；思维痕迹非忠实审计）
7. Agent Loop 控制流？→（接收→规划→选工具→执行→观察→判断→终止；终点+护栏）
8. 终止/预算/工具选择？→（硬上限+停滞检测；工具选择是 prompt 工程）
9. 规划与 Plan-and-Execute vs ReAct？→（灵活性换成本 vs 效率换刚性；可 replan）
10. Reflection？→（生成—评估—改进；客观校验器优先，评估器需解耦）
11. 记忆分层？→（短期=上下文=工作记忆；长期=向量库=情景/语义；写入/检索/整合）
12. 推理范式差异？→（行动编排 vs 质量改进 vs 知识注入；可叠加非互斥）
13. Agentic Workflow 模式？→（chaining/routing/parallel/orchestrator-workers/evaluator-optimizer；简单优先）
14. 可靠性？→（schema/校验/错误回填；参数幻觉；上下文膨胀；反思放大错误；eval 量化）
15. 新趋势？→（推理模型大脑、context engineering、Agentic RAG、CUA、长时 checkpoint；保守表述）

**定级速判：**
- 答到第 2–6 问 → L2
- 答到第 7–11 问 + 能讲清控制流与范式取舍 → L3
- 答到第 12–14 问 + 有落地案例、能排查可靠性问题 → L4
- 答到第 15 问 + 团队级架构选型与演进视野 → L5

**一票否决信号：** 认为"Agent 就是 while 循环调 LLM、没什么技术含量"、"给足工具就一定比工作流好"、"Function Calling 等于模型真的在执行代码"、"记忆就是全塞进 prompt"、说不清循环控制流与终止条件 → 无论年限，最高 L2。

<a id="qa-903"></a>

### I3 · MCP 协议

**递进主线（照着问）：**
1. MCP 是什么？→（Anthropic 主导开放协议，AI 应用的 USB-C，M×N→M+N）
2. 三个角色？→（host 应用/client 连接端/server 能力方；一个 host 多 client 多 server）
3. 三大原语？→（tools 模型可控执行 / resources 应用可控读取 / prompts 用户可选）
4. 连接生命周期？→（initialize 能力协商 → 操作 → 关闭；JSON-RPC request/response/notification）
5. 消息格式？→（JSON-RPC 2.0；tools/list 发现、tools/call 调用；工具错误放 `result.isError`）
6. 两种传输？→（stdio 本地子进程/换行分隔/stdout 只写协议、日志走 stderr；Streamable HTTP 单 endpoint/POST+GET/JSON 或 SSE，取代 HTTP+SSE）
7. sampling/elicitation？→（server→client 反向请求；借 client 模型和 token、向用户要信息）
8. 三者取舍？→（模型动手 tool / 应用喂数据 resource / 用户点单 prompt）
9. 传输选型与安全？→（本地 stdio 环境变量；远程 HTTP 防 DNS rebinding、Origin 校验、OAuth 2.1）
10. MCP vs Function Calling？→（标准化发现/调用传输层，非模型侧工具调用本身）
11. 配置/描述/数量坑？→（绝对路径与 PATH、stdout 污染；描述差选错工具、工具多膨胀上下文）
12. 提示注入与权限、新趋势？→（server 数据不可信、最小权限、人类审批、token 隔离、Inspector 调试；2025-06-18 / 2025-11-25：tasks、URL mode elicitation、toolChoice、JSON Schema 2020-12；OAuth 2.1；MCP=agent↔工具、ACP=编辑器↔agent、A2A=agent↔agent）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–9 问 + 能讲清协商/传输/二者关系 → L3
- 答到第 10–11 问 + 写过 server、处理过安全/注入/调试 → L4
- 答到第 12 问（含新趋势）+ 跟进协议演进、能做生态选型 → L5

**一票否决信号：** 认为"MCP 是一个具体的 AI 模型"、"tools 和 resources 都是给模型随便调用的"、"stdio 传输需要走 OAuth"、"把 MCP 和 Function Calling 完全等同"、认为"server 返回数据天然可信"→ 无论年限，最高 L2。

<a id="qa-904"></a>

### I4 · RAG 检索增强

**递进主线（照着问）：**
1. RAG 是什么？→（检索+生成组合，缓解幻觉/知识截止/私域/可溯源）
2. 基本流程？→（索引：加载→切分→向量化→入库；查询：检索→重排→拼 prompt→生成）
3. vs 微调 vs 长上下文？→（RAG 注知识可溯源，微调改行为，长上下文少量短文档）
4. 切分策略？→（固定+重叠/语义结构/递归；size 权衡，保上下文完整）
5. Embedding 与相似度？→（文本→语义向量，余弦比方向；语义相似≠答案相关）
6. 向量检索？→（ANN：HNSW/IVF 换速度，Top-K，recall/延迟/内存权衡）
7. 混合检索？→（BM25 字面 + 向量语义，RRF 融合，互补）
8. rerank？→（cross-encoder 交互精排，比双塔准，用于 top-K 二次排序）
9. Query 侧技巧？→（改写/多路召回/HyDE 提召回，多跳需迭代/图谱）
10. 元数据与权限？→（过滤提精度，权限检索前置防越权）
11. 上下文构造？→（Lost in the Middle，少而精，首尾放重点）
12. 评估？→（检索 recall@K/MRR/NDCG；生成 faithfulness/答案相关性/上下文相关性；分环节）
13. Agentic RAG？→（Agent 决策何时/如何检索，多跳，代价是延迟成本）
14. 失效诊断？→（打印召回看是检索还是生成问题，逐段排查，调参靠评估集）
15. 更新与安全？→（增量索引/删除/模型升级重建；复杂文档解析；提示注入防御）
16. 新趋势？→（长上下文未取代 RAG、GraphRAG 全局问答、Agentic RAG、多模态、context engineering）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–9 问 + 能讲清混合检索/rerank → L3
- 答到第 10–15 问 + 懂评估/失效诊断/取舍 → L4
- 答到第 16 问 + 架构选型/评测与权限体系视野 → L5

**一票否决信号：** 认为"RAG 能彻底消除幻觉"、"向量库越大越好/切分越小越好"、"语义相似就等于答案正确"、"RAG 和微调是同一件事"、"接个向量库就完事"→ 无论年限，最高 L2。

<a id="qa-905"></a>

### I5 · AI 编码 Agent 与 IDE

**递进主线（照着问）：**
1. 编码 Agent 是什么？→（能读代码/改文件/跑命令/调工具的执行者；区别于补全与 Chat）
2. 能做什么、为何需要标准协议？→（多文件/跨工具编排；N×M→N+M，LSP 类比）
3. 规则文件与权限弹窗？→（AGENTS.md/CLAUDE.md 注入约定；人在回路）
4. ACP 是什么？→（Zed 主导，编辑器 client↔Agent server，JSON-RPC over stdio，能力协商+会话生命周期）
5. ACP 与 MCP 分层？→（ACP 管编辑器↔Agent，MCP 管 Agent↔工具，互补；MCP 配置由编辑器转发、工具调用直连）
6. 权限模型本质？→（allow/deny/ask 三态 + 白名单 + 工具级粒度，最小权限+人在回路）
7. 上下文如何注入？→（工作区文件/选中代码/@提及/规则文件层级；context rot）
8. 为何频繁弹窗、如何优化？→（按风险分级，只读 allow、写受限、删除/网络 ask，plan mode）
9. client 中介文件系统？→（未保存 buffer 可读、写入以 diff 待审批、可撤销）
10. stdio 实现要点？→（stdout 只写合法消息、日志走 stderr、行缓冲解析、流式 chunk 增量渲染）
11. 上下文工程怎么评估？→（相关性筛选/层级/窗口治理/工具结果管理/可观测性）
12. 实战案例？→（弹窗疲劳、误删兜底、上下文腐化+参数幻觉、间接提示注入、MCP 起不来/GUI PATH）
13. 新趋势？→（ACP Registry、Zed 1.0、40+ Agent、稳定 v1/v2 draft、AGENTS.md 开放化）

**定级速判：**
- 答到第 2–3 问 → L2
- 答到第 4–7 问 + 讲清 ACP 模型与权限三态 → L3
- 答到第 8–12 问 + 有真实案例与取舍 → L4
- 答到第 13 问 + 规范体系/协议选型视野 → L5

**一票否决信号：** 认为"ACP 是要取代 MCP 的"、"给 Agent 最高权限最省事"、"把权限弹窗全关掉没风险"、"规则文件里的指令绝对可信"、说不清 ACP 与 MCP 谁管谁 → 无论年限，最高 L2。

<a id="qa-906"></a>

### I6 · Agent 框架与编排

**递进主线（照着问）：**
1. 为什么需要框架？→（统一抽象、可观测、状态管理、工具生态；手写循环难工程化）
2. 主流框架定位？→（LangChain 组件、LangGraph 图/状态机、LlamaIndex RAG、AutoGen/CrewAI 多 Agent、Dify 低代码、OpenAI Agents SDK 轻量）
3. Chain/CoT/Agent 区别？→（Chain 固定数据流、CoT 是提示技巧、Agent 是模型驱动的循环决策；会用≠懂）
4. 核心抽象？→（Model/Tool/Memory/Retriever/OutputParser；屏蔽厂商差异但抽象泄漏）
5. Chain 本质？→（数据流编排、可组合、接口统一；无循环分支）
6. LangGraph 状态机？→（node+edge+共享 state+条件边实现循环分支；图比链更适合 Agent）
7. 检查点/流式/回调？→（checkpointer 持久化与断点恢复、人工介入；流式透传、回调埋点）
8. Chain/Graph/手写取舍？→（确定性 vs 可控性 vs 极致灵活；能简单就别复杂）
9. 四类控制流？→（循环、回退、人工介入、并行 fan-out/fan-in；配终止条件与 reducer）
10. 多 Agent 模式与开销？→（supervisor/handoff/group chat/blackboard；token 延迟上升、踢皮球、重复劳动）
11. 状态设计/状态爆炸？→（最小化、生命周期、reducer、单一写入责任、可序列化）
12. 可观测性与抽象泄漏？→（tracing/逐步 IO/token 耗时；可移植≠零成本切换）
13. 实战陷阱？→（版本迭代锁版本+适配层、工具重试退避、可观测缺失、选型失误）
14. 新趋势？→（有状态编排收敛、多 Agent 理性化、低代码与代码框架分层、ACP/A2A、context engineering）

**定级速判：**
- 答到第 1–3 问 → L1
- 答到第 4–7 问 + 懂核心抽象与状态机 → L2/L3
- 答到第 8–12 问 + 能讲图编排、多 Agent、可观测与权衡 → L3/L4
- 答到第 13–14 问 + 有生产落地、选型与生态视野 → L4/L5

**一票否决信号：** 认为"框架用得越复杂越专业"、"多 Agent 一定比单 Agent 效果好"、"把 Chain 等同于 Agent"、"认为框架屏蔽差异后就不用理解底层原理"、说不清循环/状态/恢复如何设计 → 无论年限，最高 L2。

<a id="qa-907"></a>

### I7 · Agent 评测与可观测性

**递进主线（照着问）：**
1. 为什么传统单测不适用 Agent？→（输出非确定、无唯一答案、多步路径；断言变评分器）
2. 评测的基本单位？→（数据集 / 测试用例 / 评分器；对象含答案+轨迹+工具+成本延迟）
3. 可观测与评测关系？→（评测打分"好不好"，trace 记录"哪一步、为什么"，共享埋点）
4. 评测集怎么建？→（真实样本+人工标注+边界对抗+bad case 回流；代表性、去污染、holdout）
5. 评分方法？→（规则 / LLM-as-judge / 人工；能规则就别用 judge，人工校准 judge）
6. RAG 指标？→（检索 recall@k/NDCG，生成 faithfulness / relevancy——RAGAS 拆分）
7. Agent 指标？→（任务成功率、轨迹正确性、工具准确率、步数/成本/延迟）
8. Tracing 原理？→（trace/span 树，每步输入输出/耗时/token；离线回归 vs 在线真实）
9. judge 偏差与缓解？→（位置/长度/自我偏好；成对比较+随机化+多评委+人工校准）
10. 无标准答案怎么评？→（rubric 多维、pairwise 相对比较、人工校准）
11. 过拟合与三角？→（Goodhart、holdout、刷新；质量/成本/延迟联合报告、帕累托）
12. trace 定位错误？→（检索/规划/工具/生成，找第一个输入对输出错的 span，step-level eval）
13. A/B 与 evals-first？→（灰度+guardrail；先建评测集再改 prompt）
14. "评测高线上差"排查？→（分布不符/过拟合/陈旧；线上样本回流重建）
15. 2026 新趋势？→（judge 校准、OTel GenAI 语义约定、平台化、evals-first+CI 门禁、合成数据、评测 Agent 的 Agent）

**定级速判：**
- 答到第 1–3 问 → L2
- 答到第 4–8 问 + 能讲清指标与 trace → L3
- 答到第 9–13 问 + 能讲 judge 偏差/过拟合/三角权衡 → L4
- 答到第 14–15 问 + 组织级规范/标准视野 → L5

**一票否决信号：** 认为"Agent 用普通单测断言输出就够了"、"评测分数高就等于线上效果好"、"LLM-as-judge 完全客观可信、无需校准"、"只看最终答案不看轨迹/成本"→ 无论年限，最高 L2。

<a id="qa-908"></a>

### I8 · Agent 安全与生产实践

**递进主线（照着问）：**
1. Agent vs 纯聊天多了什么攻击面？→（工具、数据、网络外泄、成本、记忆、供应链）
2. 什么是提示注入？直接 vs 间接？→（间接藏在外部数据里，来源被当可信、用户无感）
3. 为何 Agent 场景更危险？→（危害 = 不可信输入 × 工具能力 × 数据权限 × 自主程度）
4. 三大危害？安全 vs 可用？→（外泄/越权/资源滥用；C-I-A；风险分级而非绝对安全）
5. 注入原理？→（指令与数据是同一串 token，无法可靠区分，无法根治只能缓解）
6. 间接注入载体？→（网页/邮件/README/RAG/工具返回值/MCP 描述）
7. 越狱 vs 越权？→（破坏模型护栏 vs 破坏应用权限边界，常叠加）
8. 权限模型？→（最小权限 + allow/deny/ask + 工具级与参数级；L0–L4 表）
9. 沙箱/HITL/纵深？→（隔离执行、最后防线、六层叠加每层兜底）
10. system 警告为何不可靠？→（不是安全边界，靠机制而非提示词）
11. 信任边界/混淆代理/审计？→（不可信数据驱动可信工具；Agent 被借刀；可追溯）
12. 工具设计/数据化/敏感隔离？→（受限语义 API + schema 校验；返回值当数据；密钥不进上下文）
13. 成本防护/红队/新趋势？→（预算+步数+速率+循环检测；沙箱红队；OWASP PI 第一、agentic 威胁）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–9 问 + 能讲清纵深与信任边界 → L3
- 答到第 10–12 问 + 有真实案例复盘/红队/熔断 → L4
- 答到第 13 问 + 组织级规范/威胁模型/跟进演进 → L5

**一票否决信号：** 认为"在 system prompt 里写句警告就能防提示注入"、"提示注入已被彻底解决"、"为了省事给 Agent 全部权限并关闭所有审批"、"认为 Agent 生成的代码/命令天然可信"、说不出直接与间接注入的区别 → 无论年限，最高 L2。
