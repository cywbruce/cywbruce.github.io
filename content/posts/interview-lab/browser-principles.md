---
title: "浏览器原理与前端性能面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "渲染流水线、事件循环、重排重绘、缓存与核心网页指标。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **浏览器渲染机制与前端性能** 的真实深度"问出来"。
> 核心原则：**浏览器题最终都会落到"多进程架构 → 渲染流水线 → 事件循环 → 缓存 → 可量化性能"这条主线**。只会调 API、背"重排重绘"定义，却讲不清一次点击为何卡顿的人，基本停留在记忆层。
> 配套：本题库与《计算机网络-面试题库》互补——网络题聚焦 TCP/HTTP 协议原理，本题聚焦浏览器侧渲染、执行与性能，避免重复。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题（架构与重排重绘）](#part-1)
- [Part 2：底层原理题（渲染流水线、合成、事件循环、缓存）](#part-2)
- [Part 3：核心区分度题（题眼，定级主战场）](#part-3)
- [Part 4：实战与陷阱题（性能指标、调优、安全）](#part-4)
- [Part 5：2026 新趋势（INP、View Transitions、Speculation Rules）](#part-5)
- [Part 6：能否用它定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对浏览器工作原理与前端性能优化的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> 现代浏览器是**多进程架构**——浏览器进程统筹 UI，每个标签页有独立的**渲染进程**（含主线程、合成线程等），还有 GPU 进程、网络进程；**站点隔离**让不同站点跑在独立进程里，兼顾安全与稳定。
>
> 页面呈现走一条**渲染流水线**：解析 HTML/CSS → DOM/CSSOM → Render Tree → Layout → Paint → **Composite** 上屏；改几何属性会**重排**，只改外观会**重绘**，而 transform/opacity 可只在合成层由 GPU 处理。
>
> JS 执行靠**事件循环**协调：同步任务入调用栈，回调分宏/微任务，每轮宏任务后清空微任务，渲染前执行 requestAnimationFrame。
>
> 性能上，**缓存**分强缓存（Cache-Control）与协商缓存（ETag/Last-Modified），配合 Service Worker、内存/磁盘缓存减少网络；V8 用**解释执行 + JIT**、隐藏类与内联缓存加速。
>
> 体验看 **Core Web Vitals**：LCP（加载）、INP（交互，已取代 FID）、CLS（视觉稳定），优化围绕拆长任务、减少重排、预加载与图片优化展开。

**评分要点：** 多进程 / 渲染流水线 / 事件循环 / 缓存 / Core Web Vitals 五点对应入门到高级。能讲清"重排重绘区别 + 微任务时序"的直接往 Part 2/3 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题（架构与重排重绘）

### Q1. 浏览器有哪些主要进程与线程？多进程架构的优缺点？什么是站点隔离？

**标准答案：**
- **浏览器进程**：地址栏、书签、前进后退、子进程管理；**渲染进程**：每标签页一个，含**主线程**（DOM/样式/布局/JS/事件）、**合成线程**、光栅线程、IO 线程；**GPU 进程**：GPU 命令与合成；**网络进程**：请求与缓存。
- **优点**：故障隔离（一页崩溃不影响其他）、安全隔离（沙箱）、利用多核；**缺点**：**内存开销大**（每进程独占基础内存）、进程间通信成本。
- **站点隔离**：让**不同站点**（含跨站 iframe）运行在不同渲染进程，防止同进程内互相读内存，主要防御 **Spectre** 侧信道攻击。

**追问 1：渲染进程里主线程与合成线程如何分工？**
> **答案：** 主线程负责解析、执行 JS、样式计算、Layout、Paint 和事件分发；合成线程负责图层光栅化后交 GPU 合成。**合成线程可在主线程被 JS 阻塞时继续处理滚动合成**（合成器滚动不卡的原因），但 JS 在主线程，长任务仍会让交互卡顿。

**追问 2：既然内存开销大，为何不退回单进程？**
> **答案：** 现代网页复杂且不可信，稳定性与安全性收益远大于内存成本；优化方向是**按站点复用/合并进程**缓解内存，而非退回单进程。

---

### Q2. 什么是重排（reflow）与重绘（repaint）？何时触发？Render Tree 与 DOM 有何不同？

**标准答案：**
- **重排**：元素**几何属性**（尺寸/位置/结构）变化，重新计算布局。触发：增删/移动 DOM、改 width/height/padding/font-size/position、窗口 resize、字体加载、**读取** `offsetWidth`/`scrollTop`/`getBoundingClientRect()`（强制同步布局）。
- **重绘**：只改**外观**（color/background-color/box-shadow/visibility），重新绘制像素，不重算布局。
- 关系：**重排一定重绘，重绘不一定重排**；重排成本远高于重绘。
- **Render Tree**：DOM + CSSOM 合成，只含**可见节点**及其计算样式，是 DOM 的可见子集。

**追问 1：`display:none` 与 `visibility:hidden` 区别？`<script>` 为何阻塞解析，defer/async 区别？**
> **答案：** `display:none` **不进入 Render Tree**、不占位；`visibility:hidden` **进入**、占位但不可见，改回只重绘不重排。`<script>` 可能改 DOM/CSSOM，故暂停解析先执行；`defer` 异步下载、HTML 解析完后按顺序执行，`async` 下载完立即执行、不保证顺序。

**追问 2：什么是"强制同步布局"（layout thrashing）？如何避免？**
> **答案：** 循环中交替"写样式 → 读几何属性"，读操作迫使浏览器立即重排以返回准确值，引发反复重排。避免：**读写分离**（先批量读、再批量写）、缓存几何值、用 rAF 集中处理、用 transform 代替布局属性动画。

---

<a id="part-2"></a>

## Part 2：底层原理题（渲染流水线、合成、事件循环、缓存）

> "会调 API"与"懂浏览器内核"的分水岭，L2→L3 的关键。

### Q3. 详细讲从 DOM 到像素的渲染流水线及每层产物。

**标准答案：**（能完整讲下来基本 L3）

```
HTML/CSS 源码 → Parse → DOM Tree + CSSOM
   ├─ Style Calculation → Render Tree（可见节点+计算样式）
   ├─ Layout（重排：算几何）→ Layout Tree
   ├─ Layerize（分层）→ Layer Tree（图层树）
   ├─ Paint（生成绘制指令）→ Display List
   └─ Raster（光栅化，可 GPU 加速）→ Composite（GPU 合成）→ 屏幕像素
```

- **Style Calculation**：DOM/CSSOM 匹配，算每节点最终样式；**Layout**：从根计算几何；**Layerize**：按层叠上下文、`will-change`、3D transform 分层；**Paint**：生成绘制指令；**Raster + Composite**：图层位图化并由 GPU 合成上屏。

**追问 1：为什么要分层？越多越好吗？Paint 和 Raster 有何区别？**
> **答案：** 分层让独立变化区域**不必整体重绘**，便于 GPU 并行合成；但图层过多会**显存上涨、纹理上传与合成开销增大**（层爆炸）。Paint 是**生成绘制指令**（主线程），Raster 是**把指令转成像素位图**（可由合成/光栅线程或 GPU 完成，不阻塞主线程）。

---

### Q4. 为什么 transform / opacity 不触发重排重绘？什么是图层提升与"层爆炸"？

**标准答案：**
- 元素被提升到**独立合成层**后，改 `transform`/`opacity` 只改变图层的**合成变换参数**，不涉及布局与绘制，由合成线程/GPU 直接重合成，故不触发重排重绘——这类属性称"**只影响合成的属性**"。
- 对比：`left`/`width` 触发 Layout，`background-color` 触发 Paint。
- **图层提升方式**：`transform: translateZ(0)`、`will-change: transform/opacity`、3D transform、`position:fixed`、`<video>`、`<canvas>` 及层叠上下文隐式提升。
- **层爆炸**：过度提升致图层激增，**显存与合成管理成本反超收益**，内存上涨、掉帧；应精准提升、动画结束即移除。

**追问 1：`will-change` 为何不能滥用、要"用完即弃"？GPU 加速一定更快吗？**
> **答案：** `will-change` 会让浏览器**提前建层并常驻**，长期挂大量元素持续占显存，动画结束应移除。GPU 加速适合大规模像素/合成运算，但小元素、简单动画收益有限，CPU→GPU 传输也有成本，需实测。

---

### Q5. 讲清浏览器事件循环完整流程，Promise.then 与 setTimeout 顺序，及 Node 与浏览器的差异。

**标准答案：**（题眼，定级重点）
- **调用栈**执行同步代码；异步回调入**宏任务队列**（script、setTimeout、I/O、UI 事件）或**微任务队列**（Promise.then/catch/finally、MutationObserver、queueMicrotask）。

**一轮循环（tick）：**
1. 从宏任务队列取**一个**执行（整段 `<script>` 即第一个宏任务）；
2. 产生的微任务入微任务队列，宏任务入宏任务队列；
3. 当前宏任务结束，**清空微任务队列**（微任务中新产生的微任务也在本轮执行完）；
4. 判断渲染：执行 **rAF 回调** → Layout → Paint → Composite；
5. 取下一个宏任务。

**顺序结论**：同轮内 **Promise.then（微）先于 setTimeout（宏）**。

```js
console.log('1');                                  // 同步
setTimeout(() => console.log('4'), 0);            // 宏 → 下一轮
Promise.resolve().then(() => console.log('3'));   // 微 → 本轮清空
console.log('2');                                  // 同步 → 输出 1 2 3 4
```

**Node 差异（简要）**：基于 libuv 的**阶段**（timers → pending callbacks → poll → check → close callbacks）；`setImmediate` 在 check 阶段，`process.nextTick` 优先级**高于微任务**；Node 11+ 微任务时机已与浏览器趋同。

**追问 1：微任务里不断套微任务会怎样？**
> **答案：** 微任务必须**本轮全部清空**，若递归产生微任务会**阻塞宏任务与渲染**，页面卡死——这是微任务高优先级的代价。

**追问 2：为何 `process.nextTick` 可能造成 Node I/O 饥饿？**
> **答案：** 它在阶段之间**全部清空**，递归调用会无限占用事件循环，I/O 回调永不执行；应把重计算放到 `setImmediate`。

---

### Q6. 强缓存与协商缓存是什么？缓存位置有哪些？用户行为如何影响缓存？

**标准答案：**
- **强缓存**：不发请求直接用本地。`Cache-Control`（HTTP/1.1，优先）：`max-age`、`no-cache`（走协商）、`no-store`、`public/private`；`Expires`（HTTP/1.0，绝对时间，已被取代）。
- **协商缓存**：带条件头问服务器，未变返回 **304 Not Modified**。`ETag`/`If-None-Match`（精度高）优先级高于 `Last-Modified`/`If-Modified-Since`（秒级）。

| 缓存位置（查找优先级） | 特点 |
|---------|------|
| **Service Worker** | 开发者可控，可离线、精细策略，最高优先级 |
| **Memory Cache** | 内存，最快，进程结束失效，缓存小资源/当前页 |
| **Disk Cache** | 磁盘，持久、容量大，读取稍慢 |
| **Push Cache** | HTTP/2 推送，生命周期短 |
| 网络请求 | 以上未命中才发起 |

**追问 1：`from memory cache` 与 `from disk cache` 区别？**
> **答案：** 前者从内存读、**最快但关闭标签即失效**；后者从磁盘读、**持久但稍慢**。同会话刷新多命中内存，重开浏览器/新标签多命中磁盘。

**追问 2：F5、Ctrl+F5、地址栏回车的缓存行为？**
> **答案：** 地址栏回车/新开页面：**强缓存有效**；F5：强缓存失效（带 `max-age=0`）、**协商缓存仍生效**，可能 304；Ctrl+F5：强/协商缓存**都失效**（`no-cache` 且不发条件头），返回 200 全量；前进后退多从 bfcache/内存缓存恢复。

---

<a id="part-3"></a>

## Part 3：核心区分度题（题眼，定级主战场）

> 全题的题眼——rAF 时序、V8 与 GC 直接决定 L3 还是 L4/L5。

### Q7. MutationObserver、requestAnimationFrame、async/await 在事件循环里的时机？

**标准答案：**
- **MutationObserver**：监听 DOM 变化的**微任务**，DOM 变动后、渲染前**批量异步触发**（回调为变动记录数组），避免同步监听的性能问题。
- **rAF**：**每次渲染前**执行，与刷新率同步（60Hz≈16.7ms/帧）；后台标签**自动暂停**，适合逐帧动画。
- **async/await**：`await` 后表达式**同步执行**，`await` 把后续代码包装成 **Promise.then 微任务**让出执行权，故其后代码在本轮微任务阶段恢复。

```js
async function f() { console.log('A'); await 0; console.log('B'); } f(); console.log('C'); // A → C → B
```

**追问：rAF 与 setTimeout(fn,16) 做动画哪个更稳？`queueMicrotask` 与 Promise.then 有区别吗？**
> **答案：** rAF 更稳——setTimeout 延迟不精确（受事件循环拥堵影响），易与刷新率不同步致掉帧；rAF 对齐绘制节奏且后台暂停。两者都是微任务、时机一致；`queueMicrotask` 更轻量、语义直接，Promise.then 会创建 Promise 对象有额外开销。

---

### Q8. 长任务（Long Task）为何卡顿？如何排查与拆解？

**标准答案：**
- **长任务**：主线程执行超 **50ms** 的任务，独占主线程，使微任务、用户回调、rAF、Layout/Paint 全部推迟，表现为**点击无响应、掉帧、卡住**。
- 与流水线关联：JS 卡在"执行"阶段，渲染流水线拿不到主线程就无法产新帧。
- **排查**：DevTools **Performance 火焰图**定位耗时函数；**PerformanceObserver** 监听 `longtask` 上报；Lighthouse 的 **TBT** 量化阻塞。
- **拆解**：切块后用 `setTimeout(0)`/`queueMicrotask`/`scheduler.yield()` **让出主线程**；纯计算移入 **Web Worker**；高频事件**防抖/节流**；虚拟列表减 DOM。

**追问：INP 与长任务是何关系？**
> **答案：** INP 衡量"交互到下一帧绘制"的延迟，长任务是其变差的**主因**——交互回调被阻塞，输入延迟与处理时间变长；优化 INP 核心就是拆长任务、减主线程工作。

---

### Q9. V8 如何执行 JS？解释执行、JIT、隐藏类、内联缓存各解决什么问题？

**标准答案：**
- **解析→字节码→执行**：Parser 生成 AST，**Ignition 解释器**编译为字节码执行。
- **JIT**：运行时统计热点，由 **TurboFan** 编译成机器码加速；假设失效则 **deopt** 退回字节码。"解释执行 + JIT"兼顾启动与峰值性能。
- **隐藏类（Hidden Class/Map）**：记录对象**属性布局（形状）**，形状相同者共享，属性可按固定偏移定位；**动态增删属性会改变隐藏类**拖慢访问。
- **内联缓存（IC）**：缓存"隐藏类 → 属性位置"结果供下次直接命中；调用点分**单态（最快）→ 多态 → 巨态（最慢）**。

**追问 1：如何"迎合"隐藏类与 IC？为何不全编译机器码？**
> **答案：** 构造函数里**按固定顺序一次性声明所有属性**，不事后 `delete`/新增，同类对象属性与顺序一致，保持单态。不全量编译是因机器码**启动慢、耗内存**；解释器立即执行 + JIT 只编热点，是启动与效率的最优折中。

---

### Q10. V8 垃圾回收机制？常见内存泄漏与排查？

**标准答案：**
- **分代回收**：**新生代**存活短，用 **Scavenge（复制算法，From/To 半区）**；**老生代**存活久，用**标记-清除 + 标记-整理**，配合**增量/并发标记**减少 STW 停顿。
- **常见泄漏**：① 意外全局变量；② 未清理的 `setInterval`；③ 未移除的事件监听；④ 闭包持有大对象/DOM；⑤ 已移除 DOM 仍被 JS 引用（**游离 DOM**）。
- **排查**：DevTools **Memory 面板**拍 Heap Snapshot 并**对比**看增长，用 **Retainers 保留树**找引用链；**Allocation timeline** 定位分配点；Performance Monitor 看 JS Heap 是否持续上升不回落。

**追问 1：有闭包就一定泄漏吗？如何避免监听器泄漏？**
> **答案：** 不是。闭包会**延长引用变量生命周期**，只有"被长期持有 + 引用大对象"才泄漏。避免：销毁时 `removeEventListener`、用 `AbortController.signal` 统一注销、优先事件委托、不用匿名函数注册。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题（性能指标、调优、安全）

### Q11. 什么是 Core Web Vitals？LCP/INP/CLS 衡量什么、达标线、如何优化？

**标准答案：** 以真实体验为中心，取**字段数据（CrUX/RUM）第 75 百分位**评估：

| 指标 | 含义 | Good 线 | 优化方向 |
|------|------|--------|---------|
| **LCP** | 最大内容元素渲染完成时间 | ≤ 2.5s | 优化 TTFB、preload 关键资源、WebP/AVIF + 响应式、内联关键 CSS、去阻塞 JS |
| **INP** | 交互到下一帧绘制延迟（取较高分位） | ≤ 200ms | 拆长任务、减 JS、yield、缩小 DOM 更新、防抖 |
| **CLS** | 累积意外布局偏移 | ≤ 0.1 | 图片/广告位预留尺寸、字体 font-display + size-adjust、不向顶部动态插入、用 transform 动画 |

- **INP 已于 2024-03-12 取代 FID**（见 Part 5）；辅助指标：TTFB、FCP、TBT、Speed Index。

**追问 1：实验室数据（Lighthouse）与字段数据（CrUX/RUM）区别？CLS 隐蔽成因？**
> **答案：** Lighthouse 是**实验室数据**（固定环境、可复现、便于定位）；CrUX/RUM 是**字段数据**（真实用户分布，CWV 达标以此为准）。二者互补。CLS 成因：无尺寸图片/视频、字体加载回流（FOUT）、异步 banner/广告、顶部插入内容——对策为预留尺寸、`aspect-ratio`、字体回退度量匹配。

---

### Q12. 首屏优化有哪些手段？如何用 Performance API / Lighthouse / RUM 建监控闭环？

**标准答案：**
- **传输**：CDN、HTTP/2/3、Gzip/Brotli、`preconnect`、DNS 预解析。
- **资源**：`preload` 关键资源、懒加载 + WebP/AVIF + `srcset`、代码分割/按需加载、Tree Shaking。
- **渲染**：关键 CSS 内联、JS `defer/async`、SSR/SSG、骨架屏、减少重排；**缓存**：强/协商缓存 + Service Worker。
- **监控**：**Performance API**（`getEntriesByType('navigation')` 看各阶段；`PerformanceObserver` 监听 `longtask`、`largest-contentful-paint`、`layout-shift`）；**Lighthouse** 本地/CI 跑分给建议；**RUM**（`web-vitals.js` 采集 LCP/INP/CLS 上报，按分位数分析）。

**追问：首屏白屏长，按什么顺序排查？**
> **答案：** ① Network 看 TTFB（服务器/CDN）；② 关键资源 waterfall（JS/CSS 是否阻塞、串行）；③ Coverage（无用 JS/CSS 占比）；④ Performance 火焰图（长任务、强制同步布局）；⑤ 是否缺 SSR/骨架屏导致内容需等 JS 执行才出现。

---

### Q13. XSS、CSRF 原理与防御？CSP、同源策略、CORS、点击劫持各解决什么？

**标准答案：**
- **XSS**：恶意脚本注入执行（存储/反射/DOM 型）。防御：输入校验 + **输出编码转义**、`textContent` 代替 `innerHTML`、**HttpOnly Cookie**、**CSP**、框架默认转义。
- **CSRF**：诱导已登录用户跨站发请求，利用 Cookie 自动携带。防御：**CSRF Token**、**SameSite Cookie**、校验 Origin/Referer、不用 GET 改状态、二次确认。
- **CSP**：HTTP 头限制可加载资源源与脚本执行，是防 XSS 的纵深防御，支持违规上报。
- **同源策略**：协议+域名+端口三者相同才同源，限制跨源 DOM/Cookie/存储/XHR，是安全基石。
- **CORS**：同源策略的"受控放宽"，服务端 `Access-Control-Allow-Origin/Methods/Headers/Credentials` 放行；带凭证不能为 `*`；非简单请求先发 **OPTIONS 预检**。
- **点击劫持**：透明 iframe 覆盖诱导点击，防御 `X-Frame-Options` 或 CSP `frame-ancestors`。

**追问 1：CSP 能完全阻止 XSS 吗？token 防 CSRF 为何不放 Cookie？**
> **答案：** 不能替代输出编码，但通过限制脚本源、禁 `unsafe-inline`/`eval` 显著降低危害，是纵深防御一层。CSRF Token 放**参数或自定义头**，跨站攻击者受同源策略限制读不到；放 Cookie 会自动携带而失效（SameSite Cookie 另论）。

---

<a id="part-5"></a>

## Part 5：2026 新趋势（加分题）

> 考察技术视野，细节以官方发布为准。

### Q14. INP 取代 FID 的细节？对前端监控的影响？

**标准答案：**
- **时间线**：2022 年 INP 作为实验指标；**2024-03-12 正式成为 Core Web Vitals 响应性指标，取代 FID**；Chrome 工具中 FID 逐步弃用（约 2024-09 从 CrUX/PSI 等 API 移除）。
- **原因**：FID 只测**首次输入延迟**，不覆盖后续交互与**处理时间 + 下一帧绘制**；INP 观测会话中**几乎所有交互**并取较高分位，更全面。
- **影响**：RUM 从 FID 迁到 INP（如 `web-vitals.js` 的 `onINP`）；优化重点从"缩短首次输入延迟"转向"**减少长任务、缩小渲染更新**"的全局响应性治理。

**追问：INP 的 good 阈值？如何统计？**
> **答案：** ≤ 200ms 为 good，按**字段数据第 75 百分位**评估；INP 取交互中较高值（大样本约 p98），偶发严重卡顿也会拉高分。

---

### Q15. 谈谈 View Transitions API 与 Speculation Rules API 对前端的意义。

**标准答案：**（保守表述，注意支持差异）
- **View Transitions API**：让页面切换有**原生过渡动画**。同文档用 `document.startViewTransition()`；跨文档用 CSS `@view-transition { navigation: auto; }` + `view-transition-name`，目标让 **MPA 也有 SPA 般顺滑切换**、减少为动画引入的 JS 框架。支持度需谨慎：同文档过渡已成 Baseline，**跨文档在 Chromium 系（Chrome/Edge 126+）、较新 Safari 可用，Firefox 仍在推进**，以 caniuse/MDN 当前状态为准。
- **Speculation Rules API**：用 `<script type="speculationrules">` 的 JSON 规则声明**预取（prefetch）/预渲染（prerender）**后续页面，点击近乎瞬时，改善 LCP/INP；用 `eagerness` 控制触发时机。
  - 注意：目前**主要是 Chromium 系支持**；预渲染**会执行脚本**，需用 `document.prerendering`/`prerenderingchange` 避免重复埋点；排除有副作用 URL（退出登录/加购）；Save-Data/省电/低内存时浏览器会禁用。

**追问：这些 API 会带来性能"反噬"吗？**
> **答案：** 会。预渲染消耗**额外内存与带宽**，过度预渲染浪费资源甚至拖慢当前页。应只对高概率目标、用 `moderate` 等温和策略启用，并配合 Chrome 并发限制（FIFO 队列）。

---

<a id="part-6"></a>

## Part 6：能否用它定级？如何定级？

### 结论先行

**可以，浏览器与前端性能题区分度很高**——天然分层：知道重排重绘/微任务 → 懂渲染流水线 → 讲清事件循环时序与 V8/GC → 做性能指标监控与调优 → 跟进新 Web API。但知识点广，**对初级易"背八股"**：招初中级问到 Part 1/2 即可，强问 V8/合成层细节只会考背诵。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 知道多进程、重排重绘、缓存名词；说不清流水线与事件循环 |
| **中级（L2）** | 2–5 年 | Part 2 | 讲清渲染流水线、合成层、微任务先于宏任务、缓存位置与用户行为 |
| **中高级（L3）** | 5–8 年 | Part 3 | 讲清 rAF/MutationObserver/async 时序、V8 执行与隐藏类、GC 与泄漏排查 |
| **高级（L4）** | 8 年+ | Part 4 | 掌握 CWV 优化、长任务排查、内存泄漏实战、XSS/CSRF 体系化防御 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 理解 INP 演进与 View Transitions/Speculation Rules 取舍，能把性能纳入工程体系 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"多进程 + 渲染流水线 + 事件循环 + 缓存 + CWV"→ 至少 L2；只背名词 → 从 Part 1 问起。

**第二步：沿追问链下探，重点追问"为什么"：**
- 为什么 transform/opacity 不重排？（合成层只改变换参数）
- 为什么微任务要本轮清空？（语义连续性，代价是可能饿死渲染）
- 为什么 INP 取代 FID？（覆盖全流程交互而非仅首次输入）
- 为什么预渲染不是越多越好？（内存/带宽反噬）

**第三步：三类信号防背题。**
1. **真实性**：能否讲真实调优/排障经历（"火焰图定位到强制同步布局" / "Heap Snapshot 发现游离 DOM" / "LCP 从 4s 优化到 2s"）。
2. **抽象能力**：能否统一为主线——**架构决定渲染方式，渲染流水线决定瓶颈，事件循环决定响应性，缓存与指标决定优化闭环**。
3. **权衡能力**：能否讲清"什么场景不该用"——不是所有动画都该 GPU 加速、不是所有页面都该预渲染。

**第四步：按最深层级定级，不按正确率。** 结合岗位调深度（业务前端问到 Part 3/4 足够；性能/架构团队才需 Part 4 全线 + Part 5）。

---

### 面试官避坑提醒

- **不要对所有人问到 V8/合成层源码级**——区分"理解设计"与"背过名词"。
- **把"能讲出真实性能数字与排查过程"作为 L4 分水岭**：只背 CWV 定义、说不出一次真实优化的压到 L3。
- **注意与网络题的边界**：TCP 握手、TLS、HTTP 版本差异放网络题库问，本题聚焦渲染/执行/性能。
- **2026 新趋势保守追问**：浏览器支持度变化快，考察"是否关注演进"即可，不纠结实验 API 细节。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

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

---

*资料整理于 2026-11-19，参考 Chrome 开发者文档（web.dev / developer.chrome.com）、MDN Web Docs、Google Core Web Vitals 官方说明（INP 于 2024-03-12 取代 FID）、V8 官方博客、web-vitals.js 文档及 2026 年前端面试趋势资料。View Transitions / Speculation Rules 等新 API 的浏览器支持以 caniuse/MDN 当前状态为准；题目与答案基于公开技术资料整理，用于面试评估参考。*
