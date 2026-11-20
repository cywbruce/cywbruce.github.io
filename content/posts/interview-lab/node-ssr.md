---
title: "Node.js 与 SSR 面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "libuv 事件循环、Stream 与背压、中间件、SSR 与 hydration 取舍。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把全栈候选人对 **Node.js 运行时与 SSR 框架** 的真实深度"问出来"——覆盖事件循环、模块、Stream、异步上下文、工程化与服务端渲染。
> 核心原则：**Node 的每道题，最终都会落到"V8 + libuv → 单线程事件循环 + 非阻塞 I/O → 异步编程（Promise/Stream/上下文）"这条主线**；SSR 的每道题，最终都会落到"**同构 → 服务端出 HTML → 客户端水合（hydrate）→ 渲染策略取舍**"这条主线。只会调 Express API 却讲不清事件循环与同构水合的人，基本停留在 API 记忆层。
> 配套：与 Java 体系共用 L1–L5 定级标尺。OS 层的 select/poll/epoll 见《操作系统-面试题库》，本题聚焦 **Node 运行时机制与 SSR 框架层**，不重复 OS 底层。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题](#part-1)
- [Part 2：底层原理题（事件循环 / 模块 / Stream）](#part-2)
- [Part 3：核心区分度题（题眼，定级主战场）](#part-3)
- [Part 4：实战与陷阱题](#part-4)
- [Part 5：2026 新趋势：RSC / Edge SSR / 原生 TS](#part-5)
- [Part 6：能否用 Node+SSR 定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 Node.js 和 SSR 的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> ①② Node.js 是**基于 V8 + libuv 的 JS 运行时**，核心是**事件驱动 + 非阻塞 I/O**：一个 JS 主线程配合 libuv 处理并发，适合 **I/O 密集**、不适合 **CPU 密集**（会阻塞唯一 JS 线程）；"单线程"仅指 **JS 执行主线程**，底层仍有线程池。SSR 是**服务端把组件渲染成完整 HTML 返回浏览器**，相对 CSR 换来**更好的首屏与 SEO**，代价是**服务器压力和复杂度**。
>
> ③④ 关键机制是**同构（Isomorphic）**：同一份组件代码服务端跑出 HTML、客户端接管交互；通过 **hydrate（水合）** 复用服务端 DOM 并绑定事件，而非重绘整棵 DOM。渲染策略是一条光谱 **CSR / SSR / SSG / ISR**，按内容动态性、首屏要求、服务器成本取舍。
>
> ⑤ 对全栈而言，Node 的价值是**用同一语言打通前后端**，承担 BFF/中间层（聚合接口、鉴权、直出首屏），SSR 正是"前端基础设施化"的典型落地。

**评分要点：** V8+libuv / 事件驱动非阻塞 I/O / I/O 密集 vs CPU 密集 / 同构+水合 / CSR-SSR-SSG-ISR 取舍 这几个点，对应入门到高级。能说清"事件循环阶段"或"水合过程"的，直接往 Part 2/3 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题

### Q1. Node.js 到底是什么？为什么说全栈工程师要懂它？

**标准答案：**
- **本质**：Node.js = **V8（执行 JS）+ libuv（事件循环、线程池、异步 I/O）+ 核心模块（fs/http/net）**，把浏览器 JS 能力搬到服务端并补上文件、网络、进程等系统能力。
- **特点**：事件驱动、非阻塞 I/O、单线程 JS 主线程。适合高并发 I/O 密集（API 网关、BFF、实时通信、SSR），**不适合 CPU 密集**（加密、图像处理、大计算会堵死主线程，需 worker_threads / 多进程）。
- **"单线程"的准确含义**：只有 **JS 执行单线程**；libuv 默认 4 个线程池线程处理文件 I/O、DNS、加密，网络 I/O 由 OS 异步机制完成——是"JS 单线程 + 底层多线程"的混合模型。
- **全栈为何要懂**：① 同一语言/类型（TS）贯通前后端；② 承担 **BFF/中间层**，聚合服务、裁剪数据、鉴权与 SSR 直出；③ 前端工具链（Webpack/Vite/esbuild）都跑在 Node 上；④ 能独立完成接口到页面的闭环。

**追问 1：Node 和 Java 处理高并发的模型有何本质不同？**
> **答案：** Java 传统是**多线程阻塞模型**（一请求一线程，线程稀缺要池化限流）；Node 是**单线程事件循环 + 非阻塞 I/O**（一个线程靠异步回调撑起大量并发，瓶颈从"线程数"变成"事件循环是否被阻塞"）。Java 靠多核吃 CPU 密集，Node 靠异步吃 I/O 密集；现代两者在融合（Java 虚拟线程、Node worker_threads）。

**追问 2：既然有线程池，为什么还说 CPU 密集会卡死 Node？**
> **答案：** 因为 **JS 代码永远只在唯一的 JS 主线程上跑**。线程池只帮 I/O 操作（文件、DNS、crypto）干活，回调最终仍回主线程执行。死循环或大计算占满主线程，所有请求回调都排不上队——这就是"阻塞事件循环"。

---

### Q2. CSR / SSR / SSG / ISR 分别是什么？怎么取舍？

**标准答案：**

| 策略 | 渲染时机 | 首屏 | SEO | 服务器压力 | 适合场景 |
|------|---------|------|-----|-----------|---------|
| **CSR** | 浏览器端 | 慢（先下 JS） | 差（HTML 空壳） | 低 | 后台系统、强交互、无 SEO |
| **SSR** | 每次请求时服务端 | 快 | 好 | 高（每请求渲染） | 内容动态 + 要首屏/SEO（电商、资讯） |
| **SSG** | 构建时一次性 | 最快 | 好 | 极低（纯静态） | 内容不常变（博客、文档） |
| **ISR** | 构建时 + 按间隔/按需再生成 | 快 | 好 | 低 | 内容偶尔变、量大（商品详情） |

- **本质取舍**：**内容动态性 vs 首屏/SEO vs 服务器成本** 的三角。**SSR 收益**：首屏直出完整 HTML（FCP/LCP 更好）、爬虫可读；**代价**：渲染吃 CPU/内存、同构/水合/数据同步、缓存与部署复杂。
- **ISR** 是 SSG 增强：按 revalidate 时间或按需（on-demand）后台重新生成静态页，兼顾静态性能与内容更新。

**追问 1：什么情况下反而不该用 SSR？**
> **答案：** ① 强交互、无 SEO 的内部后台（CSR 更简单）；② 纯静态内容（SSG 更划算）；③ 服务器资源紧张或流量极大而内容可缓存（SSG/ISR + CDN）。**SSR 不是银弹**，复杂度只有在"首屏 + SEO + 动态内容"三者同时需要时才值得。

**追问 2：SSR 的"首屏快"是绝对的吗？**
> **答案：** 不绝对。SSR 把渲染搬到服务端，**多了服务端计算和往返（TTFB 可能变高）**，只是把"白屏"提前成"有内容的 HTML"。若服务端慢或水合前不可交互（TTI 仍慢），收益会被削弱。要区分**首屏可见（FCP）**与**可交互（TTI）**两个指标。

---

<a id="part-2"></a>

## Part 2：底层原理题（事件循环 / 模块 / Stream）

> 这是"会写 Node 代码"和"懂 Node 运行时"的分水岭，L2→L3 的关键。

### Q3. 讲清 libuv 事件循环的完整执行顺序（6 个阶段），microtask 何时执行？

**标准答案：** （能画出这张表基本是 L3）

事件循环每轮（tick）按固定顺序经过 6 个阶段，每个阶段有一个 FIFO 回调队列，每两阶段之间清空 microtask：

```text
timers → pending callbacks → idle,prepare → poll → check → close callbacks →（回到 timers）
```

| 阶段 | 主要回调 | 关键点 |
|------|---------|--------|
| timers | `setTimeout` / `setInterval` | 到期才执行；精度不保证（受调度/poll 耗时影响） |
| pending callbacks | 系统级 I/O 回调 | 上一轮延迟的 I/O 回调（如 TCP 错误） |
| idle, prepare | 内部使用 | 无需关注 |
| **poll** | I/O 回调 | **核心**：队列非空则执行回调；队列空且有 setImmediate 则进 check；队列空且无 setImmediate 则**阻塞等待** I/O（受 timers 到期时间约束） |
| check | `setImmediate` | 紧接 poll，故 I/O 回调里的 setImmediate 总先于 setTimeout(0) |
| close callbacks | `close` 事件 | 连接/句柄关闭的清理（socket.on('close')） |

- **microtask（Promise.then / queueMicrotask）**：在**每个阶段切换之间、每个回调之后**清空。`process.nextTick` **优先级高于 microtask**：当前 JS 操作结束后先清空整个 nextTick 队列，再清空 microtask，然后事件循环继续。滥用 nextTick 会"饿死"事件循环（递归 nextTick 卡在当前阶段）。

**追问 1：`setTimeout(fn, 0)` 和 `setImmediate(fn)` 谁先？poll 阶段到底做什么？**
> **答案：** **顶层同步代码中顺序不确定**——取决于进入循环时 timers 阶段是否已过及 poll 耗时，两种结果都可能出现；但在 **I/O 回调内部 setImmediate 一定先于 setTimeout(0)**（I/O 在 poll 执行，紧接 check 跑 setImmediate，setTimeout 要等下一轮 timers）。poll 是"心脏"：绝大多数异步 I/O 回调在此触发，Node 的高并发本质就是 poll 阶段"高效等待 + 就绪即执行"，无需为每连接开线程。

**追问 2：为什么定时器不准时？一个耗时 5 秒的同步计算会怎样？**
> **答案：** setTimeout 延迟是"**至少** N 毫秒"而非"恰好"——poll 阶段执行耗时回调或队列很长会推迟 timers。5 秒同步计算会占满 JS 主线程，事件循环无法进入任何阶段，所有回调积压、HTTP 服务"假死"。解决：拆成异步分片、用 `setImmediate`/`queueMicrotask` 让出主线程，或移到 worker_threads / 子进程 / 多进程。

---

### Q4. CommonJS 与 ESM 的模块机制有哪些关键差异？require 的解析与缓存是怎样的？

**标准答案：**

| 维度 | CommonJS (`require`) | ESM (`import`) |
|------|---------------------|----------------|
| 加载时机 | 运行时**同步**加载 | 编译时**静态**解析、异步加载 |
| 导出本质 | `module.exports` 值的**拷贝/快照** | **live binding**（只读实时引用） |
| 严格模式 | 非默认 | 默认严格模式，顶层 `this` 为 `undefined` |
| 提升 | 无 | `import` 有提升 |
| 路径变量 | 有 `__dirname` / `__filename` | 无，用 `import.meta.url` + `fileURLToPath` |
| 区分方式 | `.cjs` / 默认 | `.mjs` 或 package.json `"type": "module"` |

- **require 缓存**：首次加载后存入 `Module._cache`，后续 `require` 同一路径**直接返回缓存的 exports**（同一实例）——模块是**单例**，适合放共享状态/配置。
- **require 解析流程**：① 核心模块（fs/http）优先 → ② 相对/绝对路径（依次试 `.js` `.json` `.node`，目录找 `package.json` 的 `main` 或 `index.js`）→ ③ 逐级向上找 `node_modules` → ④ 命中缓存。
- **循环依赖**：require 返回**模块"当前已执行到"的 exports 快照**。A require B、B 又 require A 时，B 可能拿到未执行完的不完整导出（undefined）。避免：把相互引用**延迟到函数体内 require**，或重构消除环。

**追问 1：`require` 和 `import` 如何互操作？能在 CommonJS 里 require 一个 ESM 吗？**
> **答案：** ESM 中可 `import` CommonJS（默认导出指向 `module.exports`，命名导入靠静态推断、有限制）。反过来 CommonJS **同步 `require` ESM 受限**：较新 Node 提供了 `require(esm)` 支持（部分场景/曾为实验性），历史上需动态 `import()`（返回 Promise）。细节随版本演进，**以所用 Node 版本官方文档为准**；答出"ESM 异步、CommonJS 同步，模型不同、互操作有限制"即达标。

**追问 2：ESM 里怎么拿到 `__dirname`？`import.meta` 还有什么用？**
> **答案：** 用 `import { fileURLToPath } from 'node:url'` 与 `path.dirname(fileURLToPath(import.meta.url))` 得到目录。`import.meta` 是 ESM 模块元数据对象，提供 `import.meta.url`（当前模块 file URL）、`import.meta.resolve()`，取代 CommonJS 的 `__filename` / `__dirname` / `require.resolve`。

---

### Q5. Stream 有哪几种？什么是背压？为什么流式处理大文件省内存？

**标准答案：**
- **Buffer**：处理二进制数据的定长原始内存块（基于 `ArrayBuffer`），支持 `utf8`/`latin1`/`base64`/`hex` 等编码，`Buffer.from()` / `Buffer.alloc()` 创建，是 Stream 传输的数据单元。
- **四种流**：**Readable**（可读，`fs.createReadStream`）、**Writable**（可写，`fs.createWriteStream`）、**Duplex**（双工，`net.Socket`，读写独立）、**Transform**（转换，Duplex 特例，读写间加工，如 `zlib.createGzip`）。

```js
const fs = require('node:fs'), zlib = require('node:zlib');
// 读 → gzip 压缩 → 写，全程分块、自动处理背压
fs.createReadStream('in.log').pipe(zlib.createGzip())
  .pipe(fs.createWriteStream('out.log.gz'))
  .on('finish', () => console.log('done'));
```

- **背压（backpressure）**：Writable 处理不过来、内部缓冲堆积时 `write()` 返回 `false`（"别再灌了"）；`pipe()` 据此**暂停 Readable，等 Writable 触发 `drain` 再恢复**，形成流量控制避免内存撑爆。手写流须监听 `drain` 并在 `write()` 返回 false 时暂停。
- **为什么省内存**：`fs.readFile` **一次性把整个文件读进内存**（O(文件大小)）；Stream 按 chunk（默认 64KB）逐块处理，任意时刻内存里只有少量 chunk（O(chunk)），能处理 GB 级文件。

**追问 1：手写"写速度慢"的消费者，怎么正确处理背压？**
> **答案：** 核心是 `write()` 返回 false → 停写 → `once('drain', next)` → 恢复：

```js
function writeChunks(writable, chunks) {
  let i = 0;
  (function next() {
    while (i < chunks.length && writable.write(chunks[i++]));
    if (i >= chunks.length) return writable.end();
    writable.once('drain', next);  // 缓冲区满：暂停，等 drain 再继续
  })();
}
```

用 `pipe()` 则这些都已自动处理。

**追问 2：Stream 的 `end` / `finish` / `close` 事件有什么区别？**
> **答案：** `end` 是 **Readable** 侧事件（数据读完）；`finish` 是 **Writable** 侧事件（`end()` 后数据全刷到底层）；`close` 表示底层资源（文件描述符）已关闭。写"管道完成"逻辑通常监听最后一个 Writable 的 `finish`（或 `close`）。

---

<a id="part-3"></a>

## Part 3：核心区分度题（题眼，定级主战场）

> **这一部分是全题的题眼**——能否讲清异步上下文传播、SSR 同构水合、中间件模型，直接决定 L3 还是 L4/L5。定级主要看这里。

### Q6. AsyncLocalStorage 是什么？和 Java 的 ThreadLocal / ScopedValue 有什么思想联系？

**标准答案：** （考察异步上下文传播的通识抽象能力）

- **问题背景**：异步模型里一个请求的调用链被 `await`、Promise、回调切成碎片，如何把 traceId、用户身份、租户这类**请求级上下文**贯穿整条链？全局变量会串请求，层层传参太侵入。
- **AsyncLocalStorage**：Node 在 `async_hooks` 之上的高层封装。`als.run(store, callback)` 在一段异步流里设定上下文，此后这条链任意深处 `als.getStore()` 都能取到，**跨 await / Promise / 回调自动传播**且请求间隔离。

```js
const { AsyncLocalStorage } = require('node:async_hooks');
const als = new AsyncLocalStorage();
app.use((req, res, next) => als.run({ traceId: req.headers['x-trace-id'] }, next));
function log(msg) { console.log(als.getStore().traceId, msg); } // 任意深处读取
```

- **与 Java 的联系（抽象主线：上下文传播）**：
  - **ThreadLocal** 绑定"线程"，虚拟线程/协程/异步下执行会在不同线程切换，语义失效或需 TTL 增强。
  - **ScopedValue（JDK 25 转正）** 是 Java 现代方案——**结构化、不可变、作用域内自动清理**，由 `where(...).call()` 界定生命周期，天然适配虚拟线程。
  - **AsyncLocalStorage** 把上下文绑到**异步执行链（AsyncResource / 执行上下文 id）** 而非线程，思想与 ScopedValue 一致：**上下文随执行流走、作用域结束自动失效**，都比 ThreadLocal 更适合高并发异步场景。

**追问 1：为什么不能用全局/模块级变量存 traceId？**
> **答案：** Node 单线程高并发，多请求交错执行，全局变量被所有请求共享、互相覆盖——A 的 traceId 可能被 B 改掉。必须让上下文**跟异步执行流隔离**，这正是 AsyncLocalStorage 的价值。

**追问 2：`unhandledRejection` 和 `uncaughtException` 有何区别？生产怎么处理？**
> **答案：** `unhandledRejection` 是 Promise reject 但无 `.catch`（较新 Node 默认会 throw 致进程退出）；`uncaughtException` 是同步异常一路未捕获。生产应**显式监听两者**：记录日志、上报监控、优雅关闭后退出让进程管理器重启，而不是吞掉继续运行（此时状态可能不一致）。根本手段仍是 Promise 链加 `.catch`、`async/await` + try/catch。

---

### Q7. SSR 的同构原理是什么？hydrate（水合）做了什么？什么是 hydration mismatch？

**标准答案：** （SSR 题眼，L3/L4 分水岭）

**SSR + 同构完整流程：**

```text
① 浏览器发请求 → ② SSR 服务：路由匹配 → 服务端取数 → 同一份组件代码渲染出 HTML
③ HTML + 序列化初始数据（__INITIAL_STATE__ / __NEXT_DATA__）返回
④ 浏览器看到完整内容（首屏直出、SEO），但尚不可交互
⑤ 水合：客户端在已有 DOM 上"激活"——绑定事件、建立组件树映射 → ⑥ 可交互（TTI）
```

- **同构（Isomorphic / Universal）**：**同一份组件代码既能服务端渲染出 HTML，又能浏览器端运行接管交互**；代码不能依赖纯浏览器 API（服务端会崩）或纯 Node API（客户端会崩）。
- **hydrate 水合**：**不是重新渲染整棵 DOM**，而是"认领"服务端已生成的 DOM，附加事件监听、建立组件树与 fiber/vnode 映射，并复用序列化数据作初始 state，避免重复取数。
- **数据获取与状态同步**：服务端取数后**序列化内嵌进 HTML**，客户端 hydrate 读同一份数据作初始 state（dehydration → rehydration），保证两端首屏一致、不二次请求。
- **hydration mismatch**：服务端 HTML 与客户端首次渲染结果**结构/内容不一致**。诱因：① 用 `Date.now()`/`Math.random()` 等非确定性值；② 渲染期访问 `window`/`document`/`localStorage`（服务端不存在）；③ 两端初始数据不一致。后果：React/Vue 报警告、水合失败、可能回退客户端重渲染（丢收益、页面闪烁）。**规避**：保证首屏渲染**确定性**，浏览器 API 放 `useEffect`/`onMounted`，保持两端数据一致。

**追问 1：Node 中间层 / BFF 在 SSR 架构里为什么有价值？**
> **答案：** ① **聚合裁剪**：多个微服务接口聚合成页面所需一份数据，减少客户端请求、避免暴露内部接口；② **鉴权会话**：统一处理登录态、Cookie、权限；③ **同构渲染**：同一层跑 SSR 直出首屏；④ **前后端解耦**：后端改接口时在 BFF 适配。是"前端靠近业务"的落地形态。

**追问 2：SSR 的主要代价是什么？什么时候退回 CSR？**
> **答案：** 代价：① **服务器压力**——每请求都渲染吃 CPU/内存，需缓存、限流、扩容；② **复杂度**——同构、水合、数据同步、mismatch 排查、部署运维更重；③ **缓存策略复杂**（页面级/接口级/CDN）。当页面无 SEO、强交互、流量极大而内容可静态化时，退回 CSR 或改 SSG/ISR 更划算。

---

### Q8. Express 和 Koa 的中间件模型有什么区别？NestJS 的设计理念是什么？

**标准答案：**
- **Express**：中间件 `(req, res, next)`，**线性顺序执行**，`next()` 交控制权（不调用则挂起）；错误中间件是 `(err, req, res, next)` 四参数。简单直观，但异步靠回调、异常处理分散。
- **Koa**：中间件 `async (ctx, next)`，**洋葱模型**（koa-compose）：`await next()` 前是请求阶段、后是响应阶段，形成"进→出"同心圆；天然 async/await，错误可用外层 try/catch 统一捕获，`ctx` 封装 req/res。

```js
// Koa 洋葱模型：输出 1 → 2 → 2-after → 1-after
app.use(async (ctx, next) => { console.log(1); await next(); console.log('1-after'); });
app.use(async (ctx, next) => { console.log(2); await next(); console.log('2-after'); });
```

- **NestJS**：基于 **TypeScript + 装饰器** 的企业级框架，理念借鉴 Angular——**模块化（Module）、依赖注入（DI）、Controller + Provider 分层**，大量运用 AOP（守卫 Guard、拦截器 Interceptor、管道 Pipe）。**底层可插拔**（默认 Express，可切 Fastify）。适合大型团队、需强结构与可测试性的项目。

**追问 1：洋葱模型相比 Express 线性模型的核心优势？**
> **答案：** ① `await next()` 前后都能写逻辑，天然实现"请求进入 + 响应后处理"（耗时统计、统一响应包装、错误捕获）；② 基于 async/await，异步流程更清晰；③ 外层 try/catch 能捕获下游抛错，统一错误处理更优雅。

**追问 2：NestJS 的依赖注入解决了什么问题？**
> **答案：** DI 把组件创建与依赖交给框架容器管理，而非类内部 `new`。好处：① **解耦**，依赖可替换（测试注入 mock）；② **可测试性**；③ 配合模块/装饰器实现清晰边界与生命周期（provider 单例）。这是它区别于 Express/Koa "轻量自由"的"重约定"路线。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题

> 案例驱动，识别"背题型"候选人——背八股的人能答原理，但答不好这里的落地与排障细节。

### Q9. 生产如何优雅关闭？cluster / PM2 是怎么回事？线上 CPU 打满 / 内存上涨 / 变慢怎么排查？

**标准答案：**
- **优雅关闭（Graceful Shutdown）**：收到 `SIGTERM`（K8s 滚动更新/停机）不能直接 `process.exit`，否则在途请求、未写完数据丢失。步骤：① 停止接收新连接（`server.close()` + 连接跟踪）；② 等在途请求完成（宽限期）；③ 关闭数据库连接池、消息队列、清定时器；④ 设**超时兜底**后退出。
- **cluster**：Node 内置模块，**master fork 多个 worker 共享同一端口**（默认 round-robin 分发），利用多核（弥补单进程 JS 只能跑一核），worker 崩了 master 可拉起。
- **PM2**：生产进程管理器——**守护/自动重启、cluster 模式负载均衡、日志集中、监控、`reload` 零停机重启**。
- **CPU 打满**：`node --cpu-prof` 或 `--prof`（`--prof-process` 解析）生成 profile，导入 Chrome DevTools / 火焰图看**热点函数**；常见根因是同步 CPU 密集代码、正则灾难性回溯、死循环、大对象 JSON 序列化。
- **内存持续上涨（疑似泄漏）**：`v8.writeHeapSnapshot()` 或 `--heapsnapshot-signal=SIGUSR2` 在两个时间点各抓一份堆快照，DevTools Memory 做 **comparison（对比 delta）**，沿 **retainer / dominator tree（支配树）** 找引用源。常见泄漏：全局/闭包持有、监听器未移除、缓存无限增长、定时器未清、大 Buffer 未释放。关注 RSS vs heap：RSS 涨而 heap 稳可能是**堆外内存**。
- **变慢但 CPU 不高**：多半在**等 I/O**——查下游接口、慢查询、连接池耗尽；用 APM/链路追踪（traceId 贯穿，正是 AsyncLocalStorage 的用武之地）定位瓶颈。

**追问 1：SSR 服务相比普通 API，内存泄漏更容易出现在哪？**
> **答案：** ① 组件/模块级缓存无上限堆积（按 URL 缓存渲染结果不设 LRU 上限）；② 请求创建的对象被全局/闭包意外持有；③ 渲染中事件监听、观察者未清理；④ 序列化大 HTML 的临时 Buffer 未及时回收。SSR 每请求都渲染，泄漏会被流量快速放大。

**追问 2：怎么防止单个慢请求拖垮整个 Node 服务？**
> **答案：** ① 外部调用设**超时 + 熔断**；② 用 **AbortController** 在客户端断开时取消下游请求；③ CPU 密集任务丢到 worker_threads / 独立服务；④ 限流 + 连接池上限做背压；⑤ 监控事件循环延迟（`perf_hooks.monitorEventLoopDelay`），飙升即告警。

**追问 3：worker_threads 和 cluster 有什么区别？**
> **答案：** `cluster` 是**进程级**，多个独立进程各跑一份事件循环、共享端口，用于横向扩展整个服务；`worker_threads` 是**线程级**，同进程内多线程可共享内存（SharedArrayBuffer），用于把**单个 CPU 密集任务**分拆并行。二者解决不同层次问题。

---

<a id="part-5"></a>

## Part 5：2026 新趋势：RSC / Edge SSR / 原生 TS

> 加分题，考察候选人的技术视野与学习敏锐度。细节以官方文档为准，避免编造 API/版本号。

### Q10. 谈谈 React Server Components、App Router、Edge SSR 和 Node 原生 TypeScript 的演进。

**标准答案：**
- **RSC（React Server Components）与 SSR 的关系**：RSC 是 React 的**组件级服务端范式**——Server Component 在服务端执行、**代码不进入客户端 bundle（零客户端 JS）**，结果可流式传输；与 SSR **互补而非替代**：SSR 解决"输出 HTML 首屏"，RSC 解决"哪些组件只在服务端跑、哪些进 bundle"。用 `'use client'` 标记交互组件。
- **Next.js App Router / Nuxt 4**：App Router 以 **RSC 为默认**，配合 `app/` 目录、layout、流式渲染 + Suspense、Server Actions；Nuxt 4（Vue 生态）强化 `app/` 目录、类型安全与数据获取层。共同方向是"框架默认服务端优先、按组件切分运行环境"。
- **Edge SSR**：把 SSR 从中心服务器搬到 **CDN 边缘节点**（Edge Runtime / Workers），靠近用户降低 TTFB；代价是运行时受限——Web 标准 API + V8 isolate，**不能用 Node 全部内置模块、不支持长连接/重计算**，适合轻量、延迟敏感页面。
- **Node 新 LTS**：遵循"偶数版本每年 10 月进 LTS"；近年活跃 LTS 大致是 **22.x 与 24.x 系列**（具体版本、代号、支持状态以 nodejs.org 官方发布为准）。能说出"偶数版本进 LTS、关注 Active LTS"即可，不必背死版本号。
- **Node 原生 TypeScript（类型剥离 type stripping）**：Node 从 **22.6 实验性引入**TS 支持，**22.18.0（2025-07）已默认开启**，并在 **v25.2.0 走向稳定**——不再是实验特性，可直接 `node file.ts` 运行。核心是**类型剥离（只擦除类型注解、不做类型检查）**。限制：**不等于 tsc 编译**——不做类型检查，`enum`、`namespace`、参数属性等有运行时语义的语法不受支持（需用 `--erasableSyntaxOnly` 规避或改写为 `as const` 对象）。答"仍是实验性、尚未默认"是过时说法。生产构建仍需 tsc 做完整类型检查。

**追问 1：RSC 会不会取代 SSR？**
> **答案：** 不会，二者解决不同问题且常一起用。RSC 减少客户端 JS、让组件在服务端流式产出；SSR 保证首屏完整 HTML 与 SEO。生产框架（如 App Router）往往是 **RSC + SSR + 流式渲染 + 水合** 的组合拳，而非二选一。

**追问 2：Edge SSR 的运行时限制会带来什么坑？**
> **答案：** 常见是"本地 Node 跑得好，部署 Edge 就报错"——因为用了 `fs`、长连接、Node 特有 API 或大型原生模块，而 Edge 只有 Web 标准 API。迁移要核查依赖的运行时兼容性，把重逻辑留在 Node 服务或后端 API。

---

<a id="part-6"></a>

## Part 6：能否用 Node+SSR 定级？如何定级？

### 结论先行

**可以，Node + SSR 是全栈岗位区分度很高的探针**——天然分层：会调 API → 懂运行时结构 → 懂事件循环/模块/Stream 机理 → 能讲清同构水合与异步上下文 → 有生产排障与架构选型经验。但它横跨"运行时 + 框架 + 前端渲染"，**对纯前端或纯后端候选人可能问不动**，要结合岗位：招前端转全栈重点问 SSR 与工程化，招后端转全栈重点问事件循环与服务端工程，强问不熟悉的一侧只会考察背诵。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 会用 Express/Koa 起服务、知道 CSR/SSR 之分；说不清事件循环阶段与水合 |
| **中级（L2）** | 2–5 年 | Part 2 | 知道 V8+libuv、事件循环 6 阶段、require 缓存、Stream/背压概念 |
| **中高级（L3）** | 5–8 年 | Part 3 | 讲清 microtask/nextTick 顺序、背压处理、SSR 同构水合与 mismatch、洋葱模型 |
| **高级（L4）** | 8 年+ | Part 4 | 有 AsyncLocalStorage 上下文传播实战、优雅关闭/多进程、线上 CPU/内存排障经验 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 理解 RSC/Edge SSR/原生 TS 的定位与取舍，能把 SSR 渲染策略放入整体架构选型 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"V8+libuv + 事件循环 + 同构水合"→ 至少 L2；只知道"Node 能起服务、SSR 是服务端渲染"→ 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追问"为什么"：
- 为什么 I/O 密集适合 Node、CPU 密集不适合？（主线程被占 vs 异步 I/O）
- 为什么 I/O 回调里 setImmediate 先于 setTimeout(0)？（阶段顺序）
- 为什么水合会 mismatch、如何规避？（确定性 + 浏览器 API 时机）
- 为什么上下文要用 AsyncLocalStorage 而非全局？（单线程并发隔离）

**第三步：三类信号防背题。**
1. **真实性**：能否讲出具体 SSR 上线事故或 Node 排障细节（"堆快照对比定位到缓存无限增长"、"mismatch 是渲染期用了 Date.now"、"SIGTERM 未处理导致滚动更新 5xx"）。能讲细节 > 教科书答案。
2. **抽象能力**：能否跨主题归纳——Node 上下文与 Java 体系统一为"**上下文传播**"（AsyncLocalStorage ≈ ScopedValue > ThreadLocal）、Stream/pipe/背压统一为"**流量整形**"、CSR/SSR/SSG/ISR 统一为"**渲染时机与成本的取舍光谱**"。
3. **权衡能力**：能否说清"什么场景不该用 SSR / 不该用 Node"——只会讲优点、讲不出边界的，通常停在 L2。

**第四步：按最深层级定级，不按正确率。** 结合岗位难度调整追问深度。

---

### 面试官避坑提醒

- **不要对所有人问到源码级**——libuv 源码、V8 微任务实现很深，很多优秀全栈工程师没背过但理解设计。区分"理解机制"和"背过源码"，前者更有价值。
- **把"SSR 排障 + 上下文传播实战"作为 L4 分水岭**：能讲清水合 mismatch 的真实排查、用 AsyncLocalStorage 落地全链路 trace 的人，一定是真用过。
- **结合岗位**：业务全栈问到 Part 3 足够；基础架构/前端基建团队才需要 Part 4 排障与 Part 5 演进视野。
- **2026 新趋势只作加分**：RSC/Edge SSR/原生 TS 细节以官方文档为准，抓住"互补关系与取舍"比背版本号更重要。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

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

*资料整理于 2026-11-19，参考 Node.js 官方文档（事件循环指南 / Stream / modules / async_hooks / cluster / 类型剥离说明）、libuv 设计文档、React RSC 与 Next.js App Router / Nuxt 官方文档、V8 堆快照与 Chrome DevTools 文档，以及 2026 年全栈面试趋势资料。涉及版本号与 API 细节以官方发布为准；题目与答案基于公开技术资料整理，用于面试评估参考。*
