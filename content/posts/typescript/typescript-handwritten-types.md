---
title: TypeScript 手写工具类型 20 题（附答案与追问）
date: 2026-11-05
summary: 从 Partial 到 UnionToIntersection，覆盖映射类型、条件类型、infer、分布式、模板字面量、递归，每题给实现、要点和面试追问。
interview: false
kind: qa
---

先记住四个积木，所有题都是它们的组合：

| 积木 | 语法 | 作用 |
| --- | --- | --- |
| 映射类型 | `{ [K in keyof T]: ... }` | 遍历键，可加减 `?` / `readonly`，可用 `as` 重映射键 |
| 条件类型 | `T extends U ? X : Y` | 类型层面的 if |
| `infer` | `T extends Promise<infer R> ? R : never` | 在条件类型里「解构」出一部分类型 |
| 递归 | 类型引用自身 | 处理嵌套 / 元组 / 字符串 |

**分布式条件类型**：当 `T` 是**裸类型参数**且传入联合时，条件类型会对每个成员分别计算再合并。用 `[T] extends [U]` 可以关掉分布。

```ts
type ToArr<T> = T extends any ? T[] : never
type A = ToArr<string | number> // string[] | number[]（分布）

type ToArr2<T> = [T] extends [any] ? T[] : never
type B = ToArr2<string | number> // (string | number)[]（不分布）
```

---

## 一、映射类型（初 / 中级）

### 1. MyPartial / MyRequired / MyReadonly

```ts
type MyPartial<T> = { [K in keyof T]?: T[K] }
type MyRequired<T> = { [K in keyof T]-?: T[K] }   // -? 去掉可选
type MyReadonly<T> = { readonly [K in keyof T]: T[K] }
type Mutable<T> = { -readonly [K in keyof T]: T[K] }
```

**追问：** `-?` 去掉可选后，`T[K]` 里的 `undefined` 也会被去掉吗？（会：同态映射配合 `-?` 时会把可选带来的 `undefined` 一起去掉；但开了 `exactOptionalPropertyTypes` 以后行为会有差异）

### 2. MyPick

```ts
type MyPick<T, K extends keyof T> = { [P in K]: T[P] }
```

**要点：** `K extends keyof T` 是约束，防止传入不存在的键。

### 3. MyRecord

```ts
type MyRecord<K extends keyof any, V> = { [P in K]: V }
```

**追问：** `keyof any` 是什么？（`string | number | symbol`）

### 4. MyExclude / MyExtract（依赖分布式）

```ts
type MyExclude<T, U> = T extends U ? never : T
type MyExtract<T, U> = T extends U ? T : never
```

**要点：** `never` 在联合里会被吸收，所以分布后再合并，就相当于做了过滤。

### 5. MyOmit

```ts
type MyOmit<T, K extends keyof any> = MyPick<T, MyExclude<keyof T, K>>
// 或用键重映射
type MyOmit2<T, K> = { [P in keyof T as P extends K ? never : P]: T[P] }
```

**追问：** 官方 `Omit` 的 `K` 为什么是 `keyof any` 而不是 `keyof T`？（为了灵活，代价是写错键不报错。团队可以封装一个 `StrictOmit<T, K extends keyof T>`）

### 6. 按值类型筛选键：PickByType

```ts
type PickByType<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K]
}
type S = PickByType<{ a: string; b: number; c: string }, string> // { a; c }
```

### 7. 部分可选：PartialBy

```ts
type Simplify<T> = { [K in keyof T]: T[K] } & {}
type PartialBy<T, K extends keyof T> = Simplify<
  Omit<T, K> & Partial<Pick<T, K>>
>
```

**要点：** `Simplify` 把交叉类型「拍平」，让 IDE 悬停时显示可读的结构。这是**类型可读性**的常用技巧。

---

## 二、infer 解构（中级）

### 8. MyReturnType / MyParameters

```ts
type MyReturnType<T extends (...args: any) => any> =
  T extends (...args: any) => infer R ? R : never

type MyParameters<T extends (...args: any) => any> =
  T extends (...args: infer P) => any ? P : never
```

**追问：** 重载函数取 `ReturnType` 得到的是哪个签名？（**最后一个**重载签名）

### 9. MyAwaited（递归解 Promise）

```ts
type MyAwaited<T> =
  T extends null | undefined ? T :
  T extends object & { then(onfulfilled: infer F, ...args: any): any }
    ? F extends (value: infer V, ...args: any) => any
      ? MyAwaited<V>
      : never
    : T
```

简化版（面试时够用）：

```ts
type UnwrapPromise<T> = T extends Promise<infer R> ? UnwrapPromise<R> : T
```

**追问：** 官方实现为什么按 `then` 匹配，而不是直接匹配 `Promise`？（为了兼容任意 thenable）

### 10. 元组首尾：First / Last / Pop

```ts
type First<T extends readonly any[]> = T extends [infer F, ...any[]] ? F : never
type Last<T extends readonly any[]> = T extends [...any[], infer L] ? L : never
type Pop<T extends readonly any[]> = T extends [...infer R, any] ? R : []
```

