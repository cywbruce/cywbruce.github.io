---
title: "全栈工程师面试与技术栈定级体系（总览）"
date: 2026-11-23
order: 0
summary: "全栈到 AI 时代全栈工程师的面试定级体系入口：42 套题库、九大板块、L1–L5 统一标尺、按岗位选套、防背题信号与 2026 新考点。"
kind: map
interview: false
---

> 这是一套**可落地的面试官工具**，覆盖 42 个主题，每个主题都用"30 秒总答 → 基础 → 原理 → 核心区分度 → 实战 → 2026 新趋势 → 定级 → 速查表"的追问链编排。  
> 目标：**把候选人的真实深度"问出来"**，而不是让他背出标准答案。  
> 覆盖九大板块：**Java 核心（10 套）+ 技术栈（6 套）+ 计算机基础（3 套）+ 分布式（3 套）+ 实战深水区（6 套）+ 前端与全栈（6 套）+ AI Agent 开发（8 套）**。每套可单独使用，也可按岗位组合成一场完整的技术面。  
> 定位升级：从 Java 后端 → **全栈工程师**（后端主线 A–G + 前端与全栈主线 H）→ **AI 时代全栈工程师**（板块 I：LLM 基础 / Agent 架构 / MCP / RAG / 编码 Agent / 框架编排 / 评测可观测 / 安全实践）。新增 **Elasticsearch**（搜索/日志分析）与 **Dubbo**（RPC 内核/调优案例）各两套独立专册——Dubbo 专册与板块 F「服务治理」明确分工：服务治理讲注册发现/容错/雪崩的宏观治理，Dubbo 专册深挖 Invoker 链路、SPI 微内核与源码级排障。



---

## 一、体系构成（42 套题库）

### 板块 A：并发编程（7 套）

| 主题                | 文件                                | 核心主线（题眼）                                  | 最强区分度问题                       |
| ----------------- | --------------------------------- | ----------------------------------------- | ----------------------------- |
| ThreadLocal       | `Java-ThreadLocal-面试题库.md`        | 引用链 → 内存泄漏 → 正确用法                         | "为什么弱引用还会内存泄漏？"               |
| synchronized 与锁升级 | `Java-synchronized与锁升级-面试题库.md`   | 对象头 Mark Word → Monitor → 锁升级 → 编译优化      | "偏向锁撤销为何升级而非回退？"              |
| AQS               | `Java-AQS-面试题库.md`                | volatile state + CLH 队列 + 模板方法            | "acquire 完整流程" / "现场写个 Mutex" |
| 线程池               | `Java-ThreadPoolExecutor-面试题库.md` | 7 大参数 → execute 流程 → 状态机 → 调优             | "execute 流程 + 二次检查"           |
| volatile 与 JMM    | `Java-volatile与JMM-面试题库.md`       | 可见性+禁重排 → happens-before → 内存屏障           | "DCL 为什么不 volatile 会出错？"      |
| CAS 与原子类          | `Java-CAS与原子类-面试题库.md`            | volatile+cmpxchg → ABA/自旋/单变量 → LongAdder | "LongAdder 为什么快、sum 为何不强一致？"  |
| 死锁排查              | `Java-死锁排查-面试题库.md`               | 四条件 → 预防避免 → jstack 排查实战                  | "线上死锁怎么定位？"                   |

### 板块 B：JVM 与语言基础（2 套）

| 主题       | 文件                     | 核心主线（题眼）                                    | 最强区分度问题                       |
| -------- | ---------------------- | ------------------------------------------- | ----------------------------- |
| JVM 与 GC | `Java-JVM与GC-面试题库.md`  | 内存区域 → 对象布局 → GC 算法/收集器 → 类加载               | "JDK25 默认 GC 到底是谁？"           |
| 基础与语法核心  | `Java-基础与语法核心-面试题库.md` | equals/hashCode → String 常量池 → 异常/泛型/Lambda | "为什么重写 equals 必须重写 hashCode？" |

### 板块 C：集合框架（1 套）

| 主题   | 文件                  | 核心主线（题眼）                   | 最强区分度问题                  |
| ---- | ------------------- | -------------------------- | ------------------------ |
| 集合框架 | `Java-集合框架-面试题库.md` | 数据结构选型 → HashMap 底层 → 并发容器 | "为什么容量是 2 的幂、8 转树 6 退树？" |

### 板块 D：技术栈（6 套）

| 主题     | 文件               | 核心主线（题眼）                       | 最强区分度问题                          |
| ------ | ---------------- | ------------------------------ | -------------------------------- |
| MySQL  | `MySQL-面试题库.md`  | B+树索引 → 事务/MVCC → 锁 → 日志与调优    | "MVCC 的 ReadView 在 RC/RR 下有何不同？" |
| Redis  | `Redis-面试题库.md`  | 数据结构底层 → 缓存三兄弟 → 持久化 → 分布式锁/集群 | "缓存穿透/击穿/雪崩分别怎么防？"               |
| Spring | `Spring-面试题库.md` | IOC/循环依赖 → AOP → 事务失效 → 自动配置   | "循环依赖为什么用三级缓存？"                  |
| 消息队列   | `消息队列-面试题库.md`   | 模型对比 → 可靠性四问 → 事务消息 → 选型       | "如何保证消息不丢、不重、有序？"                |
| Elasticsearch | `Elasticsearch-面试题库.md` | 倒排索引 → 分词/映射 → 分片/NRT → 查询聚合 → 向量检索 | "主分片数为何建后不可改？term 与 match 有何区别？" |
| Dubbo | `Dubbo-面试题库.md` | Invoker/URL 驱动 → SPI 微内核 → Directory/Router/Cluster → 协议序列化 | "SPI 自适应扩展原理？Consumer 为何不直连 Provider？" |

