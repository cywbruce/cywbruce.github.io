---
title: JavaScript 基础八股与手写题（TS 版答案）
date: 2026-11-05
summary: this 绑定、作用域与 TDZ、闭包、原型链与继承、类型转换、深浅拷贝、事件循环（浏览器 + Node）、Promise 全家桶、防抖节流、柯里化、并发控制，每题给答案与追问。
interview: false
kind: qa
---

TypeScript 只是编译期的类型层，运行时仍然是 JS。所以大厂 TS 岗位一定会考 JS 基础。手写题统一给出 **TS 实现**。

---

## 一、作用域、提升与 TDZ

| 声明 | 作用域 | 提升 | 重复声明 | 挂到 `window` |
| --- | --- | --- | --- | --- |
| `var` | 函数 | 提升并初始化为 `undefined` | 可以 | 是（全局作用域时） |
| `let` | 块 | 提升，但处于 TDZ | 不可以 | 否 |
| `const` | 块 | 同 `let` | 不可以 | 否 |
| `function` | 函数 | 整体提升 | 可以 | 是 |

```js
console.log(a) // undefined
var a = 1
console.log(b) // ReferenceError：暂时性死区（TDZ）
let b = 2
```

**经典题：**

```js
for (var i = 0; i < 3; i++) setTimeout(() => console.log(i)) // 3 3 3
for (let i = 0; i < 3; i++) setTimeout(() => console.log(i)) // 0 1 2（let 每轮迭代新建一个绑定）
```

---

## 二、this 绑定的四条规则

优先级：**new > 显式绑定（call/apply/bind）> 隐式绑定（obj.fn()）> 默认绑定**

```js
function show() { return this?.name }
const obj = { name: 'o', show }

show()            // 默认：严格模式下 undefined，非严格模式下是 globalThis
obj.show()        // 隐式：obj
const f = obj.show
f()               // 隐式丢失 → 默认绑定
show.call({ name: 'c' }) // 显式
new show()        // new：新创建的对象
```

**箭头函数**没有自己的 `this`，用的是**定义时**外层的 `this`，`call/bind` 也改不了它。

**追问：** `bind` 之后再 `new` 会怎样？
**答：** `new` 的优先级更高，`this` 指向新对象，但 bind 预设的参数仍然有效。

---

## 三、闭包

函数会保留对**定义时词法环境**的引用。

**用途：** 私有变量、柯里化、防抖节流、模块模式。
**风险：** 长期存活的闭包引用大对象会导致内存泄漏；React 里还有「过期闭包」问题（effect 读到的是旧的 state）。

```ts
function counter() {
  let n = 0
  return { inc: () => ++n, get: () => n }
}
```

---

## 四、原型链与继承

```text
实例.__proto__ === 构造函数.prototype
构造函数.prototype.__proto__ === Object.prototype
Object.prototype.__proto__ === null
Function.__proto__ === Function.prototype   // Function 是自己的实例
```

**手写 new：**

```ts
function myNew<T>(Ctor: new (...args: any[]) => T, ...args: any[]): T {
  const obj = Object.create(Ctor.prototype)
  const ret = (Ctor as any).apply(obj, args)
  return ret !== null && (typeof ret === 'object' || typeof ret === 'function') ? ret : obj
}
```

**手写 instanceof：**

```ts
function myInstanceof(obj: any, Ctor: Function): boolean {
  if (obj === null || (typeof obj !== 'object' && typeof obj !== 'function')) return false
  let p = Object.getPrototypeOf(obj)
  while (p) {
    if (p === Ctor.prototype) return true
    p = Object.getPrototypeOf(p)
  }
  return false
}
```

**ES5 继承的最优解：寄生组合继承**

```js
function Child(...args) { Parent.call(this, ...args) }
Child.prototype = Object.create(Parent.prototype)
Child.prototype.constructor = Child
```

`class extends` 本质上就是这套机制，另外还会设置 `Child.__proto__ = Parent`，用来继承静态方法。

---

## 五、类型与类型转换

- 8 种类型：`undefined null boolean number string symbol bigint` 加 `object`。
- `typeof null === 'object'` 是历史 bug；`typeof function(){} === 'function'`。
- 判断数组用 `Array.isArray`；通用的精确判断用 `Object.prototype.toString.call(x)`，结果形如 `'[object Date]'`。

**`==` 的规则（核心几条）：**
1. `null == undefined` 为 true，它们和其他任何值都不相等。
2. 有 `NaN` 就是 false。
3. boolean 先转成 number。
4. string 和 number 比较时，string 转成 number。
5. 对象和原始值比较时，对象先 `ToPrimitive`（依次尝试 `Symbol.toPrimitive`、`valueOf`、`toString`）。

```js
[] == ![]   // true：![] 是 false → 0；[] → '' → 0
[] + {}     // '[object Object]'
0.1 + 0.2 === 0.3 // false：IEEE 754 精度问题，用 Number.EPSILON 比较或转成整数计算
```

**`Object.is`** 和 `===` 的区别只有两处：`Object.is(NaN, NaN)` 为 true，`Object.is(+0, -0)` 为 false。

