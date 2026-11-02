---
title: React Hook 与工具函数的区别（面试官版）
date: 2026-11-03
summary: 用「状态 / 生命周期 / 渲染」三条线区分 Hook 与工具函数，并附初中高级追问，方便快速定级。
---

面试时很多人会背「Hook 以 `use` 开头」，却说不清它和普通工具函数的本质差异。本题用来筛：候选人是否真正理解 React 的状态与渲染模型。

## 一句话标准答案

工具函数负责**计算和处理数据**；Hook 负责**把状态、副作用和生命周期接入 React 组件**。  
内部调用了 `useState` / `useEffect` / `useRef` 等，才是 Hook；只叫 `useXxx` 但仍是普通函数。

## 核心对比（可直接当白板提纲）

| 对比点 | React Hook / 自定义 Hook | 工具函数 |
| --- | --- | --- |
| 本质 | 可调用其他 Hook 的特殊函数 | 普通 JavaScript 函数 |
| 状态 | 可保存组件级状态，变更可触发重渲染 | 本身不能驱动 React 更新 |
| 生命周期 | 可用 `useEffect` 绑定挂载 / 更新 / 卸载 | 不自动关联组件生命周期 |
| 副作用清理 | Effect 可返回 cleanup | 需手动清理（定时器、监听等） |
| 调用位置 | 仅函数组件或自定义 Hook | 任意位置 |
| 调用顺序 | 必须稳定，不能放进 if / 循环 / 嵌套函数 | 无此限制 |
| 数据作用域 | 状态绑定当前组件实例，彼此独立 | 模块级变量会在调用者间共享 |

## 三个必讲例子

### 1. 状态绑定：模块缓存 vs 组件独立状态

```js
// 工具函数：模块级缓存，全局共享
let cache = new Map()

function getData(url) {
  if (cache.has(url)) return cache.get(url)
  const data = fetch(url)
  cache.set(url, data)
  return data
}
```

```js
// Hook：状态绑在组件实例上
import { useRef } from 'react'

function useData(url) {
  const cacheRef = useRef(new Map())
  if (!cacheRef.current.has(url)) {
    cacheRef.current.set(url, fetch(url))
  }
  return cacheRef.current.get(url)
}
```

### 2. 能否驱动 UI 更新

普通函数改局部变量，组件不会重渲染；自定义 Hook 里 `setState` 才会触发更新。

### 3. 副作用清理

`listenResize(cb)` 容易泄漏；`useResize` 在 Effect cleanup 里 `removeEventListener`，卸载时由 React 执行。

## 选型口诀

- **工具函数**：格式化、校验、纯计算、防抖节流实现本身、与 UI 无关的请求封装  
- **Hook**：请求与 loading、表单状态、事件监听、定时器、本地存储同步、需要重渲染的逻辑  

---

## 面试怎么问（按级别）

### 初级

**主问：** Hook 和普通函数有什么区别？自定义 Hook 为什么要以 `use` 开头？

**期望：** 能说出 Hook 可调用其他 Hook、有调用规则；`use` 前缀是约定，便于 ESLint 检查规则。

**追问：**

1. 能在 `if` 里写 `useState` 吗？为什么？  
2. 工具函数里写 `useState` 会怎样？  
3. `formatDate` 要不要做成 Hook？

**定级信号：** 答出「规则 + 简单场景选型」即可过初级。

### 中级

**主问：** 什么时候写 Hook，什么时候写工具函数？如何设计一个 `useUser(userId)`？

**期望：** 能讲清「是否依赖 React 状态 / 副作用」；能写出 loading、依赖 `userId`、cleanup / 竞态意识。

**追问：**

1. `useUser` 里请求，组件快速切换 `userId`，如何避免旧请求覆盖新结果？  
2. 防抖是做成 `debounce(fn)` 还是 `useDebouncedValue`？两者如何组合？  
3. 自定义 Hook 返回 `[value, setValue]` 和返回对象，各有什么利弊？

**定级信号：** 能讲竞态、依赖数组、返回值 API 设计 → 中级。

### 高级

**主问：** 团队里大量「伪 Hook」（名叫 `useX` 却没用任何 Hook）怎么治理？共享逻辑在「Hook / 工具函数 / Context / 状态库」之间如何切分？

**期望：** 谈规范、可测试性、边界：纯逻辑下沉为 utils；UI 状态进 Hook；跨树共享再上 Context / 外置 store。

**追问：**

1. Hook 里放模块级单例（如全局 socket）有什么隐患？如何正确抽象？  
2. 自定义 Hook 导致「隐形重渲染」时你怎么排查？  
3. 和 Vue composable 对比，React Hook 的约束多在哪里？

**定级信号：** 能从架构、可维护性、性能边界谈，而不是只背对比表 → 高级。