### 板块 E：计算机基础（3 套）

| 主题    | 文件              | 核心主线（题眼）                                | 最强区分度问题                               |
| ----- | --------------- | --------------------------------------- | ------------------------------------- |
| 计算机网络 | `计算机网络-面试题库.md` | 分层模型 → TCP 可靠传输/拥塞控制 → HTTP/HTTPS → 新协议 | "三次握手为何不是两次、TIME_WAIT 为何 2MSL？"       |
| 操作系统  | `操作系统-面试题库.md`  | 进程/线程 → 内存管理 → 死锁 → I/O 多路复用 → 性能排查     | "select/poll/epoll 区别、epoll 的 LT/HT？" |
| 设计模式  | `设计模式-面试题库.md`  | 六大原则 → 创建型/结构型/行为型 → 框架中的应用             | "DCL 单例为何 volatile、装饰器 vs 代理 vs 适配器？" |

### 板块 F：分布式（3 套）

| 主题     | 文件              | 核心主线（题眼）                                    | 最强区分度问题                          |
| ------ | --------------- | ------------------------------------------- | -------------------------------- |
| 分布式事务  | `分布式事务-面试题库.md` | CAP/BASE → 2PC/TCC/SAGA → Seata 四模式 → 实战选型  | "TCC 的空回滚/幂等/悬挂怎么解决？"            |
| 服务治理   | `服务治理-面试题库.md`  | RPC 原理 → Dubbo 分层/SPI/容错 → Nacos 双职责 → Mesh | "Nacos 如何兼顾 AP/CP、应用级服务发现为何降压力？" |
| 分布式 ID | `分布式ID-面试题库.md` | 方案演进 → 雪花位结构/时钟回拨 → 号段/Leaf → UUIDv7        | "雪花算法真的绝对有序吗、时钟回拨怎么应对？"          |

### 板块 G：实战深水区（6 套）⭐ 经验区分器

> 这六套是**案例驱动**的——背八股的人能答原理题，但答不好这里的题。定级权重应**高于**原理题。

| 主题         | 文件                  | 核心主线（题眼）                                       | 最强区分度问题                                   |
| ---------- | ------------------- | ---------------------------------------------- | ----------------------------------------- |
| Redis 进阶实战 | `Redis进阶实战-面试题库.md` | 大 Key/热 Key 治理 → 慢查询/内存诊断 → 一致性进阶 → 案例复盘       | "大 Key 怎么安全删除、内存碎片率>1 说明什么？"              |
| JVM 调优案例集  | `JVM调优案例集-面试题库.md`  | 调优方法论 → OOM 全家桶 → GC 诊断 → 真实案例排查               | "运行几天后 Full GC 越来越频繁，讲完整排查过程"             |
| SQL 优化案例集  | `SQL优化案例集-面试题库.md`  | EXPLAIN 深度 → 索引失效 → 深分页/JOIN/COUNT 案例 → 索引与表设计 | "LIMIT 1000000,10 慢在哪、慢 SQL 打满 CPU 怎么排查？" |
| DDD 领域建模   | `DDD领域建模-面试题库.md`   | 战略/战术 → 限界上下文/聚合 → 事件风暴 → 伪 DDD 辨析             | "为电商订单系统建模，怎么推导聚合边界？"                     |
| ES 调优案例集   | `ES调优案例集-面试题库.md`   | 查询慢/写入拒绝/红黄诊断 → 分片与段合并 → 缓存/断路器 → 容量规划   | "翻到 10000 页超时怎么修？集群突然 red 的完整排查过程？"         |
| Dubbo 调优案例集 | `Dubbo调优案例集-面试题库.md` | 线程池打满/超时 → 重试幂等 → 注册发现 → 泛化/序列化 → 路由      | "大促 Provider 线程池打满怎么排查？重试导致重复写入怎么治？"        |

### 板块 H：前端与全栈（6 套）

> 全栈定位的核心增量：**语言（TS）+ 两大框架（React/Vue3）+ 运行时（浏览器/Node）+ 交付链路（工程化）**。既考察"会不会写"，也考察"懂不懂底层与取舍"。

| 主题            | 文件                   | 核心主线（题眼）                                         | 最强区分度问题                                            |
| ------------- | -------------------- | ------------------------------------------------ | -------------------------------------------------- |
| TypeScript    | `TypeScript-面试题库.md` | 结构化类型 → 泛型/条件/映射类型 → 类型体操的度 → Go 编译器             | "为什么 unknown 比 any 安全、satisfies 与 as 的区别？"         |
| React         | `React-面试题库.md`      | Fiber/调度 → Hooks 原理 → diff/key → 并发/RSC/Compiler | "Hooks 为何不能在条件中调用、useEffect 闭包陷阱？"                 |
| Vue 3         | `Vue3-面试题库.md`       | Proxy 响应式 → 依赖收集 → 模板编译/PatchFlag → Vapor        | "reactive 解构为何丢失响应式、watch 与 watchEffect 区别？"       |
| 浏览器原理         | `浏览器原理-面试题库.md`      | 渲染流水线 → 事件循环 → 重排重绘 → 缓存与 CWV                    | "事件循环中微任务与 rAF 时机、INP 为何取代 FID？"                   |
| 前端工程化         | `前端工程化-面试题库.md`      | 模块化 → Webpack/Vite 原理 → 包管理 → 构建性能               | "为何 ESM 才能 Tree Shaking、Vite 为何 dev/build 用不同打包器？" |
| Node.js 与 SSR | `Node与SSR-面试题库.md`   | libuv 事件循环 → Stream/背压 → 中间件 → SSR/hydrate       | "setTimeout vs setImmediate 顺序、CSR/SSR/SSG 如何取舍？"  |

