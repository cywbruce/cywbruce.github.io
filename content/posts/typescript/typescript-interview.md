---
title: TypeScript 核心面试知识点（初 / 中 / 高 + 追问）
date: 2026-11-04
summary: 面试官提纲：类型基础、泛型、工具类型、类型体操边界、与 React 结合，按初中高级追问定级。
kind: qa
---

面向**面试官**。TypeScript 题很容易变成背工具类型名词；更好的筛法是：**能否用类型表达业务约束，并在严格度和生产力之间取舍。**

---

## 怎么用这份提纲定级

| 级别 | 大致画像 | 回答特征 |
| --- | --- | --- |
| 初级 | 能给 props/函数补类型，项目能过编译 | 熟悉 interface / type / 联合 / 可选 |
| 中级 | 能写泛型组件与工具类型，会收窄 | 能解释推断、`extends`、映射类型 |
| 高级 | 能定 `tsconfig` 与类型规范，解复杂建模 | 谈可维护性、性能（类型检查）、避免过度体操 |

---

## 一、类型基础与建模

### 初级

**主问：** `interface` 和 `type` 有什么区别？项目里你怎么选？

**期望要点：** 都能描述对象；`type` 擅长联合/元组/映射；`interface` 可声明合并；现代项目两者都能用，团队统一即可。

**追问：**

1. `any`、`unknown`、`never` 分别什么时候用？  
2. 可选属性 `?` 和 `| undefined` 有何细微差别？  
3. 枚举 `enum` 和联合字面量类型你更推荐哪个？为什么？

**定级信号：** 日常类型写得对，知道少用 `any`。

### 中级

**主问：** 如何给「多种状态的请求结果」建模？（idle / loading / success / error）

**期望要点：** 可辨识联合（discriminated union）；`switch` + 收窄后字段安全。

```ts
type Result<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error }
```

**追问：**

1. 为什么用可辨识联合比 `data?: T; error?: Error` 更安全？  
2. `satisfies` 运算符解决什么问题？  
3. 对象「只读深层」怎么表达？（`Readonly` 不够时）

**定级信号：** 会用联合表达业务状态 → 中级。

### 高级

**主问：** 领域模型里「金额 / 用户 ID / 普通 number/string」如何避免混用？类型过度设计的边界在哪？

**期望要点：** branded types、名义类型技巧；也要承认成本（样板、互通）；关键路径才加强。

**追问：** 跨包共享类型时，如何避免「类型源真相」分裂？

---

## 二、函数、泛型与推断

### 初级

**主问：** 如何给函数标注参数和返回值？什么时候可以省略返回值类型？

**期望要点：** 参数通常显式；返回值可推断；对外 API / 公共库建议显式，防止推断漂移。

**追问：** 可选参数和默认参数在类型上要注意什么？

### 中级

**主问：** 写一个 `prop` 函数：`prop(obj, key)` 返回值类型要跟键走。

**期望要点：**

```ts
function prop<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key]
}
```

**追问：**

1. `keyof`、`T[K]`、`extends` 在这里各起什么作用？  
2. 若 `key` 是字符串运行时变量，类型怎么安全收窄？  
3. 泛型默认值 `<T = string>` 什么场景有用？

**定级信号：** 独立写出 `keyof` 约束 → 中级。

### 高级

**主问：** 如何设计一个类型安全的事件总线或路由 params 推断？推断失败时你怎么调试？

**期望要点：** 映射类型 + 泛型约束；看生成的类型、拆中间 `type`、避免循环；权衡 `as` 逃生舱。

**追问：** 条件类型分布式特性坑过你吗？举例。

---

## 三、工具类型与类型编程

### 初级

**主问：** 常用工具类型：`Partial`、`Required`、`Pick`、`Omit`、`Record` 各举一个业务例子。

**追问：** `Pick` 和手动再写一个 interface 如何选？

### 中级

**主问：** `Partial` 大概怎么实现？`ReturnType`、`Parameters` 有什么用？

**期望要点：** 映射类型 + `keyof`；从函数抽类型，利于包装 hooks / API client。

**追问：**

1. `Readonly<T>` 和 `as const` 关系？  
2. 如何把 `{ a: string; b?: number }` 变成所有键必填且去掉 undefined？  
3. 模板字面量类型用过吗？用在什么场景（路由 path、事件名）？

### 高级

**主问：** 什么时候该上「类型体操」，什么时候该停？如何保证类型错误信息对同事可读？

**期望要点：** 库作者 / 强约束 DSL 才值得深体操；业务代码优先简单模型；用中间类型、报错测试、文档化。

**追问：** 类型检查变慢你怎么排查？（大联合、交叉、非尾递归条件类型等）

---

## 四、收窄、断言与运行时

### 初级

**主问：** `as` 类型断言和类型守卫有什么区别？

**期望要点：** 断言是编译期告诉编译器；守卫是运行时检查并收窄；优先守卫与合法收窄。

