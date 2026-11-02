---
title: Spring / Spring Boot 核心面试题（初 / 中 / 高 · 追问 · 答案）
date: 2026-11-07
summary: 面试官题库：IoC、Bean 生命周期、AOP、循环依赖、事务失效、Boot 自动配置与场景；含追问与定级。
---

面向**面试官**。组卷见 [Spring 面试官地图](/posts/spring/spring-interview-map/)。

---

## 一、IoC 与 Bean

### 1. IoC / DI（初级）

**主问：** 什么是控制反转、依赖注入？好处是什么？

**参考答案：** 对象创建与依赖关系交给容器，而不是自己 `new`。好处：解耦、易测（可替换实现）、统一生命周期管理。

**追问：** 构造器注入、Setter、字段注入差别？你推荐哪个？（构造器：强制依赖、易测、可 final）

---

### 2. Bean 作用域与生命周期（初级～中级）

**主问：** 默认作用域？生命周期关键步骤？

**参考答案：** 默认单例。常见：prototype、request、session。  
生命周期（简化）：实例化 → 填充属性 → Aware 回调 → BeanPostProcessor 前置 → 初始化（`@PostConstruct` / `InitializingBean` / init-method）→ BPP 后置（AOP 代理常在这里）→ 使用 → 销毁。

**追问：**

1. 单例 Bean 依赖原型 Bean 会有什么问题？怎么解决？  
2. `BeanFactory` 和 `ApplicationContext` 差别？

**定级：** 能串初始化顺序 → 初级偏上；能讲 BPP 与代理 → 中级。

---

### 3. 循环依赖（中级必考）

**主问：** Spring 如何解决循环依赖？什么解决不了？

**参考答案：** 单例 + **属性/Setter 注入**：三级缓存提前暴露早期引用，打断环。  
**构造器循环依赖无法解决**（创建时就要完整依赖），需重构或 `@Lazy`。原型 Bean、某些代理场景也有限制。

**追问：** 三级缓存分别存什么？为什么需要第三级（工厂）而不只是二级？

**定级：** 只说「三级缓存」说不清 → 偏背题；能讲构造器限制 → 中级。

---

## 二、AOP

### 4. AOP 原理（中级）

**主问：** Spring AOP 怎么实现？JDK 动态代理和 CGLIB？

**参考答案：** 基于代理。有接口常 JDK 动态代理；无接口或配置强制则 CGLIB 子类。切面在调用链上织入。**同类自调用不走代理 → 切面失效**（与事务同类问题）。

**追问：**

1. AspectJ 编译期织入和 Spring AOP 差别？  
2. `@Order` / 切面顺序影响事务吗？  
3. 如何强制自调用也走代理？（注入自身、AopContext，更推荐拆 Bean）

---

## 三、事务

### 5. `@Transactional` 失效场景（中级必考）

**主问：** 注解加了但不回滚，可能为什么？

**参考答案清单：**

1. 方法非 public  
2. 同类自调用未走代理  
3. 异常被 catch 吞掉  
4. 默认只回滚 RuntimeException/Error，检查异常需 `rollbackFor`  
5. 传播行为用错  
6. 数据库引擎不支持事务  
7. 未被 Spring 管理 / 错误的代理暴露  

**追问：** `REQUIRED` vs `REQUIRES_NEW` vs `NOT_SUPPORTED`？大事务有什么问题？

**定级：** 能主动列出 ≥4 条并解释自调用 → 中级扎实。

---

### 6. 事务传播与隔离（中高级）

**主问：** 嵌套调用时事务怎么走？

**参考答案：** 说清传播：加入当前、新建、挂起等。隔离级别可委托底层 DB。实践：尽量短事务、避免事务里调远程/RPC。

**追问：** 事务里发 MQ，本地回滚了消息怎么办？（最终一致、事务消息、先落库再发）

---

## 四、Spring Boot

### 7. 自动配置原理（初级～中级）

**主问：** 为什么引入 starter 就能用？

**参考答案：** 启动类 → `@SpringBootApplication` → `@EnableAutoConfiguration` → 加载 `AutoConfiguration` 列表（`spring.factories` 或 `AutoConfiguration.imports`）→ `@Conditional*` 条件装配 → 用户 Bean 可覆盖。

**追问：** 如何排除某条自动配置？如何写一个自定义 Starter？

详见 [Spring Boot 笔记](/posts/java/spring-boot-notes/)。

---

### 8. 配置加载与优先级（中级）

**主问：** `application.yml` 和环境变量谁优先？Profile 怎么用？

**参考答案：** Boot 有明确属性源优先级（命令行 > 环境变量 > profile 文件等，以官方文档版本为准）。`spring.profiles.active` 区分环境；敏感配置走环境变量/配置中心，勿提交仓库。

---

## 五、Web 与生态

### 9. Spring MVC 请求流程（初级～中级）

**主问：** 一个 HTTP 请求到 Controller 经过什么？

**参考答案：** DispatcherServlet → HandlerMapping → HandlerAdapter → Controller → 返回值处理（HttpMessageConverter / 视图）→ 异常解析器。Filter 与 Interceptor 差别：Filter 偏 Servlet 容器，Interceptor 在 Spring MVC 链。

**追问：** 全局异常怎么做？参数校验 `@Valid` 失败如何统一返回？

---

### 10. Spring Security / 资源管理（中高，按岗选问）

**主问：** 认证鉴权在你们项目怎么做？和网关如何分工？

**参考答案：** 看候选人项目：Session / JWT / OAuth2；网关验签与服务内鉴权边界；CSRF、CORS 基础。无统一标准答案，看是否有安全意识。

---

## 六、场景题

### 11. 接口偶发「事务没生效」排查（中）

**路径：** 是否自调用 → 是否同类 private → 异常类型 → 代理类型（看是不是最终类/未打开）→ 多数据源是否绑对事务管理器。

### 12. 启动慢 / 内存高（中高）

**路径：** 启动时组件扫描范围、自动配置是否过多、连接池与线程池默认值、Actuator 与堆分析；按需排除自动配置、懒加载权衡。

---

## 组卷速查

| 级别 | 题 |
| --- | --- |
| 初级 | 1、2、7 基础、9 |
| 中级 | 3、4、5、7、8、11 |
| 高级 | 6、10、12 + 项目架构深挖 |

相关：[设计模式面试](/posts/design-patterns/patterns-interview/) · [Java 面试](/posts/java/java-interview/)