### 11. 数组元素类型 / 元组转联合

```ts
type ElementOf<T> = T extends readonly (infer E)[] ? E : never
type TupleToUnion<T extends readonly any[]> = T[number]

const roles = ['admin', 'user'] as const
type Role = (typeof roles)[number] // 'admin' | 'user'
```

**要点：** `as const` 加 `[number]` 是「从运行时数组派生类型」的标准写法，类型和值共用一份来源。

---

## 三、递归与深层（中 / 高级）

### 12. DeepReadonly / DeepPartial

```ts
type DeepReadonly<T> = T extends (...args: any) => any
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T
```

**追问：** 为什么要先排除函数？（函数也是 `object`，不排除的话会被映射坏掉）

### 13. 拍平数组：Flatten

```ts
type Flatten<T extends any[]> = T extends [infer F, ...infer R]
  ? F extends any[] ? [...Flatten<F>, ...Flatten<R>] : [F, ...Flatten<R>]
  : []
```

### 14. 路径：Paths（表单 / i18n 键）

```ts
type Paths<T> = T extends object
  ? { [K in keyof T & string]: K | `${K}.${Paths<T[K]>}` }[keyof T & string]
  : never

type P = Paths<{ user: { name: string; age: number } }>
// 'user' | 'user.name' | 'user.age'
```

**追问：** 深度很大的对象会怎样？（触发「类型实例化过深」，或者让检查变慢。可以加深度计数器做限制）

---

## 四、模板字面量（中 / 高级）

### 15. 事件名：`on${Capitalize}`

```ts
type EventHandlers<T> = {
  [K in keyof T & string as `on${Capitalize<K>}`]: (v: T[K]) => void
}
type H = EventHandlers<{ change: string; close: void }>
// { onChange: (v: string) => void; onClose: (v: void) => void }
```

### 16. 路由参数提取

```ts
type RouteParams<S extends string> =
  S extends `${string}:${infer P}/${infer Rest}`
    ? { [K in P | keyof RouteParams<Rest>]: string }
    : S extends `${string}:${infer P}`
      ? { [K in P]: string }
      : {}

type R = RouteParams<'/user/:id/post/:pid'> // { id: string; pid: string }
```

### 17. Trim / CamelCase

```ts
type TrimLeft<S extends string> = S extends ` ${infer R}` ? TrimLeft<R> : S
type CamelCase<S extends string> =
  S extends `${infer H}_${infer T}` ? `${H}${CamelCase<Capitalize<T>>}` : S
type C = CamelCase<'user_first_name'> // 'userFirstName'
```

---

## 五、高级技巧

### 18. UnionToIntersection（逆变位置推断）

```ts
type UnionToIntersection<U> =
  (U extends any ? (x: U) => void : never) extends (x: infer I) => void
    ? I
    : never
```

**原理：** 先分布，得到函数联合 `((x: A) => void) | ((x: B) => void)`；在**参数（逆变）位置**做 `infer` 时，TS 会推断出交叉类型 `A & B`。能讲清楚协变和逆变，就是高级信号。

### 19. IsAny / IsNever / Equal

```ts
type IsNever<T> = [T] extends [never] ? true : false // 必须包一层，否则分布成 never
type IsAny<T> = 0 extends 1 & T ? true : false        // any 会吞掉交叉
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2)
    ? true : false
```

**追问：** `IsNever<never>` 不包 `[]` 会得到什么？（`never`：空联合分布之后结果还是空）

### 20. 品牌类型（Branded Types）

```ts
type Brand<T, B extends string> = T & { readonly __brand: B }
type UserId = Brand<string, 'UserId'>
type OrderId = Brand<string, 'OrderId'>

const toUserId = (s: string) => s as UserId
declare function getUser(id: UserId): void
getUser(toUserId('u1'))     // ✅
// getUser('u1' as OrderId) // ❌
```

**要点：** TS 是结构类型，品牌字段可以在编译期模拟名义类型，防止把 ID、金额这类值传混。

---

## 面试官速查

| 级别 | 应能写出 | 定级信号 |
| --- | --- | --- |
| 初级 | 1–3、11 | 会用映射类型和 `keyof` |
| 中级 | 4–10、15 | 理解分布式、`infer`、键重映射 |
| 高级 | 12–14、16–20 | 递归、逆变推断、讲得清**什么时候不该这么写** |

**加分回答：** 「业务代码里我优先用官方工具类型加可辨识联合。复杂类型只放在 SDK 或基础库里，配上 `expectTypeOf` 做类型测试，同时控制递归深度，避免拖慢 IDE。」

## 相关文章

- [TypeScript 面试提纲](/posts/typescript/typescript-interview/)
- [TypeScript 工程化：tsconfig、声明文件与编译链](/posts/typescript/typescript-engineering/)
- [TS/JS 深水区](/posts/typescript/ts-js-deep-water/)
