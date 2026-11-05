---
title: 市场上的前端高频面试题（长参考答案 · 2025–2026）
date: 2026-11-06
summary: 汇总市面高频：事件循环、Fiber、Hooks 原理、React 18/19、RSC、Vite、缓存、TS 进阶、安全与 AI 协同；每题长答案 + 追问定级。
kind: qa
---

题目来源倾向近两年大厂/中大厂面经与公开题库的交集，不是押题，是**面试官选题池**。概念题配长答案；手写与场景见专题文。

- [手写题题库](/posts/react/handwritten-interview/)  
- [场景题题库](/posts/react/scenario-interview/)  
- [React 提纲](/posts/react/react-interview/) · [TS 提纲](/posts/typescript/typescript-interview/)

---

## A. JavaScript 基础（几乎必问）

### A1. 事件循环：宏任务 / 微任务（输出顺序）（初级～中级）

**主问：** 给一段含 `Promise`、`setTimeout`、`async/await` 的代码，问输出顺序。

**长参考答案：**

1. 同步代码先进调用栈执行。  
2. 微任务（`Promise.then`、`queueMicrotask`、`MutationObserver`；注意：`async` 在 await 之后的续体以微任务方式恢复）在当前宏任务结束后清空。  
3. 再取下一个宏任务（`setTimeout`、`setInterval`、I/O、部分 UI 任务）。  
4. `async` 函数在遇到 `await` 时：右侧表达式立刻求值；若是 Promise，后续代码等价注册微任务。

**追问：** `Promise.then` 里再 `setTimeout` 与再套 `Promise` 顺序？Node 和浏览器差在哪（答出「模型类似、阶段细节不同」即可）？

| 级别 | 信号 |
| --- | --- |
| 初 | 知道 Promise 先于 setTimeout |
| 中 | 能逐步推演嵌套 |
| 高 | 能联系渲染时机、长任务拆分 |

---

### A2. 闭包与内存泄漏（中级）

**主问：** 什么是闭包？闭包会怎样导致内存泄漏？

**长参考答案：** 闭包是函数保留外层词法环境。好处：封装、柯里化、Hooks 依赖。风险：长生命周期闭包引用大对象（全局事件、缓存 Map、脱离的 DOM）。排查：切断引用、弱引用、清理监听、Heap Snapshot。

**追问：** React 里哪种闭包最常见坑？（Effect / 事件里的过期状态）

---

### A3. `==` 与 `===`，以及 `[] == ![]`（初级）

**主问：** `==` 和 `===` 有什么区别？`[] == ![]` 为什么是 true？

**长参考答案：** `===` 不强制转换。`==` 走抽象相等。`![]` 为 `false`；`[] == false` 时两边会 ToPrimitive / ToNumber，最终 `0 == 0` 为 true。生产禁用怪比较，用 `===` / 显式转换。

---

## B. React 原理与生态（主战场）

### B1. Hooks 为什么不能写在条件里？useState 原理直觉（初级）

**主问：** Hooks 为什么不能写在条件或循环里？useState 大致是怎么工作的？

**长参考答案：**

React 用**调用顺序**把每次渲染的 Hook 和内部状态槽位对应起来（链表/数组）。条件/循环调用会错位，后面所有 Hook 对错状态。所以必须顶层无条件调用；ESLint `rules-of-hooks` 就是保这件事。

`useState`：首次渲染存初始值；更新时把新值写入对应槽位并调度再渲染；再渲染按同一顺序取出。

**追问：** 自定义 Hook 内部为何可以调多个 Hook？组件每次渲染 Hooks「卸载」了吗？

| 级别 | 信号 |
| --- | --- |
| 初 | 背出规则 |
| 中 | 能讲顺序与错位后果 |
| 高 | 能联系 dispatcher、严格模式双调用 |

---

### B2. Fiber 解决了什么？（中级）

**主问：** React 为什么要引入 Fiber？它解决了什么问题？

**长参考答案：** 旧协调偏递归，大更新长时间占主线程，交互卡顿。Fiber 把工作拆成可中断单元，可分片、可优先级调度（与并发特性配合），更好支撑增量渲染。业务侧直觉：**渲染应保持纯净**，因可能重复执行；副作用放 Commit 后（Effect）。

