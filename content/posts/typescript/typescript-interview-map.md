---
title: TypeScript 面试官地图：总览、组卷与定级
date: 2026-11-05
summary: TS / JS 方向总入口：画像、45 分钟组卷、按模块的追问链，链到提纲（含答案）、类型系统、手写类型、工程化与 JS 基础。
kind: map
---

面向**面试官**。TS 面试的区分点不在于会背多少工具类型，而在于：**能不能用类型表达业务约束、懂不懂类型系统的规则、能不能管好工程配置和运行时边界。**

## 级别画像

| 级别 | 画像 | 定级信号 |
| --- | --- | --- |
| 初级 | 能给 props、函数补类型，项目能编译通过 | 少用 `any`，懂 interface / type 和常用工具类型 |
| 中级 | 能写泛型组件和工具类型，会收窄 | 可辨识联合、`keyof` 泛型、守卫、`infer` |
| 高级 | 能定 `tsconfig` 和团队规范，处理复杂建模 | 变型、分布式、类型性能、契约与运行时校验 |

## 45 分钟组卷

1. **JS 基础 10 分钟**：事件循环输出题，或 `this` / 闭包
2. **类型建模 15 分钟**：请求状态建模、`prop(obj, key)`、类型守卫
3. **手写类型 10 分钟**：按级别挑一道
4. **工程 10 分钟**：`strict` 治理、`.d.ts`、ESM/CJS，任选一个

## 模块 × 级别

| 模块 | 初级 | 中级 | 高级 | 答案 |
| --- | --- | --- | --- | --- |
| JS 基础 | var/let、`this`、`==` | 事件循环、原型链、Promise.all、深拷贝 | Node 事件循环、并发池、内存泄漏 | [JS 基础八股](/posts/typescript/js-fundamentals-interview/) |
| 类型建模 | interface / type、any / unknown | 可辨识联合、`satisfies` | 品牌类型、类型单一来源 | [TS 提纲 · 一](/posts/typescript/typescript-interview/#sec-1) |
| 泛型与推断 | 函数标注 | `keyof` 约束、泛型默认值 | 事件总线、路由参数推断 | [TS 提纲 · 二](/posts/typescript/typescript-interview/#sec-2) |
| 类型系统原理 | 结构类型 | 收窄、拓宽、联合与交叉 | 协变 / 逆变、分布式条件类型 | [类型系统原理](/posts/typescript/typescript-type-system/) |
| 手写类型 | Partial / Pick / Record | Omit、ReturnType、Awaited、事件名 | DeepReadonly、Paths、UnionToIntersection | [手写类型 20 题](/posts/typescript/typescript-handwritten-types/) |
| 收窄与运行时 | `as` 和守卫的区别 | `asserts`、zod | 前后端契约 | [TS 提纲 · 四](/posts/typescript/typescript-interview/#sec-4) |
| React + TS | props、children | 泛型 Table、useRef | 团队规范、`as any` 评审 | [TS 提纲 · 五](/posts/typescript/typescript-interview/#sec-5) |
| 工程化 | `strict`、`@types` | `.d.ts`、模块增强、`paths`、enum 替代 | ESM/CJS 发包、tsc 和 swc 分工、类型性能 | [工程化](/posts/typescript/typescript-engineering/) |

## 学习与经验

- [TS/JS 深水区](/posts/typescript/ts-js-deep-water/) · [sleep 与重试](/posts/typescript/sleep-retry/)
- 前端整体组卷见 [前端面试官地图](/posts/react/frontend-interview-map/)

## 记录表

- [ ] JS 基础不出错（初级线）
- [ ] 能用联合和泛型表达业务，会收窄（中级线）
- [ ] 讲得清规则和工程取舍，知道什么时候不该写复杂类型（高级线）
