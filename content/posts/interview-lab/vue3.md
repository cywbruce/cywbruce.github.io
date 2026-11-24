---
title: "Vue 3 面试题库（含追问链与定级指南）"
date: 2026-11-20
order: 803
summary: "Proxy 响应式、依赖收集、模板编译与 PatchFlag、Vapor 模式。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **Vue 3 响应式内核、渲染机制与工程化生态** 的真实深度"问出来"。
> 核心原则：**Vue 3 的每一道题，最终都会落到"Proxy 响应式 → 依赖收集（track/trigger）→ 编译优化 → 组件与状态"这条主线**。只会用 ref/reactive 写业务却讲不清依赖怎么收集、更新怎么触发的人，基本停留在 API 记忆层。
> 配套：本题库可与 React / TypeScript / Vite 等前端题库共同构成"前端框架面试定级体系"，统一沿用 L1–L5 标尺。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题](#part-1)
- [Part 2：底层原理题（Proxy 与依赖收集）](#part-2)
- [Part 3：核心区分度题（题眼，定级主战场）](#part-3)
- [Part 4：状态、路由与实战陷阱题](#part-4)
- [Part 5：2026 新趋势（响应式重构 / Vapor Mode / Vite）](#part-5)
- [Part 6：能否用 Vue 3 定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 Vue 3 的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> 第一，**响应式系统重写**：用 **Proxy 替代 Object.defineProperty**，解决 Vue 2 无法监听数组下标/长度变化、动态新增删除属性、嵌套对象深度递归初始化性能差的问题。
>
> 第二，**Composition API**：按逻辑关注点组织代码，配合 `setup` / `<script setup>`，解决 mixins 命名冲突、来源不清的问题，逻辑复用（composables）和类型推导更自然。
>
> 第三，**性能与编译优化**：引入**静态提升、PatchFlag、事件缓存**，让 diff 只比对动态节点；配合 **Tree-shaking** 减小打包体积。
>
> 第四，**更好的 TypeScript 支持**：源码用 TS 重写，类型推导更完整。
>
> 第五，**新特性与生态**：Fragment、Teleport、Suspense，以及以 **Vite** 为核心的工具链。

**评分要点：** Proxy / Composition API / PatchFlag / Tree-shaking / TS 与生态五个点对应入门到高级。能说出 Proxy 动机和 PatchFlag 的，直接往 Part 2 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题

### Q1. Vue 3 为什么重写响应式？Object.defineProperty 有哪些局限？

**标准答案：**
- **数组硬伤**：defineProperty 无法拦截数组下标赋值（`arr[0]=x`）和长度修改，只能重写 7 个变更方法（push/pop/splice 等）"曲线救国"，拦截不完整。
- **动态属性无法监听**：对象新增/删除属性不会被拦截，需借助 `Vue.set` / `Vue.delete`。
- **初始化性能差**：必须深度遍历所有属性逐个劫持，嵌套越深成本越高。
- **Proxy 优势**：直接代理整个对象，可拦截 get/set/deleteProperty 等 13 种操作，天然支持数组和动态属性；嵌套对象**懒代理**（访问到才创建代理），初始化更快。

**追问：Proxy 有什么缺点？兼容 Options API 吗？**
> **答案：** 缺点：① ES6 特性无法 polyfill 兼容 IE11，Vue 3 因此放弃 IE；② 代理对象与原对象不等价（`proxy !== target`），严格相等判断需注意。Options API 依然兼容，老项目可平滑升级，但 Composition API 是推荐方向。

---

### Q2. Options API 和 Composition API 有何区别？为什么需要后者？

**标准答案：**
- **Options API**：按 `data`/`methods`/`computed` 等选项分类组织。简单组件直观，但复杂组件里**同一逻辑关注点的代码被拆散**，难以维护。
- **Composition API**：用 `setup` 把同一逻辑聚合，并可抽成 composable 函数复用。
- **核心动机**：解决 **mixins 缺陷**（命名冲突、来源不清、隐式依赖），并提供更友好的 **TS 类型推导**。

**追问 1：Composition API 是要取代 Options API 吗？**
> **答案：** 不是，二者共存互补。简单组件用 Options 依然清晰；复杂组件、逻辑复用或强类型场景用 Composition。

**追问 2：mixins 有什么问题，composables 怎么解决？**
> **答案：** mixins 易命名冲突、属性来源难追溯、mixin 间隐式耦合。composables 是普通函数，通过**显式返回值**暴露状态，来源清晰、可传参、类型可推导。

---

### Q3. reactive 和 ref 有什么区别？为什么两者都需要？

**标准答案：**
- **reactive**：接收对象/数组，返回**响应式代理（Proxy）**，直接访问属性，无需 `.value`。
- **ref**：接收**任意类型**（含基本类型），返回带 `.value` 的 Ref 对象；模板中自动解包。
- **为什么都要**：Proxy 无法代理基本类型，ref 用 `.value` 对象包装统一了基本类型响应式；传入对象时内部会调用 `reactive` 转深层响应式。

**追问 1：ref 包装对象时内部发生什么？**
> **答案：** `ref(obj)` 创建 `{ value: toReactive(obj) }`，`toReactive` 判断为对象则调用 `reactive` 转 Proxy，所以 `.value` 是响应式代理对象。

**追问 2：模板里为什么不用写 `.value`？**
> **答案：** 模板编译时对顶层 ref 做**自动解包（unref）**，渲染时自动取 `.value`；但在 JS（setup 内）仍需手动 `.value`。

---

<a id="part-2"></a>

## Part 2：底层原理题（Proxy 与依赖收集）

> 这是"会用响应式 API"和"懂内核"的分水岭，L2→L3 的关键。

### Q4. Vue 3 响应式完整链路？track 和 trigger 如何工作？

**标准答案：** （能完整讲下来基本是 L3）核心是 **Proxy + Reflect + effect** 配合：

1. `reactive(target)` 返回 Proxy，拦截 `get` / `set`。
2. **读时收集（track）**：effect 执行读取属性时，`get` 调用 `track`，把当前 **activeEffect** 收集进依赖集合。
3. **写时触发（trigger）**：改属性时 `set` 调用 `trigger`，取出该 key 的所有 effect 重新执行。
4. **依赖存储**用 `targetMap`（WeakMap）：
```js
// target → key → Set<effect>
targetMap: WeakMap<target, Map<key, Set<effect>>>
```
5. **Reflect**：`Reflect.get(target, key, receiver)` 保证 this 指向**代理对象**，否则依赖收集出错。

**追问 1：为什么用 Reflect 而非直接 `target[key]`？**
> **答案：** `receiver` 让 this 指向代理，避免 target 内部 getter 以原始对象为 this 而**绕过代理导致依赖收集丢失**。Reflect 保证代理链正确传递。

**追问 2：targetMap 为什么用 WeakMap？**
> **答案：** WeakMap 键是**弱引用**，响应式对象被 GC 回收时其依赖关系自动清理，**避免内存泄漏**；用普通 Map 会强引用导致无法释放。

---

### Q5. effect、调度器与 computed 的懒执行和缓存如何实现？

**标准答案：**
- **effect**：响应式执行单元，`effect(fn)` 立即执行并把自身设为 activeEffect 从而被 track；依赖变化后被 trigger 重执行。
- **调度器（scheduler）**：trigger 时不直接执行 effect，而交给 scheduler 决定**执行时机**（去重、入队）——是 watch 的 `flush` 与批量更新的基础。
- **computed** = **lazy + 带缓存的 effect**：创建时不立即执行（`lazy:true`）；有 `dirty` 标记，依赖变化时由 scheduler 置 `dirty=true`，读取时才重算并置回 `false`。

**追问 1：computed 为什么要缓存？和 methods 区别？**
> **答案：** computed 仅依赖变化时重算，多次读取返回缓存；methods 每次调用都执行。昂贵计算放 methods 并在模板频繁调用会造成重复计算。

**追问 2：依赖变化时 computed 为何不立即重算而是标脏？**
> **答案：** **懒计算**优化：依赖可能频繁变化但结果未必马上被读。标脏把计算推迟到下次读取，期间多次变化只算一次，避免中间态无效计算。

---

### Q6. watch 和 watchEffect 有何区别？flush 时机如何理解？

**标准答案：**

| 对比项 | watch | watchEffect |
|--------|-------|-------------|
| 数据源 | 显式指定（getter/ref/数组） | 自动收集回调中用到的依赖 |
| 执行时机 | 默认**懒执行**（immediate 才立即） | **立即执行**一次 |
| 新旧值 | 有 `(newVal, oldVal)` | 无旧值 |
| 依赖范围 | 精确控制在指定源 | 回调用到的所有响应式属性 |

`flush`：`pre`（默认，更新前）/ `post`（更新后，可读最新 DOM）/ `sync`（同步立即，少用）。

**追问 1：watch 监听 reactive 对象要开 deep 吗？**
> **答案：** `watch(reactiveObj, cb)` **隐式深度监听**；但 `watch(() => obj.x, cb)` 的 getter 形式只监听返回值本身，若返回对象且要监听内部变化需 `deep:true`。

**追问 2：什么场景用 `flush:'post'`？**
> **答案：** 回调需读取**更新后的 DOM**（测量尺寸、操作 ref 指向的 DOM）时用 post。Vue 3.5+ 提供 `watchPostEffect` 语法糖。

---

<a id="part-3"></a>

## Part 3：核心区分度题（题眼，定级主战场）

> **全题题眼**——能否讲清响应式丢失、diff、编译优化和生命周期，直接决定 L2 还是 L3/L4。

### Q7. 什么是"响应式丢失"？如何避免？（最高频陷阱）

**标准答案：** （能系统讲清是 L3+）属性被取出后**脱离 Proxy 的 get/set 拦截变成普通值**，修改不再触发更新。场景：
- 解构 reactive：`const { count } = state`，count 是普通数字。
- 赋值给普通变量、展开运算符 `{...state}`。
- `<script setup>` 中直接 `const { title } = props`。

**解决**：用 **toRefs**（`const {count} = toRefs(state)`，每属性变 ref，改 `.value` 写回源）、**toRef**（单个属性），或 Vue 3.5 的**响应式 props 解构**（编译器自动保活）。

**追问 1：为什么解构会丢失？根源？**
> **答案：** 响应式依赖 Proxy 拦截。`state.count` 读取本会 trigger track，但解构是一次性取值得到**原始值拷贝**，此后读写不再经过 Proxy，无法 track/trigger。

**追问 2：toRefs 原理？**
> **答案：** 遍历每个 key 用 `toRef` 创建 **ObjectRefImpl**：`get value()` 返回 `source[key]`，`set value(v)` 写回 `source[key]`。这个"转发回源对象"的 getter/setter 保住了响应式链路。

**追问 3：ref 作为 reactive 数组元素会自动解包吗？**
> **答案：** **不会**。Vue 对 reactive 对象属性自动解包 ref，但**数组元素和 Map 值不解包**。`reactive([ref(1)])[0]` 得到的是 ref，需 `.value`。

---

### Q8. Vue 3 diff 算法做了哪些优化？为什么需要 key？

**标准答案：**
- **双端指针**：oldStart/oldEnd/newStart/newEnd 四指针从两端逼近，优先处理头头、尾尾、头尾、尾头四种命中，复杂度接近 O(n)。
- **最长递增子序列（LIS）**：节点移动时用 LIS 找出顺序不变的最长一组保持不动，只移动其余，最小化 DOM 移动。
- **PatchFlag**：编译时标记动态节点类型（TEXT/CLASS/PROPS），diff **只比对动态部分**，静态子树整棵跳过。
- **静态提升**：静态节点提到 render 外复用。
- **key**：作为节点**唯一身份**，帮助判断"是否同一节点"以复用 DOM、保持组件状态。

**追问 1：没有 key 为何状态错乱？**
> **答案：** 无 key 时按**索引位置**复用。列表中间插入/删除后，索引对应的数据变了，Vue 错误复用旧节点，导致输入框内容、组件 state 与数据错位；有 key 则按身份匹配、正确移动。

**追问 2：v-if 和 v-for 为何不建议写在同一元素？**
> **答案：** 优先级不同且易混淆：Vue 3 中 **v-if 优先于 v-for**，导致 v-if 无法访问 v-for 作用域变量（Vue 2 相反）。应先用计算属性过滤列表，或把 v-if 放外层。

---

### Q9. 模板编译过程？PatchFlag 如何提升性能？

**标准答案：** 三阶段：
1. **parse**：template 字符串 → **AST**。
2. **transform**：遍历 AST 处理指令、静态提升、生成 PatchFlag、缓存事件 → 转换后 AST。
3. **generate**：AST → **render 函数代码字符串**。

链路：`template → AST → render function → VNode → patch → 真实 DOM`。

**三板斧**：静态提升（静态节点提为常量复用）、PatchFlag（只比对标记的动态部分）、事件缓存（内联事件函数缓存，避免每次渲染生成新函数）。

**追问 1：运行时编译 vs 预编译？**
> **答案：** 完整版 `vue` 含 compiler 可运行时编译（灵活但有开销）；`vue.runtime` 只收 render 函数。实际 `.vue` 由 `vue-loader` / `@vitejs/plugin-vue` 在**构建时预编译**，运行时零编译开销、体积更小。

**追问 2：PatchFlag 为什么快？**
> **答案：** 传统 diff 递归比对整棵子树所有属性。PatchFlag 在编译期就知道节点"只有 class 动态"或"只有文本动态"，运行时**仅检查标记部分**，跳过静态属性和子树，把范围从整棵树缩到少量动态点。

---

### Q10. setup 执行时机与生命周期钩子顺序？

**标准答案：** `setup` 在**组件实例创建前**执行（约当 beforeCreate 之前），因此**拿不到 this**。组合式钩子与选项式顺序（组合式先注册先执行）：`setup → onBeforeMount(beforeMount) → onMounted(mounted) → onBeforeUpdate(beforeUpdate) → onUpdated(updated) → onBeforeUnmount → onUnmounted`。`onMounted` 等只能在 setup / `<script setup>` 中**同步调用**（依赖当前活跃实例上下文）。

**追问 1：setup 为何不能用 this？**
> **答案：** 执行时实例尚未初始化（data/methods/computed 还没挂到实例），this 未指向组件。Vue 通过参数 `props`、`context` 提供能力，从设计上避免 this 混乱。

**追问 2：组合式与选项式钩子能共存吗？顺序？**
> **答案：** 可共存（不建议混用）。同阶段**组合式钩子先于选项式**，因 setup 最先运行并完成注册，如 `onMounted` 回调先于 `mounted`。

---

<a id="part-4"></a>

## Part 4：状态、路由与实战陷阱题

### Q11. Pinia 和 Vuex 有何区别？为什么去掉 mutations？

**标准答案：**

| 对比项 | Vuex | Pinia |
|--------|------|-------|
| 核心概念 | State/**Mutations**/Actions/Getters | State/Actions/Getters |
| 改状态 | 同步走 mutations，异步走 actions | 统一在 actions 中同步/异步改 |
| 模块 | 单 store + modules + 命名空间 | 天然**多 store**，无嵌套命名空间 |

**为什么去掉 mutations**：Vuex 要求 mutations **必须同步**，以便 devtools 追踪每次变更（时间旅行），但带来同步/异步分离的心智负担与样板代码。Pinia 重构了 devtools 集成，**不再强制同步约束**，同步异步都在 actions 直接改 state，简化 API 同时保留追踪。

**追问 1：Vuex 当初为何要 mutations？**
> **答案：** 为**可被 devtools 追踪**。若任意处直接改 state 就无法记录"谁何时改了什么"。约束变更走同步 mutation，devtools 才能捕获每次变更、支持时间旅行。Pinia 用更现代机制去掉约束仍支持调试。

**追问 2：Pinia 为何对 TS 更友好？**
> **答案：** `defineStore` 直接传 setup 函数或 options 对象，state/actions/getters 类型自动推导，无需 Vuex 的字符串 mutation 类型和 `mapState` 等辅助函数的复杂声明。

---

### Q12. hash 与 history 路由模式区别？导航守卫执行顺序？

**标准答案：**
- **hash 模式**：URL 带 `#`（`/#/user`），通过 `hashchange` 切换。`#` 后变化**不发 HTTP 请求**，兼容性好、无需服务端配置，但 URL 不美观、SEO 弱。
- **history 模式**：基于 `pushState`/`replaceState`，URL 干净。切换不发请求，但**刷新或输入 URL 会向服务器请求该路径**，需服务端配置 fallback 到 `index.html`，否则 404。

**导航守卫顺序**：导航触发 → `beforeEach`（全局前置）→ `beforeEnter`（路由独享）→ `beforeRouteEnter`（组件内）→ 复用时 `beforeRouteUpdate` → `afterEach`（全局后置，无 next）。

**追问 1：history 模式刷新 404 怎么解决？**
> **答案：** 服务端配置所有未匹配静态资源的请求返回 `index.html`。Nginx：`try_files $uri $uri/ /index.html;`；Node 用 connect-history-api-fallback 类中间件。

**追问 2：如何动态添加路由？场景？**
> **答案：** `router.addRoute(record)` 运行时添加，典型用于**权限路由**——按后端返回角色动态注册可访问路由（常配合 `beforeEach` 首次导航完成），避免静态路由暴露无权限页面。

---

### Q13. 实战陷阱：v-if/v-show、nextTick、循环 ref、组件通信

**标准答案：**
- **v-if vs v-show**：`v-if` 条件渲染（false 时不创建/销毁，切换成本高、初始渲染省）；`v-show` 切 **CSS display**（始终渲染、切换成本低）。频繁切换用 v-show，条件很少变用 v-if。
- **nextTick 原理**：DOM 更新**异步批量**，同一 tick 多次修改合并，微任务后统一更新。`nextTick(cb)` 把回调放微任务队列（`Promise.then`，降级 MutationObserver/setTimeout），确保 DOM 更新**之后**执行、拿到最新 DOM。
- **循环绑定 ref 与组件通信**：`v-for` 中的 ref 是**数组**（函数式 ref 更可控，按索引访问）；通信选型——父子 `props`/`emit`，跨层级 `provide/inject`，全局用 Pinia，兄弟/任意用状态提升或事件总线（大型项目不推荐）。

**追问 1：nextTick 为何用微任务？**
> **答案：** 微任务在**同步代码后、渲染前**执行，一个 tick 内完成所有 DOM 更新并让回调尽快读取结果，避免宏任务额外渲染帧延迟。优先 `Promise.then`，不支持才降级宏任务。

**追问 2：v-model 本质？**
> **答案：** 语法糖。原生 input 上 = `:value` + `@input`；自定义组件上 = `:modelValue` + `@update:modelValue`。Vue 3 支持多个 v-model（如 `v-model:title`）。

---

<a id="part-5"></a>

## Part 5：2026 新趋势（响应式重构 / Vapor Mode / Vite）

> 加分题，考察技术视野。不确定细节以官方发布为准，保守表述、不编造 API。

### Q14. Vue 3.5 响应式重构与 useTemplateRef 解决了什么？

**标准答案：**
- **响应式重构（3.5，2024-09）**：核心是**内存与性能优化**——重写依赖收集数据结构（用双向链表管理 dep 与订阅），官方数据称显著降低内存占用、提升大型响应式数组/对象访问性能。对使用者**API 基本无感**，属无感升级。
- **useTemplateRef()**（3.5 新增）：`const el = useTemplateRef('myRef')` 统一获取模板引用，类型推导更友好，避免 `ref(null)` 与字符串名不一致的问题；同期还有 `watchPostEffect`/`watchSyncEffect`、`onWatcherCleanup` 等增强。

**追问：这些重构对业务代码有破坏性吗？**
> **答案：** 基本没有。3.5 响应式重构是底层实现优化，公开 API 兼容，绝大多数项目可平滑升级；useTemplateRef 是**新增**能力，不强制替换旧写法。

---

### Q15. Vapor Mode 与 Vue 的 SSR / Vite 生态演进怎么看？

**标准答案：**
- **Vapor Mode**：Vue 探索的**无虚拟 DOM 编译策略**，受 SolidJS 启发。绕过 VNode 与 diff，编译期生成**直接操作 DOM 的细粒度更新代码**，依赖变化精准更新对应 DOM，理论上更快更省内存。
  - **现状（保守）**：截至 2026 年处于**渐进可用 / 逐步稳定**阶段，通常需显式启用（如 `<script setup vapor>`），可与虚拟 DOM 组件互操作。**并未全面取代虚拟 DOM**，虚拟 DOM 仍是默认且成熟路径，复杂场景与生态兼容仍依赖它。
- **SSR 优化**：`@vue/server-renderer` 支持流式渲染与 SSR 构建；Nuxt 3 封装同构渲染、水合（hydration）与数据预取。
- **Vite**：**原生 ESM + esbuild 预构建 + 快速 HMR**，启动与热更新远快于传统打包器，生产用 Rollup，是官方推荐工具链。

**追问 1：Vapor Mode 会让虚拟 DOM 消失吗？**
> **答案：** 短期不会。Vapor 是**可选**策略，虚拟 DOM 的一致性、跨平台（自定义渲染器、SSR）与生态兼容不可替代。更可能长期共存、按场景选择，而非一方消失。

**追问 2：Vite 为什么快？**
> **答案：** ① 开发态用**原生 ESM** 按需加载，无需整体打包；② **esbuild**（Go）做预构建与转译，远快于 JS 打包器；③ **HMR** 基于 ESM 精确更新单模块，不重建整应用。

---

<a id="part-6"></a>

## Part 6：能否用 Vue 3 定级？如何定级？

### 结论先行

**可以，Vue 3 是前端框架里区分度很高的探针**——天然分层：会用 ref/reactive → 知道 Proxy → 懂 track/trigger → 懂 diff 与编译优化 → 能做状态/路由架构与排障 → 跟进 Vapor Mode。但概念面广，**对只会写业务的初中级要控制追问深度**，招初中级问到 Part 1/2 即可，强问源码只会考背诵。

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 会用 ref/reactive/v-if 写页面，知道用 Proxy，说不清依赖收集与响应式丢失 |
| **中级（L2）** | 2–5 年 | Part 2 | 懂 Proxy+Reflect、track/trigger、computed 缓存、watch/watchEffect |
| **中高级（L3）** | 5–8 年 | Part 3 | 讲清响应式丢失与 toRefs、diff 的 LIS 与 PatchFlag、编译、setup 生命周期 |
| **高级（L4）** | 8 年+ | Part 4 | 精通 Pinia/Router 原理，能排查内存泄漏/响应式陷阱，合理选型 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 理解 3.5 重构、Vapor Mode 定位、SSR/Vite 生态，能做框架级选型权衡 |

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"Proxy 替代 defineProperty + Composition API + PatchFlag"→ 至少 L2；只说"Vue 3 更快"→ 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追"为什么"：响应式为何丢失、toRefs 为何保住？targetMap 为何用 WeakMap、Reflect 的 receiver 解决什么？key 为何防错乱、PatchFlag 为何快？Pinia 去掉 mutations 为何仍能追踪？

**第三步：三类信号防背题。**
1. **真实性**：能否讲真实项目里的响应式踩坑、内存泄漏排查、权限路由落地。
2. **抽象能力**：能否把 ref/reactive/toRefs 统一为"**Proxy 拦截 + 依赖收集链路是否保住**"这一本质。
3. **权衡能力**：能否说清"什么场景不该用"——Options/Composition、v-if/v-show、hash/history、虚拟 DOM/Vapor。

**第四步：按最深层级定级，不按正确率。** 结合岗位难度调整追问深度。

### 面试官避坑提醒

- **不要对所有人问到源码级**——区分"理解设计"和"背过 API"，前者更有价值。
- **把"响应式丢失 + toRefs 原理"作为 L3 分水岭**：能系统讲清场景、根源与方案的人是真懂响应式。
- **Vapor Mode 不要当事实宣判**：答"已全面取代虚拟 DOM"反而是概念错误；保守准确才是 L5 视野。
- **结合岗位**：业务开发问到 Part 3 足够；基建/平台团队才需深挖 Part 4/5。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**

1. Vue 3 相比 Vue 2 改了什么？→（Proxy、Composition API、编译优化、Tree-shaking、TS）
2. 为何用 Proxy 替代 defineProperty？→（数组/动态属性/嵌套性能；懒代理）
3. reactive vs ref？→（Proxy 代理对象 / .value 包装基本类型；模板自动解包）
4. 响应式链路？→（get→track、set→trigger；WeakMap<target,Map<key,Set<effect>>>）
5. Reflect 的作用？→（receiver 保证 this 指向代理，避免依赖收集错误）
6. computed 为何缓存？→（lazy effect + dirty 标记，依赖不变不重算）
7. watch vs watchEffect？→（显式源/懒/有旧值 vs 自动/立即/无旧值；flush）
8. 响应式丢失怎么防？→（解构丢 Proxy 拦截；toRefs/toRef、响应性 props 解构）
9. diff 优化？→（双端指针 + LIS + PatchFlag + 静态提升；key 用于身份复用）
10. 模板编译？→（parse→transform→generate；template→AST→render function）
11. setup 生命周期？→（beforeCreate 前、无 this；组合式钩子先于选项式）
12. Pinia vs Vuex？→（去掉 mutations、actions 统一改 state、TS 友好）
13. 路由与守卫？→（hash vs history；beforeEach→beforeEnter→beforeRouteEnter）
14. 新趋势？→（3.5 重构、useTemplateRef、Vapor 渐进可用、Vite 快在 ESM/esbuild/HMR）

**定级速判：**
- 答到第 2–5 问 → L2
- 答到第 6–8 问 → L3
- 答到第 9–13 问 + 能讲真实踩坑 → L4
- 答到第 14 问 + 体系化选型权衡 → L5

**一票否决信号：** 认为"用了 Proxy 就不会有响应式丢失"、"ref 和 reactive 完全等价"、"computed 每次读取都重算"、"setup 里能用 this"、"Vapor Mode 已全面取代虚拟 DOM"、"history 模式刷新一定不 404" → 无论年限，最高 L2。

---

*资料整理于 2026-11-19，参考 Vue 3 官方文档（响应式 API / 渲染机制 / 模板编译 / Pinia / Vue Router）、Vue 3.5 发布说明（Reactivity System Optimizations、useTemplateRef）、Vue Vapor Mode 官方进展、Vite 官方文档及 2026 年前端面试趋势资料。涉及版本细节以官方发布为准，保守表述、不编造 API；题目与答案基于公开技术资料整理，用于面试评估参考。*