### 板块 I：AI Agent 开发（8 套）⭐ 2026 增量

> AI 时代全栈工程师的核心增量：**模型层（LLM/提示）+ 推理架构（Agent Loop/规划/记忆）+ 协议层（MCP/ACP）+ 知识层（RAG）+ 工程落地（编码 Agent/框架编排）+ 质量与安全（评测/护栏）**。既考"会不会用框架写 Demo"，更考"懂不懂底层控制流、协议分层、失效模式与安全边界"。其中编码 Agent、评测、安全三套偏**经验区分器**，案例题权重高。

| 主题               | 文件                       | 核心主线（题眼）                                           | 最强区分度问题                                                    |
| ---------------- | ------------------------ | -------------------------------------------------- | --------------------------------------------------------- |
| LLM 基础与提示工程     | `LLM基础与提示工程-面试题库.md`  | token/分词 → 上下文/采样 → 消息角色 → 结构化输出               | "temperature=0 就完全确定吗？结构化输出为何约束解码才可靠？"                    |
| Agent 架构与推理模式   | `Agent架构与推理模式-面试题库.md` | Agent Loop → 规划/反思 → 记忆分层 → 推理范式取舍              | "什么时候不该用 Agent 而用确定性工作流？Agent 死循环怎么治？"                    |
| MCP 协议           | `MCP协议-面试题库.md`        | 三角色三原语 → 能力协商 → stdio/Streamable HTTP → 安全      | "tools 与 resources 谁控制、何时用？stdio 要 OAuth 吗？"                    |
| RAG 检索增强         | `RAG检索增强-面试题库.md`      | 切分/Embedding → 混合检索/rerank → 评估 → Agentic RAG   | "检索效果差如何系统性定位是切分、Embedding 还是检索的锅？"                       |
| AI 编码 Agent 与 IDE | `AI编码Agent与IDE集成-面试题库.md` | ACP/MCP 分层 → 权限三态 → 上下文注入 → stdio 排障           | "仓库 README 藏恶意指令诱导外泄 .env 怎么处理？弹窗太多如何调优？"                  |
| Agent 框架与编排      | `Agent框架与编排-面试题库.md`    | Chain/图/状态机 → 多 Agent 模式 → 可观测 → 框架取舍        | "多 Agent 协作为何有时反而更差？何时该抛弃框架手写？"                            |
| Agent 评测与可观测性   | `Agent评测与可观测性-面试题库.md`  | 评测集 → LLM-as-judge → trace 定位 → 质量/成本/延迟三角      | "评测分高但线上效果差、成本突增，如何定位？judge 偏差怎么校准？"                     |
| Agent 安全与生产实践   | `Agent安全与生产实践-面试题库.md`  | 提示注入 → 最小权限/沙箱 → 纵深防御 → 成本熔断              | "间接注入为何更难防？Agent 一夜烧爆账单如何熔断？"                              |

> 共 **42 套题**，覆盖工程师面试的九大正交维度：**并发与安全**（7 套）、**运行时与语言**（JVM + 基础）、**数据结构**（集合）、**存储与框架**（技术栈 6 套：MySQL/Redis/Spring/MQ/ES/Dubbo）、**计算机基础**（网络/OS/设计模式）、**分布式**（事务/治理/ID）、**实战经验**（Redis/JVM/SQL/DDD/ES/Dubbo 案例）、**前端与全栈**（TS/React/Vue/浏览器/工程化/Node）、**AI Agent 开发**（模型/推理/协议/检索/编码/编排/评测/安全）。合起来能勾勒出候选人在 **AI 时代全栈工程师**的完整能力全貌。

---

## 二、统一的定级标尺

42 套题共用一套 L1–L5 标尺，按"**能达到的最深追问层级**"定级，而非答题正确率：

| 级别           | 典型年限  | 能力画像               |
| ------------ | ----- | ------------------ |
| **L1 初级**    | 0–2 年 | 会用 API，说不清原理       |
| **L2 中级**    | 2–5 年 | 懂基本结构，说不清底层机理      |
| **L3 中高级**   | 5–8 年 | 能讲清核心原理与源码流程       |
| **L4 高级**    | 8 年+  | 有源码级认知 + 生产实战/排障经验 |
| **L5 资深/架构** | 10 年+ | 跟进技术演进，能做抽象归纳与技术选型 |

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

> 用法：某候选人在 ThreadLocal 到 P3、线程池到 P4、MySQL 只到 P2——说明并发实战强但数据库底层薄弱，综合定 **L3，偏并发实战型**。单点突出不能代表整体，**均衡度本身也是信号**。  
> **板块 G 加权**：实战案例题答到 P4（能讲具体排查过程与根因）才算真正的 L4；只会背原理、案例题答不上来的，即使原理题全对也应**压到 L3**。DDD 到 P5（能做体系化建模与选型权衡）是架构级信号；ES 调优案例要能讲出完整的"现象→指标→根因→修复→量化结果"（如深分页、写入 429、集群 red）才算 P4；Dubbo 调优案例要能讲清线程池打满/重试幂等/泛化序列化等真实事故的排查链才算 P4。  
> **板块 I 加权**：AI 编码 Agent / 评测可观测 / 安全实践三套是**经验区分器**，案例题（Part 4）答不到 P4（讲不出真实排查、事故复盘、熔断与校准细节）就压到 L3——只会背"提示注入""LLM-as-judge"名词、没处理过真实失效的，是典型的"AI 八股型"候选人。MCP/RAG/框架答到 P5（能跟进协议演进、做生态选型）是 AI 架构级信号。