**追问：** `as const` 和 `as SomeType` 不是一类东西，能说说吗？

### 中级

**主问：** 如何写一个 `isUser` 类型守卫？`assert` 函数返回 `asserts x is T` 什么场景用？

**追问：**

1. `in`、`typeof`、`instanceof`、可辨识字段，各自局限？  
2. `JSON.parse` 结果如何安全进业务类型？（zod 等）  
3. 为什么说「TypeScript 不消除运行时错误」？

**定级信号：** 强调运行时校验边界 → 扎实中级。

### 高级

**主问：** 前后端契约（OpenAPI / tRPC / zod）在类型流中怎么接？出事故时常见断裂点在哪？

**期望要点：** 生成类型与校验单源；版本化；客户端勿盲信断言；边界校验。

---

## 五、与 React / 工程结合

### 初级

**主问：** 函数组件的 `props` 怎么写？`children` 类型怎么写？

**期望要点：** `type Props = { ... }`；`React.ReactNode`；事件类型 `React.ChangeEvent<HTMLInputElement>` 等。

**追问：** `FC` 还建议用吗？为什么很多团队不推荐？

### 中级

**主问：** 泛型组件怎么写？例如 `Table<T>` 的 `columns` 与 `data` 如何约束在一起？

**追问：**

1. `useRef` 在 DOM 与可变值两种场景类型差异（`null` 初始值）？  
2. `useState` 推断不出来时如何显式标注？  
3. 高阶组件或 `forwardRef` 的类型难点是什么？

### 高级

**主问：** 制定团队 TS + React 规范：`strict` 开关、禁止策略、`any` 治理、第三方坏类型怎么包一层？

**期望要点：** `strict`、`noUncheckedIndexedAccess` 等取舍；`eslint` 限制；渐进打补丁；不要为过关而全局关闭检查。

**追问：**

1. monorepo 里共享 UI 包的类型入口与 `peerDependencies` 注意点？  
2. 路径别名、项目引用（project references）什么时候上？  
3. 如何评审「为了过编译而 `as any`」的 PR？

---

## 六、速查：按级别建议题单（约 40 分钟）

| 级别 | 建议主问 |
| --- | --- |
| 初级 | interface/type、any/unknown、props 标注、常用工具类型 |
| 中级 | 可辨识联合、`keyof` 泛型、类型守卫、泛型列表组件 |
| 高级 | 契约与运行时校验、规范与 `strict`、类型性能与可读性权衡 |

**初级过线：** 少 `any`、props 正确、懂基础工具类型。  
**中级过线：** 联合建模 + 泛型约束 + 守卫。  
**高级过线：** 能定规范、接好运行时边界、知道何时不要炫技。

---

## 附：追问参考答案

### 一、类型基础与建模

- **any / unknown / never：** `any` 关闭检查，会传染，只在迁移期临时用；`unknown` 用于外部输入，必须先收窄才能使用；`never` 用于穷尽检查、不可能的分支，以及只抛异常的函数的返回值。
- **`?` 和 `| undefined`：** `a?: T` 表示键可以不存在；`a: T | undefined` 表示键必须存在，但值可以是 undefined。开启 `exactOptionalPropertyTypes` 后，`a?: T` 不允许显式赋值 `undefined`。
- **enum 和字面量联合：** 推荐 `as const` 对象加字面量联合。原因是不产生运行时代码，和 `isolatedModules`、类型擦除工具兼容，也不会有数字枚举那样的宽松赋值问题。
- **可辨识联合为什么更安全：** `data?: T; error?: Error` 允许「两个都有」或「两个都没有」这种非法组合；可辨识联合让非法状态在类型上无法表示，`switch` 收窄后访问字段也是安全的。
- **satisfies：** 只校验值符合某个类型，不会把推断结果拓宽成那个类型。适合配置对象，既保证结构正确，又保留字面量键和值。
- **深层只读：** 内置 `Readonly` 只作用于第一层，需要递归写 `DeepReadonly`，并排除函数；如果只针对单个值，用 `as const` 更简单。
- **跨包类型单一来源：** 类型放进独立的 `types` 包，或者从 schema 生成（OpenAPI / zod / Prisma）；业务包只引用、不复制；在 CI 里校验生成的类型和 schema 是否一致。

### 二、函数、泛型与推断

- **可选参数和默认参数：** 可选参数必须放在必选参数后面，类型里会带 `| undefined`；有默认值的参数在函数内部不会是 undefined，对调用方来说仍然可以不传。
- **keyof / T[K] / extends：** `keyof T` 取出键的联合；`K extends keyof T` 约束 key 只能是合法的键；`T[K]` 是索引访问类型，让返回值跟着键变化。
- **运行时字符串 key：** 先用守卫收窄，例如 `function isKey<T extends object>(o: T, k: PropertyKey): k is keyof T { return k in o }`，不要直接用 `as keyof T`。
- **泛型默认值：** 用于大多数调用方不需要传泛型的 API，例如 `useState<T = undefined>`、`EventEmitter<E = Record<string, any[]>>`。
- **分布式的坑：** `type IsNever<T> = T extends never ? true : false`，传入 never 时得到 never 而不是 true；`ToArray<string | number>` 得到的是 `string[] | number[]`。用 `[T]` 包一层可以关闭分布。详见 [类型系统原理](/posts/typescript/typescript-type-system/)。

