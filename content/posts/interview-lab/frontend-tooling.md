---
title: "前端工程化面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "模块化、Webpack/Vite 原理、包管理与构建性能优化。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **前端工程化（模块化 / 构建工具 / 包管理 / 编译转译 / 产物性能 / 工程规范）** 的真实深度"问出来"。
> 核心原则：**工程化的每道题，最终都会落到"输入是模块化的源码，输出是能在浏览器高效加载、可缓存、可协作维护的产物"这条主线**。只会配 `vite.config` 却讲不清 ESM 与构建流程的人，基本停留在工具 API 记忆层。
> 配套：本题库可作为全栈 / 前端面试定级体系的独立一套使用，自带 L1–L5 定级表与面试官速查表。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题](#part-1)
- [Part 2：底层原理题（模块化与构建内核）](#part-2)
- [Part 3：核心区分度题（题眼，定级主战场）](#part-3)
- [Part 4：实战与陷阱题](#part-4)
- [Part 5：2026 新趋势：Rust 工具链与 bundleless](#part-5)
- [Part 6：能否用前端工程化定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对前端工程化的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> 前端工程化是指用**工程手段**把"写页面"变成"可协作、可维护、高性能交付"的过程，核心解决**模块化、构建、包管理、转译、产物性能**五大问题。
>
> **模块化**是地基：早期用 CommonJS / AMD / UMD，现在以 **ESM** 为主流，因为它静态可分析，能支撑 Tree Shaking。
>
> **构建工具**负责把源码转成浏览器可运行的产物：Webpack 是"一切皆模块"的打包器，Vite 则利用**原生 ESM + esbuild 预构建**让 dev 阶段免打包、秒级启动。
>
> **包管理**上 npm / yarn / pnpm 解决依赖安装与版本锁定，pnpm 用**硬链接 + 符号链接 + 内容寻址存储**大幅省磁盘、杜绝幽灵依赖。
>
> **编译转译**层用 Babel / SWC / esbuild 把新语法降级并按需注入 polyfill；TypeScript 提供类型与擦除式编译。
>
> 最终落到**产物与性能**：code splitting、动态 import、`contenthash` 长缓存、gzip/brotli、source map，再配合 ESLint / CI 形成闭环。

**评分要点：** 模块化（ESM）/ 构建（Webpack vs Vite）/ 包管理（pnpm）/ 转译（Babel·SWC）/ 产物性能（分割·缓存）五个点，对应入门到高级。能讲清 ESM 静态特性与 Vite 免打包原理的，直接往 Part 3 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题

### Q1. 为什么需要前端工程化？它主要解决哪些问题？

**标准答案：**
- 早期前端是"HTML + jQuery 脚本"堆砌，应用变大后暴露出**全局污染、依赖混乱、重复劳动、无类型检查、无压缩优化**等问题。
- 工程化就是把软件工程方法引入前端，目标可归纳为：
  - **模块化**：把代码拆成高内聚模块，解决命名冲突与依赖管理。
  - **自动化**：自动完成编译、压缩、测试、部署，减少手工重复。
  - **规范化**：统一代码风格（ESLint/Prettier）、提交规范（Husky）、目录约定。
  - **性能**：打包压缩、按需加载、缓存策略，优化加载与运行。
- 本质：**用工具链把开发体验与线上性能同时提上去**，而不是"为了用工具而用工具"。

**追问 1：工程化和"构建工具"是一回事吗？**
> **答案：** 不是。构建工具（Webpack/Vite）只是工程化的一环。工程化是**体系**：涵盖模块化规范、包管理、编译、代码规范、测试、CI/CD、部署、监控等。构建工具主要解决"源码→产物"这一段。

**追问 2：dev 和 prod 环境的构建目标有什么不同？**
> **答案：** dev 追求**快启动、快热更新、源码可调试**（source map 完整、不压缩、保留 devTools）；prod 追求**体积最小、加载最快、缓存友好**（压缩混淆、Tree Shaking、contenthash、去掉或单独上传 source map）。二者配置必须区分，典型用 `mode` 或 `import.meta.env.DEV/PROD` 注入差异。

---

### Q2. CommonJS 和 ESM 的核心差异是什么？

**标准答案：**

| 维度 | CommonJS (CJS) | ES Module (ESM) |
|------|---------------|-----------------|
| 设计时代 | Node 早期，运行时模块规范 | ES2015 语言级规范，编译期静态 |
| 加载时机 | **运行时**加载，`require` 可在任意位置、条件调用 | **编译期**静态解析，`import` 必须在顶层 |
| 导出本质 | `module.exports` 多为**值拷贝**（导出时拷贝一份） | `export` 是**实时绑定**（live binding，引用原值） |
| 循环依赖 | 加载一半就返回**当前已导出的部分**，可能拿不完整 | 依赖图先解析完成，配合实时绑定更可控 |
| 适用 | Node 服务端、老生态 | 浏览器 + 现代 Node，Tree Shaking 的基础 |

- 关键差异：**CJS 是运行时、动态、值拷贝；ESM 是编译期、静态、实时绑定**。

**追问 1：为什么说 ESM 的导入是"实时绑定"？给个例子。**
> **答案：** ESM 导入的是变量的**只读引用**，不是值快照。例如 `counter.js` 里 `export let count = 1` 并定时 `count++`；`main.js` 里 `import { count }`，每次访问都读到**最新值**。而 CJS 若 `module.exports = count`（基本类型）是拷贝，后续变化不会同步；导出的若是对象则共享引用，这是二者容易混淆之处。

**追问 2：Node.js 里 ESM 和 CJS 能互相引用吗？有什么坑？**
> **答案：** 有条件支持。ESM 可 `import` CJS（CJS 的 `module.exports` 作为默认导出）；CJS 用 `require()` 加载 ESM 在较新 Node 版本才有限支持。`package.json` 的 `type: "module"` 决定 `.js` 按哪种解析，混用要注意：ESM 相对导入必须写全扩展名（如 `./a.js`），且 ESM 中没有 `require`/`__dirname`。

---

<a id="part-2"></a>

## Part 2：底层原理题（模块化与构建内核）

> 这是"会配工具"和"懂原理"的分水岭，L2→L3 的关键。

### Q3. ESM 为什么是趋势？Tree Shaking 的前提是什么？main / module / exports 有何区别？

**标准答案：**
- **ESM 是趋势的原因**：① 语言级标准，浏览器和 Node 统一；② **静态结构**（import/export 必须在顶层、依赖可静态分析），是 Tree Shaking、依赖预构建的基础；③ 实时绑定 + 循环依赖处理更优；④ 天然支持按需加载 `import()`。
- **Tree Shaking 前提**：
  1. 必须用 **ESM**——CJS 的动态 `require` 无法静态确定依赖关系。
  2. 模块**无副作用**或副作用被正确声明：打包器通过 `package.json` 的 `sideEffects` 字段判断，`sideEffects: false` 表示整包无副作用，未引用的导出可安全删除；否则保守保留。
  3. 生产模式开启压缩（Terser/esbuild minify）才能真正"摇掉"死代码。
- **字段区别**（解析优先级大致为 exports > module > main）：

| 字段 | 含义 | 指向 |
|------|------|------|
| `main` | CommonJS 入口（Node/老打包器） | CJS 产物 |
| `module` | 社区约定，指向 ESM 入口（非官方标准但广泛支持） | ESM 产物，利于 Tree Shaking |
| `exports` | 现代正式方案，按条件暴露子路径、封装内部文件，优先级最高 | 条件映射（`import`/`require`/`types`） |

**追问 1：什么是副作用（side effect）？为什么它对 Tree Shaking 关键？**
> **答案：** 副作用指模块被 import 时就执行的行为，如修改全局变量、注册 polyfill、注入 CSS（`import './style.css'`）。打包器不确定某文件有无副作用时，**不敢删除**它的未引用导出（删了可能破坏功能）。库作者用 `sideEffects: false` 或数组白名单明确告知，打包器才敢激进摇树。

**追问 2：`exports` 相比 `main` 解决了什么痛点？**
> **答案：** `main` 只能暴露单一入口，外部可深度引用包内任意路径（如 `lodash/fp`），导致内部结构不敢改、可能绕过 ESM 版本。`exports` 通过**子路径导出映射**显式声明"哪些能被引用"，未列出的路径被封装（Node 会报错），还能按 `import`/`require` 条件分别返回 ESM/CJS 产物。

---

### Q4. Webpack 的构建流程是怎样的？loader 和 plugin 分别负责什么？

**标准答案：**
- **构建流程**：
  1. **初始化**：读取配置，创建 Compiler 对象，加载插件。
  2. **编译**：从 `entry` 出发递归解析依赖，用对应 **loader** 把各类资源（`.tsx`/`.scss`/图片）转成 Webpack 可识别的 JS 模块，构建**依赖图**。
  3. **封装**：把每个模块封装成 Module 对象，按依赖关系生成 chunk。
  4. **优化与输出**：Tree Shaking、代码分割、压缩，通过 `output` 把 chunk 写成最终 bundle。
- **loader vs plugin**：
  - **loader**：**转换器**，作用于**单个模块文件**，把非 JS 转成 JS 模块（如 `ts-loader`、`babel-loader`、`css-loader`），本质是函数。
  - **plugin**：**扩展器**，作用于**整个构建生命周期**，监听钩子在打包的特定时机做更宽泛的事（如 `HtmlWebpackPlugin` 生成 HTML、`DefinePlugin` 注入环境变量、压缩、资源优化）。

**追问 1：多个 loader 的执行顺序是什么？如何记忆？**
> **答案：** 同一 rule 下 loader **从后往前**执行：`use: ['style-loader', 'css-loader', 'less-loader']` 的顺序是 **less-loader → css-loader → style-loader**。可记为"先转译后注入"：less 编译成 css，css-loader 处理 `@import`/`url()` 转成 JS 模块，最后 style-loader 把样式注入 DOM。

**追问 2：plugin 的底层机制是什么？Tapable 了解吗？**
> **答案：** Webpack 的 plugin 基于 **Tapable 事件流**机制。Tapable 提供 `SyncHook`/`AsyncSeriesHook`/`AsyncParallelHook` 等钩子；Webpack 在构建各阶段广播钩子（如 `emit`、`compilation`、`done`），插件通过 `compiler.hooks.xxx.tap(...)` **注册回调**介入。所以 plugin 本质是"在钩子上挂函数，在特定时机修改构建结果"，这是理解 Webpack 可扩展性的核心。

---

<a id="part-3"></a>

## Part 3：核心区分度题（题眼，定级主战场）

> **这一部分是全题的题眼**——能否讲清 Vite 原理、pnpm 存储、Babel 编译，直接决定 L2 还是 L3/L4。定级主要看这里。

### Q5. Vite 为什么快？讲讲它的 dev server、依赖预构建、HMR 和生产打包机制。

**标准答案：**
- **核心：dev 阶段不打包，利用浏览器原生 ESM**。浏览器直接请求源码模块，dev server 按需转换返回，**无需等待整包构建**，启动是"秒级"的。
- **依赖预构建（esbuild）**：首次启动用 **esbuild**（Go 编写，极快）把 CJS / UMD 依赖预打包成 ESM，并合并内部模块——解决两点：① CJS 依赖浏览器不能直接用；② 避免海量小模块请求导致"请求瀑布"。
- **HMR（热更新）**：基于 ESM 和 WebSocket，模块变更时精确失效受影响的模块链，只重新请求变更模块，更新速度与项目规模基本无关。
- **生产打包用 Rollup**：dev 的免打包不适合生产（大量模块请求、无优化），生产用 **Rollup** 做 Tree Shaking、代码分割、压缩，输出优化后的静态资源。
- **为什么快总结**：esbuild 预构建 + 原生 ESM 免打包 + 按需编译 + HMR 精准更新。

```js
// vite.config.ts 典型结构
export default defineConfig({
  plugins: [vue()],
  build: { rollupOptions: { output: { manualChunks: { vendor: ['vue', 'react'] } } } },
  server: { port: 5173 }
})
```

**追问 1：既然 dev 用原生 ESM，为什么生产还要打包？**
> **答案：** 生产打包是为了**加载性能与兼容性**：① 减少 HTTP 请求数（避免瀑布）；② Tree Shaking / 压缩 / 代码分割减小体积；③ `contenthash` 做长缓存；④ 兼容旧浏览器与处理 CJS 依赖；⑤ 支持预加载、模块合并。dev 的"快"是开发体验，prod 的"打包"是线上性能，目标不同。

**追问 2：Vite 的 HMR 和 Webpack 的 HMR 本质区别？**
> **答案：** Webpack HMR 基于**打包后的 bundle**，改动后需重新构建受影响 chunk，大项目会变慢；Vite HMR 直接基于**原生 ESM 模块**，依赖图精确失效，只让浏览器重拉变更模块，速度与项目规模弱相关。

**追问 3：什么场景仍选 Webpack 而非 Vite？**
> **答案：** ① 有特殊构建需求、深度依赖 Webpack 私有 loader/plugin 的老项目，迁移成本高；② 需要 Webpack 更成熟的生态与大型复杂定制；③ 团队对 Webpack 更熟。选型看项目规模、历史包袱与团队熟悉度，而非"谁更新潮"。

---

### Q6. pnpm 为什么省磁盘？lockfile 和语义化版本分别起什么作用？什么是幽灵依赖？

**标准答案：**
- **pnpm 省磁盘的原理**：
  - **content-addressable store（内容寻址存储）**：依赖内容按 hash 存在全局 store（如 `~/.pnpm-store`），**同一版本全机器只存一份**。
  - **硬链接（hard link）**：项目 `node_modules` 里的文件不是复制，而是**硬链接**到 store 中的文件，多项目共享同一份物理存储，几乎不额外占空间。
  - **符号链接（symbolic link）**：`node_modules/.pnpm` 下按版本平铺真实包，业务依赖目录通过**符号链接**指向它，形成严格嵌套结构。
- **幽灵依赖（phantom dependency）**：npm 的**依赖提升（hoist）**会把子依赖提到顶层 `node_modules`，于是代码能 `require` 一个**未在 package.json 声明**的包——这就是幽灵依赖。危险在于依赖树一变（某包不再依赖它）代码就崩溃。pnpm 用符号链接构造**严格隔离**的 `node_modules`，未声明的包不可见，从根上杜绝。
- **lockfile 作用**：锁定**依赖树的精确版本与结构**（含传递依赖），保证不同人、机器、时间 `install` 出**完全一致**的结果，是可复现构建与 CI 稳定性的基础，应提交入库。
- **语义化版本（SemVer `major.minor.patch`）**：`^1.2.3` 允许 minor/patch 升级，`~1.2.3` 只允许 patch。SemVer 描述"**期望的兼容范围**"，lockfile 锁定"**实际安装的确切版本**"——范围给灵活度，lockfile 给确定性。

**追问 1：npm / yarn / pnpm 的核心差异？**
> **答案：** npm 是官方方案（v5 起有 lockfile）；yarn 早期以速度和确定性 lockfile 取胜，引入 workspaces；pnpm 用硬链接+符号链接省磁盘、严格隔离杜绝幽灵依赖、monorepo 支持优秀。现代 npm 也在吸收彼此特性，差距缩小，但**存储模型**仍是 pnpm 的独有优势。

**追问 2：什么是 workspaces / monorepo？pnpm 如何支持？**
> **答案：** monorepo 是"**一个仓库管理多个包**"的策略；workspaces 是包管理器提供的原生支持，让多个包互相依赖、共享 lockfile、统一安装。pnpm 通过根 `pnpm-workspace.yaml` 声明工作区，支持 `workspace:*` 协议引用本地包，配合 `pnpm -r` 批量执行命令，是当前 monorepo 的主流选择之一。

---

### Q7. Babel 的编译原理是什么？polyfill 怎么回事？SWC/esbuild 为什么更快？

**标准答案：**
- **Babel 三阶段**：
  1. **Parse**：用 `@babel/parser` 把源码解析成 **AST（抽象语法树）**。
  2. **Transform**：遍历 AST，由 **plugin / preset** 按规则增删改节点（如箭头函数转普通函数、TS 类型擦除）。
  3. **Generate**：用 `@babel/generator` 把修改后的 AST 生成目标代码（可带 source map）。
- **plugin vs preset**：plugin 是单个转换规则；preset 是**一组 plugin 的集合**（如 `@babel/preset-env` 按目标浏览器自动决定需要哪些转换）。
- **polyfill**：语法转换（如箭头函数）解决"语法认不认"，新 API（如 `Promise`、`Array.prototype.flat`）需要**运行时补齐**——这就是 polyfill。`core-js` 是主流库；`@babel/preset-env` 配合 `useBuiltIns: 'usage'/'entry'` + `corejs` 按需注入。Babel 7.4 起 `@babel/polyfill` 已废弃，直接用 `core-js` + `regenerator-runtime`。
- **SWC / esbuild 为什么快**：用 **Rust / Go** 编写，是**原生编译型**工具，多线程并行、内存模型高效，相比纯 JS 的 Babel 有**数量级**速度提升，可替代 Babel 转译或作为打包器。

**追问 1：Babel 和 TypeScript 编译器（tsc）什么关系？transpile only 是什么？**
> **答案：** Babel **只做语法转换、不做类型检查**，通过 `@babel/preset-typescript` 擦除类型（快）；`tsc` 既转译又做完整类型检查（慢但严谨）。**transpile only** 指跳过类型检查、只转译（如 esbuild 转 TS、`ts-loader` 的 `transpileOnly: true`），常配合 `fork-ts-checker-webpack-plugin` 在独立进程检查类型，兼顾速度与正确性。

**追问 2：`@babel/preset-env` 的 targets 如何影响产物？**
> **答案：** 它根据 `targets`（浏览器兼容范围，来自 `.browserslistrc`）**只转译目标环境不支持的语法、只注入缺失的 polyfill**。目标越宽（兼容旧浏览器）转译和 polyfill 越多、体积越大；目标越窄（只支持现代浏览器）产物越接近源码。

**追问 3：Babel 会被 SWC 取代吗？**
> **答案：** 纯转译性能敏感场景（大型项目构建慢）SWC/esbuild 优势明显，Vite/Next.js 已大量采用；但 Babel 生态最成熟、自定义 plugin 最丰富，复杂定制仍依赖它。趋势是"**性能敏感用 Rust/Go 工具，复杂定制用 Babel**"并存，而非一刀切取代。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题

### Q8. code splitting、contenthash、gzip/brotli、source map 各有什么门道？

**标准答案：**
- **code splitting（代码分割）**：把 bundle 拆成多个 chunk 按需加载，减小首屏体积。三种常见方式：① **入口分割**（多 entry）；② **动态 `import()`**（路由级/组件级懒加载，返回 Promise）；③ **SplitChunksPlugin** 抽取公共/ vendor chunk。
- **动态 import**：`const mod = await import('./heavy')`，打包器把 `./heavy` 单独打成 chunk，首次用到才下载，是首屏优化利器。
- **contenthash 长缓存**：产物文件名带**内容 hash**（如 `app.a1b2c3.js`）。内容变→hash 变→URL 变→重新下载；内容不变→命中强缓存（`Cache-Control: max-age=31536000, immutable`）。区分 `hash`（整次构建）/ `chunkhash`（按 chunk）/ `contenthash`（按文件内容，最精确）。
- **gzip / brotli**：服务端/网关压缩文本资源传输，brotli 压缩率通常高于 gzip；构建阶段可预生成 `.gz`/`.br` 由 Nginx/CDN 直接返回，省去实时压缩开销。
- **source map**：映射压缩代码到源码便于调试，类型很多（`eval`/`cheap-module-source-map`/`source-map` 等），dev 用快而详细的，prod 用完整的或 hidden 的。

**追问 1：生产环境 source map 有什么泄露风险？如何兼顾调试与安全？**
> **答案：** 若把完整 source map 随产物发布到公网，任何人都能还原**源码逻辑**，有安全风险。做法：生产用 `hidden-source-map`（生成但不引用）或 `nosources-source-map`（不含源码内容），把 source map **只上传到错误监控平台**（Sentry 等）还原线上堆栈，不放公开静态目录。

**追问 2：chunk 拆分过细有什么问题？**
> **答案：** 拆太细导致**HTTP 请求数激增**、chunk 间重复代码、首次并行加载变慢（HTTP/2 下影响变小但仍有开销）。应按**路由/功能边界 + 公共依赖**合理拆分，配合 `prefetch`/`preload` 预加载，而非"能拆就拆"。

---

### Q9. 首屏体积过大、构建很慢，分别怎么排查和优化？

**标准答案：**
- **首屏体积过大**：
  1. **先量化**：用 `webpack-bundle-analyzer` / `rollup-plugin-visualizer` 出**体积分析图**定位大模块。
  2. **按需加载**：路由懒加载 + 组件动态 `import()`；大依赖按功能引入（如 lodash-es 按需、图标按需）。
  3. **Tree Shaking**：确认用 ESM、`sideEffects` 正确、prod 模式开启。
  4. **拆分 vendor / 提取公共 chunk**，配合 CDN 与长缓存。
  5. **压缩与图片优化**：gzip/brotli、图片转 WebP/AVIF、字体子集化。
- **构建很慢**：
  1. **先定位瓶颈**：用 `speed-measure-webpack-plugin` 或 `--profile` 测各 loader/plugin 耗时，判断是转译慢、压缩慢还是 IO 慢。
  2. **转译提速**：Babel 换 SWC/esbuild；缩小 `include`/`exclude`（别对 `node_modules` 做 babel-loader）；开缓存（`babel-loader?cacheDirectory`、Webpack 5 `filesystem` cache）。
  3. **并行/多核**：`thread-loader`、terser 并行。
  4. **换工具**：dev 迁 Vite（免打包），或用 Rspack/Rollup 等更快构建器。
  5. **减少不必要工作**：dev 关压缩、关昂贵类型的 source map、按需构建。

**追问 1：为什么"先量化再优化"是铁律？**
> **答案：** 成因多样，凭直觉常做无用功（瓶颈在图片却去折腾 Babel）。用分析工具拿到**数据**（谁最大、谁最慢），针对 TOP 瓶颈下手收益最大，并有基线数据验证效果。

**追问 2：转译慢但类型检查也慢，怎么兼顾？**
> **答案：** 用 **transpile only**（esbuild/SWC）做快速转译，把类型检查**挪到独立进程**（`fork-ts-checker-webpack-plugin`）或 CI 异步执行。开发时不等类型检查、构建飞快，提交/CI 时仍保证类型正确。

---

### Q10. 依赖冲突、缓存失效、Webpack 迁移 Vite 的坑有哪些？工程规范如何落地？

**标准答案：**
- **依赖冲突**：同一包多版本共存导致行为异常或体积翻倍。排查用 `npm ls <pkg>` / `pnpm why <pkg>` 看依赖树；解法：升级统一版本、用 `overrides`（npm/pnpm）或 `resolutions`（yarn）强制版本、`dedupe`。
- **缓存失效**：① **浏览器缓存**：文件名无 hash 导致更新不生效 → 用 contenthash + 合理 Cache-Control（HTML 用 no-cache，静态资源长缓存）；② **构建缓存**：缓存没失效导致产物陈旧 → 确保缓存 key 包含配置/依赖变化，必要时清 `.cache`/`node_modules/.vite`。
- **Webpack 迁移 Vite 的坑**：① `require`/CJS 依赖需预构建或改 ESM；② Webpack 专用 loader/plugin 无对应 Vite 插件，需找替代或改写；③ 环境变量从 `process.env` 改为 `import.meta.env.VITE_`（前缀约束）；④ `__dirname`/`process` 等 Node 全局变量浏览器不可用；⑤ 路径别名、静态资源引用方式差异；⑥ dev 用 esbuild、prod 用 Rollup，行为可能与 Webpack 不同，要回归测试。

**工程规范落地：**

| 工具 | 职责 |
|------|------|
| **ESLint** | 代码质量/潜在 bug 静态检查，配共享 config 统一规则 |
| **Prettier** | 统一代码格式（缩进、引号、换行），与 ESLint 分工（格式交 Prettier） |
| **Husky + lint-staged** | Git hooks：提交前只对**暂存文件**跑 lint/format，阻止坏代码入库 |
| **CI/CD** | 提交后自动跑 lint + test + build，绿了才部署，保证主干质量 |

环境变量注入：dev 用 `.env.development`、prod 用 `.env.production`，构建时通过 `DefinePlugin`（Webpack）或 `import.meta.env`（Vite）**注入并区分**，敏感信息绝不前端硬编码。

**追问 1：为什么 lint-staged 只处理暂存文件，而不是全量？**
> **答案：** 全量 lint 大项目很慢，且会把历史遗留问题一起暴露、阻塞提交。`lint-staged` 只检查 `git add` 的文件，反馈快、聚焦本次改动，是提交前门禁最佳实践（全量检查交给 CI）。

**追问 2：微前端是什么？qiankun 和 Module Federation 的区别？**
> **答案：** 微前端把大应用拆成多个可独立开发、部署的子应用再聚合。**qiankun**（基于 single-spa）是**运行时容器**方案：主应用按路由加载子应用，用 JS 沙箱 + 样式隔离，接入成本低、技术栈无关。**Module Federation**（Webpack 5 / Vite 插件）是**模块共享**方案：运行时从远端动态加载模块，可共享依赖、互相暴露/消费组件，更灵活但心智负担高。前者偏"应用级拼装"，后者偏"模块级共享"。

---

<a id="part-5"></a>

## Part 5：2026 新趋势：Rust 工具链与 bundleless

> 加分题，考察技术视野；涉及版本以官方发布为准，细节保守表述。

### Q11. 谈谈 Rust 工具链的普及、Rolldown、Lightning CSS 和 bundleless 趋势。

**标准答案：**
- **Rust / Go 工具链普及**：构建性能瓶颈催生"原生化"浪潮——**SWC**（Rust，转译）、**esbuild**（Go，构建/转译）、**Rspack**（字节开源，Rust，兼容 Webpack 生态）、**Turbopack**（Vercel，Rust，Next.js 构建工具，主打增量计算）、**Oxc**（Rust 高性能 JS 工具集，涵盖 parser/linter/transformer/minifier）。共同点是**用系统级语言换数量级性能**。
- **Rolldown**：由 Evan You 团队推进的 **Rust 版 Rollup**，目标兼容 Rollup 插件生态同时获得 Rust 级速度。它正**逐步集成进 Vite 生态**，团队已规划将其作为未来默认生产打包器（路线图层面），但目前 **Vite 7 默认生产打包仍是 Rollup**——面试中不该把"已默认切换"说成既成事实，以官方版本公告为准。
- **Lightning CSS**：Rust 编写的 CSS 工具，把**解析、浏览器前缀补全、降级转译、压缩**合为一步，速度远超纯 JS 的 PostCSS 类方案，已被 Parcel、Vite 等采用/支持。
- **bundleless（无打包）**：开发阶段基于原生 ESM **不打 bundle**（Vite/Snowpack 思路），浏览器按需加载；生产仍倾向打包优化。随 HTTP/2、原生 ESM、import maps 成熟，"构建"正从"必须打包"走向"按需转换 + 必要时打包"。

**追问 1：为什么前端工具链集体转向 Rust/Go？**
> **答案：** JS 是解释型、主线程单线程语言，CPU 密集任务（解析、转译、压缩）性能受限；Rust/Go 是编译型原生语言，可多线程并行、内存可控，性能有数量级提升。当项目大到"构建慢"成为真实痛点，用系统语言重写工具链就是高收益选择。

**追问 2：bundleless 会不会彻底取代打包？**
> **答案：** 短期不会。生产仍需要打包做 Tree Shaking、压缩、代码分割、缓存指纹与兼容性处理，这些是"加载性能"刚需。bundleless 主要革新**开发体验**（免打包、秒启动、精准 HMR）。更可能二者长期共存、各司其职。

---

<a id="part-6"></a>

## Part 6：能否用前端工程化定级？如何定级？

### 结论先行

**可以，前端工程化是区分度很好的探针**——它天然分层：会用工具 → 懂模块化/构建概念 → 懂底层原理 → 能排查优化实战问题 → 懂体系演进与技术选型。但它覆盖面广，**对初中级候选人要控制范围**：招初中级问到 Part 1/2 即可，强问 Vite 内核或 pnpm 存储只会考到背诵。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 会用 Vite/Webpack 脚手架，知道 CJS/ESM 名字；说不清差异与构建流程 |
| **中级（L2）** | 2–5 年 | Part 2 | 懂 ESM 静态优势与 Tree Shaking 前提、loader/plugin 分工、Babel 三阶段 |
| **中高级（L3）** | 5–8 年 | Part 3 | 讲得清 Vite 原理、pnpm 存储模型、Babel/SWC 取舍；能做技术选型 |
| **高级（L4）** | 8 年+ | Part 4 | 有体积/构建优化实战、能排查依赖冲突与缓存失效、主导过迁移 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 跟进 Rust 工具链与 bundleless 演进，能把工程化放入团队规范与架构治理 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"模块化+构建+包管理+转译+产物"五条主线 → 至少 L2；只会说"用 Webpack 打包" → 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追问"为什么"：
- 为什么 ESM 能 Tree Shaking 而 CJS 不行？（静态分析 vs 运行时动态）
- 为什么 Vite dev 快、prod 还要打包？（开发体验 vs 线上性能）
- 为什么 pnpm 既省磁盘又杜绝幽灵依赖？（硬链接 + 严格隔离）
- 为什么用 contenthash 能长缓存？（内容变 URL 变）

**第三步：三类信号防背题。**
1. **真实性**：能否讲出**具体的优化/排障案例**（"bundle analyzer 发现某依赖全量引入""迁移 Vite 踩了 `process.env` 的坑""构建慢定位到 babel-loader 没排除 node_modules"）。
2. **抽象能力**：能否把工具归纳为统一本质——Webpack/Vite/Rspack → "**模块图 + 转换 + 产物优化**"；CJS/ESM/AMD/UMD → "**模块规范与依赖解析时机**"；npm/yarn/pnpm → "**依赖树 + 存储模型 + 确定性**"。
3. **权衡能力**：能否讲清"什么场景不该用"——小项目别上微前端、dev 快不等于 prod 优、拆包过细反而慢。

**第四步：按最深层级定级，不按正确率。** 结合岗位难度调整追问深度：业务开发问到 Part 3 足够；基建/平台团队才需要 Part 4 实战与 Part 5 视野。

---

### 面试官避坑提醒

- **不要对所有人问到源码级**——很多优秀中级工程师没背 Vite 源码但理解思想。区分"理解设计"和"背过实现"，前者更有价值。
- **把"实战排障"作为 L4 分水岭**：能讲清一次完整的体积/构建优化或迁移复盘的人，通常是真做过。
- **版本事实要核实**：如 Rolldown 与 Vite 7 的关系、Babel polyfill 废弃等，别用过时结论误导，也不接受候选人把"计划中"说成"已默认"。
- **结合岗位**：前端业务开发问到 Part 3/4 足够；工程化平台/架构团队才深挖 Part 4/5。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**

1. 什么是前端工程化？→（模块化/构建/包管理/转译/产物性能）
2. CJS vs ESM？→（运行时 vs 编译期、值拷贝 vs 实时绑定）
3. ESM 为何是趋势 / Tree Shaking 前提？→（静态分析、sideEffects、main/module/exports）
4. Webpack 流程 + loader/plugin？→（依赖图、loader 转换单文件、plugin 监听 Tapable 钩子）
5. Vite 为什么快？→（原生 ESM 免打包、esbuild 预构建、精准 HMR、prod 用 Rollup）
6. pnpm 为何省磁盘 / 幽灵依赖？→（硬链接+符号链接+content-addressable store、严格隔离）
7. Babel 原理 / SWC 提速？→（parse→transform→generate、preset/plugin、core-js；Rust/Go）
8. code splitting / contenthash / source map？→（懒加载、内容指纹长缓存、source map 泄露风险）
9. 首屏大 / 构建慢怎么排查？→（先量化、按需加载、换原生工具、缓存）
10. 依赖冲突 / 缓存失效 / 迁移 Vite 坑？→（overrides、contenthash、环境变量/插件替代）
11. 2026 新趋势？→（Rust 工具链、Rolldown 逐步集成、Lightning CSS、bundleless 共存）

**定级速判：**
- 答到第 2–4 问 → L2
- 答到第 5–7 问 + 能讲原理 → L3
- 答到第 8–10 问 + 有实战复盘 → L4
- 答到第 11 问 + 体系化演进判断 → L5

**一票否决信号：** 认为"Vite 完全没有打包、生产也不用构建"、说不清 CJS 与 ESM 的加载时机差异、认为"pnpm 只是装得快"、把"计划中的 Rolldown 默认集成"说成"Vite 7 已默认" → 无论年限，最高 L2。

---

*资料整理于 2026-11-19，参考 Webpack / Vite / Rollup / esbuild / SWC / pnpm / Babel / Rspack / Oxc / Lightning CSS 官方文档与 GitHub 仓库，MDN 关于 ESM 与 source map 的说明，SemVer 规范，以及 2026 年前端工程化面试趋势资料。涉及版本细节（如 Rolldown 与 Vite 的集成进度）以官方发布为准；题目与答案基于公开技术资料整理，用于面试评估参考。*
