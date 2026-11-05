---
title: TypeScript 工程化：tsconfig、声明文件、模块与编译链
date: 2026-11-05
summary: 关键 tsconfig 选项怎么选、.d.ts 与模块增强、ESM/CJS 互操作、tsc 与 swc/esbuild 分工、monorepo 与类型性能排查，附面试追问。
interview: false
kind: qa
---

工程化题筛的是：**能不能让一个多人项目的类型系统长期可维护**。光会写类型不够，还要能定配置、接好第三方库、搭好构建链。

---

## 一、tsconfig 关键选项

### 1. 严格度（必开）

| 选项 | 作用 | 建议 |
| --- | --- | --- |
| `strict` | 总开关，包含下面几项 | 新项目必开 |
| `strictNullChecks` | `null/undefined` 不能随便赋值 | 核心，收益最大 |
| `noImplicitAny` | 禁止隐式 `any` | 开 |
| `strictFunctionTypes` | 函数参数逆变检查（方法简写除外） | 开 |
| `useUnknownInCatchVariables` | `catch (e)` 里的 `e` 是 `unknown` | 开 |
| `noUncheckedIndexedAccess` | `arr[i]`、`obj[key]` 带 `\| undefined` | 强烈推荐，能防越界 |
| `exactOptionalPropertyTypes` | `a?: string` 不允许显式赋 `undefined` | 库作者考虑开 |
| `noImplicitOverride` | 子类覆盖必须写 `override` | 有 class 继承时开 |

**追问：** 老项目怎么渐进开 `strict`？
**答：** 先开 `strict`，再用 `// @ts-expect-error` 或按目录 `include` 分批推进；也可以用 `typescript-strict-plugin` 让新文件强制严格；在 CI 里记录错误数，只允许下降。**不要**为了消灭报错就全局关掉检查。

### 2. 模块与解析

| 场景 | `module` | `moduleResolution` |
| --- | --- | --- |
| Vite / webpack 前端应用 | `ESNext` | `bundler` |
| Node 纯 ESM / 发布 npm 包 | `NodeNext` | `NodeNext` |
| 老 CJS Node 项目 | `CommonJS` | `node10`（旧称 `node`） |

- `bundler`：允许省略扩展名，支持 `package.json` 的 `exports`，适合有打包器的场景。
- `NodeNext`：严格遵守 Node 规则，ESM 里导入必须写 `.js` 扩展名（即使源文件是 `.ts`），并按 `package.json` 的 `"type"` 判断文件是 ESM 还是 CJS。

### 3. 和构建工具配合

| 选项 | 作用 |
| --- | --- |
| `isolatedModules` | 保证每个文件能单独转译。swc、esbuild、babel 需要它；会禁止跨文件的 `const enum`，要求类型导出写成 `export type` |
| `verbatimModuleSyntax` | （TS 5）原样保留 `import type`，替代旧的 `importsNotUsedAsValues` |
| `noEmit` | 只做检查不产出 JS，由打包器负责转译 |
| `skipLibCheck` | 跳过 `.d.ts` 检查，能大幅提速，几乎都开 |
| `esModuleInterop` | 允许 `import x from 'cjs-lib'` |
| `paths` / `baseUrl` | 路径别名。**只影响类型解析**，运行时还要打包器或 `tsconfig-paths` 配合 |

**追问：** 配了 `paths`，编译通过但运行时报找不到模块，为什么？
**答：** `tsc` 不会改写 import 路径。别名需要在 Vite（`resolve.alias`）或 Node（`tsconfig-paths`、子路径 `imports`）里再配一遍。

---

## 二、声明文件 `.d.ts`

### 1. 类型从哪里来

```text
库自带 types（package.json "types" / "exports".types）
  → DefinitelyTyped：@types/xxx
  → 自己写 declare module
```

### 2. 常见写法

```ts
// global.d.ts —— 无类型的第三方模块兜底
declare module 'legacy-lib' {
  export function foo(x: string): number
}

// 非 TS 资源
declare module '*.svg' {
  const src: string
  export default src
}

// 全局变量（如注入的配置）
declare global {
  interface Window {
    __APP_CONFIG__: { apiBase: string }
  }
}
export {} // 让文件成为模块，declare global 才生效
```

### 3. 模块增强（Module Augmentation）

给第三方库补字段，而不是 fork：

```ts
// 给 axios 的 config 加自定义字段
import 'axios'
declare module 'axios' {
  interface AxiosRequestConfig {
    skipAuth?: boolean
  }
}
```

依赖的是 **interface 声明合并**。这也是「对外扩展点用 `interface`」的主要原因。