**追问：** Fiber 和 Virtual DOM 什么关系？和 Vue 的编译优化路径有何不同？

---

### B3. React 18 并发与 Automatic Batching（中级）

**主问：** React 18 的并发特性和自动批处理是什么？

**长参考答案：**

- **Automatic Batching：** 即使在 `setTimeout`、Promise、原生事件里，多次 `setState` 也常合并为一次渲染（相对 17 进步）。  
- **并发：** `startTransition` / `useDeferredValue` 标记非紧急更新，紧急更新（输入）可优先。  
- 其它：`useId`、`useSyncExternalStore`、`useInsertionEffect` 等。

**追问：** Transition 里丢更新吗？如何避免撕裂（tearing）？外部 store 为何用 `useSyncExternalStore`？

---

### B4. React 19 / RSC 市场新热点（高级）

**主问：** React 19 有哪些新特性？RSC（服务端组件）解决什么问题，边界在哪？

**长参考答案（面试够用版）：**

- **React 19：** Actions 相关（`useActionState` 等）、`useOptimistic`、`use()` 读 Promise/Context、`ref` 作 prop 渐成主流、文档元数据与资源 API 等。  
- **RSC：** 组件在服务端跑，不把该组件的 JS 打进客户端包；可直接访数据；与客户端组件有序列化边界。  
- **≠ SSR：** SSR 仍要出水合后的交互包；RSC 强调服务端组件树与更细的客户端边界。  
- **Compiler：** 自动记忆化方向，减少手写 memo 样板，但仍需理解依赖与纯度。

**定级：** 听说过名词 → 初；能讲清客户端边界与适用场景 → 中；有落地取舍（缓存、错误、鉴权）→ 高。

---

### B5. 虚拟 DOM Diff 与 key（初级～中级）

**主问：** 虚拟 DOM 的 diff 是怎么做的？为什么不建议用 index 作为 key？

**长参考答案：** Diff 同层比较；`key` 标识兄弟节点身份，利于复用状态正确的实例。`index` 作 key 在乱序/插入时易错位（输入框错乱）。key 稳定且在兄弟间唯一。

---

### B6. 状态管理怎么选（市场常问对比）（中高级）

**主问：** 状态管理方案怎么选？服务端状态和客户端状态要不要分开？

**长参考答案：**

| 类型 | 代表 | 适合 |
| --- | --- | --- |
| 服务端状态 | TanStack Query / SWR | 请求缓存、重试、失效 |
| 客户端全局 | Zustand / Jotai / Redux Toolkit | UI 全局、复杂更新规则（Redux） |
| 局部 | useState / useReducer | 组件内 |

反模式：接口数据双写进 Redux + Query；巨型 Context 无拆分。

---

## C. 工程化与性能

### C1. Vite 开发为什么快？（中级）

**主问：** Vite 开发环境为什么比 Webpack 快？

**长参考答案：** 开发态用原生 ESM，按需编译；依赖预构建（esbuild）成 dev 友好产物；与 Webpack「整包」心智不同。**生产**仍打包（Rollup 等），「开发快」≠「生产一定更快」，生产看拆包与优化配置。

**追问：** Loader vs Plugin？冷启动与热更新路径？

---

### C2. 强缓存与协商缓存（初级～中级）

**主问：** 强缓存和协商缓存有什么区别？分别用哪些响应头？

**长参考答案：**

- 强缓存：`Cache-Control` / `Expires`，命中不上服务器（或仅本地判断）。  
- 协商：`ETag` / `Last-Modified`，发请求由服务器 304 或 200。  
- 前端构建：文件名 hash → 长强缓存；`index.html` 常协商或不缓存。

---

### C3. Core Web Vitals（中高级）

**主问：** Core Web Vitals 是哪几个指标？分别怎么优化？

**长参考答案：** LCP（最大内容绘制）、INP（交互到下一次绘制，替代 FID 成为主交互指标）、CLS（布局偏移）。优化要对症：LCP 看资源与服务端；INP 看长任务与主线程；CLS 看尺寸预留与字体。

