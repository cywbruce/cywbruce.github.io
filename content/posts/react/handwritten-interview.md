---
title: 前端手写题题库（含长参考答案 · 定级）
date: 2026-11-06
summary: 市场高频手写：防抖节流、深拷贝、Promise、发布订阅、列表树、Hooks、TS 工具类型；每题附长答案、边界与追问定级。
kind: qa
---

面试官用法：初级只要求「主路径能跑」；中级看边界与复杂度；高级看 API 设计、可取消、类型与可测试性。下面答案偏**阅卷版**，可直接对照打分。

相关：[场景题](/posts/react/scenario-interview/) · [市场高频概念题](/posts/react/market-hot-questions/)

---

## 一、防抖 debounce（初级～中级）

**主问：** 实现 `debounce(fn, delay)`，支持取消；追问立即执行版。

### 长参考答案

```js
function debounce(fn, delay = 300, { immediate = false } = {}) {
  let timer = null
  let invoked = false

  const debounced = function (...args) {
    const ctx = this

    if (timer) clearTimeout(timer)

    if (immediate) {
      const callNow = !timer
      timer = setTimeout(() => {
        timer = null
        invoked = false
      }, delay)
      if (callNow && !invoked) {
        invoked = true
        return fn.apply(ctx, args)
      }
      return
    }

    timer = setTimeout(() => {
      timer = null
      fn.apply(ctx, args)
    }, delay)
  }

  debounced.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    invoked = false
  }

  return debounced
}
```

**业务点：** 搜索框、resize、按钮防重复提交（更常用 throttle / loading 锁）。

| 级别 | 期望 | 追问 |
| --- | --- | --- |
| 初 | 能写出 setTimeout + clearTimeout | 和节流差别？ |
| 中 | 保留 `this` / `args`，有 `cancel` | 卸载组件怎么清？ |
| 高 | immediate、React 里 `useDebouncedValue` | 和 `requestAnimationFrame` 怎么选？ |

---

## 二、节流 throttle（初级～中级）

**主问：** 时间戳版或定时器版，说明差异。

### 长参考答案（时间戳 + 尾调用简化）

```js
function throttle(fn, wait = 300) {
  let last = 0
  let timer = null

  const throttled = function (...args) {
    const now = Date.now()
    const remaining = wait - (now - last)
    const ctx = this

    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer)
        timer = null
      }
      last = now
      fn.apply(ctx, args)
    } else if (!timer) {
      // 尾部补一次，保证最后一次触发还能执行
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn.apply(ctx, args)
      }, remaining)
    }
  }

  throttled.cancel = () => {
    if (timer) clearTimeout(timer)
    timer = null
    last = 0
  }

  return throttled
}
```

**定级：** 只会「固定间隔忽略中间」→ 初级；能讲清 leading/trailing → 中级。

---

## 三、深拷贝 deepClone（中级）

**主问：** 支持普通对象/数组；加分：循环引用、`Date`/`RegExp`/`Map`/`Set`。

### 长参考答案

```js
function deepClone(input, map = new WeakMap()) {
  if (input === null || typeof input !== 'object') return input

  if (input instanceof Date) return new Date(input)
  if (input instanceof RegExp) return new RegExp(input.source, input.flags)

  if (map.has(input)) return map.get(input)

  if (input instanceof Map) {
    const result = new Map()
    map.set(input, result)
    input.forEach((v, k) => result.set(deepClone(k, map), deepClone(v, map)))
    return result
  }

  if (input instanceof Set) {
    const result = new Set()
    map.set(input, result)
    input.forEach((v) => result.add(deepClone(v, map)))
    return result
  }

  const result = Array.isArray(input) ? [] : {}
  map.set(input, result)

  Reflect.ownKeys(input).forEach((key) => {
    result[key] = deepClone(input[key], map)
  })

  return result
}
```

| 级别 | 期望 |
| --- | --- |
| 初 | 递归 + 数组/对象分支 |
| 中 | `WeakMap` 破循环引用 |
| 高 | 特殊对象、Symbol 键、说明 `structuredClone` 适用边界 |

