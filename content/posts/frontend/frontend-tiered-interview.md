---
title: 前端分级面试题（浏览器 · 网络 · 工程化 · 性能）
date: 2026-11-04
summary: 前端面试：初 / 中 / 高分级题目，含参考答案、追问与定级。
---

面向前端面试。React / TS 专项见 [React 核心](/posts/react/react-interview/)、[TypeScript 核心](/posts/typescript/typescript-interview/)。

> 级别写在标题括号里（初级 / 中级 / 高级），[题库](/interview) 会据此自动分级，点击题目直达本页答案。

---

## 一、浏览器与 HTML/CSS

### 1. 从输入 URL 到页面展示（初级）

**主问：** 从输入 URL 到页面渲染出来，经历了哪些步骤？

**参考答案：** DNS 解析 → TCP 连接（HTTPS 还有 TLS 握手）→ 发 HTTP 请求 → 服务端返回 HTML → 浏览器解析 HTML 生成 DOM，解析 CSS 生成 CSSOM → 合成渲染树 → 布局（Layout）→ 绘制（Paint）→ 合成（Composite）。JS 默认会阻塞 HTML 解析，`defer` / `async` 可以改变这一点。

**追问：** CSS 会阻塞渲染吗？会阻塞 DOM 解析吗？（阻塞渲染，不阻塞解析，但会阻塞后面 JS 的执行）

**定级：** 能按顺序讲完 → 初级；能讲清阻塞关系和关键渲染路径的优化 → 中级。

---
### 2. 盒模型与 BFC（初级）

**主问：** 标准盒模型和 IE 盒模型有什么区别？BFC 是什么？

**参考答案：** `content-box` 的 width 只算内容；`border-box` 的 width 包含 padding 和 border。BFC（块级格式化上下文）是一块独立的布局区域：内部浮动参与高度计算，不会和外部浮动重叠，外边距不会和外部折叠。`overflow: hidden`、`display: flow-root`、flex/grid 容器、绝对定位都会触发 BFC。

**追问：** 怎么清除浮动？margin 折叠在什么情况下发生？

---
### 3. 重排与重绘（中级）

**主问：** 重排（reflow）和重绘（repaint）有什么区别？怎么减少？

**参考答案：** 改了几何属性（宽高、位置）会触发重排，重排之后一定会重绘；只改颜色这类外观属性只会重绘。减少的办法：批量修改样式（换 class）；读写分离，避免强制同步布局（读 `offsetHeight` 之前不要穿插写操作）；动画用 `transform` / `opacity`，只走合成层；长列表用虚拟滚动。

**追问：** `will-change` 有什么副作用？（层太多会占内存）什么是 layout thrashing？

**定级：** 能讲到合成层和强制同步布局 → 中级。

---
### 4. 事件循环（中级）

**主问：** 浏览器的事件循环是怎么跑的？宏任务和微任务谁先执行？

**参考答案：** 执行一个宏任务（script、setTimeout、I/O）→ 清空微任务队列（Promise.then、queueMicrotask、MutationObserver）→ 视情况渲染（rAF 在渲染前执行）→ 进入下一个宏任务。所以同一轮里微任务一定先于下一个 setTimeout。

**追问：** `await` 后面的代码属于哪一类任务？微任务一直递归添加会怎样？（会饿死渲染）

---
## 二、网络与安全

### 5. HTTP 缓存（初级）

**主问：** 强缓存和协商缓存分别是什么？

**参考答案：** 强缓存看 `Cache-Control: max-age` / `Expires`，命中就不发请求。强缓存过期后走协商缓存：带上 `If-None-Match`（ETag）或 `If-Modified-Since`，资源没变就返回 304。工程上常见做法：HTML 设 `no-cache`，静态资源文件名带 hash 再加长期 `immutable` 缓存。

**追问：** `no-cache` 和 `no-store` 有什么区别？

---
### 6. 跨域（初级）

**主问：** 为什么会有跨域？怎么解决？