---

## 三、推荐的面试流程（按岗位组装，30–60 分钟）

**不要 42 套全问完**——那是背书比赛。按岗位挑 4–6 套，每套深挖 8–10 分钟：

### 通用流程模板

1. **热身（3 分钟）**：任选一套的 **Part 0（30 秒总答）** 破冰，判断整体档位。
   - 五点全中 → 起点高，直接跳该主题的 Part 3。
   - 只说得出"线程隔离/加锁/数组+链表" → 从 Part 1 逐级问。
2. **主线深挖（15–20 分钟）**：选 1–2 套与岗位最相关的主题，沿追问链下探到答不上为止。
3. **交叉验证（10 分钟）**：换 1–2 套主题（跨板块），重点问 **Part 4 实战题**，验证"是否真用过"。**中高级以上必从板块 G 抽 1 套案例题**——这是识别"背题型"候选人的最有效手段。
4. **加分/收尾（5 分钟）**：抛 **Part 5 的 2026 新趋势题**，观察技术视野与学习敏锐度。

### 按岗位的选套建议

| 岗位          | 必问                                  | 选问                           | 重点                        |
| ----------- | ----------------------------------- | ---------------------------- | ------------------------- |
| **业务后端开发**  | 线程池、MySQL、SQL 优化案例                  | Redis 进阶、集合框架、Spring、消息队列、Elasticsearch | 实战排障、慢 SQL 优化、索引事务、缓存一致性  |
| **高并发/中间件** | AQS、volatile+JMM、CAS                | synchronized、消息队列、Redis 进阶、Dubbo | 源码级理解、无锁编程、内存模型、RPC 内核     |
| **搜索/大数据/日志** | Elasticsearch、ES 调优案例               | MySQL、消息队列、分布式 ID          | 倒排索引与分词、分片规划、深分页/聚合、集群排障 |
| **基础架构/平台** | JVM 调优案例、操作系统、计算机网络                 | JVM+GC、服务治理、分布式 ID           | GC/索引调优、OS 底层、网络协议、线上诊断   |
| **微服务/分布式** | 分布式事务、服务治理、Dubbo                  | 消息队列、分布式 ID、DDD、Dubbo 调优案例   | CAP 权衡、一致性、注册发现、RPC 内核与幂等   |
| **全栈工程师**   | TypeScript、React（或 Vue3）、Node 与 SSR | 浏览器原理、前端工程化 + 后端任选 2 套       | 类型系统深度、框架原理、端到端交付、前后端视野均衡 |
| **前端工程师**   | TypeScript、React/Vue3、浏览器原理         | 前端工程化、Node 与 SSR             | 框架底层、渲染/性能、工程化与构建         |
| **应届/初级**   | 基础语法、集合框架、设计模式                      | 计算机网络、操作系统、（前端岗加 TypeScript） | 基础扎实度、学习潜力（板块 G 暂不考）      |
| **资深/架构**   | DDD、JVM 调优案例 + 任选 2 套深挖             | SQL 优化案例、前端工程化、全领域快问         | 体系化建模、技术选型、排障深度、演进视野      |
| **AI Agent 工程师** | LLM 基础、Agent 架构、MCP 协议            | RAG、Agent 框架编排、评测可观测          | 模型/采样原理、Agent Loop、协议分层、工具设计   |
| **AI 编码 Agent / IDE 工具** | AI 编码 Agent 与 IDE、Agent 安全实践 | MCP 协议、Agent 评测可观测、Agent 框架     | ACP/MCP 分层、权限与注入防护、stdio 排障、上下文治理 |
| **AI 应用全栈**   | TypeScript、React、Agent 架构、RAG        | LLM 基础、MCP、Node 与 SSR、评测可观测     | 端到端交付 + 前后端视野 + Agent/RAG 落地能力   |

---

## 四、防"背题"的三类通用信号

42 套题都适用，这是**定级准确性的关键**：

1. **真实性信号**：能否讲出**具体的生产事故与排查细节**（"jmap dump 定位到脏 Entry" / "jstack 发现两个线程加锁顺序不一致" / "慢 SQL 用 explain 定位到隐式转换导致的索引失效" / "ss 看到大量 TIME_WAIT 定位到短连接未复用" / "arthas stack 定位到热点方法" / "Performance 面板定位到长任务导致 INP 超标" / "用 GC/构建分析定位到首屏 chunk 过大" / "ES 集群 red 用 allocation explain 定位到磁盘水位、深分页超时改 search_after" / "Dubbo Provider 线程池 dump 定位到下游慢 + 重试放大"）。能讲细节 > 教科书答案。**板块 G 六套 + 板块 H 的浏览器/工程化题专门用于放大这一信号**。
2. **抽象能力信号**：能否跨主题归纳出统一本质——
   - ThreadLocal / MDC / TTL / ScopedValue → "**上下文传播**"
   - synchronized / AQS / volatile / CAS → "**同步机制的层次与取舍**"
   - 线程池 / Semaphore / 限流器 → "**资源池化与背压**"
   - HashMap / ConcurrentHashMap / LongAdder → "**数据结构选型与竞争分散**"
   - MySQL MVCC / Redis 缓存 / MQ 事务消息 / Seata → "**一致性模型的多层次实现**"
   - MySQL B+树（精确查找）/ ES 倒排索引（相关度检索）/ 向量索引（语义近似） → "**索引结构决定检索范式：精确→相关→语义**"
   - 2PC / TCC / SAGA / 事务消息 / 本地消息表 → "**强一致到最终一致的光谱**"
   - 雪花 / 号段 / UUIDv7 / Leaf → "**唯一性与有序性的权衡**"
   - TCP 滑动窗口 / 限流 / MQ 削峰 / 线程池队列 → "**背压与流量整形**"
   - 大 Key / 热 Key / 慢查询 / 堆外泄漏 / ES 分片过多与段爆炸 → "**资源竞争点的识别与隔离**"
   - 限界上下文 / 聚合 / 微服务拆分 → "**边界划分：业务语义 vs 技术约束**"
   - React Fiber / Vue 响应式 / 浏览器事件循环 / Node libuv → "**调度与响应式：把变化高效地映射到更新**"
   - ESM / Tree Shaking / Vite dev-build 差异 / 类型剥离 → "**编译期 vs 运行时的边界前移**"
   - CSR / SSR / SSG / RSC / 边缘渲染 → "**渲染发生在哪里：首屏、SEO 与交互的权衡光谱**"
   - LLM / Agent Loop / MCP / RAG / 工具调用 → "**上下文工程：把有限的注意力窗口当好钢用在刀刃上**"
   - Agent Loop / 线程池 / 限流 → "**都有循环与预算上限，否则失控**"（步数上限 vs 队列容量，本质是防止资源无界消耗）
   - Function Calling / MCP / ACP / LSP → "**都是用结构化协议解耦多对多集成**"（N×M → N+M）
   - Dubbo SPI / Spring SPI / ServiceLoader / JDK 代理 → "**扩展点发现与动态代理：把'选择实现'推迟到运行时**"
   - 提示注入 / SQL 注入 / XSS → "**不可信数据被当成指令执行**"的统一安全本质
