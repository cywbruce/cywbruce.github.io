---
title: AI 工程师面试官地图：总览、组卷与定级
date: 2026-11-05
summary: AI 应用工程方向总入口：画像、组卷、按模块（基础 / RAG / Agent / MCP / 评测 / 部署）的追问链与题库、面经链接。
kind: map
---

面向**面试官**。AI 工程岗位重点考**把模型可靠地接进业务**，不考训练算法。最有区分度的是：**评测意识、幻觉治理、成本与延迟、安全。**

## 级别画像

| 级别 | 画像 | 定级信号 |
| --- | --- | --- |
| 初级 | 会调 API、写 Prompt、做过 Demo | 懂 token、temperature、基础 RAG |
| 中级 | 做过上线的 RAG 或 Agent | 讲得清检索质量、切块、重排、工具调用的坑 |
| 高级 | 负责 AI 平台或核心 AI 产品 | 评测体系、成本模型、安全合规、推理部署 |

## 60 分钟组卷

1. **开场 10 分钟**：用一次真实请求，把 LLM → Embedding → 检索 → Tool → Agent 串起来讲
2. **RAG 20 分钟**：全链路、幻觉、怎么证明效果变好了
3. **Agent / MCP 15 分钟**：工具调用原理、循环防护、写操作安全
4. **工程 10 分钟**：成本延迟优化、高并发接口，或推理部署
5. **收尾 5 分钟**

## 模块 × 级别

| 模块 | 初级 | 中级 | 高级 | 答案 |
| --- | --- | --- | --- | --- |
| 模型基础 | Token、上下文、采样参数 | 注意力直觉 | — | [AI 分级题 · 一](/posts/ai/ai-engineer-tiered-interview/#sec-1) |
| Prompt | 写一个生产 Prompt | 结构化输出、注入防护 | — | [AI 分级题 · 二](/posts/ai/ai-engineer-tiered-interview/#sec-2) |
| 向量与检索 | 余弦相似度 | ANN 选型、相似不等于相关 | — | [Java 转 AI · 二](/posts/ai/java-ai-engineering-interview/#sec-2) |
| RAG | 基本链路 | 切块、混合检索、RRF、重排、知识同步 | 评测与持续监控 | [Java 转 AI · 三](/posts/ai/java-ai-engineering-interview/#sec-3) |
| Tool / Skills / MCP | 模型是否自己调接口 | 工具集收敛、MCP 原语 | MCP 生产安全 | [Java 转 AI · 四](/posts/ai/java-ai-engineering-interview/#sec-4) |
| Agent | 基本循环 | 生产级 ReAct 防护 | 多 Agent 编排与治理 | [Java 转 AI · 五](/posts/ai/java-ai-engineering-interview/#sec-5) |
| 工程化 | — | 成本与延迟 | 高并发 AI 接口、推理部署 | [AI 分级题 · 三、四](/posts/ai/ai-engineer-tiered-interview/#sec-3) |
| 训练取舍 | — | 微调和 RAG 怎么选、LoRA | 小模型落地场景 | [AI 分级题](/posts/ai/ai-engineer-tiered-interview/) · [小模型场景](/posts/ai/small-model-finetune-scenarios/) |
| 安全合规 | — | 输出过滤 | 面向客户的 AI 安全体系 | [AI 分级题 · 13](/posts/ai/ai-engineer-tiered-interview/#q13) |

## 高区分度追问

1. 你怎么证明这次改动让 RAG 变好了？用的什么数据集和指标？
2. 用户问到知识库里没有的内容，系统会怎样？
3. 一次请求花多少钱、多少毫秒？怎么降一半？
4. Agent 调用写接口（下单、退款）之前，你加了哪些防线？

## 面经

- [AI 工程师模拟面经（三轮）](/posts/ai/ai-engineer-mock-interview/)
- [Java 后端转 AI 工程面试题](/posts/ai/java-ai-engineering-interview/)