### 三、工具类型与类型编程

- **Pick 还是手写 interface：** 和原类型强相关时用 `Pick` / `Omit` 派生，原类型变化会自动同步；两者语义已经独立，未来会各自演化时，就单独定义。
- **Readonly 和 as const：** `Readonly<T>` 作用于类型，只读一层；`as const` 作用于值，会把整个字面量变成深层只读，并且保留字面量类型。
- **全部必填并去掉 undefined：** `{ [K in keyof T]-?: Exclude<T[K], undefined> }`，或者 `Required<T>` 加 `NonNullable`。
- **模板字面量：** 用于事件名（`on${Capitalize<K>}`）、路由参数提取、CSS 单位、i18n 键路径。见 [手写工具类型 20 题](/posts/typescript/typescript-handwritten-types/)。
- **类型检查变慢：** 用 `--extendedDiagnostics` 和 `--generateTrace` 定位，详见 [工程化](/posts/typescript/typescript-engineering/)。

### 四、收窄、断言与运行时

- **as const 和 as T：** `as const` 是「更窄的推断」，安全；`as T` 是「让编译器相信我」，可能是在撒谎。
- **各收窄手段的局限：**
  - `typeof null` 是 `'object'`；
  - `instanceof` 跨 iframe 会失效，而且对 interface 无效；
  - `in` 遇到可选属性时收窄不完整；
  - 可辨识字段需要在设计阶段就预留。
- **JSON.parse 的结果：** 类型是 `any`，应该先当作 `unknown`，再用 zod 之类的库 `schema.parse(x)`，类型用 `z.infer<typeof schema>` 推导，让校验逻辑和类型共用一份定义。
- **TS 不消除运行时错误：** 类型在编译后会被擦除。外部数据、`as` 断言、`any`、数组越界（没开 `noUncheckedIndexedAccess` 时），都能让编译期的类型和运行时的值不一致。

### 五、与 React / 工程结合

- **FC 是否推荐：** 早期的 `React.FC` 会隐式带上 `children`，对泛型组件不友好，`defaultProps` 推断也有问题。现在更推荐普通函数加 `Props` 类型。React 18 的类型去掉了隐式 `children`，但大多数团队仍然沿用普通函数写法。
- **泛型 Table：**

```tsx
type Column<T> = { key: keyof T; title: string; render?: (row: T) => React.ReactNode }
function Table<T extends { id: React.Key }>({ data, columns }: { data: T[]; columns: Column<T>[] }) { /* ... */ }
```

- **useRef：** `useRef<HTMLDivElement>(null)` 得到的 `.current` 是只读的 `RefObject`，供 DOM 绑定使用；`useRef<number | null>(null)` 得到可变的 `MutableRefObject`，用来存定时器 ID 之类的值。
- **useState 推断不出来：** 例如 `useState<User | null>(null)`、`useState<string[]>([])`。空数组和 null 作为初始值时，必须显式标注类型。
- **forwardRef 和高阶组件：** `forwardRef` 会丢失泛型，常见的解法是类型断言或 `as` 包装，React 19 起 `ref` 可以直接作为 prop 传入；高阶组件的难点在于 props 的注入和剔除（`Omit<P, Injected>`），以及透传静态属性。
- **monorepo 共享 UI 包：** `react` 放进 `peerDependencies`，避免出现两份 React；类型入口通过 `exports.types` 暴露；用 project references 做增量构建。
- **路径别名和 project references：** 层级很深的 import 用路径别名，同时要配好打包器；包很多、`tsc` 很慢时，上 project references。
- **评审 `as any` 的 PR：** 先要求说明原因，再按顺序找替代方案：正确的类型 → 守卫 → `unknown` 加校验 → 最小范围的 `as`，最后才考虑 `// @ts-expect-error` 并附说明。用 ESLint 规则禁止新增 `any`，再配合 CI 统计数量，只允许下降。

---

## 七、相关文章

- [React 面试提纲](/posts/react/react-interview/)  
- [Hook 与工具函数](/posts/react/hook-vs-utils/)
- [手写工具类型 20 题](/posts/typescript/typescript-handwritten-types/)  
- [TypeScript 工程化：tsconfig、声明文件与编译链](/posts/typescript/typescript-engineering/)
- [TypeScript 类型系统原理](/posts/typescript/typescript-type-system/)  
- [JavaScript 基础八股与手写题](/posts/typescript/js-fundamentals-interview/)
