---
title: 为什么选择静态博客
date: 2026-11-01
summary: 第三篇 demo：静态站 + Markdown 对个人博客的好处。
---

个人博客未必需要服务端和数据库。静态方案通常更简单：

| 点 | 说明 |
|----|------|
| 便宜 | GitHub Pages 托管即可 |
| 快 | CDN / 静态文件直出 |
| 安全 | 没有动态运行时，攻击面更小 |
| 可版本化 | 文章与代码一起进 Git |

本仓库的流程是：

1. Markdown 作为内容源  
2. Node + TypeScript（Vite + React）构建  
3. 预渲染成 HTML 放进 `dist/`  
4. Actions 部署到 Pages  

界面支持中 / 英切换；**文章正文**仍由你在 Markdown 里用自己喜欢的语言来写。

下一篇，就写你真正想公开的内容吧。