**追问：** 函数、DOM、原型链拷不拷？生产为何优先 `structuredClone` / immer？

---

## 四、Promise.all / race / allSettled

### Promise.all（中级）

**主问：** 手写 `Promise.all`：保持结果顺序，任一失败立即 reject，空数组直接 resolve。

```js
function promiseAll(iterable) {
  const tasks = [...iterable]
  if (tasks.length === 0) return Promise.resolve([])

  return new Promise((resolve, reject) => {
    const result = new Array(tasks.length)
    let done = 0

    tasks.forEach((item, i) => {
      Promise.resolve(item).then(
        (value) => {
          result[i] = value
          done += 1
          if (done === tasks.length) resolve(result)
        },
        reject, // 任一失败立刻失败
      )
    })
  })
}
```

### allSettled（中级）

**主问：** 手写 `Promise.allSettled`，并说明它和 `Promise.all` 的语义差别。

```js
function promiseAllSettled(iterable) {
  const tasks = [...iterable].map((item) =>
    Promise.resolve(item).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    ),
  )
  return promiseAll(tasks)
}
```

**追问：** 和 `all` 语义差？并发数限制（`p-limit`）怎么做？→ 高级可继续手写 scheduler。

---

## 五、发布订阅 EventEmitter（中级）

**主问：** 实现一个 EventEmitter，支持 `on` / `off` / `once` / `emit`。

```js
class EventEmitter {
  constructor() {
    this.map = Object.create(null)
  }

  on(event, handler) {
    ;(this.map[event] ||= []).push(handler)
    return () => this.off(event, handler)
  }

  once(event, handler) {
    const wrap = (...args) => {
      this.off(event, wrap)
      handler(...args)
    }
    return this.on(event, wrap)
  }

  off(event, handler) {
    const list = this.map[event]
    if (!list) return
    this.map[event] = list.filter((h) => h !== handler)
  }

  emit(event, ...args) {
    ;[...(this.map[event] || [])].forEach((h) => h(...args))
  }
}
```

**定级：** 有 `once` + emit 时拷贝数组防重入 → 中级；能对比 Node EventEmitter / 内存泄漏 → 高级。

---

## 六、列表 ↔ 树（业务高频）

### 列表转树（初级～中级）

**主问：** 把带 `id` / `parentId` 的扁平列表转成树，要求 O(n)。

```js
function listToTree(list, { id = 'id', parentId = 'parentId', children = 'children' } = {}) {
  const map = new Map()
  const roots = []

  list.forEach((item) => {
    map.set(item[id], { ...item, [children]: [] })
  })

  map.forEach((node) => {
    const pid = node[parentId]
    if (pid == null || !map.has(pid)) roots.push(node)
    else map.get(pid)[children].push(node)
  })

  return roots
}
```

### 树转列表（中级）

**主问：** 把树形结构拍平成带 `parentId` 的列表。

```js
function treeToList(tree, { children = 'children' } = {}) {
  const result = []
  const walk = (nodes, parentId = null) => {
    nodes.forEach((node) => {
      const { [children]: kids, ...rest } = node
      result.push({ ...rest, parentId })
      if (kids?.length) walk(kids, node.id)
    })
  }
  walk(tree)
  return result
}
```

**追问：** 环怎么检测？超大树要不要迭代？字段可配置如何设计？

---

## 七、lodash.get / 模板字符串（初级～中级）

**主问：** 实现 `get(obj, path, defaultValue)`，支持 `a.b[0].c` 这样的路径。

```js
function get(obj, path, defaultValue) {
  const keys = Array.isArray(path)
    ? path
    : String(path)
        .replace(/\[(\w+)\]/g, '.$1')
        .replace(/^\./, '')
        .split('.')

  let cur = obj
  for (const key of keys) {
    if (cur == null) return defaultValue
    cur = cur[key]
  }
  return cur === undefined ? defaultValue : cur
}
```

---

## 八、React 手写：usePrevious / useDebounceValue