3. **权衡能力信号**：能否说清"**什么场景不该用**"——只会讲优点、讲不出适用边界的，通常停在 L2。DDD 题库的"什么时候不该用 DDD"、JVM 调优的"什么时候不该调"、Agent 架构的"什么时候不该用 Agent 而用工作流"、RAG 的"什么时候该微调而非 RAG"是这一信号的直接探针。

> **一票否决规则**（42 套题通用）：出现根本性概念错误（如"ThreadLocal 是银弹"、"volatile 能保证 i++ 原子性"、"用了 MQ 就不用考虑一致性"、"消费者越多消费越快（与分区数无关）"、"JDK25 默认 GC 是 ZGC"、"三次握手可以省成两次"、"epoll 是异步 I/O"、"雪花算法绝对全局有序"、"TCC 不需要幂等"、"用 DEL 删大 Key 没关系"、"DDD 就是加几层接口"、"LIMIT 一定能减少扫描行数"、"索引建得越多越好"、"any 和 unknown 一样安全"、"Hooks 可以放在 if 里"、"key 用 index 没区别"、"reactive 解构后仍响应式"、"useEffect 依赖数组能省略"、"TS 7 还在预览阶段"、"React Compiler 仍是 beta"、"Vapor Mode 已取代虚拟 DOM"、"ES 能替代 MySQL 做事务"、"text 字段可直接聚合排序 / term 查询会分词 / 主分片数可以随时改 / refresh 就是立即刷盘"、"from+size 深分页没问题 / 分片越多越快 / 集群 red 就重启节点"、"Dubbo 就是注解配置没原理 / SPI 就是 JDK SPI 换个目录 / @Adaptive 是编译期固定实现 / Consumer 直接调 Provider 不经 Invoker/Cluster / 注册中心挂了服务立刻不可用 / 超时就调大 retries 且不管幂等"）→ 无论年限，最高 L2。
>
> **板块 I 追加否决信号**："token 等同于字符数"、"temperature=0 就完全确定无随机"、"system prompt 是绝对安全边界"、"结构化输出就是提示模型注意输出 JSON"、"Agent 就是 while 循环调 LLM 没技术含量"、"给足工具就一定比确定性工作流好"、"记忆就是全塞进 prompt"、"MCP 是一个具体模型 / tools 与 resources 都是给模型调用的 / stdio 需要走 OAuth"、"把语义相似等同于答案正确 / 切分越小越好"、"ACP 是取代 MCP 的 / 把权限弹窗全关掉没风险 / 规则文件里的指令绝对可信"、"多 Agent 一定比单 Agent 强 / Chain 就是 Agent"、"Agent 用普通单测就够 / 评测分高等于线上效果好 / LLM-as-judge 完全客观无需校准"、"system prompt 写句警告就能防提示注入 / 提示注入已被彻底根治 / 为省事给 Agent 全部权限"→ 无论年限，最高 L2。

---

## 五、2026 年新增考点（多套题共同覆盖）

这些是 2024–2026 的技术演进，**是区分"持续学习者"与"死守旧八股"的试金石**：

### Java 平台

| 新考点                                        | 对应主题                    | 关键结论                                                                |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------- |
| **JEP 491**（JDK 24）synchronized 不再 pinning | synchronized / AQS / 死锁 | "虚拟线程下必须换 ReentrantLock"已过时（JDK 24+）                                |
| **JEP 506**（JDK 25）ScopedValue 转正          | ThreadLocal / volatile  | 上下文传播的现代方案，不可变、自动清理                                                 |
| **JEP 444**（JDK 21）虚拟线程正式                  | 线程池 / 基础 / JVM 调优       | 不池化；CPU 密集仍需池化限流；jstack 输出变化影响排障                                    |
| **JEP 439/474/490** 分代 ZGC                 | JVM+GC / JVM 调优         | 分代是 ZGC 内部形态；**JDK25 整体默认 GC 仍是 G1**（易混淆）                           |
| **JEP 374**（JDK 15）偏向锁默认禁用                 | synchronized            | 偏向锁因撤销成本高、收益为负而被淘汰                                                  |
| **JEP 193** VarHandle                      | CAS / volatile          | 官方替代 Unsafe，类型安全、细粒度内存序                                             |
| **JEP 395/409/441** Record/Sealed/模式匹配     | 基础语法 / 设计模式             | Record=JDK16、Sealed=JDK17、switch 模式匹配=JDK21 正式版；Sealed+模式匹配可简化访问者模式 |
| **JEP 431** SequencedCollection            | 集合框架                    | JDK 21 新增的统一序列集合接口                                                  |
| **JEP 519/521** 紧凑对象头 / 分代 Shenandoah      | JVM 调优                  | 内存布局与收集器持续演进，以官方发布为准                                                |


