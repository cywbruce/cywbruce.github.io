---
title: TypeScript 类型系统原理：结构类型、兼容性、变型与推断
date: 2026-11-05
summary: 讲清 TS 类型系统的底层规则：结构类型、类型层级（top/bottom）、赋值兼容性、协变/逆变/双变、收窄与控制流分析、推断与上下文类型、分布式条件类型，附面试追问与答案。
interview: false
kind: qa
---

工具类型是「招式」，这篇讲「内功」：**TS 编译器到底按什么规则判断 A 能不能赋给 B。** 能讲清这些规则的候选人，类型体操题基本都能现场推出来。

---

## 一、结构类型（Structural Typing）

TS 判断兼容性看**形状**，不看名字（Java 是名义类型）。

```ts
interface Point { x: number; y: number }
class Vec { constructor(public x: number, public y: number) {} }

const p: Point = new Vec(1, 2) // ✅ 形状一致即可，不需要 implements
```

**多余属性检查（Excess Property Check）** 是例外：只对**新鲜的对象字面量**生效。

```ts
const a: Point = { x: 1, y: 2, z: 3 } // ❌ 字面量多了 z
const tmp = { x: 1, y: 2, z: 3 }
const b: Point = tmp                   // ✅ 非新鲜对象，只要求「至少有」
```

**追问：** 想要名义类型怎么办？
**答：** 用品牌类型 `T & { __brand: 'X' }`；或者 class 里加 `private` / `#private` 字段，私有成员会让 class 按「名义」比较。

---

## 二、类型层级：top 与 bottom

```text
          unknown            ← top：任何值都能赋给它
       /     |      \
   object  string  number ...
       \     |      /
          never              ← bottom：可以赋给任何类型，但没有值
any：既是 top 又是 bottom，直接关闭检查（会「传染」）
```

| 类型 | 能赋给它 | 它能赋给 | 用途 |
| --- | --- | --- | --- |
| `unknown` | 一切 | 只能赋给 `unknown`/`any` | 外部输入，强制先收窄 |
| `any` | 一切 | 一切 | 逃生舱，尽量不用 |
| `never` | 只有 `never` | 一切 | 穷尽检查、不可能分支、抛异常函数的返回值 |
| `void` | `undefined` | — | 函数「不关心返回值」 |

**穷尽检查：**

```ts
type Shape = { kind: 'circle'; r: number } | { kind: 'square'; a: number }
function area(s: Shape) {
  switch (s.kind) {
    case 'circle': return Math.PI * s.r ** 2
    case 'square': return s.a ** 2
    default: {
      const _never: never = s // 新增一种 Shape 但忘了处理时，这里会报错
      return _never
    }
  }
}
```

**追问：** `() => void` 类型的回调为什么可以返回 number？
**答：** `void` 返回类型的**函数类型**表示「调用方不使用返回值」，所以 `[1,2].forEach(x => arr.push(x))` 合法。但**函数声明**如果显式写了 `: void`，就不能 `return 1`。

---

## 三、联合与交叉：是集合运算

把类型看成**值的集合**，很多规则就自然了：

- `A | B` 是并集，值更多，类型更「宽」；**能访问的属性**只有公共的那部分。
- `A & B` 是交集，值更少，类型更「窄」；能访问的属性是两边的合集。
- `string & number` 是空集，结果为 `never`。
- 对象交叉时如果同名属性冲突，`{ a: string } & { a: number }` 的 `a` 会变成 `never`。

```ts
type U = { a: 1; b: 2 } | { a: 1; c: 3 }
declare const u: U
u.a // ✅ 公共属性
// u.b // ❌ 要先收窄
```

**`keyof` 的反直觉之处：** `keyof (A | B)` = `keyof A & keyof B`（只有公共键），`keyof (A & B)` = `keyof A | keyof B`。

---

## 四、变型：协变、逆变、双变

设 `Dog extends Animal`：

| 位置 | 规则 | 例子 |
| --- | --- | --- |
| 协变（返回值、只读属性、数组元素） | `Dog` 可赋给 `Animal`，那么 `() => Dog` 可赋给 `() => Animal` | 产出更具体的值是安全的 |
| 逆变（函数参数） | `(a: Animal) => void` 可赋给 `(d: Dog) => void` | 能处理所有动物的函数，当然能处理狗 |
| 双变（方法简写参数） | 两个方向都允许 | 历史兼容，不安全 |

```ts
type Handler<T> = (x: T) => void
declare let hAnimal: Handler<Animal>
declare let hDog: Handler<Dog>
hDog = hAnimal // ✅ 逆变
hAnimal = hDog // ❌（strictFunctionTypes 下）——hDog 可能会调用 Dog 才有的方法
```

**关键细节：** `strictFunctionTypes` 只对**函数属性写法**生效，对**方法简写**不生效。

```ts
interface A { fn: (x: Dog) => void }  // 严格逆变
interface B { fn(x: Dog): void }      // 双变（为了让 Array<Dog> 能赋给 Array<Animal>）
```

**数组协变是不安全的（TS 有意妥协）：**

```ts
const dogs: Dog[] = []
const animals: Animal[] = dogs // ✅ 允许
animals.push(new Cat())        // 编译通过，但运行时 dogs 里混进了猫
```

**TS 4.7 起可以显式标注变型：** `interface Box<out T>`（协变）、`<in T>`（逆变）、`<in out T>`（不变）。

**追问：** `UnionToIntersection` 为什么能把联合变成交叉？
**答：** 先分布，构造出 `(x: A) => void | (x: B) => void`；再在**参数（逆变）位置**做 `infer`。同一个类型变量在多个逆变位置的候选，会被推断成**交叉**（协变位置的候选则推断成联合）。