---

## 六、深浅拷贝

- **浅拷贝：** `{...obj}`、`Object.assign`、`arr.slice()`
- **深拷贝：** 优先用 `structuredClone`，它支持循环引用、Date、Map、Set，但**不支持函数、DOM 和原型链**。`JSON.parse(JSON.stringify())` 会丢失 `undefined`、函数和 Symbol，Date 会变成字符串，遇到循环引用直接报错。

**手写深拷贝（处理循环引用）：**

```ts
function deepClone<T>(v: T, seen = new WeakMap<object, any>()): T {
  if (v === null || typeof v !== 'object') return v
  if (seen.has(v as object)) return seen.get(v as object)
  if (v instanceof Date) return new Date(v) as T
  if (v instanceof RegExp) return new RegExp(v.source, v.flags) as T
  if (v instanceof Map) {
    const m = new Map(); seen.set(v, m)
    v.forEach((val, k) => m.set(deepClone(k, seen), deepClone(val, seen)))
    return m as T
  }
  if (v instanceof Set) {
    const s = new Set(); seen.set(v, s)
    v.forEach((val) => s.add(deepClone(val, seen)))
    return s as T
  }
  const out = Array.isArray(v) ? [] : Object.create(Object.getPrototypeOf(v))
  seen.set(v as object, out)
  for (const k of Reflect.ownKeys(v as object)) {
    out[k] = deepClone((v as any)[k], seen)
  }
  return out
}
```

**追问：** 为什么用 `WeakMap`？
**答：** 弱引用不会阻止垃圾回收，拷贝完成后不会留下内存泄漏。

---

## 七、事件循环

### 浏览器

```text
执行一个宏任务（script / setTimeout / I/O / UI 事件）
  → 清空所有微任务（Promise.then / queueMicrotask / MutationObserver）
  → 视情况渲染（rAF → 样式 → 布局 → 绘制）
  → 下一个宏任务
```

```js
async function a1() { console.log('a1 start'); await a2(); console.log('a1 end') }
async function a2() { console.log('a2') }
console.log('script start')
setTimeout(() => console.log('timeout'), 0)
a1()
new Promise(r => { console.log('p1'); r() }).then(() => console.log('then'))
console.log('script end')
// script start → a1 start → a2 → p1 → script end → a1 end → then → timeout
```

**要点：** `await x` 之后的代码相当于放进了 `.then` 回调；`new Promise` 的执行器是**同步**执行的。

### Node.js（libuv 的 6 个阶段）

```text
timers（setTimeout / setInterval）
→ pending callbacks
→ idle / prepare
→ poll（I/O 回调）
→ check（setImmediate）
→ close callbacks
每个回调执行完之后：先清 process.nextTick 队列，再清 Promise 微任务
```

- `process.nextTick` 的优先级高于 `Promise.then`。
- 在主模块里，`setTimeout(0)` 和 `setImmediate` 的先后顺序**不确定**；在 I/O 回调里，`setImmediate` 一定先执行。

---

## 八、Promise 全家桶

### Promise.all / allSettled / race / any

```ts
function promiseAll<T>(ps: Iterable<T | PromiseLike<T>>): Promise<Awaited<T>[]> {
  return new Promise((resolve, reject) => {
    const arr = Array.from(ps)
    const res: Awaited<T>[] = new Array(arr.length)
    let done = 0
    if (arr.length === 0) return resolve(res)
    arr.forEach((p, i) => {
      Promise.resolve(p).then((v) => {
        res[i] = v as Awaited<T>
        if (++done === arr.length) resolve(res)
      }, reject)
    })
  })
}

function promiseAllSettled<T>(ps: (T | PromiseLike<T>)[]) {
  return Promise.all(
    ps.map((p) =>
      Promise.resolve(p).then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason) => ({ status: 'rejected' as const, reason }),
      ),
    ),
  )
}

function promiseRace<T>(ps: (T | PromiseLike<T>)[]): Promise<Awaited<T>> {
  return new Promise((resolve, reject) => {
    ps.forEach((p) => Promise.resolve(p).then(resolve as any, reject))
  })
}

function promiseAny<T>(ps: (T | PromiseLike<T>)[]): Promise<Awaited<T>> {
  return new Promise((resolve, reject) => {
    const errs: unknown[] = []
    let n = 0
    if (ps.length === 0) return reject(new AggregateError([], 'All promises were rejected'))
    ps.forEach((p, i) =>
      Promise.resolve(p).then(resolve as any, (e) => {
        errs[i] = e
        if (++n === ps.length) reject(new AggregateError(errs, 'All promises were rejected'))
      }),
    )
  })
}
```

| 方法 | 什么时候 resolve | 什么时候 reject |
| --- | --- | --- |
| `all` | 全部成功 | 第一个失败 |
| `allSettled` | 全部结束 | 永远不会 |
| `race` | 第一个结束（成功） | 第一个结束（失败） |
| `any` | 第一个成功 | 全部失败（AggregateError） |

### 并发控制（高频）