### 技术栈

| 新考点 | 对应主题 | 关键结论 |
|--------|---------|---------|
| **MySQL 8.x** 不可见/降序/函数索引、直方图、Instant DDL | MySQL | 5.7 时代的"索引优化八股"需要更新 |
| **Redis 8.0**（2025-05 GA）Vector Set / JSON / 概率结构 | Redis / Redis 进阶 | Vector Set 仍是 **Beta**，别编造命令；Redis Stack 模块已内置 |
| **Redis lazyfree / RESP3 客户端缓存** | Redis 进阶 | 大 Key 删除用 UNLINK 异步化；RESP3 tracking 支撑客户端缓存 |
| **Spring Boot 4.0 + Framework 7**（2025-11） | Spring | JDK 17 基线（拥抱 25）、Jakarta EE 11、模块化、Jackson 3；不确定的细节保守表述 |
| **Kafka 4.0**（2025-03）KRaft-only、KIP-848 | 消息队列 | ZooKeeper 已彻底移除，集群必须先在 3.x 迁到 KRaft 才能升 4.x |
| **Tiered Storage / Quorum Queue** | 消息队列 | 分层存储解耦存算；RabbitMQ Quorum Queue 基于 Raft 替代镜像队列 |
| **Elasticsearch 9.x**（9.3 于 2026-02 发布） | Elasticsearch / ES 调优 | 基于 **Lucene 10**，索引压缩与检索效率提升；升级需关注 8.x 迁移兼容，具体数值以官方基准为准 |
| **向量/混合检索成 ES 一等公民** | Elasticsearch | `dense_vector` + HNSW；**DiskBBQ**（磁盘上搜索量化向量、降内存）、**ACORN**（带过滤的向量检索加速）、bfloat16 / on-disk rescoring 降低向量成本；`semantic_text` 自动 embedding |
| **ES|QL 流式查询语言** | Elasticsearch / ES 调优 | 管道式语法替代冗长 DSL；LOOKUP JOIN、时序聚合（RATE/TBUCKET）、Inline Stats；定位与 DSL 互补而非完全取代 |
| **Columnar Mode / 多模态 semantic field**（技术预览） | ES 调优 | 9.5 的列式存储、VectorDB index mode、多模态语义字段处技术预览/快速演进；须核对 GA 状态，不可当生产稳定承诺 |

### 计算机基础与分布式

| 新考点 | 对应主题 | 关键结论 |
|--------|---------|---------|
| **HTTP/3（RFC 9114，2022）** 基于 QUIC/UDP | 计算机网络 | 解决 TCP 连接级队头阻塞、连接迁移、0/1-RTT；与 HTTP/2 长期并行而非立即取代 |
| **TLS 1.3（RFC 8446）1-RTT/0-RTT** | 计算机网络 | 0-RTT 无重放保护，非幂等请求禁用——高频追问 |
| **后量子 TLS：X25519MLKEM768** | 计算机网络 | 经典 X25519 + ML-KEM 混合密钥交换，Chrome/Firefox 等已默认启用；NIST 2024 首批 PQC 标准 |
| **BBR / BBRv3 拥塞控制** | 计算机网络 | 带宽+RTT 建模 vs 传统丢包驱动；CUBIC 仍是许多系统默认 |
| **EEVDF 调度器（Linux 6.6 起默认）** | 操作系统 | 替代 CFS，改善延迟敏感任务；"CFS 仍是 Linux 默认调度器"已过时 |
| **io_uring / eBPF / cgroup v2** | 操作系统 | io_uring 异步批处理 vs epoll 同步就绪；eBPF 零侵入可观测；cgroup v2 影响容器内 JVM 调优 |
| **Dubbo 3 应用级服务发现 + Triple 协议** | 服务治理 | 注册从"实例×接口"降为"实例"级；Triple 基于 HTTP/2 兼容 gRPC |
| **Dubbo 3.3.x 维护线（3.3.7 / 2026-11）** | Dubbo / Dubbo 调优 | Dubbo2(2.7.x) 已 EOL、3.1.x 不再积极维护；3.3.7 支持 JDK 25；"仍用 2.7.x 且说官方还在维护"是过时认知 |
| **Triple X 协议 + AOT + 虚拟线程** | Dubbo / Dubbo 调优 | Triple X 统一南北/东西向流量、gRPC 兼容 + Protobuf、支持 HTTP/1/2/3、Spring Web 平滑迁移；Native Image AOT 适配 Serverless；Project Loom 虚拟线程提升高并发（细节以官方为准） |
| **Nacos 3.x / Service Mesh / Proxyless Mesh** | 服务治理 | Nacos 强化 gRPC/K8s；Mesh 把治理下沉 Sidecar，短期与 RPC 框架互补而非取代 |
| **Seata 2.x（Apache 孵化）/ GraalVM Native** | 分布式事务 | AT/TCC/SAGA/XA 四模式；Raft 集群处 beta；Transaction Mesh 仍是探索方向 |
| **UUIDv7（RFC 9562，2024-05）** | 分布式 ID | 48 位毫秒时间戳前缀、时间有序、无需 workerId、无时钟回拨，有望替代雪花；但仍 128 位、生态演进中 |