---

## 五、收窄与控制流分析

编译器沿着代码分支追踪变量的类型：

| 手段 | 例子 | 局限 |
| --- | --- | --- |
| `typeof` | `typeof x === 'string'` | `typeof null === 'object'` |
| `instanceof` | `e instanceof Error` | 跨 realm（iframe）失效；对接口无效 |
| `in` | `'swim' in pet` | 可选属性会让收窄不完整 |
| 字面量判等 | `s.kind === 'circle'` | 需要设计可辨识字段 |
| 真值 | `if (x)` | 会把 `0`、`''` 也排除掉 |
| 自定义守卫 | `(x): x is User =>` | 守卫逻辑写错时，编译器不会发现 |
| 断言函数 | `asserts x is User` | 只能用于语句，不能用在表达式里 |

**收窄失效的常见场景：**

```ts
function f(obj: { v: string | null }) {
  if (obj.v !== null) {
    setTimeout(() => obj.v.length) // ❌ 回调里收窄失效：属性可能被修改
  }
  const v = obj.v
  if (v !== null) setTimeout(() => v.length) // ✅ 先存进 const
}
```

TS 5.4 起，闭包在**最后一次赋值之后**创建时，可以保留收窄结果；TS 5.5 起，`arr.filter(x => x !== null)` 能自动推断成类型守卫。

---

## 六、类型推断

### 1. 字面量拓宽（Widening）

```ts
let a = 'hi'        // string（let 会拓宽）
const b = 'hi'      // 'hi'
const o = { k: 'hi' } // { k: string }（对象属性可变，所以拓宽）
const o2 = { k: 'hi' } as const // { readonly k: 'hi' }
```

### 2. 上下文类型（Contextual Typing）

```ts
window.addEventListener('click', e => e.clientX) // e 根据事件名推断成 MouseEvent
```

### 3. 泛型推断与 `const` 类型参数（TS 5.0）

```ts
function tuple<const T extends readonly unknown[]>(...xs: T) { return xs }
const t = tuple('a', 1) // readonly ['a', 1]，而不是 (string | number)[]
```

### 4. `NoInfer`（TS 5.4）

```ts
function pick<T extends string>(opts: T[], def: NoInfer<T>) {}
pick(['a', 'b'], 'c') // ❌ 没有 NoInfer 时，T 会被推断成 'a'|'b'|'c'
```

### 5. `satisfies`（TS 4.9）

```ts
const routes = {
  home: '/',
  user: '/user/:id',
} satisfies Record<string, string>
routes.user // 仍然是字面量类型，同时校验了结构
```

**`satisfies` 和类型注解的区别：** 注解（`const x: T`）会把类型**拓宽**成 T；`satisfies` 只做**校验**，保留推断出来的更精确的类型。

---

## 七、条件类型的分布式规则

规则：`T extends U ? X : Y` 中，**`T` 是裸类型参数**并且被实例化为联合时，会逐个成员计算。

```ts
type IsString<T> = T extends string ? true : false
type A = IsString<string | number> // boolean（true | false）

type IsString2<T> = [T] extends [string] ? true : false
type B = IsString2<string | number> // false
```

**容易踩的坑：**
1. `never` 是**空联合**，分布后结果仍然是 `never`。所以 `IsNever<T>` 必须写成 `[T] extends [never]`。
2. `boolean` 实际上是 `true | false`，也会被分布。
3. 只有**裸** `T` 才会分布：`T[]`、`[T]`、`keyof T` 都不会。

---

## 八、interface 与 type 的底层差异

| 维度 | `interface` | `type` |
| --- | --- | --- |
| 声明合并 | ✅（模块增强靠它） | ❌ |
| 联合 / 元组 / 映射 / 条件 | ❌ | ✅ |
| `extends` 冲突检查 | 继承时如果属性冲突，**立刻报错** | `&` 冲突时静默变成 `never` |
| 检查性能 | 关系会被缓存，大型项目更快 | 大型交叉类型需要反复计算 |
| 错误信息 | 显示接口名 | 可能把整个结构展开显示 |

**建议：** 对象形状和对外扩展点用 `interface`；联合、函数类型、类型运算用 `type`。

---

## 九、面试追问速答

1. **TS 类型能影响运行时吗？** 不能。类型会被完全擦除（`enum`、参数属性、装饰器这类会产出代码的语法除外），运行时安全要靠校验库（zod 等）。
2. **`{}`、`object`、`Object` 有什么区别？** `{}` 表示除了 `null/undefined` 以外的任何值（包括原始类型）；`object` 只表示非原始类型；`Object` 和 `{}` 接近，但会检查 `toString` 等方法签名，基本不用。
3. **`any` 和 `unknown` 选哪个？** 外部输入一律用 `unknown`，先收窄再用；`any` 会关闭检查并向外传染。
4. **为什么 `Object.keys(obj)` 返回 `string[]` 而不是 `(keyof T)[]`？** 因为结构类型下，对象运行时可能有更多键，返回 `keyof T` 是不安全的。
5. **类型兼容和类型相等有什么区别？** 兼容是单向可赋值；相等要双向兼容，而且要处理 `any` 这类特殊情况，所以严格判等需要用 `Equal` 那种技巧。

---

## 相关文章

- [TypeScript 面试提纲](/posts/typescript/typescript-interview/)
- [手写工具类型 20 题](/posts/typescript/typescript-handwritten-types/)
- [TypeScript 工程化](/posts/typescript/typescript-engineering/)
- [JavaScript 基础八股与手写题](/posts/typescript/js-fundamentals-interview/)