**参考答案：** 同源策略要求协议、域名、端口都相同。解决办法：CORS（服务端返回 `Access-Control-Allow-*`，非简单请求会先发 OPTIONS 预检）；开发环境用代理；生产环境用 Nginx 反向代理。JSONP 已经过时。

**追问：** 带 Cookie 跨域要满足哪些条件？（credentials，且 Allow-Origin 不能写 *）

---
### 7. XSS 与 CSRF（中级）

**主问：** XSS 和 CSRF 的原理和防御方法？

**参考答案：** XSS 是被注入恶意脚本：输出时转义、用 CSP、Cookie 设 HttpOnly、谨慎使用 `dangerouslySetInnerHTML`（要先做 sanitize）。CSRF 是借用户已登录的身份发出伪造请求：Cookie 设 SameSite、加 CSRF Token、校验 Origin/Referer、关键操作二次确认。

**追问：** token 存在 localStorage 还是 Cookie？各有什么风险？

**定级：** 能讲清防御各自针对的是哪个环节 → 中级。

---
### 8. HTTP/2 与 HTTP/3（高级）

**主问：** HTTP/2 解决了什么问题？HTTP/3 为什么换成了 UDP？

**参考答案：** HTTP/2：二进制分帧、多路复用、头部压缩（HPACK），解决了应用层的队头阻塞，但 TCP 层丢包时仍然会阻塞所有流。HTTP/3 基于 QUIC（UDP）：流之间独立、0-RTT/1-RTT 建连、切换网络时连接可以迁移。

**追问：** 到了 HTTP/2，雪碧图、域名分片这类优化还有必要吗？

**定级：** 能讲到传输层的队头阻塞 → 高级。

---
## 三、工程化与性能

### 9. 模块化与打包（中级）

**主问：** ESM 和 CommonJS 有什么区别？Tree Shaking 依赖什么？

**参考答案：** ESM 是静态结构，编译期就能分析导入导出，导出的是活绑定；CJS 在运行时 require，导出的是值的拷贝。Tree Shaking 依赖 ESM 的静态分析，再加上 `sideEffects` 标注。Vite 开发时利用浏览器原生 ESM 按需编译，生产构建用 Rollup。

**追问：** 为什么 Vite 开发时启动快？生产环境为什么还要打包？

---
### 10. Core Web Vitals（中级）

**主问：** LCP、INP、CLS 分别衡量什么？怎么优化？

**参考答案：** LCP 衡量最大内容的绘制时间：图片预加载、SSR、CDN、关键 CSS 内联。INP 衡量交互响应：拆分长任务、`startTransition`、减少主线程 JS。CLS 衡量布局偏移：给图片和广告位预留尺寸、字体用 `font-display`。线上用 web-vitals 采集，分位数看 P75。

**追问：** INP 为什么取代了 FID？

---
### 11. 首屏方案选择（高级）

**主问：** CSR、SSR、SSG、ISR、流式 SSR 怎么选？

**参考答案：** 内容型、对 SEO 敏感的页面用 SSG/ISR；个性化且要首屏快的用 SSR，再配合流式渲染和选择性 hydration；后台管理类用 CSR。要权衡的有：TTFB、服务器成本、缓存命中率、hydration 成本。RSC 能减少下发到客户端的 JS。

**追问：** hydration mismatch 是怎么产生的？怎么排查？

**定级：** 能结合业务做取舍，并讲出缓存和成本 → 高级。

---
### 12. 前端监控体系（高级）

**主问：** 从零搭建前端监控，你会怎么设计？

**参考答案：** 采集：JS 错误（onerror、unhandledrejection）、资源错误、接口耗时和错误码、Web Vitals、白屏检测、用户行为轨迹。上报：sendBeacon、批量上报、采样、失败重试。处理：sourcemap 还原堆栈、错误聚合去重、按版本和灰度维度分析。告警：设阈值并对接值班。还要考虑隐私脱敏和 SDK 本身的性能开销。

**追问：** 线上报错怎么定位到源码？怎么避免监控 SDK 拖慢页面？

---