### 实战与建模理念

| 新考点 | 对应主题 | 关键结论 |
|--------|---------|---------|
| **容器感知 JVM** | JVM 调优 | UseContainerSupport 默认开启；Xmx 与 cgroup limit 不匹配是被 OOM-Kill 的高频原因 |
| **虚拟线程时代排障** | JVM 调优 | jstack/async-profiler 对海量虚拟线程的观测方式在演进，传统"线程池打满"判断需更新 |
| **DDD 与微服务/中台** | DDD | 限界上下文**不等于**微服务（一个上下文可多服务、一服务可含多上下文）；按业务语义而非技术分层拆 |
| **事件驱动 + CQRS/Event Sourcing** | DDD | 领域事件与 Kafka 结合落地最终一致；Event Sourcing 是强取舍（复杂度换可追溯），非银弹 |
| **AI 辅助领域建模** | DDD | 用 LLM 从需求文档/对话抽取领域概念属探索方向，仍须人工校验统一语言与边界——保守表述 |

### 前端与全栈

| 新考点 | 对应主题 | 关键结论 |
|--------|---------|---------|
| **TypeScript 7.0**（2026-07 stable）Go 编译器（Corsa） | TypeScript | 8–12x 提速、`strict` 默认开启；TS 6 是最后 JS 版；编程式 API 留到 7.1，生态工具短期留在 6.0——"仍是预览"是过时答案 |
| **Node 类型剥离**（v22.18 默认、v25.2 稳定） | TypeScript / Node | 可直接 `node file.ts`；仅支持可擦除语法，`enum`/`namespace` 需规避；不等于 tsc 完整类型检查 |
| **React 19（2024-12）+ 19.2（2025-10）** | React / Node | Actions、`use`、useActionState、ref 作为 prop、稳定 RSC；React 2026-02 转入 Linux 基金会 React Foundation |
| **React Compiler 1.0**（2025-10 GA） | React | 自动插入 memo，浏览器原理上"手写 memo 逐步不必要"；"仍 beta"已过时 |
| **Vue 3.5 响应式重构 + Vapor Mode（3.6 仍 RC）** | Vue 3 | Vapor 无虚拟 DOM 编译路径为可选，未取代 vDOM；useTemplateRef 改善类型推导 |
| **INP 取代 FID**（2024-03） | 浏览器原理 | Core Web Vitals 响应性指标更全面；≤200ms 为 good，取 p75；优化重心转向"减少长任务" |
| **View Transitions / Speculation Rules API** | 浏览器原理 | 原生页面过渡 + 声明式预渲染；跨文档支持度仍分浏览器，保守表述 |
| **Vite 7 / Rolldown（Rust）** | 前端工程化 | Rolldown 为路线图上的未来默认打包器；当前 Vite 7 默认生产打包仍是 Rollup，`rolldown-vite` 可选尝鲜；要求 Node 20.19+/22.12+ |
| **Rust/Go 工具链**（Rspack/Oxc/SWC/esbuild/Turbopack） | 前端工程化 | 用系统级语言换数量级构建性能，前端工具链集体"原生化" |
| **RSC / Edge SSR / 原生 TS** | Node 与 SSR | RSC 与 SSR 互补非替代；Edge 运行时受限（仅 Web 标准 API）；框架默认服务端优先 |

### AI Agent 开发

| 新考点 | 对应主题 | 关键结论 |
|--------|---------|---------|
| **MCP 协议版本演进**（2025-06-18 → 2025-11-25 修订） | MCP 协议 | Streamable HTTP 取代旧 HTTP+SSE（2024-11-05）；2025-11-25 新增实验性 tasks、URL mode elicitation、sampling 工具调用、JSON Schema 2020-12 默认方言；授权基于 OAuth 2.1（stdio 不走 OAuth、从环境取凭据）；答"只有旧版本"是过时答案 |
| **ACP（Agent Client Protocol）生态** | AI 编码 Agent | Zed 2025-06 建仓、2025-08 提出，JetBrains 2025-12 加入；2026-01-28 上线 ACP Agent Registry；Zed 1.0 核心特性；40+ Agent、多编辑器支持；已有稳定 v1（v2 draft 中），远程 Agent 仍完善中；ACP=编辑器↔Agent、MCP=Agent↔工具、A2A=Agent↔Agent，三者互补 |
| **AGENTS.md 开放指令格式** | AI 编码 Agent | 开放的 Agent 指令文件规范，被大量仓库采用；与 CLAUDE.md 等同类文件一起做上下文/规则注入；具体优先级以各工具文档为准 |
| **推理模型改变提示范式** | LLM 基础 / Agent 架构 | 推理（thinking）模型内建长思考，通常**不再需要手动 CoT 提示**；传统提示工程的不少"技巧"对推理模型反而是负优化——考察是否跟进 |
| **Context Engineering 取代 Prompt Engineering** | 多套 | 从"雕琢一句话"升级为"系统化管理进入上下文的全部信息"（检索/工具结果/记忆/规则），长上下文也未取代 RAG（成本/精度/可溯源仍需 RAG） |
| **结构化输出 / Constrained Decoding** | LLM 基础 | JSON Schema 约束解码成为可靠结构化输出的主流（非"提示模型注意格式"）；契约化输出是 Agent 工具调用可靠的前提 |
| **LLM-as-judge + 可观测性标准** | Agent 评测可观测 | LLM 裁判成主流但强调校准（位置/长度/自我偏差）；OpenTelemetry GenAI 语义约定与 trace 平台兴起；evals-first、质量门禁进 CI |
| **OWASP LLM Top 10 / Agentic 安全** | Agent 安全实践 | 提示注入常年居首（间接注入更难防）；工具链投毒、MCP 供应链、记忆投毒等新威胁；最小权限 + 沙箱 + HITL + 纵深防御成标配——"提示注入无法根治，只能缓解" |