### 4. 环境变量类型（Vite）

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE: string
}
```

**追问：**
1. `declare module` 写在有顶层 `import` 的文件里，和写在没有 import 的文件里有什么区别？（前者是**增强**已有模块，后者是**声明**一个新模块）
2. `@types/xxx` 和库版本不一致怎么办？（锁定版本；用 `patch-package` 或本地增强兜底；推动上游自带类型）

---

## 三、ESM 与 CJS 互操作

| 点 | ESM | CJS |
| --- | --- | --- |
| 语法 | `import / export` | `require / module.exports` |
| 加载 | 静态、异步，可 tree-shake | 动态、同步 |
| 顶层 `await` | 支持 | 不支持 |
| `this` 顶层 | `undefined` | `module.exports` |
| `__dirname` | 没有，用 `import.meta.url` | 有 |

**坑：**
- ESM 可以 `import` CJS（得到 default）；CJS 不能直接 `require` ESM（Node 22 以后逐步支持 `require(esm)`，以前只能用动态 `import()`）。
- **双包风险**：同一个库的 ESM 和 CJS 两份都被加载，导致单例状态不一致。
- 发包时用 `exports` 条件导出：

```json
{
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    }
  }
}
```

`types` 条件要放在**最前面**。发包前可以用 `arethetypeswrong`（attw）检查。

---

## 四、编译链：谁检查，谁转译

```text
tsc            ：类型检查 + 转译 + 产出 .d.ts（慢，但唯一完整的检查器）
swc / esbuild  ：只擦除类型、转译（很快，不做类型检查）
babel          ：@babel/preset-typescript，同样只擦除类型
```

**主流做法：** 打包器（Vite 用 esbuild，Next 用 swc）负责转译，`tsc --noEmit` 单独跑类型检查（CI 加编辑器）。产出声明文件用 `tsc --emitDeclarationOnly`，或者 `tsup`、`rollup-plugin-dts`。

**本站就是这样：** `vite build` 只负责转译，类型检查需要单独执行 `tsc --noEmit`（或 `vue-tsc` / `tsc -b`）。

**追问：** 为什么 esbuild 不支持 `const enum` 跨文件内联，也不支持装饰器元数据（`emitDecoratorMetadata`）？
**答：** 两者都需要**跨文件的类型信息**，而单文件转译器没有。所以要开 `isolatedModules`，在写代码阶段就把这类用法拦下来。

---

## 五、enum 的坑与替代

```ts
enum Color { Red, Green }     // 产出运行时对象，数字枚举有反向映射 Color[0] === 'Red'
const enum Dir { Up, Down }   // 内联常量，但和 isolatedModules 冲突
```

**问题：** 数字枚举能接受任意 `number`（较新版本已收紧）、有运行时代码体积、`const enum` 发包有坑、不能被 Node 的类型擦除模式（`--experimental-strip-types`）直接执行。

**推荐替代：**

```ts
const Color = { Red: 'red', Green: 'green' } as const
type Color = (typeof Color)[keyof typeof Color] // 'red' | 'green'
```

---

## 六、Monorepo 与项目引用

- **Project References**：`composite: true` 加上 `references: [{ path: '../pkg' }]`，再用 `tsc -b` 做增量构建。适合大仓按包拆分检查。
- 共享 `tsconfig.base.json`，各个包通过 `extends` 继承。
- 共享 UI 包：`react` 放进 `peerDependencies`，避免出现两份 React 导致 Hooks 报错；类型入口通过 `exports.types` 暴露。
- 内部包有两种方案：
  - 「源码直连」：`exports` 指向 `.ts`，由打包器编译。开发体验好，但要求消费方能编译 TS。
  - 「构建产物」：发布前先编出 `dist`。更规范，但开发时要 watch。

---

## 七、类型检查性能排查

```bash
tsc --noEmit --extendedDiagnostics   # 看检查耗时、实例化次数、内存
tsc --noEmit --generateTrace trace   # 生成 trace，配合 @typescript/analyze-trace
```

**常见元凶：**
- 巨大的联合类型（上千成员）和它们之间的交叉
- 深递归的条件类型（比如 `Paths<T>` 作用在大对象上）
- 复杂泛型被反复推断（把中间结果抽成具名 `type`，结果可以被缓存）
- `include` 范围太大，把 `node_modules` 或产物目录也扫了进来

**优化：** 显式标注函数返回类型；用 `interface extends` 代替大型交叉 `&`（interface 的关系会被缓存）；开 `skipLibCheck` 和 `incremental`。

---

## 八、类型测试与质量门禁

```ts
import { expectTypeOf } from 'vitest'
expectTypeOf(prop({ a: 1 }, 'a')).toEqualTypeOf<number>()

// @ts-expect-error —— 断言「这里必须报错」，如果不报错，这行本身会报错
prop({ a: 1 }, 'b')
```

- 用 `@ts-expect-error`，不要用 `@ts-ignore`（后者在不再需要时也不会提醒）。
- ESLint 加 `@typescript-eslint/no-explicit-any`、`no-floating-promises`（需要类型信息）、`consistent-type-imports`。
- CI 流程：`tsc --noEmit` → `eslint` → 单测（含类型测试）。

---

## 面试官速查

| 级别 | 主问 | 过线标准 |
| --- | --- | --- |
| 初级 | `strict` 有什么用？`@types` 是什么？ | 知道严格模式、会装类型包 |
| 中级 | `.d.ts` 与模块增强、`paths` 运行时问题、enum 替代方案 | 能独立接入无类型库 |
| 高级 | ESM/CJS 发包、tsc 与 swc 分工、monorepo、类型性能 | 能定团队规范，并能排查构建和类型问题 |

## 相关文章

- [TypeScript 面试提纲](/posts/typescript/typescript-interview/)
- [手写工具类型 20 题](/posts/typescript/typescript-handwritten-types/)
- [TS/JS 深水区](/posts/typescript/ts-js-deep-water/)