### usePrevious（中级）

**主问：** 实现 `usePrevious(value)`，返回上一次渲染时的值。

```js
function usePrevious(value) {
  const ref = useRef()
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref.current
}
```

### useDebouncedValue（中级）

**主问：** 实现 `useDebouncedValue(value, delay)`，值停止变化 delay 毫秒后才更新。

```js
function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])

  return debounced
}
```

**追问：** 为何不直接 debounce 事件回调？和 `useDeferredValue` 区别？

---

## 九、React 手写：简易 useRequest（中高级）

**主问：** `const { data, loading, error, run } = useRequest(fetcher)`，切换参数要防竞态。

### 长参考答案

```js
function useRequest(fetcher, { manual = false, defaultParams } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(!manual)
  const seqRef = useRef(0)

  const run = useCallback(
    async (...args) => {
      const seq = ++seqRef.current
      setLoading(true)
      setError(null)
      try {
        const result = await fetcher(...args)
        if (seq !== seqRef.current) return // 过期请求
        setData(result)
        return result
      } catch (e) {
        if (seq !== seqRef.current) return
        setError(e)
        throw e
      } finally {
        if (seq === seqRef.current) setLoading(false)
      }
    },
    [fetcher],
  )

  useEffect(() => {
    if (!manual) run(defaultParams)
    return () => {
      seqRef.current += 1 // 卸载作废进行中请求
    }
  }, [manual, run, defaultParams])

  return { data, error, loading, run }
}
```

| 级别 | 期望 |
| --- | --- |
| 中 | loading/error/data + 基础请求 |
| 高 | 竞态序号、卸载取消、对比 React Query |

---

## 十、TypeScript 工具类型手写（中级）

**主问：** 手写 `Partial`、`Pick`、`Omit`、`ReturnType`、`DeepReadonly`。

```ts
type MyPartial<T> = { [K in keyof T]?: T[K] }

type MyRequired<T> = { [K in keyof T]-?: T[K] }

type MyReadonly<T> = { readonly [K in keyof T]: T[K] }

type MyPick<T, K extends keyof T> = { [P in K]: T[P] }

type MyExclude<T, U> = T extends U ? never : T

type MyOmit<T, K extends keyof any> = MyPick<T, MyExclude<keyof T, K>>

type MyReturnType<T extends (...args: any) => any> = T extends (
  ...args: any
) => infer R
  ? R
  : never

type DeepReadonly<T> = {
  readonly [K in keyof T]: T[K] extends object
    ? T[K] extends Function
      ? T[K]
      : DeepReadonly<T[K]>
    : T[K]
}
```

**业务加分题：**

```ts
type SafeUser = MyOmit<MyReturnType<typeof fetchUser>, 'token' | 'password'>
```

**定级：** 会默写 Partial/Pick → 初级；Omit=Pick+Exclude、ReturnType+infer → 中级；DeepReadonly 边界与检查性能 → 高级。

---

## 十一、市场常见「顺带手写」短题（可当热身）

| 题 | 级别 | 要点 |
| --- | --- | --- |
| `call` / `apply` / `bind` | 初/中 | 挂临时方法、处理原生构造 |
| `instanceof` | 初 | 原型链行走 |
| `Array.prototype.flat(n)` | 初/中 | 递归 / 栈，注意稀疏数组 |
| `curry` / `compose` | 中 | 参数收集、结合律 |
| 并发池 `asyncPool(limit, tasks)` | 高 | 队列 + 完成再补位 |
| JSON → DOM / 迷你 React render | 中/高 | 递归建树，对标 JSX |

---

## 十二、阅卷建议（面试官）

1. **先看主路径**，再抠边界；边界全错但主路径清晰，中级岗可过。  
2. 手写 React Hook 重点看：**依赖、清理、竞态**，不是 API 皮相。  
3. TS 手写重点看：**约束写在哪**（`extends keyof`），不是能不能背。  
4. 每场建议 **1～2 道手写**，其余时间留给[场景题](/posts/react/scenario-interview/)。
