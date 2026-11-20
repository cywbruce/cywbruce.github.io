---
title: "React 面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "Fiber 与调度、Hooks 原理、diff/key、并发/RSC/React Compiler。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **React 设计理念、Fiber 内核、Hooks 原理与工程实战** 的真实深度"问出来"。
> 核心原则：**每道题最终都落到"UI = f(state) 主线 + 状态变化如何驱动重新渲染"**。只会写 JSX、调 Hooks 却讲不清"为什么不能直接改 state""为什么 Hooks 不能放进 if"的人，基本停留在 API 记忆层。
> 配套：与前端技术栈其它题库共同构成"前端面试定级体系"，与 Java 体系共用同一套 L1–L5 标尺。

---

## 目录

- [Part 0：30 秒标准总答](#part-0)
- [Part 1：基础认知题（理念 / JSX / 虚拟 DOM）](#part-1)
- [Part 2：底层原理题（Fiber 与调度）](#part-2)
- [Part 3：核心区分度题（Hooks 与 diff，题眼）](#part-3)
- [Part 4：状态管理、性能与实战陷阱](#part-4)
- [Part 5：2026 新趋势：React 19 与并发普及](#part-5)
- [Part 6：能否用 React 定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 React 的理解。**

**标准答法（30 秒，五个得分点）：**

> ① React 是构建 UI 的 JS 库，核心公式 **UI = f(state)**——状态决定界面，状态变了自动重渲染，开发者只描述"结果长什么样"，不手动操作 DOM。
> ② 三大理念：**声明式 UI**、**组件化**（拆成函数组件再组合）、**单向数据流**（数据经 props 向下传，子改数据靠回调）。
> ③ 为高效更新，中间加一层 **虚拟 DOM**：先算出新树，再 **diff** 出最小差异批量更新真实 DOM，也是跨端（React Native）的基础。
> ④ React 16 引入 **Fiber 架构**，把渲染改造成**可中断、可分片、有优先级**的过程，配合时间切片让大更新不阻塞交互。
> ⑤ **Hooks** 让函数组件也能拥有状态和副作用，自定义 Hook 复用状态逻辑，是当今主流写法。

**评分要点：** 声明式 / UI=f(state) / 组件化+单向数据流 / 虚拟 DOM / Fiber 并发 / Hooks。能说出"状态驱动渲染"主线的直接进 Part 2。

---

<a id="part-1"></a>

## Part 1：基础认知题（理念 / JSX / 虚拟 DOM）

### Q1. 为什么说 React 是声明式的？"UI = f(state)" 意味着什么？

**标准答案：** ① **声明式 vs 命令式**：命令式要一步步写"找节点、改 class、插子元素"，声明式只写"state 是 A 时长这样"，DOM 更新交给 React，可预测易维护。② **UI = f(state)**：组件近似纯函数，输入 state（含 props/context）、输出 UI 描述，相同输入必得相同输出，故 render 期间必须保持**纯**（不改外部变量、不做副作用）。③ **单向数据流**：state 经 props 向下传，子组件要改就调父传下来的回调，数据流可追溯。

**追问 1：为什么在 render 里写 `fetch` 或 `document.title = x` 有问题？**
> **答案：** render 会被多次调用（StrictMode、并发下被打断重来），副作用放这里会重复执行、产生竞态。应放 `useEffect`/`useLayoutEffect`，在 commit 后执行。

**追问 2：React 是"库"还是"框架"？**
> **答案：** 官方定位是"构建 UI 的 JS 库"，只解决视图层；路由、状态管理靠生态（React Router、Redux、Next.js）。这是与 Angular（大而全框架）的经典区别。

### Q2. JSX 的本质是什么？它怎么变成真实 DOM？

**标准答案：** JSX 是 JS 的**语法扩展**，浏览器不认识，本质是 `React.createElement()`（或新版 jsx-runtime）的**语法糖**，由 Babel 编译。React 17 起引入 **automatic runtime**，无需手动 `import React`：`<Button>Hi</Button>` → classic 下 `React.createElement(Button, null, 'Hi')`，automatic 下 `_jsx(Button, { children: 'Hi' })`（来自 `react/jsx-runtime`）。`createElement` 返回普通 **JS 对象（React 元素）**，只是 UI 描述、不是真实 DOM；真正变成 DOM 在 render/commit 阶段由 React DOM 完成。

**追问：JSX 里为何用 `className` 而非 `class`？`<>` 是什么？**
> **答案：** `class` 是 JS 保留字故用 `className`（同理 `for`→`htmlFor`）。`<>` 是 **Fragment** 语法糖，用于返回多节点而不引入额外 DOM 包裹——组件需返回单个根元素（16+ 支持数组/Fragment）。

### Q3. 虚拟 DOM 是必需的吗？React 和 Vue 在此如何取舍？

**标准答案：** 虚拟 DOM 是描述 UI 的 JS 对象树。核心价值不是"快"（直接改 DOM 未必慢），而是把状态→DOM 映射交给框架、批量+diff 减少无效 DOM 操作、屏蔽平台差异实现跨端。它**非必需**：Svelte / SolidJS 用编译时方案直接生成命令式 DOM 更新，运行时无虚拟 DOM，某些场景更快、包更小。

**追问 1：React 和 Vue 的更新机制有何本质差异？**
> **答案：** 都用虚拟 DOM，但 Vue 编译期能分析模板做细粒度优化（静态提升、patchFlag），靠 Proxy 精确追踪依赖；React JSX 编译期信息少，更依赖运行时 diff + 手动 memo（今有 React Compiler 自动补），默认靠**组件级重渲染**（父渲染带动子渲染）。

**追问 2：那是不是"Vue 比 React 先进"？**
> **答案：** 不是，是取舍。Vue 模板优化强、上手快、约定多；React 更"just JavaScript"、灵活、跨端（React Native）强、适合大型团队自定义抽象。定级看候选人能否说出**取舍**而非站队。

---

<a id="part-2"></a>

## Part 2：底层原理题（Fiber 与调度）

> 这是"会写组件"和"懂 React 内核"的分水岭，L2→L3 的关键。

### Q4. 为什么需要 Fiber？Fiber 节点长什么样？

**标准答案：** React 15 的 **Stack Reconciler** 用递归遍历，一旦开始**无法中断**，树大时长时间占主线程，导致掉帧、输入卡顿。**Fiber**（React 16）重写 reconciler，把递归改成**可中断的链表遍历**：每个 Fiber 是一个工作单元，执行一小段就检查是否该让出主线程。目标是**可中断、可分片、有优先级**的异步渲染。节点关键字段：

```js
{ tag, type, key, stateNode,          // 类型/DOM 或实例
  return, child, sibling,            // 树的链表指针（父/子/兄弟）
  pendingProps, memoizedProps, memoizedState, // props 与 hooks 链表
  updateQueue, flags, alternate }    // 更新队列/副作用标记/双缓冲指针
```

**追问 1：Fiber 为什么用链表而不是递归？**
> **答案：** 递归栈一旦压入无法暂停；链表下用 `while` + `child/sibling/return` 手动模拟遍历，随时停下保存现场（当前 Fiber），下次从断点恢复——这是时间切片的前提。

**追问 2：`flags`（旧称 effectTag）干什么用？**
> **答案：** 标记该节点需执行的 DOM 操作（插入/更新/删除）。render 阶段只打标记不改 DOM，commit 阶段统一按 flags 执行，避免边算边改让用户看到中间状态。

### Q5. 什么是双缓冲？render 阶段和 commit 阶段如何分工？

**标准答案：** **双缓冲**：同时维护 `current`（屏幕显示的树）与 `workInProgress`（内存中正在构建的树），节点通过 `alternate` 互指；构建在 WIP 上进行不干扰显示，完成后 `root.current` 切到 WIP，旧树成为下次 WIP，保证不出现半渲染状态。**render 阶段**（可中断、异步）：从根开始 reconciliation，调用组件函数、diff 子节点、打 flags，可被高优先级任务打断。**commit 阶段**（不可中断、同步）：把 flags 一次性同步应用到真实 DOM，执行 layout effects、切换 ref，必须同步完成以免看到不一致 UI。

**追问 1：为什么 commit 阶段不能中断？**
> **答案：** commit 已在改真实 DOM，中断会让用户看到"改了一半"的界面；且 DOM 操作只是应用 diff 结果、很快，没必要分片。

**追问 2：useEffect 和 useLayoutEffect 分别在哪个阶段执行？**
> **答案：** `useLayoutEffect` 在 commit 阶段**同步**执行（DOM 更新后、绘制前），阻塞绘制；`useEffect` 在 commit 后**异步**调度（通常绘制后）。详见 Q11。

### Q6. 时间切片和优先级调度怎么实现？说说 Lane 模型。

**标准答案：** **时间切片**：把大渲染切成约 5ms 小片段，每段后把主线程交还浏览器响应输入/绘制，有空再继续。React 用 **Scheduler** 包，底层基于 **MessageChannel**（非 `requestIdleCallback`——调用频率低、兼容性差），用 `shouldYield()` 判断让出。**Lane 模型**：用 31 位二进制"车道"表示优先级，越靠前越高（SyncLane > InputContinuousLane > DefaultLane > TransitionLane > IdleLane）；高优先级可**打断**低优先级渲染，同一 lane 的多次更新被**批处理**。

**追问 1：`startTransition`/`useTransition` 和这套机制什么关系？**
> **答案：** 它们把更新标记为 Transition 优先级（低 lane），使其可被用户输入等高优先级更新打断。典型场景：搜索框输入要立即响应，结果列表渲染标记为 transition，键入时不被大列表卡住。

**追问 2：为什么不用一个数字表示优先级，要用二进制位？**
> **答案：** 需表达"一批优先级"及批处理的合并/拆分。位运算能表示一组 lane、比较高低、把同批更新合并到同一 lane，比单一数字灵活。

### Q7. 讲讲 React 的合成事件系统，它与原生事件有何区别？

**标准答案：** **合成事件（SyntheticEvent）** 是对原生事件的跨浏览器包装，抹平差异、接口统一。**事件委托**：不在每个元素直接绑事件，统一委托到**根容器**——17 之前委托到 `document`，17 起委托到 React 挂载的 root 节点，避免同页多版本 React 在 document 上互相干扰，也让与嵌套原生事件行为更一致。

**追问 1：原生事件和合成事件的执行顺序？**
> **答案：** 冒泡到根容器才触发合成事件，故绑在 root 之外的原生监听**先于**合成事件。整体：原生捕获 → 合成捕获 → 合成冒泡 → 原生冒泡；合成事件中 `e.stopPropagation()` 会阻止继续冒泡到外层原生监听。

**追问 2：合成事件对象能异步访问吗（如 setTimeout 里读 `e.target`）？**
> **答案：** 旧版有事件池、复用释放事件对象，异步访问拿到 null，需 `e.persist()`。React 17 起**移除事件池**，可正常异步访问。

---

<a id="part-3"></a>

## Part 3：核心区分度题（Hooks 与 diff，题眼）

> **全题题眼**——能否讲清 Hooks 链表本质和 diff 策略，直接决定 L2 还是 L3/L4。定级主要看这里。

### Q8. 为什么 Hooks 不能在条件、循环或嵌套函数中调用？

**标准答案：** （能讲清"链表顺序"基本是 L3）每个 hook 的状态存在一条**链表**里，挂在 Fiber 的 `memoizedState` 上，由 `next` 串联。React **不靠名字、只靠调用顺序**对应"第几个 hook 是哪个 state"：

```js
const [a, setA] = useState(0);                    // hook1
if (show) { const [b, setB] = useState(0); }       // 条件成立才存在的 hook2
const [c, setC] = useState(0);                    // 有时第 2、有时第 3 节 → 状态错配
```

`show` 变化使中间 hook 时有时无，`c` 位置改变致状态错乱。故必须在**组件顶层、无条件、按顺序**调用；条件逻辑应放进 hook 内部。

**追问 1：React 靠什么规则强制这一点？**
> **答案：** ESLint 插件 `eslint-plugin-react-hooks` 的 `rules-of-hooks` 做静态检查、`exhaustive-deps` 检查 effect 依赖。这是工具约束，运行时 React 主要靠顺序约定。

**追问 2：函数组件每次渲染都重新执行，hook 状态为何不丢？**
> **答案：** 函数每次重调用，但状态存在 Fiber 的 `memoizedState` 链表而非局部变量；重执行时 `useState` 按索引去链表取值，故状态保留。

### Q9. 多次 setState 会发生什么？为什么要用函数式更新？

**标准答案：** `setState` **异步且被批处理**：一次事件/tick 内多次更新合并成一次渲染；React 18 起**所有**更新（含 Promise、setTimeout、原生事件）都自动批处理。同批里 `setCount(count+1)` 两次读到同一旧值只 +1；函数式更新 `setCount(c => c+1)` 基于累积最新值得 +2。

**追问 1：`useState` 的更新是"替换"还是"合并"？和 class 的 `setState` 有何不同？**
> **答案：** `useState` 是**整体替换**（`setState({a:1})` 丢掉其它字段），class 的 `this.setState` 是**浅合并**。要合并得写 `setState(prev => ({...prev, a:1}))`。

**追问 2：设置相同值（Object.is 相等）为何可能不重渲染？**
> **答案：** React 对同 hook 的更新用 `Object.is` 比较，相同则 bail out；但父组件因别的状态重渲染时，子组件仍会跟着渲染（除非 memo）。

### Q10. React 的 diff 算法怎么做？key 有何用，为什么别用 index？

**标准答案：** 把 O(n³) 树 diff 降到 O(n) 的启发式策略：① **同层比较**——只比同层节点，跨层移动直接销毁重建；② **type 不同则替换**——类型不同整棵子树重建；③ **key 匹配**——同层用 key 识别稳定身份决定复用或新建。**key** 让列表增删/排序时正确复用节点、保持状态。**别用 index**：插入/删除改变 index，key 跟着变致错误复用节点，若子节点持有 state/输入框会出现**内容错位、输入串位**。

```jsx
items.map((item, i) => <Row key={i} data={item} />);   // 反例：index
items.map(item => <Row key={item.id} data={item} />);  // 正解：稳定唯一 ID
```

**追问 1：为什么不跨层移动节点？**
> **答案：** 跨层查找需遍历整树，代价极高；实践中少有跨层移动，简化的性能收益远大于损失。

**追问 2：key 需要全局唯一吗？**
> **答案：** 只需在**同一父节点的同层子节点间唯一**，不同层/不同父下可重复，因为 diff 只在同层进行。

### Q11. useEffect 的依赖与清理函数是怎样的？useLayoutEffect 有何不同？

**标准答案：** `useEffect(fn, deps)` 在 commit 后**异步**执行；deps 变化时先 `Object.is` 浅比较，有变才重跑。**清理函数**（effect 返回的函数）在**下次 effect 执行前**和**卸载时**调用，用于取消订阅、清定时器——防内存泄漏与重复副作用；`deps=[]` 表示只挂载时执行一次。**useLayoutEffect** 在 DOM 更新后、**绘制前同步执行**，阻塞绘制；适合读 DOM 布局后同步修改、避免闪烁。

**追问 1：为什么 effect 在依赖没变时也可能执行多次？**
> **答案：** 开发环境 **StrictMode** 故意"挂载→卸载→重挂载"来暴露未清理的副作用，生产环境只执行一次；正确写清理函数后不受影响。

**追问 2：在 effect 里直接 setState 会导致无限循环吗？**
> **答案：** 若依赖数组含该 state 且无条件 setState，就反复触发死循环。须加条件判断，或用函数式更新配合正确依赖。

### Q12. useMemo / useCallback 如何正确使用？有哪些误区？

**标准答案：** `useMemo(fn, deps)` 缓存**计算结果**，依赖不变则复用，避免昂贵计算重跑；`useCallback(fn, deps)` 缓存**函数引用**，依赖不变则返回同一引用，配合 `React.memo` 避免子组件无效重渲染。**误区**：① 到处加 memo——依赖比较本身有成本，轻计算/非 memo 子组件用了反而更慢；② 依赖写错/写不全导致闭包捕获旧值；③ 以为 memo 能保证不重渲染——重渲染根因是 state/props/context 变化，memo 只是阻断手段。

**追问 1：useRef 有何用？为什么改 `.current` 不重渲染？**
> **答案：** `useRef(initial)` 返回 `{current}`，多次渲染间引用稳定、存在 Fiber 上。改 `.current` 是改普通属性、不入更新队列，故不重渲染。常用于访问 DOM、存定时器 ID、存"最新值"绕开闭包陷阱。

**追问 2：何时用 useReducer？自定义 Hook 是什么？**
> **答案：** `useReducer` 适合状态逻辑复杂、多值关联、新状态依赖旧状态的场景，用纯函数 reducer 集中管理、可测试，也便于把 dispatch 传深层组件。**自定义 Hook** 是以 `use` 开头、内部调用其它 Hook 的函数，把一组状态逻辑抽出来复用（如 `useFetch`），每次调用都是独立实例。

---

<a id="part-4"></a>

## Part 4：状态管理、性能与实战陷阱

> 案例驱动——背八股的人能答原理题，但答不好这里。定级权重应**高于**纯原理题。

### Q13. 什么是 useEffect 的闭包陷阱（stale closure）？怎么解决？

**标准答案：** 每次渲染生成"快照"，effect 内闭包捕获了**那次渲染**的 state/props，依赖为空或漏写时读到旧值：`setInterval(() => setCount(count+1), 1000)` 配 `[]` 永远读到首次 count=0，结果恒为 1。解决：函数式更新 `setCount(c => c+1)`、补全依赖、或用 `useRef` 存最新值再从中读。

**追问 1：StrictMode 为何让 effect 执行两次？是 bug 吗？**
> **答案：** React 18 开发环境**故意**为之："挂载→清理→再挂载"提前暴露未清理的副作用（没清定时器、没取消订阅）。不是 bug，生产环境只执行一次。

**追问 2：依赖数组里放对象/数组会怎样？**
> **答案：** deps 用 `Object.is` 浅比较，每次新建的对象/数组引用都不同，effect 每次都重跑。应把具体字段作依赖，或用 `useMemo` 稳定引用。

### Q14. 受控组件和非受控组件有何区别？怎么选？

**标准答案：** **受控**值由 state 驱动，`value={state}` + `onChange` 里 setState，UI 与 state 始终同步，React 推荐；**非受控**值由 DOM 自己维护，用 `ref` 读取（`defaultValue` + `ref.current.value`），适合简单表单、文件上传、集成非 React 代码。取舍：受控更可控、易即时校验但代码多；非受控简单但难做"值驱动 UI"。

**追问：React 19 的 ref 转发（forwardRef）有什么变化？**
> **答案：** React 19 起 **ref 可作为普通 prop 传递**，函数组件可直接 `function Input({ref}){return <input ref={ref}/>}`，不再需要 `forwardRef`。旧写法仍可用，属渐进迁移。

### Q15. Context 有什么性能坑？Redux / Zustand / Jotai 理念有何不同？

**标准答案：** **Context** 解决 props 逐层透传，但坑在于 **Provider 的 value 变化时所有消费组件都重渲染**，即使只用一小部分；缓解：`useMemo` 稳定 value、拆分 context、消费组件用 `memo` 包裹、传稳定函数而非大对象。**Redux**：单一 store、纯函数 reducer、单向数据流，可预测、时间旅行强、约定重（Redux Toolkit 减样板），适合大型复杂应用。**Zustand**：轻量、基于 Hook、选择器**按需订阅**（选哪块只在哪块变时重渲染）。**Jotai**：**原子化（atom）**状态，细粒度依赖追踪，某 atom 变只重渲染依赖它的组件。

**追问 1：何时用状态提升，何时用全局状态？**
> **答案：** 两兄弟组件共享就**提升**到最近公共父组件；跨多层、多处共享或需长期持有才用全局状态。盲目全局化增加耦合与复杂度。

**追问 2：Redux 为何要求 reducer 是纯函数？**
> **答案：** 相同输入必得相同输出、无副作用，使状态变化可预测、可回放、便于浅比较优化；副作用放中间件（thunk/saga）。

### Q16. 组件为什么会重渲染？有哪些性能优化手段？

**标准答案：** **重渲染根因**（三个）：自身 state 变化；父组件重渲染（默认带动所有子组件）；消费的 context 变化。**优化手段**：`React.memo`（props 浅比较跳过渲染，内联函数/对象是新引用会失效，需配 `useCallback`/`useMemo`）；`useMemo`/`useCallback`；**列表虚拟化**（`react-window` 只渲染可视区）；**代码分割**（`React.lazy` + 动态 `import()` + `<Suspense fallback>`）；用 **Profiler**（DevTools）先测量定位再优化；稳定 key、避免 render 里新建对象/组件类型。

**追问 1：`memo` 一定能让组件不重渲染吗？**
> **答案：** 不一定：① 自身 state 变了照样渲染；② 消费的 context 变了照样渲染；③ props 含不稳定引用时浅比较失败，memo 失效。

**追问 2：Suspense 除了配合 lazy 还能做什么？**
> **答案：** 还能配合**数据获取**及 React 19 的 `use` API——读取数据（Promise）未就绪时"挂起"，由最近的 `<Suspense fallback>` 显示加载态，即并发渲染下"等数据也优雅降级"。

### Q17. 并发渲染下的 tearing（撕裂）是什么？React 如何解决？

**标准答案：** **tearing**：并发渲染可被暂停/恢复，期间若外部状态（如外部 store）变化，同一屏不同组件可能读到**不同时间点的状态快照**，画面不一致。React 把更新放进统一批次（同一 lane）保证一次提交读到一致状态；对外部数据源提供 `useSyncExternalStore`，让 React 渲染期订阅外部 store 并检测变化，一旦变化强制同步重渲染以避免撕裂。

**追问 1：`useSyncExternalStore` 一般什么场景用？**
> **答案：** 主要给状态库/外部 store 作者用（Zustand 内部即类似机制），让外部状态与并发渲染正确集成。普通业务代码少直接用。

**追问 2：并发渲染一定更快吗？**
> **答案：** 不一定。并发优势是"可中断+优先级"，提升**响应性**，总工作量没减少甚至有调度开销。它解决"卡顿/交互延迟"而非"总计算量"。

---

<a id="part-5"></a>

## Part 5：2026 新趋势：React 19 / Compiler 与并发普及

> 加分题，考察技术视野。版本细节以官方发布为准。

### Q18. React 19 正式版有哪些重要特性？

**标准答案：**
**React 19 已于 2024 年 12 月正式发布（stable）**，核心是让异步/表单处理更顺手并推动 Server Components 落地：

| 特性 | 作用 |
|------|------|
| **Actions** | 异步函数传给 `transition`/`<form action>`，自动管 pending、错误、乐观更新 |
| **useActionState** | 管理 action 状态（旧名 `useFormState`），返回 `[state, formAction, isPending]` |
| **useFormStatus** | 表单内子组件读取父表单提交状态（pending） |
| **use API** | 在 render 中读 Promise 或 Context，配合 Suspense |
| **useOptimistic** | 乐观更新：先显示预期结果，失败再回滚 |
| **ref 作为 prop** | 函数组件直接经 props 收 ref，无需 `forwardRef` |
| **Server Components** | 服务端组件零客户端 bundle，Next.js App Router 已落地 |

**版本脉络（加分）**：React 19 于 2024-12-05 stable；**React 19.2 于 2025-10-07 发布**，与 **React Compiler 1.0 正式版（GA）** 同期。治理上也发生变化：2026-02 React 项目转入 Linux 基金会旗下的 **React Foundation**（创始成员含 Meta、Amazon、Microsoft、Vercel），Create React App 已弃用，官方推荐 Next.js / React Router / Vite / Expo 作为起点。能说出这些演进的候选人视野分更高。

**追问 1：Actions 解决了什么痛点？**
> **答案：** 以前表单提交要手动维护 loading、error、乐观更新、竞态，样板多。Actions 把异步函数纳入 React 管理，自动跟踪 pending、配合 `useOptimistic`、交给错误边界，大幅简化代码。

**追问 2：RSC 和传统 SSR 有何区别？**
> **答案：** 传统 SSR 服务端渲染成 HTML，但组件代码仍作为 JS 打到客户端用于 hydration；RSC 在服务端执行且**不进入客户端 bundle**，可直接访问数据库/文件系统，只把结果序列化给客户端，显著减小客户端 JS。二者可配合而非互斥。

### Q19. React Compiler（曾名 React Forget）是什么？进展如何？

**标准答案：** 官方**自动记忆化编译器**（早期代号 React Forget），能在**编译期自动**插入等价的 `useMemo`/`useCallback`/`React.memo`，把"手动优化重渲染"自动化——理论上无需到处手写 memo；基于对 JS 语义与 Hooks 规则的理解分析该缓存哪些值、依赖是什么。**进展**：React Conf 2024（2024-10）开放 beta，**React Compiler 1.0 已于 2025-10 正式稳定（GA）**，与 React 19.2 同期；它会在可证明安全的地方自动插入记忆化。答"仍是 beta / 实验特性"是**过时答案**。

**追问：有了 Compiler，是不是就不需要 useMemo/useCallback 了？**
> **答案：** 长期方向如此，但目前 Compiler 渐进推广，迁移期仍可能保留手写 memo；且超出编译器分析能力的边界（副作用、外部可变数据）仍需理解重渲染原理。考察候选人是否理解**本质是"自动 memo"**而非死记结论。

### Q20. 并发特性从 React 18 到 19 如何演进普及？

**标准答案：** **React 18** 奠定并发基础：`createRoot` 开启并发模式、自动批处理、`startTransition`/`useTransition`、`useDeferredValue`、Suspense 增强（旧 `ReactDOM.render` 是同步模式）。**React 19** 把并发能力**上层封装、更易使用**：Actions、useActionState、useOptimistic、`use` API 都构建在并发/Suspense 之上，不必直接操作底层调度也能受益。趋势：并发从"高级特性"变"默认能力"，配合 React Compiler 与 Server Components，目标是应用**默认就响应流畅、包更小**。

**追问：旧项目迁移到并发模式最大的兼容性风险？**
> **答案：** render 可能中断重来，任何"非纯"的 render（改外部变量、副作用、假设只执行一次）都可能出问题；自动批处理也会让依赖"立刻拿到更新后 DOM/state"的旧代码失效。StrictMode 双调用正是帮着提前发现这些问题。

---

<a id="part-6"></a>

## Part 6：能否用 React 定级？如何定级？

### 结论先行

**可以，React 区分度很高**——天然分层：会 JSX/Hooks → 懂虚拟 DOM/单向数据流 → 懂 Fiber/调度 → 懂 Hooks 链表与 diff → 能排查闭包陷阱/性能问题 → 懂并发与生态演进。但 React 上手门槛低、八股成熟，**很多人能背概念却没真做过复杂应用**，务必用 Part 4 案例题交叉验证。

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 会 JSX、函数组件和常用 Hooks；说不清虚拟 DOM/Fiber，Hooks 规则只知"规定如此" |
| **中级（L2）** | 2–5 年 | Part 2 | 懂声明式/单向数据流/虚拟 DOM；知道 Fiber、双缓冲、合成事件；会说 useMemo/memo 用法 |
| **中高级（L3）** | 5–8 年 | Part 3 | 讲得清 Hooks 链表本质、批量更新、diff 与 key、useEffect 时机；理解调度与优先级 |
| **高级（L4）** | 8 年+ | Part 4 | 能排查闭包陷阱/重渲染/撕裂，有状态管理与性能优化实战，能讲具体案例与根因 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 跟进 React 19/RSC/Compiler，能在并发、渲染策略、状态方案上做体系化选型与权衡 |

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"UI=f(state) + 状态驱动渲染"主线 → 至少 L2；只会说"React 好用、虚拟 DOM 快" → 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追问"为什么"：为什么 Hooks 不能放进 if？（链表顺序错配）；为什么 key 不能用 index？（节点复用致状态错位）；为什么 useEffect 有闭包陷阱？（快照 + 依赖没更新）。

**第三步：三类信号防背题。** ① **真实性**：能否讲出具体性能排查过程（"用 Profiler 发现列表子组件因内联函数每次重渲染" / "把 index 改为业务 id 后解决输入错位 bug"），细节 > 教科书答案；② **抽象能力**：能否归纳主线——"所有优化本质都是减少不必要重渲染/稳定引用""并发本质是可中断+优先级"；③ **权衡能力**：能否说清"什么场景不该用"——不该到处 memo、不该盲目上 Redux、虚拟 DOM 非万能。

**第四步：按最深层级定级，不按正确率。** 结合岗位调整深度：业务开发问到 Part 3/4 足够；基础架构/跨端团队才需深挖 Part 2 内核与 Part 5 演进。

### 面试官避坑提醒

- **别把"能背概念"当"懂"**：React 八股成熟，L2 与 L3 差别在"能否讲清 why"，区分"知道规则"与"理解机制"。
- **把 Part 4 案例作为 L4 分水岭**：能现场分析闭包陷阱/重渲染根因、讲出真实排查过程的，才是真做过复杂应用的人。
- **版本事实要核实**：React 19 是 2024-12 正式版；React Compiler 以 beta/渐进推广表述为准，别编造稳定版日期或不存在的 API。
- **结合岗位**：招应届/初中级时 Part 1/2 即可，强问 Fiber 源码只会考察背诵。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

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

---

*资料整理于 2026-11-19，参考 React 官方文档（react.dev）、React 19 发布说明（2024-12）、React Conf 2024（React Compiler beta）、React 源码（Fiber/reconciler/scheduler）及 2026 年前端面试趋势资料。涉及版本与 API 细节以官方发布为准；题目与答案基于公开技术资料整理，用于面试评估参考。*