**追问：** 你怎么在项目里量？实验室指标 vs 真实用户 RUM？

---

### C4. Monorepo（高级）

**主问：** Monorepo 解决什么问题？有哪些工具和常见痛点？

**长参考答案：** 多包一仓，共享工具链与类型。工具：pnpm workspace、Turborepo、Nx。痛点：构建图、版本、CI 缓存。适合设计系统 + 多应用；小团队单仓单应用不必硬上。

---

## D. TypeScript（市场高频）

### D1. 泛型 / 条件类型 / 映射类型（中级）

**主问：** 讲讲泛型、条件类型和映射类型，各举一个例子。

**长参考答案：** 泛型参数化类型；条件 `T extends U ? X : Y`，联合会上**分布式**；映射 `[K in keyof T]` 批量变属性。`infer` 抽取。工具类型多是这三者组合。

**追问：** `Exclude` 为何对联合逐个算？`never` 在分发里扮演什么？

---

### D2. 类型守卫（中级）

**主问：** 什么是类型守卫？`JSON.parse` 的结果怎么安全地变成业务类型？

**长参考答案：** 运行时检查 + `value is Foo` 谓词，使控制流收窄。`JSON.parse` 结果是 `any`，应 zod 等校验再进业务类型——**TS 不替代运行时校验**。

---

### D3. `satisfies`、`as const`（中级）

**主问：** `satisfies` 和 `as const` 分别解决什么问题？

**长参考答案：** `as const` 推成最窄字面量；`satisfies` 既检查符合某类型又保留更具体推断。适合配置对象、路由表。

---

## E. 网络与安全（前端岗常问）

### E1. 跨域 CORS（初级）

**主问：** 什么是跨域？CORS 是怎么工作的？简单请求和预检请求有什么区别？

**长参考答案：** 浏览器同源策略；简单/预检请求；服务器 `Access-Control-Allow-*`。前端常见：开发代理、网关同源、JSONP（过时）。带 Cookie 要 `credentials` + 精确 Origin。

### E2. XSS / CSRF（初级～中级）

**主问：** XSS 和 CSRF 分别是什么？怎么防？

**长参考答案：** XSS：注入脚本，防转义、CSP、避免 `dangerouslySetInnerHTML` 不消毒。CSRF：借用户 Cookie 伪造请求，防 SameSite、CSRF Token、关键操作再认证。Token 放 LocalStorage 偏 XSS 面；Cookie 要注意 CSRF。

### E3. HTTP/1.1 vs 2 vs 3（简述）（中级）

**主问：** HTTP/1.1、HTTP/2、HTTP/3 的主要区别是什么？

**长参考答案：** H1 队头阻塞、多连接；H2 多路复用+头部压缩，仍受 TCP 阻塞；H3 基于 QUIC/UDP，减连接迁移与队头问题。前端优化仍要减请求、缓存、CDN。

---

## F. 市场题单速查（按级别组卷）

### 初级场（约 45 分钟）

1. 事件循环简题  
2. Hooks 规则 + 受控组件  
3. 防抖手写（主路径）  
4. CORS / XSS 各一句  
5. [场景：搜索列表](/posts/react/scenario-interview/) 简化版  

### 中级场

1. Fiber + 批处理  
2. Effect 竞态 / 闭包  
3. 深拷贝或 Promise.all  
4. Query vs 全局状态  
5. 场景：鉴权 或 列表性能  
6. TS：可辨识联合 + keyof  

### 高级场

1. 并发 / RSC 边界与取舍  
2. 性能预算与 CWV  
3. 状态分层规范  
4. 场景：监控体系 或 微前端  
5. TS 规范与运行时契约  
6. AI 协同质量保障  

---

## G. 面试官备注：市面上的「过时题」少问

除非候选人简历深挖，否则少花时间在：类组件生命周期背诵、Mixin、老式 Redux 样板、仅 Webpack1 配置、Iframe 跨域奇技。把时间留给 **Hooks 深度、服务端状态、工程化、性能指标、TS 建模、React 18/19 现实落地**。
