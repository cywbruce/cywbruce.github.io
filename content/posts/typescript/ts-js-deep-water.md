---
title: TypeScript / JavaScript 如何快速掌握：路径与深水区
date: 2026-11-03
summary: TS 是编译期类型层，运行时仍是 JS。深水区在事件循环、原型链、闭包、V8，以及类型体操。
kind: guide
---

先认清双层结构：

```text
TypeScript（编译期检查）→ 擦除类型 → JavaScript（V8 / 浏览器 / Node 执行）
```

学习路径：

```text
JS 语法 → 原型 / this → 闭包 → Promise / async → 事件循环
       → TS 基础类型 → 泛型 / 条件 / 映射类型 → V8 / Node 直觉
```

## 对标 Java 的深水区

| Java | JS/TS | 要点 |
| --- | --- | --- |
| JVM | V8 / Node | 解析、JIT（TurboFan） |
| HashMap | `Map` / `Object` | `Map` 才是通用键；`Object` 键会字符串化 |
| ArrayList | Array | V8 有快/慢数组路径 |
| 线程池 | 无同构物 | 单线程 + 事件循环；重活用 Worker |
| synchronized | 通常不需要 | 单线程协作式；注意共享状态竞态仍在 |
| 反射 | `Reflect` / `Proxy` | 元编程 |
| 泛型 | TS 类型系统 | 更偏结构类型 + 类型编程 |

## 必须啃透的四点

### 1. 事件循环

```ts
console.log('1')
setTimeout(() => console.log('2'), 0) // 宏任务
Promise.resolve().then(() => console.log('3')) // 微任务
console.log('4')
// 1 → 4 → 3 → 2
```

同步 → 清微任务 → 下一个宏任务。这是 JS「并发」的灵魂模型。

### 2. 原型链

对象属性查找走 `[[Prototype]]`；`class` 语法糖仍建立在原型上。

### 3. 闭包

函数保留外层词法环境；好处是封装，坏处是泄漏（长生命周期引用大对象）。和 GC、React Hooks 过期闭包是同一类问题。

### 4. TS 类型体操（TS 独有深水区）

```ts
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? DeepReadonly<T[P]>
    : T[P]
}
```

业务代码够用联合、泛型约束、工具类型；库作者才需要深体操。

## 验证手段

- Chrome DevTools Performance / Memory  
- `node --prof` + `--prof-process`  
- 书：《你不知道的 JavaScript》《深入浅出 Node.js》

## 相关文章

- [TypeScript 面试提纲](/posts/typescript/typescript-interview/)  
- [sleep 与重试](/posts/typescript/sleep-retry/)  
- [三语言掌握总览](/posts/guides/language-mastery/)  
