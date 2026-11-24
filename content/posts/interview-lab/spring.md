---
title: "Spring 框架面试题库（含追问链与定级指南）"
date: 2026-11-20
order: 403
summary: "IOC 与循环依赖三级缓存、AOP、事务传播行为与失效场景、MVC 流程与 Boot 自动配置。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **Spring 核心机制（IOC / AOP / 事务 / MVC / Boot）** 的真实深度"问出来"。
> 核心原则：**Spring 的每一道题，最终都会落到"Bean 的生命周期与代理"这条主线**——IOC 管对象创建与装配，AOP 在生命周期某节点"套一层代理"，事务只是 AOP 的一个经典应用。只会配 `@Transactional` 却讲不清它为何在自调用时失效的人，基本停留在 API 记忆层。
> 配套：本题库与 Java 并发 / JVM / 集合框架各套共同构成"Java 后端面试定级体系"，是框架栈的第一套。

---

## 目录

- [Part 0：30 秒标准总答](#part-0)
- [Part 1：基础认知题（IOC / DI / Bean 基础）](#part-1)
- [Part 2：底层原理题（生命周期 / 循环依赖 / AOP）](#part-2)
- [Part 3：核心区分度题（事务，定级主战场）](#part-3)
- [Part 4：实战与陷阱题（MVC / Boot / 配置）](#part-4)
- [Part 5：2026 新趋势：Spring 6 / Boot 3–4](#part-5)
- [Part 6：能否用 Spring 定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 Spring 框架的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> Spring 是一个**轻量级 Java 企业级框架**，两大核心是 **IOC（控制反转）和 AOP（面向切面）**。
>
> **IOC** 把对象的创建和依赖管理从代码"反转"给容器：以前自己 `new`，现在由容器创建 Bean 并通过 **DI（依赖注入）** 装配，从而**解耦**——面向接口、易替换、易测试。
>
> **AOP** 把日志、事务、权限等**横切关注点**从业务代码剥离，通过**代理**在方法前后统一织入，避免重复和侵入。
>
> Spring 管理对象的基本单元是 **Bean**，容器负责其完整生命周期（实例化 → 属性填充 → 初始化 → 销毁）；`@Transactional`、循环依赖、BeanPostProcessor 都在这条线上。
>
> 之上，Spring MVC 负责 Web 请求分发（核心 DispatcherServlet），**Spring Boot** 通过**自动配置 + Starter + 约定优于配置**极大简化搭建与部署。

**评分要点：** IOC/DI / AOP / Bean 生命周期 / MVC+Boot 几个点，对应入门到高级。能说出"事务基于 AOP""循环依赖三级缓存"的，直接往 Part 2/3 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题（IOC / DI / Bean 基础）

### Q1. 什么是 IOC 和 DI？有何关系？

**标准答案：**
- **IOC（控制反转）**：对象的创建、依赖查找与生命周期管理**由调用方反转给容器**。
- **DI（依赖注入）**：IOC 的典型实现，容器运行期把依赖通过构造器、setter 或字段**注入**组件。
- 关系：**IOC 是思想/目标，DI 是实现手段**。好处：解耦（面向接口）、易测试（注入 Mock）、易替换、统一生命周期管理。

**追问 1：依赖注入有哪几种方式？哪种最推荐？**
> **答案：** 构造器、setter、字段注入。**推荐构造器注入**：依赖可 final 不可变、创建即完整、且暴露循环依赖（构造器注入的循环依赖无法解决会直接报错，反而暴露设计问题）。

**追问 2：BeanFactory 和 ApplicationContext 区别？**
> **答案：** `BeanFactory` 是底层 IoC 容器，**懒加载** Bean、只提供基础获取能力；`ApplicationContext` 继承扩展它，**启动时预加载单例**，另提供事件发布、国际化、资源访问、AOP 集成。日常基本用后者。

---

### Q2. Spring Bean 有哪些作用域？singleton 线程安全吗？

**标准答案：**

| 作用域 | 说明 |
|--------|------|
| **singleton**（默认） | 容器中只有一个实例 |
| **prototype** | 每次获取/注入都新建 |
| **request / session** | 每个 HTTP 请求 / 会话一个实例（需 Web 环境） |
| **application / websocket** | 整个 Web 应用 / 每个 WebSocket 会话一个实例 |

singleton **不保证线程安全**：无状态 Bean（无可变成员）才天然安全，这是 Controller/Service 标准写法；有可变状态需改 prototype、用 ThreadLocal 或同步手段。

**追问为何 prototype Bean 注入到 singleton 里"看起来还是同一个"？**
> **答案：** prototype 只在**注入那一刻**创建一次，之后 singleton 一直持有同一引用。要每次用都拿新的，需用 `@Lookup`、ObjectFactory/Provider 惰性获取或 `getBean()`。

---

### Q3. BeanFactory vs FactoryBean、@Autowired vs @Resource？（基础辨析）

**标准答案：**
- **BeanFactory** 是 **IoC 容器本身**（管理所有 Bean 的顶层接口）；**FactoryBean** 是实现 `FactoryBean<T>` 的**特殊 Bean**，按名获取时返回其 `getObject()` 产出对象，加 `&` 前缀才拿到工厂本身——用于封装复杂对象创建（如 MyBatis 的 `SqlSessionFactoryBean`）。
- **@Autowired**（Spring 官方）默认**按类型**装配，多个再按名称，可用 `@Qualifier`/`@Primary` 消歧；**@Resource**（JDK 标准）默认**按名称**，找不到再按类型，且不支持构造器注入。

**追问 1：@Autowired 遇到多个同类型 Bean 如何选择？**
> **答案：** 先按类型找候选，再用**字段名**匹配 beanName；不唯一则用 `@Qualifier("beanName")` 或 `@Primary` 标记首选；失败抛 `NoUniqueBeanDefinitionException`。

**追问 2：为何 Spring 6 / Boot 3 更推荐构造器注入？**
> **答案：** 依赖不可变、创建即完整、暴露循环依赖；字段注入无法 final、脱离容器不可用、隐藏依赖，官方已明确不推荐。

---

<a id="part-2"></a>

## Part 2：底层原理题（生命周期 / 循环依赖 / AOP）

> 这是"会用 Spring"和"懂 Spring 内核"的分水岭，L2→L3 的关键。

### Q4. 说一下一个 Bean 的完整生命周期。

**标准答案：** （能完整讲下来基本是 L3）

1. **实例化** `createBeanInstance`：构造器/工厂方法创建"空壳"。
2. **属性填充** `populateBean`：依赖注入赋值。
3. **Aware 回调**：`BeanNameAware`/`BeanFactoryAware`/`ApplicationContextAware` 等 set 方法。
4. **BPP 前置** `postProcessBeforeInitialization`：`@PostConstruct` 在此由 `CommonAnnotationBeanPostProcessor` 触发。
5. **初始化** `invokeInitMethods`：`afterPropertiesSet()` → 自定义 init-method。
6. **BPP 后置** `postProcessAfterInitialization`：**AOP 代理在此生成**，返回可能是代理对象。
7. **使用**：放入单例池。
8. **销毁**：`@PreDestroy` → `DisposableBean.destroy()` → 自定义 destroy-method。

**追问 1：AOP 代理在哪一步生成？为何不是实例化时？**
> **答案：** 第 6 步，由 `AbstractAutoProxyCreator`（BeanPostProcessor）完成。是否代理、如何代理需完整 Bean 与类型信息，实例化时无法判断，故延迟到初始化后。

**追问 2：@PostConstruct、afterPropertiesSet、init-method 执行顺序？**
> **答案：** `@PostConstruct` → `afterPropertiesSet()` → 自定义 init-method。前者属 BPP 前置阶段，后两者在 invokeInitMethods 中依次执行。

---

### Q5. 什么是循环依赖？Spring 如何用三级缓存解决？（核心区分度题）

**标准答案：** （Spring 面试**最强区分度**问题之一）

循环依赖：A 依赖 B、B 又依赖 A。Spring 只对**单例 Bean 的 setter/字段注入**能解决。三级缓存（在 `DefaultSingletonBeanRegistry`）：
```java
singletonObjects        // 一级：完全初始化好的 Bean
earlySingletonObjects   // 二级：早期暴露（已实例化，未完成初始化）
singletonFactories      // 三级：ObjectFactory，生成早期引用（可能含 AOP 代理）
```

**流程**（A↔B）：① 实例化 A 后把 ObjectFactory 放三级 → ② A 填属性需 B，转去创建 B → ③ B 需 A，从三级取 A 的 ObjectFactory，`getObject()` 得早期引用 → ④ 放入二级、从三级移除 → ⑤ B 完成入一级 → ⑥ A 拿到 B 完成入一级，闭环打开。

**追问 1：为什么三级缓存？二级行不行？（题眼）**
> **答案：** 核心是 **AOP**。三级缓存的 `ObjectFactory.getEarlyBeanReference()` 被调用时才决定返回**原始对象还是 AOP 代理**——"**延迟生成代理**"。若只有二级：暴露原始对象会导致"注入 B 的是原始对象、容器里 A 却是代理"的**对象不一致**；实例化时就生成代理又因 Bean 未初始化、无法判断切面条件。三级缓存把代理决策推迟到真正需要时，并保证代理**只创建一次**（唯一性）。本质是"**循环依赖 + AOP 代理**"的兼容方案。

**追问 2：什么样的循环依赖解决不了？**
> **答案：** ① **构造器注入**——对象未实例化放不进三级，抛 `BeanCurrentlyInCreationException`；② **prototype**——不缓存；③ 多线程场景。解决不了往往意味着设计问题，应解耦。此外 Boot 2.6+ 将 `spring.main.allow-circular-references` 默认改为 `false`，启动即失败，倒逼从设计上消除。

---

### Q6. 什么是 AOP？通知类型有哪些？JDK 动态代理和 CGLIB 区别？

**标准答案：**
- **AOP（面向切面）**：把日志、事务、权限等**横切关注点**与业务分离，通过**代理**在方法前后织入增强，解耦复用。概念：切面、切点、通知、连接点、织入。
- 五种通知：`@Before`（前）、`@After`（**finally**）、`@AfterReturning`（正常返回后）、`@AfterThrowing`（异常后）、`@Around`（**环绕**，最强，需 `proceed()`）。

| 维度 | JDK 动态代理 | CGLIB |
|------|-------------|-------|
| 原理 | 基于**接口**（`Proxy`+`InvocationHandler`） | 基于**继承**，子类重写方法 |
| 要求 | 目标类**必须实现接口** | 无需接口，但**不能代理 final 类/方法** |
| 性能 | 调用稍慢、创建快 | 创建慢、调用快 |

**追问 1：Boot 默认用哪种代理？能强制吗？**
> **答案：** Boot 2.0+ **默认 CGLIB**（`spring.aop.proxy-target-class=true`），即使实现接口，可配回 JDK。final 类/方法无法增强——这是事务/切面在 final 方法上失效的原因。

**追问 2：多切面执行顺序如何控制？**
> **答案：** `@Order(n)` 或 `Ordered` 接口，**n 越小优先级越高**，呈"洋葱模型"（先进后出）。同一切面内：`@Around(前) → @Before → 目标 → @Around(后) → @AfterReturning/@AfterThrowing → @After`。

---

<a id="part-3"></a>

## Part 3：核心区分度题（事务，定级主战场）

> **这一部分是全题的题眼**——能否讲清事务传播、失效场景与 AOP 关系，直接决定 L2 还是 L3/L4。

### Q7. @Transactional 的传播行为和隔离级别有哪些？

**标准答案：**
7 种传播行为（解决"多个事务方法互相调用时事务如何传递"）：

| 传播行为 | 含义 |
|---------|------|
| **REQUIRED**（默认） | 有事务就加入，没有就新建 |
| **SUPPORTS** | 有则加入，没有则非事务执行 |
| **MANDATORY** | 必须在事务中，否则抛异常 |
| **REQUIRES_NEW** | **总是新建**，挂起外层，二者独立提交/回滚 |
| **NOT_SUPPORTED** | 非事务执行，挂起当前事务 |
| **NEVER** | 不能在事务中，否则抛异常 |
| **NESTED** | 嵌套于外层事务的**保存点（savepoint）**，内层回滚不影响外层 |

4 种隔离级别（解决并发读问题）：READ_UNCOMMITTED（脏读/不可重复读/幻读都可能）、READ_COMMITTED（避免脏读）、REPEATABLE_READ（MySQL 默认，避免脏读+不可重复读）、SERIALIZABLE（全避免）；Spring 默认 **DEFAULT**（用底层数据库默认级别）。

**追问 1：REQUIRES_NEW 和 NESTED 的区别？（高频）**
> **答案：** `REQUIRES_NEW` 是**全新独立事务**，内外完全隔离，内层提交即生效、外层回滚不影响它。`NESTED` 是外层的**子事务/保存点**，内层回滚只回退到保存点，但须等外层一起提交才生效——外层回滚会连带内层。

**追问 2：Spring 隔离级别和数据库的什么关系？不可重复读与幻读区别？**
> **答案：** Spring 只把配置**传递给数据库**，真正实现隔离的是数据库（锁/MVCC），它是统一抽象层。不可重复读针对**同一行被修改**（两次读值不同）；幻读针对**结果集行数变化**（同条件两次查询行数不同，由 insert/delete 引起）。InnoDB 在 REPEATABLE_READ 下靠 MVCC + 间隙锁已基本解决幻读。

---

### Q8. @Transactional 在哪些场景下会失效？（题眼，必考）

**标准答案：** （系统说出 6+ 种并解释原因，基本 L4）

1. **同类自调用**：`m1()` 调本类 `m2()`，没经代理（`this.m2()`），AOP 拦截不到。
2. **方法非 public**：默认只拦截 public，protected/private 上的注解被忽略。
3. **异常被吞掉**：`try-catch` 捕获后没再抛出，拦截器感知不到，正常提交。
4. **回滚规则不匹配**：默认只回滚 `RuntimeException`/`Error`，**受检异常不回滚**，需 `rollbackFor = Exception.class`。
5. **多线程调用**：事务资源用 ThreadLocal 与线程绑定，跨线程拿不到同一上下文。
6. **final 类/方法**：CGLIB 靠继承生成子类，final 无法继承/重写。
7. **Bean 未被 Spring 管理**：没加 `@Component`/`@Service`，没进容器就没有代理。
8. **数据库引擎不支持事务**：如 MySQL 的 MyISAM。
9. **传播行为设置不当**：如误设 `NOT_SUPPORTED`/`NEVER`。

**追问 1：自调用导致失效怎么解决？**
> **答案：** ① 拆到另一个 Bean 通过代理调用（最推荐）；② 自己注入自己（`@Autowired` 当前类）通过代理调用；③ `AopContext.currentProxy()`（需 `exposeProxy=true`，侵入强）；④ AspectJ 编译/加载期织入。

**追问 2：为什么默认不回滚受检异常？**
> **答案：** 受检异常被视为"业务预期内、可恢复"（如文件未找到），通常业务显式处理，不应默认回滚；RuntimeException 多代表程序错误，默认回滚更安全。可用 `rollbackFor` 覆盖。

---

### Q9. @Transactional 底层原理是什么？和 AOP 什么关系？

**标准答案：**
- `@Transactional` **完全基于 Spring AOP**：声明式事务通过代理在方法前后自动加开启/提交/回滚逻辑。
- 核心：`TransactionInterceptor`（`MethodInterceptor`，即环绕通知）+ `PlatformTransactionManager`（如 `DataSourceTransactionManager`）。
- 流程：① `@EnableTransactionManagement` 通过 `@Import` 注册 `AutoProxyCreator` 与 `TransactionInterceptor` → ② 解析注解生成代理 → ③ 进入 `TransactionInterceptor.invoke()`：**前置**按传播行为获取/创建事务，把 Connection 经 `TransactionSynchronizationManager`（**ThreadLocal**）绑到线程；**执行**目标方法；**后置**无异常提交、异常按规则回滚并清理资源。
- 一句话：**事务 = AOP 环绕通知 + ThreadLocal 资源绑定 + 事务管理器**。

**追问 1：为什么事务要用 ThreadLocal 绑定连接？**
> **答案：** 保证同一事务的多次 DB 操作拿到**同一个 Connection**（否则提交/回滚无从谈起），同时避免把 connection 作参数层层传递。

**追问 2：声明式 vs 编程式事务？**
> **答案：** 声明式（`@Transactional`）侵入小、常用，但只到方法级、易静默失效；编程式（`TransactionTemplate`）粒度可控到代码块、失败可精确处理，适合复杂逻辑（如循环中按条提交）。生产以声明式为主，复杂场景补充编程式。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题（MVC / Boot / 配置）

### Q10. 说一下 Spring MVC 请求处理流程和 DispatcherServlet 九大组件。

**标准答案：**
**流程**：请求 → `DispatcherServlet`（**前端控制器**）→ `HandlerMapping` 找 Handler 及拦截器链 → `HandlerAdapter` 执行 Controller 得 `ModelAndView` → 异常由 `HandlerExceptionResolver` 处理 → `ViewResolver` 解析视图 → View 渲染响应。
> 注：前后端分离下 `@ResponseBody` 走 `HttpMessageConverter` 直接返回 JSON，**不经过 ViewResolver**。

| 组件 | 职责 | 组件 | 职责 |
|------|------|------|------|
| HandlerMapping | URL→Handler 映射 | HandlerAdapter | 调用不同形式 Handler |
| HandlerExceptionResolver | 异常处理 | ViewResolver | 逻辑视图名→View |
| RequestToViewNameTranslator | 推导视图名 | LocaleResolver | 国际化 Locale |
| ThemeResolver | 主题解析 | MultipartResolver | 文件上传 |
| FlashMapManager | 重定向参数传递 | — | — |

**追问 1：DispatcherServlet 和 Tomcat 什么关系？Interceptor 和 Filter 区别？**
> **答案：** Tomcat 是 Servlet 容器负责通信与请求解析；DispatcherServlet 本身是 Servlet（`FrameworkServlet extends HttpServletBean extends HttpServlet`），是 MVC 的**入口/中枢**，Boot 中由 `ServletRegistrationBean` 自动注册、默认映射 `/`。Filter 属 Servlet 规范，在 DispatcherServlet **之前**执行、拿不到 Handler 信息；Interceptor 是 Spring MVC 的，在其**内部**（HandlerMapping 后）执行、能拿 Handler/ModelAndView。

**追问 2：九大组件里最核心的是哪两个？**
> **答案：** `HandlerMapping`（找到该用哪个 Controller 方法）和 `HandlerAdapter`（统一适配不同形式的 Handler 并调用）。HandlerAdapter 用**适配器模式**屏蔽了 Controller 的多种写法（注解式、实现 Controller 接口等），让 DispatcherServlet 无需关心细节。

---

### Q11. Spring Boot 自动配置原理是什么？（核心）

**标准答案：**
1. `@SpringBootApplication` = `@SpringBootConfiguration`（即 `@Configuration`）+ `@ComponentScan` + **`@EnableAutoConfiguration`**。
2. `@EnableAutoConfiguration` 通过 `@Import(AutoConfigurationImportSelector.class)`，读取 `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`（**Boot 2.7+ 新机制**，旧版为 `spring.factories`）中的自动配置类。
3. 这些类带 **`@Conditional` 注解**：`@ConditionalOnClass`（有某类才生效）、`@ConditionalOnMissingBean`（**容器无用户 Bean 才生效**）、`@ConditionalOnProperty`。
4. 效果：**约定优于配置**——引 Starter 就有依赖，条件满足即自动装配，少量配置即可覆盖。

**追问 1：为何用户自定义 Bean 能覆盖自动配置 Bean？spring.factories 和 imports 区别？**
> **答案：** 自动配置类普遍用 `@ConditionalOnMissingBean`，Spring 先处理用户 `@Configuration` 再处理自动配置，发现已有用户 Bean 则条件不成立而"让位"，即"用户配置优先"。`spring.factories` 是 Boot 2.7 前机制、混放多类扩展；2.7 起 `AutoConfiguration.imports` **专列自动配置类**、按行写全限定名、加载更高效，Boot 3 已移除自动配置对 spring.factories 的支持。

**追问 2：Starter 是什么？和自动配置怎么配合？**
> **答案：** Starter 是**依赖描述符（pom）**，把某功能的依赖聚合，引一个坐标即得整套依赖 + 对应自动配置（官方 `spring-boot-starter-*`，第三方 `*-spring-boot-starter`）。它只"带上依赖"，自动配置类由 jar 内 `AutoConfiguration.imports` 声明：引 Starter → 类进类路径 → `@ConditionalOnClass` 满足 → Bean 装配，实现"加依赖即开箱即用"。

---

### Q12. Spring Boot 配置优先级如何？

**标准答案：** （高→低）

① **命令行参数**（`--server.port=8081`）→ ② Java 系统属性（`-D`）→ ③ 操作系统环境变量 → ④ `application-{profile}`（jar 外 > jar 内）→ ⑤ `application.properties`（jar 外 > jar 内）→ ⑥ `@PropertySource` → ⑦ 默认属性。

高优先级覆盖低优先级，profile 专属配置高于通用配置。

**追问 1：application.properties 和 application.yml 同时存在谁生效？**
> **答案：** 同位置下 `.properties` **高于** `.yml`（都加载、同名属性 properties 覆盖），项目不要混用。

**追问 2：为什么要有这么复杂的配置优先级？**
> **答案：** 为了支持"**同一份构建产物在不同环境用外部配置覆盖**"——容器化部署时常通过命令行参数或环境变量注入配置，无需改包内文件或重新打包，这是云原生实践的基础。

---

<a id="part-5"></a>

## Part 5：2026 新趋势：Spring 6 / Boot 3–4（加分题）

> 加分题，考察技术视野；细节不确定时以保守表述为准。

### Q13. Spring Framework 6.x / Spring Boot 3.x–4.x 有哪些重要演进？

**标准答案：**
- **Java 基线提升**：Spring 6 / Boot 3 起**最低 Java 17**，全面迁移到 **Jakarta EE 9+**（`javax.*` → `jakarta.*`）——升级最大兼容性断点。
- **AOT 与 GraalVM 原生镜像**：Spring 6 内置 AOT 引擎，配合 GraalVM 编译为**原生镜像**，**毫秒级启动、极低内存**，适合 Serverless/云原生；代价是构建复杂、反射/动态代理需提前配置 hints。
- **虚拟线程支持**：Boot 3.2+（需 Java 21）提供 `spring.threads.virtual.enabled=true`，让 Tomcat、异步任务用**虚拟线程**提升 IO 密集吞吐；不解决 CPU 密集与锁竞争。
- **ProblemDetail（RFC 7807/9457）**：Spring 6 引入 `ProblemDetail` 作为 HTTP 错误响应标准格式，Boot 3.2+ 可用 `spring.mvc.problemdetails.enabled=true` 全局开启。

**追问 1：Boot 2 升 Boot 3 最容易踩的坑？**
> **答案：** 首推 **javax → jakarta 包名迁移**（Servlet、Validation、Persistence 注解全变），大量 import 需改；其次 Java 17 基线、部分属性重命名、循环依赖默认被禁。

**追问 2：谈谈对 Spring Boot 4 的了解（保守表述）。**
> **答案：** Boot 4.0 已于 **2025 年**发布，基于 Spring Framework 7.0，延续 Java 17+ 基线，在**模块化拆分、Jackson 3、可观测性**等方面持续演进。答"知道大方向但没在生产深入用过，需要时查官方文档"是诚实可接受的——**不确定的版本号/属性名不要编造**，面试官更看重学习能力和诚实度。

---

<a id="part-6"></a>

## Part 6：能否用 Spring 定级？如何定级？

### 结论先行

**可以，Spring 是 Java 后端面试里区分度极高的探针**——天然分层：会用注解 → 懂 IOC/AOP 概念 → 懂生命周期与循环依赖 → 懂事务传播/失效原理 → 能排障与架构选型。但覆盖面极广，要**聚焦核心机制（IOC/AOP/事务）深挖**，别耗在记注解和配置项上。招初级问到 Part 1 即可，强问源码只会考察背诵。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 会用 `@Autowired`/`@Component`/`@RequestMapping`，说不清 IOC/AOP 原理 |
| **中级（L2）** | 2–5 年 | Part 2 | 懂 IOC/DI、作用域、AOP 通知，但讲不清三级缓存与事务失效 |
| **中高级（L3）** | 5–8 年 | Part 3 | 能讲清生命周期、循环依赖、事务传播/隔离/原理与 AOP 关系 |
| **高级（L4）** | 8 年+ | Part 4 | 系统说全事务失效场景、懂 MVC 流程与自动配置原理，有生产排障经验 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 理解 Spring 6/Boot 3–4 演进（AOT、虚拟线程、Jakarta 迁移），能做选型与升级规划 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"IOC + AOP + Bean 生命周期 + Boot 自动配置"→ 至少 L2；只会说"Spring 是框架、能注入 Bean"→ 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追问"为什么"：为什么循环依赖要三级缓存不能二级？（AOP 代理 + 延迟决策）为什么 `@Transactional` 自调用失效？（没走代理）为什么 `@ConditionalOnMissingBean` 能让用户配置覆盖？（条件装配 + 加载顺序）

**第三步：三类信号防背题。**
1. **真实性**：能否讲出**真实生产事故与排查细节**（"事务没回滚，最后发现 catch 了异常" / "循环依赖导致启动失败，最后拆了 Service"），讲细节 > 教科书答案。
2. **抽象能力**：能否把 IOC/AOP/事务统一为"**Bean 生命周期 + 代理增强**"一条主线。
3. **权衡能力**：能否说清"什么场景不该用"——构造器注入暴露循环依赖、声明式事务边界、AOT 反射限制。

**第四步：按最深层级定级，不按正确率。** 结合岗位调整深度：业务开发问到 Part 3 足够，基础架构/平台再深入 Part 4–5。

---

### 面试官避坑提醒

- **不要对所有人问到源码级**——很多优秀中级没背 `DefaultSingletonBeanRegistry` 源码但理解思想。区分"理解设计"和"背过源码"，前者更有价值。
- **把"循环依赖三级缓存"和"事务失效场景"作为 L3/L4 分水岭**：这两个背不出来基本到不了高级。
- **Part 5 不确定细节不算分**——Boot 4 具体属性名等，考察诚实度和视野即可，不要因此压级。
- **结合岗位**：纯业务 CRUD 别强问 AOT/原生镜像；云原生/平台岗才重点考察 Part 5。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**

1. Spring 核心是什么？→（IOC + AOP；IOC 是思想、DI 是实现）
2. 注入方式？作用域？→（构造器推荐；singleton 默认、线程不安全）
3. BeanFactory vs FactoryBean？@Autowired vs @Resource？→（容器 vs 工厂 Bean；byType vs byName）
4. Bean 生命周期？→（实例化 → 属性填充 → Aware → BPP 前置 → 初始化 → BPP 后置(AOP) → 销毁）
5. 循环依赖怎么解决？→（三级缓存；singletonFactories 的 ObjectFactory 延迟生成代理）
6. 为什么三级不能二级？→（AOP 代理的对象一致性 + 代理唯一性）
7. AOP 通知与代理？→（五类通知；JDK 基于接口 / CGLIB 基于继承；Boot 默认 CGLIB）
8. 事务传播/隔离？→（7 种传播；REQUIRES_NEW vs NESTED；隔离交给数据库）
9. 事务失效场景？→（自调用/非 public/吞异常/受检异常/多线程/final/未托管…）
10. @Transactional 原理？→（AOP 环绕 + TransactionInterceptor + ThreadLocal 绑连接）
11. MVC 流程与九大组件？→（DispatcherServlet 中枢；HandlerMapping/Adapter/ViewResolver…）
12. 自动配置原理？→（@EnableAutoConfiguration + imports + @Conditional；用户配置优先）
13. Spring 6 / Boot 3–4 演进？→（Java 17 + Jakarta、AOT/原生镜像、虚拟线程、ProblemDetail）

**定级速判：**
- 答到第 2–4 问 → L2
- 答到第 5–9 问 → L3
- 答到第 10–12 问 + 有生产排障细节 → L4
- 答到第 13 问 + 体系化演进视野 → L5

**一票否决信号：** 认为"@Transactional 加在任何方法上都生效"、说不清 IOC 与 DI 关系、认为"singleton Bean 天然线程安全"、循环依赖只会说"Spring 自动解决"却讲不出三级缓存 → 无论年限，最高 L2。

---

*资料整理于 2026-11-19，参考 Spring Framework / Spring Boot 官方文档、Spring 源码（DefaultSingletonBeanRegistry / AbstractAutoProxyCreator / TransactionInterceptor）、Spring Boot 3.x/4.x 发布说明及 2026 年 Java 后端面试趋势资料。题目与答案基于公开技术资料整理，用于面试评估参考；涉及 Spring Boot 4 具体细节以官方文档为准，未确认处采用保守表述。*
