---
title: 前端面试官地图：React + TypeScript 怎么问
date: 2026-11-06
summary: 总览篇：按初 / 中 / 高级组卷，链到手写题、场景题、市场高频长答案与专题提纲。
---

本目录放前端向面试材料。你是**面试官**时，先定级别目标，再挑专题，不要一轮塞满所有题。

## 级别画像（快速对齐）

| 级别 | 能独立交付什么 | 本轮重点 |
| --- | --- | --- |
| 初级 | 页面与组件、按设计稿实现、改小需求 | API 会用、基本概念正确 |
| 中级 | 模块设计、排障、合理状态与类型 | 机制清晰、有项目坑与解法 |
| 高级 | 规范、性能与架构、带人 Review | 权衡、边界、治理手段 |

## 60 分钟推荐结构

1. **开场 5 分钟**：最近项目、负责模块、技术栈  
2. **主线 25 分钟**：概念 / 市场高频题 + 追问  
3. **实操 15 分钟**：1 道[手写](/posts/react/handwritten-interview/)或半道[场景](/posts/react/scenario-interview/)  
4. **深挖 10 分钟**：用候选人项目里的真实决策加压  
5. **收尾 5 分钟**：反问；记录定级信号  

## 按级别选题（直接抄）

### 面初级

- 概念：[市场高频](/posts/react/market-hot-questions/) A1、B1、B5  
- 手写：防抖主路径、或 `listToTree` 简化  
- 场景：搜索列表（只要防抖 + loading）  
- TS：props 标注、`any` vs `unknown`

### 面中级

- 概念：Fiber / 批处理、Effect 竞态、Query vs Store  
- 手写：深拷贝（循环引用）或 `Promise.all` 或 `useDebouncedValue`  
- 场景：鉴权刷新 / 列表卡顿  
- TS：可辨识联合、`keyof` 泛型、类型守卫  

### 面高级

- 概念：并发与 RSC 边界、CWV、状态分层  
- 手写：`useRequest` 竞态 或 并发池  
- 场景：监控体系 / 微前端 / 线上偶现  
- TS：`strict` 治理、契约 + zod、类型可读性  

## 专题文章索引

| 文章 | 用途 |
| --- | --- |
| [市场高频题（长答案）](/posts/react/market-hot-questions/) | 市面常考概念 + 长参考答案 + 组卷 |
| [手写题题库](/posts/react/handwritten-interview/) | 防抖/深拷贝/Promise/Hooks/TS 工具类型 |
| [场景题题库](/posts/react/scenario-interview/) | 业务场景长答案 + 定级 |
| [React 核心知识点](/posts/react/react-interview/) | React 主提纲 + 追问 |
| [TypeScript 核心知识点](/posts/typescript/typescript-interview/) | TS 主提纲 + 追问 |
| [Hooks 高频追问](/posts/react/hooks-followups/) | 单点加压 |
| [Hook vs 工具函数](/posts/react/hook-vs-utils/) | 概念 / 设计题 |
| [React vs Vue](/posts/react/react-vs-vue/) | 双端经验与选型 |

## 记录表（建议面试时打勾）

- [ ] 概念正确（初级线）  
- [ ] 能讲清机制与排障（中级线）  
- [ ] 有权衡与规范意识（高级线）  
- [ ] 手写主路径清晰、边界有意识  
- [ ] 场景题有结构：约束 → 方案 → 验证  
- [ ] 表达结构化、承认不知道并会查  

**原则：** 追问是为了看深度，不是为了为难。市面题再热，也要结合岗位 JD 裁剪；过时题少问，把时间留给能定级的点。