```ts
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const res: T[] = new Array(tasks.length)
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++ // 单线程，这里不会有竞态
      res[i] = await tasks[i]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return res
}
```

**追问：** 一个任务失败了怎么办？
**答：** 上面的写法遇到失败会整体 reject，但其他 worker 还在跑。如果需要「失败也继续」，改用 `allSettled` 的思路收集结果；如果需要取消，传入 `AbortSignal`。

### 带超时的请求

```ts
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const t = new Promise<never>((_, rej) => {
    timer = setTimeout(() => rej(new Error('timeout')), ms)
  })
  return Promise.race([p, t]).finally(() => clearTimeout(timer))
}
// 现代写法：fetch(url, { signal: AbortSignal.timeout(3000) })
```

---

## 九、防抖与节流

```ts
function debounce<A extends unknown[]>(fn: (...a: A) => void, wait: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  const d = (...args: A) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
  d.cancel = () => clearTimeout(t)
  return d
}

function throttle<A extends unknown[]>(fn: (...a: A) => void, wait: number) {
  let last = 0
  let t: ReturnType<typeof setTimeout> | undefined
  return (...args: A) => {
    const now = Date.now()
    const remain = wait - (now - last)
    if (remain <= 0) {
      clearTimeout(t); t = undefined
      last = now
      fn(...args)
    } else if (!t) {
      t = setTimeout(() => { last = Date.now(); t = undefined; fn(...args) }, remain)
    }
  }
}
```

| | 防抖 | 节流 |
| --- | --- | --- |
| 语义 | 停止触发 N ms 后执行一次 | 每 N ms 最多执行一次 |
| 场景 | 搜索联想、窗口 resize 结束 | 滚动、拖拽、埋点 |

---

## 十、其他手写高频

### call / apply / bind

```ts
Function.prototype.myCall = function (ctx: any, ...args: any[]) {
  ctx = ctx == null ? globalThis : Object(ctx)
  const key = Symbol()
  ctx[key] = this
  const r = ctx[key](...args)
  delete ctx[key]
  return r
}

Function.prototype.myBind = function (ctx: any, ...pre: any[]) {
  const fn = this
  function bound(this: any, ...rest: any[]) {
    // 被 new 调用时，忽略 ctx
    return fn.apply(this instanceof bound ? this : ctx, [...pre, ...rest])
  }
  bound.prototype = Object.create(fn.prototype)
  return bound
}
```

### 柯里化

```ts
function curry(fn: (...a: any[]) => any) {
  return function c(...args: any[]): any {
    return args.length >= fn.length ? fn(...args) : (...more: any[]) => c(...args, ...more)
  }
}
const add = curry((a: number, b: number, c: number) => a + b + c)
add(1)(2)(3) // 6
```

### 发布订阅（类型安全版）

```ts
class Emitter<E extends Record<string, unknown[]>> {
  private map: { [K in keyof E]?: Set<(...a: E[K]) => void> } = {}
  on<K extends keyof E>(k: K, fn: (...a: E[K]) => void) {
    (this.map[k] ??= new Set()).add(fn)
    return () => this.map[k]!.delete(fn)
  }
  emit<K extends keyof E>(k: K, ...a: E[K]) {
    this.map[k]?.forEach((fn) => fn(...a))
  }
}
const bus = new Emitter<{ login: [userId: string]; logout: [] }>()
bus.on('login', (id) => id.toUpperCase())
```

### 数组拍平 / 去重

```ts
const flat = (arr: unknown[], d = Infinity): unknown[] =>
  d > 0 ? arr.reduce<unknown[]>((a, x) => a.concat(Array.isArray(x) ? flat(x, d - 1) : x), []) : arr.slice()
const uniq = <T,>(a: T[]) => [...new Set(a)]
```

---

## 十一、内存与垃圾回收

- **V8 分代回收：** 新生代用 Scavenge（复制算法，From/To 两个空间）；对象存活多次后晋升到老生代，用标记清除加标记整理，并通过增量和并发标记减少停顿。
- **常见泄漏：** 意外的全局变量、忘记清除的定时器和事件监听、闭包持有大对象、已脱离 DOM 但仍被引用的节点、只增不减的 Map 缓存（可以用 `WeakMap`、LRU）。
- **排查：** DevTools Memory 面板，拍两次堆快照做对比，看 Retainers 引用链。

---

## 面试官速查

| 级别 | 必问 | 过线 |
| --- | --- | --- |
| 初级 | var/let、this、闭包、`==`、浅拷贝 | 概念正确 |
| 中级 | 事件循环输出题、原型链、Promise.all、防抖节流、深拷贝 | 能手写，并处理边界情况 |
| 高级 | Node 事件循环、并发池与取消、内存泄漏排查、V8 GC | 能结合线上问题讲 |

## 相关文章

- [TS/JS 深水区](/posts/typescript/ts-js-deep-water/)
- [TypeScript 类型系统原理](/posts/typescript/typescript-type-system/)
- [sleep 与重试](/posts/typescript/sleep-retry/)
- [前端手写题题库](/posts/react/handwritten-interview/)
- [市场高频题（含事件循环）](/posts/react/market-hot-questions/)
