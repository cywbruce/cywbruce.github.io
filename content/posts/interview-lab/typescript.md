---
title: "TypeScript 面试题库（含追问链与定级指南）"
date: 2026-11-20
order: 801
summary: "结构化类型、泛型与条件/映射类型、类型体操的度与 Go 编译器。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **TypeScript 类型系统本质与类型编程能力** 的真实深度"问出来"。
> 核心原则：**TS 的每道题最终都落到"类型是一套编译期约束系统、会被完全擦除、且本身图灵完备可编程"这条主线**。只会写 `interface`、满屏 `any` 却讲不清类型何时拓宽、条件类型为何分发的人，基本停留在 API 记忆层。配套：与 Java 并发/集合/技术栈等套题共同构成"全栈工程师面试定级体系"，可独立使用，按 L1–L5 统一标尺定级。

---

## 目录

- [Part 0：30 秒标准总答](#part-0)
- [Part 1：基础认知题](#part-1)
- [Part 2：底层原理题（类型本质与收窄）](#part-2)
- [Part 3：核心区分度题（类型编程，定级主战场）](#part-3)
- [Part 4：实战与陷阱题（工程配置与类型体操的度）](#part-4)
- [Part 5：2026 新趋势（satisfies、const 参数、Go 编译器）](#part-5)
- [Part 6：能否用 TypeScript 定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 TypeScript 的理解。**（标准答法 30 秒，五个得分点）

> TypeScript 是 JavaScript 的**超集**，在 JS 之上加了一套**静态类型系统**，任何合法 JS 都是合法 TS。
> 它的类型系统是**结构化类型（structural typing）**：兼容由"结构/成员"决定，而非像 Java 那样由名字决定，即"鸭子类型"。
> 类型是**编译期的约束（值的集合）**：`tsc` 在编译期做静态检查，编译后**类型信息被完全擦除，只输出纯 JS**——TS 不生成运行时代码，也不做运行时检查。
> 收益是 **IDE 提示、编译期排错、安全重构和团队协作契约**，适合大型项目。
> 更进一步，类型系统**图灵完备**，可用条件类型/`infer`/映射类型做"类型编程"；但复杂类型有可读性与编译性能代价，必要时用 `any`/断言作"逃生舱"。

**评分要点：** 超集 / 结构化类型 / 编译期检查且擦除 / 静态约束 / 类型可编程与逃生舱五点。能说出"类型擦除""结构化类型"的，直接往 Part 2 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题

### Q1. TypeScript 是什么？和 JavaScript 什么关系？为什么要学它？

**标准答案：** TS 是 JS 的**带类型超集**：语法兼容 JS，额外增加类型注解、接口、泛型等**只在编译期存在**的语法。流程是 `.ts` →（tsc/Babel/esbuild 转译）→ `.js` → 浏览器或 Node 运行，**运行时看到的是纯 JS**。收益：① 编译期报错而非上线后；② IDE 精准补全；③ 重命名等重构更安全；④ 类型即文档、团队协作契约。

**追问 1：TS 是"强类型"还是"静态类型"？运行时会检查类型吗？**
> **答案：** 是**静态类型**（编译期检查）；"强/弱"定义模糊，一般不用于描述 TS。关键是**运行时零检查**——类型注解被擦除后，`let a: number = 'x'` 只能在编译期被拦，绕过编译（`any` 或 JS 直调）后运行不报错。

**追问 2：`.ts` 能直接丢进浏览器跑吗？TS 生成运行时代码吗？**
> **答案：** 不能，必须编译/转译。**TS 不生成运行时代码**——注解、接口、断言全部擦除；唯一例外是 `enum`、命名空间、装饰器等少数"有运行时语义"的语法（见 Part 4）。这就是"类型零成本"的由来。

---

### Q2. 结构化类型（structural typing）和名义类型（nominal typing）有何区别？

**标准答案：** **结构化类型**只看**结构（成员名与类型）是否匹配**，不看名字，即"鸭子类型"，TS 主要采用；**名义类型**由**声明的名字/继承关系**决定（Java/C#），结构相同但名字不同的类互不兼容。
```ts
interface Point { x: number; y: number }
interface Vec2  { x: number; y: number }
const p: Point = { x: 1, y: 2 };
const v: Vec2 = p; // OK：结构相同即可赋值
```

**追问 1：TS 里能否实现"名义类型"？**
> **答案：** 可以：① 类的私有字段（`#x`/`private`）——结构相同但私有字段来自不同声明则不兼容；② `unique symbol` 作标记；③ **品牌类型** `type UserId = string & { __brand: 'UserId' }`，让 `UserId` 与裸 `string` 不兼容。

**追问 2：结构化类型有什么坑？**
> **答案：** 语义不同但结构相同的类型会被误赋值，如 `UserId` 与 `OrderId` 都是 `string`，可随意互换埋下"用错 ID"隐患。这正是大项目引入 branded type 的原因。

---

<a id="part-2"></a>

## Part 2：底层原理题（类型本质与收窄）

> "会写类型注解"和"懂类型系统"的分水岭，L2→L3 的关键。

### Q3. "类型是什么"？怎么理解"类型是值的集合/约束"？编译期与运行时的关系？

**标准答案：** 类型可看作**值的集合**（约束）：`string` 是所有字符串集合，`42` 是单值集合，`never` 是**空集**，`unknown` 是**全集**（top type）。类型检查是**编译期静态分析**，不运行程序就推导并验证约束。编译后类型**全部擦除**，所以类型只能覆盖"编译期可静态判定"的部分，运行时动态数据（接口返回、用户输入）不在保护范围。

**追问 1：`never` 与 `unknown` 对应什么集合？在类型运算中是什么角色？**
> **答案：** `never` 是空集（bottom，可赋给任何类型，代表"永不存在的值"）；`unknown` 是全集（top，任何值可赋给它，但不能直接使用）。运算上 `A | never = A`，`A & unknown = A`。

**追问 2：类型被擦除，TS 能防止运行时错误吗？**
> **答案：** 只能防编译期可静态推断的部分。对系统边界的不可信数据，必须用**运行时**校验库（Zod、io-ts）或类型守卫校验后再收窄为 TS 类型——"类型只覆盖编译期，边界另行校验"是核心实践。

---

### Q4. `any` / `unknown` / `never` / `void` 的区别？为何 `unknown` 比 `any` 安全？

**标准答案：**

| 类型 | 含义 | 关键特性 |
|------|------|---------|
| `any` | 任意类型 | **跳过检查**、有传染性，逃生舱也是漏洞源 |
| `unknown` | 未知类型 | top type，**安全版 any**：使用前必须收窄 |
| `never` | 不存在的值 | bottom type，用于**穷尽检查**、联合排除 |
| `void` | 无返回值 | 表示"不关心返回值"，无 `return` 时推断为 void |

`unknown` 更安全，因为它**强制先证明类型再用**，把错误从运行时提前到编译期；`any` 直接放弃检查。

**追问 1：为何 `unknown` 必须先收窄？怎么收窄？**
> **答案：** 编译器不知真实类型，直接 `.toFixed()` 会报错。须用 `typeof`/`instanceof`/真值/`in`/类型谓词/断言收窄成具体类型后才可操作——这层"强制确认"正是它安全的根源。

**追问 2：`never` 在实战怎么用？**
> **答案：** ① **穷尽检查**：`switch` 的 `default` 写 `const _x: never = value`，漏处理分支就报错；② **联合排除**：`Exclude<'a'|'b','a'>` 中命中分支返回 `never` 被联合忽略（见 Q8 分布式条件类型）。

**追问 3：`void` 和 `undefined` 区别？**
> **答案：** 严格模式下不完全等价：返回 `undefined` 的函数可赋给期望 `() => void` 的位置（void 允许忽略返回值），但返回非 undefined 的函数不能赋给 `() => undefined`。`void` 表达"不关心返回什么"。

---

### Q5. 字面量类型、类型拓宽（widening）、`as const`、类型收窄（narrowing）是什么？

**标准答案：** **字面量类型**是 `"hi"`、`42`、`true` 这类单值类型。**拓宽**：`let x = 'hi'` 推断为 `string`，`const x = 'hi'` 推断为 `"hi"`（const 不拓宽），但 `const o = { a: 'hi' }` 的 `o.a` 仍拓宽为 `string`（const 只锁引用不锁属性）。**`as const`**：const 断言，递归加 `readonly` 且字面量不拓宽。**收窄**：在控制流中把宽类型缩为窄类型，手段有 `typeof`、`instanceof`、真值守卫、`in`、**可辨识联合**、类型谓词 `x is T`。
```ts
const cfg = { method: 'GET' } as const; // cfg.method: 'GET'（非 string）
```

**追问 1：`as const` 和 `const` 声明区别？**
> **答案：** `const` 只锁**引用**不可重赋值，对象属性仍可变、仍拓宽；`as const` 作用于**值本身**，递归只读并保留字面量，常用于不可变配置、元组、联合类型的来源。

**追问 2：可辨识联合为何是收窄利器？**
> **答案：** 给联合每个成员一个共同**字面量判别字段**（如 `kind: 'circle'|'square'`），`switch(kind)` 时 TS 精确收窄到对应成员、安全访问专有属性；配合 `default` 的 `never` 穷尽检查，漏分支即报错——这是建模标签联合/状态机的标准范式。

---

<a id="part-3"></a>

## Part 3：核心区分度题（类型编程，定级主战场）

> **全题题眼**——能否把类型当"可编程的约束系统"用，直接决定 L2 还是 L3/L4。
> 主线：**泛型=参数化，条件类型=分支，infer=解构，映射类型=遍历**。

### Q6. 泛型的本质？泛型约束 `extends` 和默认值有何用？

**标准答案：** 泛型是**类型参数化**：把类型当参数延迟到调用时确定，从而**不丢失类型关联地复用代码**；函数、接口、类都可泛型化。与 `any` 的本质区别：泛型**保留输入输出的类型关系**（传 `string` 返 `string`），`any` 丢失一切关联——泛型是"类型安全的多态"。
```ts
function identity<T>(x: T): T { return x; }
interface Box<T> { value: T }
```

**追问 1：`extends` 约束解决什么问题？**
> **答案：** 限制参数形态以安全访问属性，如 `function len<T extends { length: number }>(x: T)` 保证 `T` 有 `length`，否则编译期拦截，比 `any` 安全。

**追问 2：泛型默认值与 `keyof` 约束？**
> **答案：** `<T = string>` 提供默认值；`<K extends keyof T>` 把参数限制为 `T` 的键集合，是写 `get<T,K extends keyof T>(o:T,k:K): T[K]` 类型安全取属性函数的基础。

---

### Q7. 常用工具类型（Partial/Pick/Omit/Exclude/ReturnType 等）的实现原理？

**标准答案：** （能现场手写几个基本是 L3+）

| 工具类型 | 作用 | 核心实现 |
|---------|------|---------|
| `Partial<T>` | 全部可选 | `{ [P in keyof T]?: T[P] }` |
| `Required<T>` | 全部必填 | `{ [P in keyof T]-?: T[P] }` |
| `Pick<T,K>` | 挑出指定键 | `{ [P in K]: T[P] }` |
| `Omit<T,K>` | 排除指定键 | `Pick<T, Exclude<keyof T, K>>` |
| `Record<K,T>` | 键到值映射 | `{ [P in K]: T }` |
| `Exclude<T,U>` | 从 T 去掉 U | `T extends U ? never : T` |
| `Extract<T,U>` | 取属于 U 的 | `T extends U ? T : never` |
| `NonNullable<T>` | 去 null/undefined | `T extends null \| undefined ? never : T` |
| `ReturnType<T>` | 取返回值 | `T extends (...a:any[]) => infer R ? R : never` |
| `Parameters<T>` | 取参数元组 | `T extends (...a:infer P) => any ? P : never` |

底层只依赖四件事：**`keyof`、映射类型、条件类型、`infer`**。

**追问 1：`Partial` 为何能"加问号"？`-?` 是什么？**
> **答案：** 映射类型 `[P in keyof T]` 遍历所有键，`?` 是映射的**修饰符**给属性加可选，`-?` 移除可选；同理 `readonly`/`-readonly` 控制只读。

**追问 2：`Exclude` 为何能"排除"？**
> **答案：** 依赖**分布式条件类型**：`'a' extends 'a'|'b' ? never : T` 命中返回 `never`、未命中返回自身，`never` 在联合中被忽略，剩下的即"不属于 U 的部分"。

---

### Q8. 条件类型、`infer`、分布式条件类型是什么？如何关闭分发？

**标准答案：** **条件类型** `T extends U ? X : Y`，类型层面的三元，是类型编程的"分支"。**`infer`** 在条件类型中声明"待推断类型变量"以**解构/提取**类型，如 `ReturnType` 的 `infer R`。**分布式条件类型**：当 `T` 是**裸类型参数**且出现在 `extends` 左侧，联合会**逐成员分发**再联合。
```ts
type ToArray<T> = T extends unknown ? T[] : never;
type A = ToArray<string | number>; // string[] | number[]（分发）
```

**追问 1：什么是"裸类型参数"？如何关闭分发？**
> **答案：** `T extends ...` 中 `T` 未被包裹才分发；用元组包一层 `[T] extends [U]` 即关闭，整体作为一个判断，得 `(string|number)[]`。这是区分真高手的经典追问。

**追问 2：`infer` 在 `ReturnType` 里做了什么？能多层吗？**
> **答案：** `infer R` 声明占位变量，匹配成功后绑定为真实返回类型。可嵌套、可递归——`Awaited<T>` 就是递归 `infer` + 条件类型，一层层剥掉 Promise 拿到最内层值类型。

**追问 3：为何说条件类型是类型编程核心？**
> **答案：** 它提供分支，配合 `infer`（解构）、映射类型（遍历）、递归（循环），让类型系统图灵完备，能写任意复杂的"类型级计算"——即"类型体操"的由来与边界（见 Q13）。

---

### Q9. 映射类型、`keyof`/`typeof`、模板字面量、递归类型、`UnionToIntersection` 怎么手写？

**标准答案：** （L4 分水岭，考察综合类型编程）
- `keyof` 取键联合、`typeof` 取值类型，是从"值世界"通往"类型世界"的桥梁。
- **映射类型** `{ [K in keyof T]: ... }` 遍历键并变换，可配合 `as` 重映射键名；**模板字面量类型** `` `on${Capitalize<K>}` `` 在类型层拼接字符串生成派生键。
- **递归类型**（`DeepReadonly`）与**联合转交叉**（借函数参数的**逆变**推断交叉）：
```ts
type DeepReadonly<T> = { readonly [K in keyof T]:
  T[K] extends object ? DeepReadonly<T[K]> : T[K] };
type UnionToIntersection<U> =
  (U extends unknown ? (arg: U) => void : never) extends
  ((arg: infer I) => void) ? I : never;
// UnionToIntersection<{a:1}|{b:2}> => {a:1} & {b:2}
```

**追问 1：`UnionToIntersection` 为何绕一层函数参数？**
> **答案：** 在**逆变位置**（函数参数）对多个候选 `infer` 推断得到的是**交叉类型**（协变位置得联合）。先用分布式条件把联合成员变成各自函数签名，再统一 `infer`，即可把联合"合"成交叉——类型体操最经典技巧之一。

**追问 2：递归类型有什么限制？**
> **答案：** 递归深度有上限，过深报 "Type instantiation is excessively deep"；TS 4.5 起对部分尾递归做了优化。生产要克制层级，避免类型实例化爆炸拖慢编译。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题（工程配置与类型体操的度）

### Q10. `interface` 和 `type` 有何区别？什么是声明合并？

**标准答案：**

| 维度 | `interface` | `type` |
|------|------------|--------|
| 声明合并 | **支持**（同名自动合并） | 不支持（重复声明报错） |
| 描述范围 | 对象/类结构 | 任意类型：联合/交叉/元组/字面量/映射 |
| 扩展 | `extends`/`implements` | 用交叉 `&` 模拟 |
| 场景 | 对象建模、公共 API、库类型 | 联合交叉、工具类型、复杂运算 |

**声明合并**：多个同名 `interface` 合并成一个，常用于扩展第三方库类型。
```ts
declare global { interface Window { myGlobal: string } }
```

**追问 1：何时用 interface、何时用 type？**
> **答案：** 描述对象/类、需 `implements` 或将来可能被合并扩展（尤其写库）用 `interface`；表达联合、交叉、条件类型等复杂类型用 `type`。团队应统一约定、避免混用。

**追问 2：声明合并的用途与风险？**
> **答案：** 用途是给第三方类型"打补丁"（如给 Express 的 `Request` 加字段）；风险是同名合并可能意外叠加成员、且只在同一作用域生效，滥用会让类型来源难追踪。

---

### Q11. `tsconfig.json` 有哪些关键配置？`strict` 家族包含什么？

**标准答案：** **输出相关**：`target`（目标 JS 版本）、`module`（模块规范）、`moduleResolution`（解析策略，如 `bundler`/`node16`）、`outDir`、`noEmit`（只检查不产出）、`declaration`（生成 `.d.ts`）。**`strict` 家族**（`strict:true` 一次打开）：`noImplicitAny`、`strictNullChecks`、`strictFunctionTypes`、`strictBindCallApply`、`strictPropertyInitialization`、`noImplicitThis`、`alwaysStrict`。**路径**：`paths`+`baseUrl` 配别名（需构建工具同步解析）。

**追问 1：`strictNullChecks` 开启后的直接影响？**
> **答案：** `null`/`undefined` 不再能赋给任意类型，必须显式处理（`?.`、`??`、类型守卫）。它是 TS 从"能跑"到"可靠"的关键开关，成熟项目几乎必开。

**追问 2：`noEmit` 和 `declaration` 各用在哪？**
> **答案：** `noEmit` 让 tsc 只检查、由 Babel/esbuild/Vite 转译（追求速度）；`declaration` 用于**发布库**时产出 `.d.ts` 供使用者获得提示。二者常配合 `emitDeclarationOnly`。

---

### Q12. `.d.ts`、`@types`、`declare module`、三斜线指令是什么？`enum` 与 `const enum` 有何坑？

**标准答案：** **`.d.ts`** 只含类型声明无实现，给无类型 JS 库描述类型；**`@types/xxx`** 是 DefinitelyTyped 社区声明包，`tsc` 自动加载 `node_modules/@types`；**`declare module 'x'`** 为模块写环境声明；**三斜线指令** `/// <reference path="..." />` 显式引入声明依赖（现代多用 `types`/`include` 替代）。**`enum`** 会生成**运行时对象**；**`const enum`** 编译期**内联**为字面量、不生成对象。

**追问 1：`enum` 有什么坑？更推荐的替代？**
> **答案：** 普通 enum 生成额外运行时代码；`const enum` 在 `isolatedModules`、`preserveConstEnums` 或经 Babel 转译时行为不一致（可能无法内联或产出对象），**库作者慎用**。推荐 `as const` 对象 + 联合类型：`const E = { A:'a', B:'b' } as const; type E = typeof E[keyof E]`，零运行时开销且纯类型。

**追问 2：给完全没类型的 JS 库接类型，流程？**
> **答案：** 先查 `@types`；没有就写 `.d.ts`（`declare module` 声明导出、`export` 描述成员），放 `types/` 并通过 `typeRoots`/`include` 引入；必要时 `declare global` 扩展全局。给开源库补类型是常见贡献方式。

---

### Q13. 类型体操的"度"在哪？何时用 `any`/断言逃生？复杂类型代价？

**标准答案：** **该写复杂类型**：公共 API、核心业务不变量、库类型定义——类型能真正防错、价值高。**该逃生**：第三方库无类型、动态/边界数据、原型阶段——用 `any`/`unknown`/`as` 把不确定性**隔离在最小范围**，边界处尽快用守卫转为精确类型。**代价**：① 拖慢编译、IDE 卡顿（类型实例化爆炸）；② 错误信息冗长；③ 团队上手门槛与维护成本上升。类型安全是手段不是目的。

**追问 1：为何复杂类型会拖慢编译？**
> **答案：** 条件类型分发、深层递归、大联合的笛卡尔积让编译器大量实例化，复杂度可爆炸式增长，表现为 tsc 变慢、VS Code 卡顿、"excessively deep"报错。

**追问 2：怎么让"逃生舱"不失控？**
> **答案：** 优先 `unknown` 而非 `any`（强制边界校验）；用 ESLint `no-explicit-any` 约束扩散；把断言集中在数据入口并写注释；对关键路径写**类型测试**（`expectType`/`tsd`）防类型回归。

---

<a id="part-5"></a>

## Part 5：2026 新趋势（加分题）

> 考察技术视野。涉及版本细节以官方文档为准，不确定的保守表述即可。

### Q14. `satisfies`、const 类型参数、`NoInfer` 各解决什么问题？

**标准答案：** **`satisfies`（TS 4.9）**：校验表达式是否符合某类型，**同时保留精确推断**——不像注解会拓宽、也不像 `as` 绕过检查。**const 类型参数（TS 5.0）**：`function f<const T>(x: T)` 让 `T` 推断为字面量而非拓宽，相当于把 `as const` 用在泛型参数上，适合配置、路由定义。**`NoInfer<T>`（TS 5.4）**：阻止某位置参与 `T` 的推断，让推断更可控（只从第一个参数推断，避免被第二个带偏成联合）。
```ts
const routes = { home: '/', about: '/about' } satisfies Record<string, string>;
// 既校验形状，又保留 '/'、'/about' 的字面量类型
```

**追问 1：`satisfies` 与 `as`、类型注解的核心区别？**
> **答案：** `: Type` 注解按目标类型**拓宽**并只做赋值兼容检查；`as Type` 是断言、**绕过检查**可能掩盖错误；`satisfies Type` **既检查又保留精确类型**。三者语义不同，高频辨析点。

**追问 2：const 类型参数的典型场景？**
> **答案：** 需保留对象键/值字面量类型时，如路由表、表单 schema、状态字典。过去要逐值加 `as const`，现在 `<const T>` 一处声明即可。

---

### Q15. `tsc` 的 Go 编译器（TypeScript 7）进展如何？TS 5.x→7 有哪些演进？

**标准答案：** （考察视野，不要求背所有版本号，但关键节点答错是减分项）
- **Go 编译器已正式落地（项目代号 Corsa）**： Anders Hejlsberg 于 2025-03 宣布将编译器用 Go 原生重写（预览期二进制名 `tsgo`、包名 `@typescript/native-preview`）。关键节点：**TS 6.0（2026-03）是最后一个 JS 版编译器**，作为迁移"桥接版"；**TS 7.0 已于 2026-07-08 正式稳定**，Go 编译器成为 `typescript` 包里的默认 `tsc`。官方基准显示大型项目 **8–12x 提速**（如 VS Code 全量构建 125.7s→10.6s）、内存下降、编辑器响应大幅改善；7.0 是**移植而非重写类型系统**，语义与 6.0 保持一致。** breaking changes**：`strict: true`、`module: esnext`、`types: []` 改为默认，移除 `target: es5`、`baseUrl`、amd/umd/systemjs 等旧选项。注意：7.0 尚未暴露稳定的**编程式 API**（ts-morph、typescript-eslint、Vue/Svelte 的模板工具链短期仍需留在 6.0），官方以 npm alias 并存过渡，稳定 API 留到 7.1。答"仍是预览、尚未取代 tsc"是**过时答案**。
- **TS 5.x 系列铺垫**：5.0 引入 const 类型参数与标准化装饰器（TC39）、5.4 引入 `NoInfer`；`moduleResolution` 持续完善（`bundler`/`node16`/`nodenext`）；`--erasableSyntaxOnly` 支持"纯类型可擦除"场景。
- **Node 类型剥离运行已稳定**：Node **22.18.0（2025-07）默认开启**类型剥离，**v25.2.0 已稳定**（不再是实验特性），可直接 `node file.ts` 运行；但仅支持"可擦除语法"，`enum`/`namespace` 等有运行时语义的语法需用 `--erasableSyntaxOnly` 规避。它与 tsc 是不同路径——一个弱化编译、一个优化编译，2026 年已不是"实验性"方向。

**追问 1：既然 TS 7 已稳定，升级时最大的坑是什么？**
> **答案：** 两类坑。① **默认行为变化**：`strict`/`module: esnext`/`types: []` 变默认、`es5`/`baseUrl`/amd/umd 等被移除，老项目 tsconfig 需实打实迁移而非升个版本号。② **生态工具链没跟上**：依赖编译器编程式 API 的 typescript-eslint、ts-morph 代码生成、Vue/Svelte/Astro 模板工具（Volar 等）短期仍需留在 6.0，官方方案是 npm alias 让 `tsc` 跑 7.0、工具继续消费 6.0。能答出"语言语义没变、变的是编译器和默认配置、工具链要分批迁"是 L5 视野。

**追问 2：为何"类型剥离"方向值得关注？它与 Go 编译器提速矛盾吗？**
> **答案：** 不矛盾，是两条路线：Go 编译器**优化编译过程**（更快但仍有编译），Node 类型剥离**弱化编译本身**（直接擦除注解运行、少一层构建、启动更快）。剥离只支持可擦除语法——这解释了为何官方反复强调"避免 enum/namespace 这类有运行时语义的语法"，并推出 `--erasableSyntaxOnly`。能点出这个区别、并说清"生产构建仍需 tsc 做完整类型检查"是加分项。

---

<a id="part-6"></a>

## Part 6：能否用 TypeScript 定级？如何定级？

### 结论先行

**可以，TS 是前端/全栈面试里区分度最高的探针之一**——天然分层：会写注解 → 懂擦除与结构化 → 会泛型与工具类型 → 能手写条件类型/`infer`/递归 → 懂工程配置与类型体操取舍 → 跟进演进。但类型编程偏难，**对初中级强问类型体操只会考到背诵**，结合岗位：初中级问到 Part 1/2 即可，类型编程题留给中高级。

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 会写接口/注解，知道是 JS 超集；说不清类型擦除、结构化 |
| **中级（L2）** | 2–5 年 | Part 2 | 懂类型擦除、结构化、any/unknown/never、拓宽与收窄 |
| **中高级（L3）** | 5–8 年 | Part 3 | 讲清泛型与工具类型原理、条件类型/分发/infer/映射，能手写常用工具类型 |
| **高级（L4）** | 8 年+ | Part 4 | 能写 `UnionToIntersection` 等复杂类型，懂 tsconfig/声明文件/enum 取舍，能把控类型体操的度 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 跟进 satisfies/const 参数/Go 编译器等演进，能在团队层面制定类型规范与工程选型 |

### 定级操作方法

**第一步：Part 0 摸底。** 能说"编译期检查、类型擦除、结构化类型"→ 至少 L2；只会说"TS 是 JS 加类型、更规范"→ 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追问"为什么"：为什么 `unknown` 比 `any` 安全？条件类型为何"分发"、裸类型参数是什么、如何关闭？为什么 `UnionToIntersection` 要绕函数参数？

**第三步：三类信号防背题。**
1. **真实性**：能否结合真实项目讲出"用类型解决了什么具体问题/踩过什么坑"（边界数据校验、`as` 滥用导致的 bug）。
2. **抽象能力**：能否把零散工具类型统一为"**keyof + 映射 + 条件 + infer**"四件套。
3. **权衡能力**：能否讲清"何时不该写复杂类型"、何时用 `unknown` 替代 `any`、enum 的替代方案。

**第四步：按最深层级定级，不按正确率。** 结合岗位难度调整追问深度：业务开发问到 Part 3 足够，基础架构/库作者才需 Part 4 的类型体操深度。

### 面试官避坑提醒

- **不要对所有人问到类型体操级**——很多优秀工程师日常够用、没练过复杂类型但理解本质。区分"理解类型系统"与"背过体操题"，前者更有价值。
- **把"手写工具类型/`UnionToIntersection`"作为 L4 分水岭**：能现场推导的人，一定是真懂条件类型与变型的。
- **务必问"不该用"**：只堆复杂类型、讲不出代价与逃生策略的，通常停在 L2/L3——识别"炫技型"候选人的关键。
- **结合岗位**：业务前端问到 Part 3 即可；TS 库作者、基础架构团队需要 Part 4 深度。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**
1. TS 是什么？→（JS 超集，编译期静态类型，编译后擦除为纯 JS）
2. 结构化 vs 名义？→（看结构/成员，鸭子类型；名义手段：`#`、`unique symbol`、brand）
3. 类型是什么？编译期 vs 运行时？→（值的集合/约束；边界需运行时校验）
4. any/unknown/never/void？→（unknown 是安全版 any，须先收窄；never 穷尽/排除）
5. 拓宽与收窄？→（`as const` 锁字面量；typeof/instanceof/真值/可辨识联合收窄）
6. 泛型本质？→（类型参数化，保留关联；`extends` 约束、默认值、`keyof` 约束）
7. 工具类型怎么实现？→（keyof + 映射 + 条件 + infer 四件套）
8. 条件类型/分发/infer？→（`T extends U?X:Y`；裸参数分发，`[T]` 关闭；infer 解构）
9. 手写 `UnionToIntersection`？→（函数参数逆变位置 infer 得交叉）
10. interface vs type？→（声明合并；对象 vs 任意类型）
11. tsconfig / .d.ts / enum？→（strict 家族、noEmit/declaration；const enum 陷阱与 as const 替代）
12. 类型体操的度？→（公共 API 才值得；边界用 unknown；复杂类型拖慢编译）
13. 新趋势？→（satisfies 校验不拓宽、const 参数、NoInfer、Go 编译器提速约 10 倍目标/预览阶段）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–8 问 + 能手写工具类型 → L3
- 答到第 9–12 问 + 能写复杂类型、懂取舍 → L4
- 答到第 13 问 + 团队级规范/选型视野 → L5

**一票否决信号：** 认为"TS 会在运行时做类型检查"、"类型注解会被编译进 JS"、"any 和 unknown 差不多"、说不清结构化类型、认为"类型体操越多越专业"→ 无论年限，最高 L2。

---

*资料整理于 2026-11-19，参考 TypeScript 官方文档与发布说明（satisfies 4.9、const 类型参数 5.0、NoInfer 5.4 等）、TypeScript 原生 Go 移植官方公告与社区 tsgo 进展、DefinitelyTyped、Node.js 类型剥离相关文档，以及 2026 年前端/全栈面试趋势资料。涉及版本细节以官方发布为准；题目与答案基于公开技术资料整理，用于面试评估参考。*