---

## 六、文件清单（共 43 个文件）

```
/Users/cyw/WorkBuddy/2026-11-18-12-26-46/
├── Java-面试定级体系-总览.md              ← 本文件（体系入口）
│
├── 【板块 A · 并发编程 7 套】
│   ├── Java-ThreadLocal-面试题库.md
│   ├── Java-synchronized与锁升级-面试题库.md
│   ├── Java-AQS-面试题库.md
│   ├── Java-ThreadPoolExecutor-面试题库.md
│   ├── Java-volatile与JMM-面试题库.md
│   ├── Java-CAS与原子类-面试题库.md
│   └── Java-死锁排查-面试题库.md
│
├── 【板块 B · JVM 与语言基础 2 套】
│   ├── Java-JVM与GC-面试题库.md
│   └── Java-基础与语法核心-面试题库.md
│
├── 【板块 C · 集合框架 1 套】
│   └── Java-集合框架-面试题库.md
│
├── 【板块 D · 技术栈 6 套】
│   ├── MySQL-面试题库.md
│   ├── Redis-面试题库.md
│   ├── Spring-面试题库.md
│   ├── 消息队列-面试题库.md
│   ├── Elasticsearch-面试题库.md
│   └── Dubbo-面试题库.md
│
├── 【板块 E · 计算机基础 3 套】
│   ├── 计算机网络-面试题库.md
│   ├── 操作系统-面试题库.md
│   └── 设计模式-面试题库.md
│
├── 【板块 F · 分布式 3 套】
│   ├── 分布式事务-面试题库.md
│   ├── 服务治理-面试题库.md
│   └── 分布式ID-面试题库.md
│
├── 【板块 G · 实战深水区 6 套】⭐ 经验区分器
│   ├── Redis进阶实战-面试题库.md
│   ├── JVM调优案例集-面试题库.md
│   ├── SQL优化案例集-面试题库.md
│   ├── DDD领域建模-面试题库.md
│   ├── ES调优案例集-面试题库.md
│   └── Dubbo调优案例集-面试题库.md
│
├── 【板块 H · 前端与全栈 6 套】
│   ├── TypeScript-面试题库.md
│   ├── React-面试题库.md
│   ├── Vue3-面试题库.md
│   ├── 浏览器原理-面试题库.md
│   ├── 前端工程化-面试题库.md
│   └── Node与SSR-面试题库.md
│
└── 【板块 I · AI Agent 开发 8 套】⭐ 2026 增量
    ├── LLM基础与提示工程-面试题库.md
    ├── Agent架构与推理模式-面试题库.md
    ├── MCP协议-面试题库.md
    ├── RAG检索增强-面试题库.md
    ├── AI编码Agent与IDE集成-面试题库.md
    ├── Agent框架与编排-面试题库.md
    ├── Agent评测与可观测性-面试题库.md
    └── Agent安全与生产实践-面试题库.md
```

每份题库均可**独立使用**（含完整的定级表和速查表），也可配合本总览组成完整体系。全部 42 套统一为 7 个 Part 结构，共约 16400 行。

---

## 七、可扩展方向

本体系当前覆盖 Java 语言与平台、主流后端技术栈、计算机基础、分布式、实战案例、前端与全栈主线（TS/React/Vue/浏览器/工程化/Node），以及 AI Agent 开发主线（模型/推理/协议/检索/编码/编排/评测/安全）。若需进一步扩展，可按同样格式增补：
- 云原生：Docker/K8s、CI/CD、可观测性（Prometheus/Grafana/OpenTelemetry）
- 大数据：Hadoop/Spark/Flink
- 质量工程：单元测试与 Mock、持续集成、代码评审
- AI 进阶：Fine-tuning/PEFT、多模态模型、Agent 记忆与强化学习、RAG 评测专项、A2A/多 Agent 协议细节
- 其他：Spring Cloud 微服务实战、架构演进案例、跨端（小程序/RN/Flutter）

需要时按"主题 + 7 Part 结构"复用同一模板即可。

---

*资料整理于 2026-11-23。参考 JDK 官方 JEP（193/374/431/439/444/474/490/491/506/519/521 等）、HotSpot 源码、MySQL/Redis/Spring/Elasticsearch/Apache Lucene/Apache Kafka/Apache Dubbo/Nacos/Seata 官方文档、RFC 9114/8446/9562、TypeScript/React/Vue/Node.js/Vite 官方文档与发布说明、MDN Web Docs、Eric Evans《领域驱动设计》与 Vaughn Vernon《实现领域驱动设计》、阿里 Java 开发手册、《Java 并发编程实战》《深入理解 Java 虚拟机》《设计数据密集型应用》《计算机网络：自顶向下方法》、Anthropic MCP 规范（含 2025-06-18 / 2025-11-25 修订）与 OAuth 2.1 相关 RFC、Agent Client Protocol 官方规范与 Registry 公告、OWASP LLM Applications Top 10、主流 LLM/Agent 框架与评测工具官方文档，及 2026 年全栈与 AI Agent 面试趋势资料。涉及版本细节（含 Elasticsearch 9.x 特性与技术预览状态、Dubbo 3.3.x / Triple X / AOT / 虚拟线程）以官方发布为准；题目与答案基于公开技术资料整理，用于面试评估参考。*
