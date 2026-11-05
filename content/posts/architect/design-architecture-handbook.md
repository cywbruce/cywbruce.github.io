---
title: 设计与架构深度面试手册
date: 2026-11-05
summary: 设计模式（结合 Spring/JDK 源码）、DDD、微服务、高可用、高并发、秒杀与电商系统设计、架构演进。
interview: false
kind: handbook
---

> **定位**：面向 3-5 年+ Java 开发者，覆盖大厂（阿里/美团/字节/腾讯）高频架构面试题，深入原理与实战。

---

## 一、设计模式（结合 Spring/JDK 源码）

### 1.1 策略模式（Strategy）

#### 原理详解

策略模式的本质是**将算法族封装为独立的策略对象，通过组合而非继承实现运行时的算法切换**。其核心在于"开闭原则"——对扩展开放、对修改关闭。

JDK 中最经典的策略模式是 `Comparator`。`Collections.sort(List<T>, Comparator<? super T>)` 方法接收一个 `Comparator` 策略，`TimSort` 算法在排序过程中通过 `c.compare(a, b)` 回调策略对象，实现排序逻辑与比较逻辑的解耦。

Spring 中的 `Resource` 体系同样是策略模式：`ResourceLoader` 根据路径前缀（`classpath:`、`file:`、`http:`）返回不同的 `Resource` 实现（`ClassPathResource`、`FileSystemResource`、`UrlResource`）。核心方法 `DefaultResourceLoader.getResource(String location)` 内部通过 `if-else` 链 + `ProtocolResolver` SPI 扩展选择策略。

```java
// JDK Comparator 策略模式
List<Order> orders = getOrders();
// 策略1：按金额排序
orders.sort(Comparator.comparing(Order::getAmount));
// 策略2：按时间倒排
orders.sort(Comparator.comparing(Order::getCreateTime).reversed());

// Spring Resource 策略体系
public class DefaultResourceLoader implements ResourceLoader {
    @Override
    public Resource getResource(String location) {
        // 先尝试 ProtocolResolver（SPI 扩展点）
        for (ProtocolResolver resolver : this.protocolResolvers) {
            Resource resource = resolver.resolve(location, this);
            if (resource != null) return resource;
        }
        // 策略选择
        if (location.startsWith("/")) {
            return getResourceByPath(location);
        } else if (location.startsWith(CLASSPATH_URL_PREFIX)) {
            return new ClassPathResource(
                location.substring(CLASSPATH_URL_PREFIX.length()), getClassLoader());
        } else {
            try { return new UrlResource(location); }
            catch (MalformedURLException ex) { return getResourceByPath(location); }
        }
    }
}
```

#### 实现方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| if-else 硬编码 | 简单直接 | 违反开闭原则，每次新增策略需修改代码 | 策略数 ≤ 2 且不会扩展 |
| 策略模式 + Map 注册 | 支持运行时扩展，O(1) 查找 | 需要维护策略注册逻辑 | 策略数较多且稳定 |
| 策略模式 + SPI | 框架级扩展能力，零侵入 | 延迟加载可能有性能损耗 | 中间件/框架设计 |
| 策略模式 + 注解自动注册 | 结合 Spring 零配置 | 依赖 Spring 容器 | 业务系统中策略频繁变化 |

```java
// 生产推荐：策略模式 + Spring 自动注册
@Component
public class PayStrategyContext {
    private final Map<String, PayStrategy> strategyMap;

    // Spring 自动注入所有 PayStrategy 实现
    public PayStrategyContext(List<PayStrategy> strategies) {
        this.strategyMap = strategies.stream()
            .collect(Collectors.toMap(PayStrategy::getType, Function.identity()));
    }

    public PayResult pay(String type, PayRequest request) {
        PayStrategy strategy = strategyMap.get(type);
        if (strategy == null) throw new UnsupportedPayTypeException(type);
        return strategy.execute(request);
    }
}
```

#### 生产踩坑经验

- **坑1**：策略 Map 中 key 重复导致覆盖，上线后某个策略"消失"。**解决**：启动时检查 key 唯一性，重复立即抛异常 fail-fast。
- **坑2**：策略对象有状态，多线程下数据错乱。**解决**：策略对象应设计为无状态（Stateless），或使用 `@Scope("prototype")`。
- **坑3**：策略过多（50+），Map 维护困难。**解决**：考虑规则引擎（Drools/EasyRules）替代。

#### 面试追问点

> **Q：策略模式和工厂模式的区别？**
> A：策略模式关注"行为替换"，客户端知道有哪些策略并主动选择；工厂模式关注"对象创建"，客户端不关心创建细节。二者经常组合使用——工厂负责创建策略对象，策略模式负责执行。

> **Q：Spring 中如何优雅地扩展策略？**
> A：利用 `@Autowired List<Strategy>` 自动收集所有实现，配合 `@Order` 控制优先级。更高级可以使用 `@Conditional` 条件装配实现环境差异化策略。

---

### 1.2 责任链模式（Chain of Responsibility）

#### 原理详解

责任链模式的核心思想是**将请求沿着处理者链条传递，每个处理者可以选择处理、拦截或传递给下一个处理者**。它解决的核心问题是"请求发送者与处理者之间的解耦"。

**Servlet Filter 链**：`ApplicationFilterChain` 内部维护一个 `ApplicationFilterConfig[]` 数组和当前位置指针 `pos`。调用 `doFilter()` 时，`pos++` 取出下一个 Filter，执行其 `doFilter(request, response, chain)` 方法。Filter 内部决定是否调用 `chain.doFilter()` 将请求传递下去。这是一种**双向拦截模式**——Filter 可以在请求前后分别处理。

```java
// Servlet FilterChain 核心逻辑（简化）
public final class ApplicationFilterChain implements FilterChain {
    private ApplicationFilterConfig[] filters = new ApplicationFilterConfig[0];
    private int pos = 0;  // 当前执行位置
    private int n = 0;    // filter 总数
    private Servlet servlet;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response) {
        if (pos < n) {
            ApplicationFilterConfig filterConfig = filters[pos++];
            Filter filter = filterConfig.getFilter();
            // 把 chain 自身传进去，filter 内部决定是否继续
            filter.doFilter(request, response, this);
        } else {
            // 所有 filter 执行完毕，调用 Servlet
            servlet.service(request, response);
        }
    }
}
```

**Sentinel Slot 链**：Sentinel 的限流/熔断/统计是通过 `ProcessorSlotChain` 实现的。每个 `ProcessorSlot`（如 `FlowSlot`、`DegradeSlot`、`StatisticSlot`）通过 `fireEntry()` 调用下一个 Slot。如果某个 Slot 判定不通过，直接抛出 `BlockException` 中断链条。

**Netty Pipeline**：`ChannelPipeline` 是一个双向链表结构，内部节点是 `AbstractChannelHandlerContext`。Inbound 事件从 Head 到 Tail 传播，Outbound 事件从 Tail 到 Head 传播。`ctx.fireChannelRead(msg)` 会找到下一个 Inbound Handler 执行。

#### 实现方案对比

| 实现方式 | 代表框架 | 链的组织方式 | 双向支持 | 特点 |
|----------|----------|-------------|----------|------|
| 数组 + 指针 | Servlet Filter | 数组索引 | ✅ | 简单高效，不支持动态增删 |
| 链表 | Netty Pipeline | 双向链表 | ✅ | 支持动态增删 Handler |
| 递归调用 | OkHttp Interceptor | List + index | ✅ | 函数调用栈即链条 |
| 事件驱动 | Sentinel Slot | 单链表 | ❌ | 异常中断链条 |

#### 生产踩坑经验

- **坑1**：Filter 中忘记调用 `chain.doFilter()`，导致请求"吞掉"，后续逻辑不执行。
- **坑2**：责任链节点有状态（如统计计数器），多线程需要注意线程安全。
- **坑3**：链过长导致调用栈过深。**解决**：控制链长度在 20 以内，超过考虑合并节点或异步化。

#### 面试追问点

> **Q：Netty 的 Pipeline 和 Servlet Filter 链有什么本质区别？**
> A：(1) Netty Pipeline 是双向链表支持动态增删，Filter 链是数组固定长度；(2) Netty 区分 Inbound/Outbound 两个方向，Filter 链是请求→响应单向穿越；(3) Netty Handler 可以关联 EventLoop 实现异步执行，Filter 是同步阻塞模型。

> **Q：如何保证责任链的执行顺序？**
> A：Servlet 通过 `web.xml` 或 `@WebFilter` + `@Order` 定义顺序；Netty 通过 `addFirst`/`addLast`/`addBefore`/`addAfter` 精确控制；Spring Interceptor 通过 `InterceptorRegistry.addInterceptor().order()` 指定。

---

### 1.3 观察者模式（Observer）— Spring ApplicationEvent

#### 原理详解

观察者模式定义了**一对多的依赖关系**：当"被观察者"（Subject）状态改变时，所有"观察者"（Observer）自动收到通知。它是"发布-订阅"思想的面向对象实现。

Spring 的事件机制是观察者模式的典型实现。核心角色：
- `ApplicationEvent`：事件对象（被观察的状态变化）
- `ApplicationListener<E>`：观察者接口
- `ApplicationEventMulticaster`：事件广播器（中介），默认实现 `SimpleApplicationEventMulticaster`

事件发布时，`AbstractApplicationContext.publishEvent()` 委托给 `ApplicationEventMulticaster.multicastEvent()`，它遍历所有匹配的 `Listener` 并调用 `onApplicationEvent()`。

```java
// Spring 事件机制核心源码（简化）
public class SimpleApplicationEventMulticaster
        extends AbstractApplicationEventMulticaster {
    @Override
    public void multicastEvent(ApplicationEvent event, ResolvableType eventType) {
        ResolvableType type = (eventType != null
            ? eventType : resolveDefaultEventType(event));
        Executor executor = getTaskExecutor(); // 如果设置了线程池，就异步执行
        for (ApplicationListener<?> listener
                : getApplicationListeners(event, type)) {
            if (executor != null) {
                executor.execute(() -> invokeListener(listener, event));
            } else {
                invokeListener(listener, event); // 默认同步执行
            }
        }
    }
}

// 业务使用示例
@Component
public class OrderCreatedListener
        implements ApplicationListener<OrderCreatedEvent> {
    @Override
    public void onApplicationEvent(OrderCreatedEvent event) {
        // 发送短信通知、扣减库存、记录日志...
    }
}

// 也可以使用 @EventListener 注解，更简洁
@Component
public class OrderEventHandler {
    @EventListener
    @Async  // 异步执行
    public void handleOrderCreated(OrderCreatedEvent event) {
        // 处理逻辑
    }
}
```

#### 生产踩坑经验

- **坑1**：默认同步执行，某个 Listener 抛异常会导致后续 Listener 不执行，甚至影响主流程。**解决**：为 `Multicaster` 配置 `TaskExecutor` 实现异步，或在 Listener 内 try-catch。
- **坑2**：`@TransactionalEventListener` 与事务的关系——默认在事务提交后触发（`AFTER_COMMIT`），如果事务回滚，Listener 不会执行。需要在事务内处理的逻辑不能用这个注解。
- **坑3**：Spring 事件是进程内的，跨服务需用 MQ 替代。误用 Spring Event 做跨服务通信会导致事件丢失。

#### 面试追问点

> **Q：Spring 事件是同步还是异步的？如何改成异步？**
> A：默认同步。两种方式改异步：(1) 在 Listener 上加 `@Async` 注解（前提是启用了 `@EnableAsync`）；(2) 给 `SimpleApplicationEventMulticaster` 设置 `TaskExecutor`。方式 1 更灵活，可以逐个 Listener 控制。

> **Q：观察者模式和发布-订阅模式有什么区别？**
> A：观察者模式中，Subject 直接持有 Observer 引用，二者耦合；发布-订阅模式引入了"消息中间件/事件总线"作为中介，Publisher 和 Subscriber 完全解耦。Spring Event 介于两者之间——有 `Multicaster` 作中介，但仍在同一进程内。

---

### 1.4 模板方法模式（Template Method）

#### 原理详解

模板方法模式定义了一个**算法骨架**（在父类中），将某些步骤的具体实现**延迟到子类**。它体现了"好莱坞原则"——Don't call us, we'll call you。

Spring 中最经典的模板方法是 `AbstractApplicationContext.refresh()`，它定义了 IoC 容器的启动流程：

```java
// AbstractApplicationContext.refresh() — 容器启动的模板方法
@Override
public void refresh() throws BeansException, IllegalStateException {
    synchronized (this.startupShutdownMonitor) {
        prepareRefresh();                          // 1. 准备刷新
        ConfigurableListableBeanFactory beanFactory
            = obtainFreshBeanFactory();            // 2. 获取BeanFactory
        prepareBeanFactory(beanFactory);           // 3. BeanFactory预处理
        try {
            postProcessBeanFactory(beanFactory);   // 4. ★ 子类扩展点（钩子方法）
            invokeBeanFactoryPostProcessors(beanFactory); // 5. 执行后处理器
            registerBeanPostProcessors(beanFactory);      // 6. 注册Bean后处理器
            initMessageSource();                   // 7. 初始化MessageSource
            initApplicationEventMulticaster();     // 8. 初始化事件广播器
            onRefresh();                           // 9. ★ 子类扩展点（如创建Web容器）
            registerListeners();                   // 10. 注册监听器
            finishBeanFactoryInitialization(beanFactory); // 11. 初始化非延迟单例
            finishRefresh();                       // 12. 发布完成事件
        } catch (BeansException ex) {
            destroyBeans();
            cancelRefresh(ex);
            throw ex;
        }
    }
}
```

其中 `postProcessBeanFactory()` 和 `onRefresh()` 是空的钩子方法（Hook），子类如 `ServletWebServerApplicationContext` 覆盖 `onRefresh()` 来创建嵌入式 Tomcat 容器。

`JdbcTemplate` 也是模板方法的经典应用——它封装了获取连接、创建 Statement、处理异常、释放资源的通用流程，将 SQL 执行逻辑通过回调接口（`PreparedStatementCallback`、`RowMapper`）交给调用者：

```java
// JdbcTemplate 模板方法 — 通过回调接口变化具体步骤
public <T> T execute(PreparedStatementCreator psc,
                     PreparedStatementCallback<T> action) {
    Connection con = DataSourceUtils.getConnection(obtainDataSource());
    PreparedStatement ps = null;
    try {
        ps = psc.createPreparedStatement(con);
        T result = action.doInPreparedStatement(ps); // ★ 回调，具体逻辑由调用者实现
        handleWarnings(ps);
        return result;
    } catch (SQLException ex) {
        throw translateException("PreparedStatement", getSql(psc), ex);
    } finally {
        JdbcUtils.closeStatement(ps);
        DataSourceUtils.releaseConnection(con, obtainDataSource());
    }
}
```

#### 面试追问点

> **Q：模板方法和策略模式的区别？**
> A：模板方法通过**继承**实现变化（子类覆盖方法），策略模式通过**组合**实现变化（注入不同策略对象）。模板方法中父类控制流程、子类实现步骤；策略模式中客户端选择策略。设计原则上，优先使用组合（策略模式），继承的耦合更紧。

> **Q：JdbcTemplate 用的是模板方法还是回调？**
> A：准确说是"模板方法 + 回调（Callback）"的组合。`execute()` 方法定义了连接获取→执行→异常处理→释放连接的骨架，但变化的部分不是通过子类覆盖，而是通过回调接口（`RowMapper`、`PreparedStatementCallback`）注入，这比纯粹的模板方法更灵活。

---

### 1.5 代理模式（Proxy）— Spring AOP

#### 原理详解

Spring AOP 的核心在于**动态代理**，分为两种实现：

1. **JDK 动态代理**：基于接口。`java.lang.reflect.Proxy.newProxyInstance()` 在运行时动态生成实现目标接口的代理类 `$Proxy0`。所有方法调用转发到 `InvocationHandler.invoke()`。底层通过 `ProxyGenerator.generateProxyClass()` 生成字节码。
2. **CGLIB 代理**：基于继承。使用 ASM 库在运行时生成目标类的子类，覆盖非 final 方法。方法拦截通过 `MethodInterceptor.intercept()` 实现。

Spring AOP 的选择策略在 `DefaultAopProxyFactory` 中：

```java
// DefaultAopProxyFactory 的选择逻辑
public class DefaultAopProxyFactory implements AopProxyFactory {
    @Override
    public AopProxy createAopProxy(AdvisedSupport config) {
        if (config.isOptimize() || config.isProxyTargetClass()
                || hasNoUserSuppliedProxyInterfaces(config)) {
            Class<?> targetClass = config.getTargetClass();
            if (targetClass.isInterface() || Proxy.isProxyClass(targetClass)) {
                return new JdkDynamicAopProxy(config);
            }
            return new ObjenesisCglibAopProxy(config); // CGLIB
        } else {
            return new JdkDynamicAopProxy(config);
        }
    }
}
```

选择逻辑：目标类实现了接口 → 默认使用 JDK 代理；目标类未实现接口 → 使用 CGLIB；配置 `proxyTargetClass=true` → 强制使用 CGLIB。

#### 实现方案对比

| 特性 | JDK 动态代理 | CGLIB 代理 |
|------|-------------|-----------|
| 实现方式 | 基于接口 | 基于继承（生成子类） |
| 要求 | 目标类必须实现接口 | 目标类不能是 final |
| 性能（创建） | 较快 | 较慢（生成字节码） |
| 性能（调用） | 反射调用，JDK 8+ 优化后接近 | FastClass 机制，直接调用 |
| Spring Boot 默认 | 1.x 默认 | 2.x 起默认 CGLIB |

#### 生产踩坑经验

- **坑1（经典）**：同一个类内部方法调用（`this.methodB()`）不会触发 AOP 代理。因为 `this` 是原始对象，不是代理对象。**解决**：注入自身（`@Lazy private XxxService self;`）或使用 `AopContext.currentProxy()`。
- **坑2**：`@Transactional` 标注在 private 方法上无效——CGLIB 生成子类无法覆盖 private 方法。
- **坑3**：CGLIB 代理的类不能使用 `final` 修饰，否则启动时报错。

#### 面试追问点

> **Q：为什么 Spring Boot 2.x 默认使用 CGLIB 而不是 JDK 代理？**
> A：因为 JDK 代理要求必须有接口，在实际业务开发中很多 Service 类并没有接口。为了减少使用门槛和 `ClassCastException` 问题（把代理对象强转为具体类时），Spring Boot 2.x 起将 `spring.aop.proxy-target-class` 默认设为 `true`。

> **Q：Spring AOP 和 AspectJ 有什么区别？**
> A：Spring AOP 是运行时代理，只支持方法级别的切面，通过动态代理实现。AspectJ 是编译时/类加载时织入，支持字段级别、构造器级别等更细粒度的切面。AspectJ 功能更强但配置更复杂。Spring AOP 的 `@Aspect` 注解是借用了 AspectJ 的注解语法，但底层实现完全不同。

---

### 1.6 工厂模式（Factory）

#### 原理详解

Spring 的 `BeanFactory` 是工厂模式的巅峰实现。`DefaultListableBeanFactory` 是最核心的实现类，它维护一个 `Map<String, BeanDefinition> beanDefinitionMap` 存储 Bean 定义，通过 `getBean(String name)` → `doGetBean()` → `createBean()` → `doCreateBean()` 完成 Bean 的创建。

`LoggerFactory`（SLF4J）是**静态工厂方法**模式：`LoggerFactory.getLogger(Class<?>)` 内部通过 `ILoggerFactory`（策略模式）获取实际的日志实现（Logback 的 `LoggerContext`、Log4j2 的 `Log4jLoggerFactory`）。查找过程通过 SPI（`StaticLoggerBinder`）实现。

```java
// SLF4J LoggerFactory — 静态工厂方法
public static Logger getLogger(Class<?> clazz) {
    return getLogger(clazz.getName());
}
public static Logger getLogger(String name) {
    ILoggerFactory iLoggerFactory = getILoggerFactory(); // SPI 查找具体实现
    return iLoggerFactory.getLogger(name);
}
```

#### 面试追问点

> **Q：简单工厂、工厂方法、抽象工厂的区别？**
> A：**简单工厂**：一个工厂类 + 条件判断创建对象，违反开闭原则；**工厂方法**：每个产品对应一个工厂类，符合开闭原则，如 `Collection.iterator()` 每个集合返回自己的迭代器；**抽象工厂**：一个工厂创建一组相关产品（产品族），如数据库连接工厂同时创建 `Connection`、`Statement`、`PreparedStatement` 等。

> **Q：BeanFactory 和 FactoryBean 的区别？**
> A：`BeanFactory` 是 IoC 容器的根接口，负责管理所有 Bean。`FactoryBean<T>` 是一个特殊的 Bean——容器中存储的是 FactoryBean 实例，但 `getBean("xxx")` 返回的是它 `getObject()` 方法创建的对象。要获取 FactoryBean 本身需要 `getBean("&xxx")`。MyBatis 的 `MapperFactoryBean` 就是典型用例。

---

### 1.7 单例模式

#### 原理详解

单例模式的核心挑战是**线程安全**和**延迟加载**的平衡。

```java
// ❌ 经典DCL（双重检查锁定）— 必须加 volatile
public class Singleton {
    private static volatile Singleton INSTANCE; // volatile 防止指令重排
    private Singleton() {}

    public static Singleton getInstance() {
        if (INSTANCE == null) {                // 第一次检查（无锁）
            synchronized (Singleton.class) {    // 加锁
                if (INSTANCE == null) {          // 第二次检查
                    INSTANCE = new Singleton();
                    // ★ 非原子操作：分配内存 → 初始化 → 赋值引用
                }
            }
        }
        return INSTANCE;
    }
}

// ✅ 静态内部类（推荐）— 利用类加载机制保证线程安全 + 延迟加载
public class Singleton {
    private Singleton() {}
    private static class Holder {
        // 类加载时初始化，JVM 保证线程安全
        static final Singleton INSTANCE = new Singleton();
    }
    public static Singleton getInstance() {
        return Holder.INSTANCE; // 首次调用时才加载 Holder 类
    }
}

// ✅ 枚举（最安全）— 天然防反射、防序列化
public enum Singleton {
    INSTANCE;
    public void doSomething() { /* ... */ }
}
```

**为什么 DCL 需要 volatile？** `INSTANCE = new Singleton()` 在字节码层面分三步：(1) 分配内存空间 (2) 调用构造函数初始化 (3) 将引用赋值给 INSTANCE。JIT 可能将 (2)(3) 重排序，导致另一个线程看到非 null 但未初始化的对象。`volatile` 通过内存屏障（StoreStore + StoreLoad）禁止这种重排序。

#### 实现方案对比

| 方案 | 线程安全 | 延迟加载 | 防反射 | 防序列化 | 推荐度 |
|------|----------|----------|--------|----------|--------|
| 饿汉式 | ✅ | ❌ | ❌ | ❌ | ★★★ |
| DCL | ✅ | ✅ | ❌ | ❌ | ★★★ |
| 静态内部类 | ✅ | ✅ | ❌ | ❌ | ★★★★ |
| 枚举 | ✅ | ❌ | ✅ | ✅ | ★★★★★ |

#### 面试追问点

> **Q：Spring 的单例 Bean 和设计模式的单例有什么区别？**
> A：Spring 单例是"容器级单例"，即每个 `ApplicationContext` 中只有一个实例（存储在 `DefaultSingletonBeanRegistry` 的 `singletonObjects` ConcurrentHashMap 中）。设计模式单例是"类级单例"，整个 JVM 只有一个。Spring 单例依赖容器管理而非类本身的限制，同一个类在不同容器中可以有多个实例。

---

### 1.8 装饰器模式（Decorator）

#### 原理详解

装饰器模式通过**包装（Wrapping）**的方式给对象动态增加功能，避免了继承的"类爆炸"问题。

JDK 的 `InputStream` 体系是教科书级的装饰器：`FileInputStream`（被装饰者）→ `BufferedInputStream`（装饰器，增加缓冲功能）→ `DataInputStream`（装饰器，增加数据类型读取）。所有装饰器都继承自 `FilterInputStream`，持有一个 `InputStream in` 成员。

```java
// InputStream 装饰器链
InputStream is = new DataInputStream(           // 装饰器3：支持 readInt()
                    new BufferedInputStream(     // 装饰器2：增加 8KB 缓冲
                        new FileInputStream("data.bin"))); // 原始流

// MyBatis Cache 装饰器链
Cache cache = new LoggingCache(                  // 装饰器：日志记录
                new LruCache(                    // 装饰器：LRU 淘汰
                    new SynchronizedCache(       // 装饰器：线程安全
                        new PerpetualCache("default")))); // 基础 HashMap 缓存
```

MyBatis 的二级缓存使用装饰器链：`PerpetualCache`（基础缓存，内部是 HashMap）→ `LruCache`（LRU 淘汰）→ `SerializedCache`（序列化）→ `LoggingCache`（命中率统计）→ `SynchronizedCache`（线程安全）。这些装饰器都实现 `Cache` 接口并持有一个 `Cache delegate`。

#### 面试追问点

> **Q：装饰器模式和代理模式的区别？**
> A：从代码结构上看几乎相同——都持有目标对象的引用。区别在于**意图**：装饰器模式侧重"增强功能"（动态叠加多个装饰器），代理模式侧重"控制访问"（权限检查、延迟加载、远程调用等）。装饰器通常可以嵌套多层，代理通常只有一层。

---

### 1.9 适配器模式（Adapter）— HandlerAdapter

#### 原理详解

Spring MVC 的 `HandlerAdapter` 是适配器模式的典型应用。`DispatcherServlet` 收到请求后，通过 `HandlerMapping` 找到 Handler（可能是 `@Controller` 方法、`HttpRequestHandler`、`Servlet` 等不同类型），然后需要一个统一的方式来调用这些不同类型的 Handler。`HandlerAdapter` 就是这个"翻译器"。

```java
// DispatcherServlet 中使用适配器
protected void doDispatch(HttpServletRequest request,
                          HttpServletResponse response) {
    HandlerExecutionChain mappedHandler = getHandler(request);
    // 找到匹配的适配器
    HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());
    // 统一调用接口
    ModelAndView mv = ha.handle(request, response,
                                mappedHandler.getHandler());
}

// HandlerAdapter 接口
public interface HandlerAdapter {
    boolean supports(Object handler);  // 是否支持该类型 Handler
    ModelAndView handle(HttpServletRequest req,
                        HttpServletResponse resp, Object handler);
}
```

常见的适配器实现：
- `RequestMappingHandlerAdapter`：适配 `@RequestMapping` 注解方法
- `HttpRequestHandlerAdapter`：适配 `HttpRequestHandler` 接口
- `SimpleControllerHandlerAdapter`：适配 `Controller` 接口

#### 面试追问点

> **Q：适配器模式和策略模式有什么区别？**
> A：适配器模式的目的是"接口转换"——让不兼容的接口协同工作；策略模式的目的是"行为替换"——在运行时选择不同的算法。`HandlerAdapter` 的 `supports()` 方法就是在判断"我能不能适配这个 Handler"。

---

## 二、DDD 领域驱动设计

### 2.1 战略设计

#### 原理详解

DDD 战略设计解决的核心问题是**业务复杂度管理**——如何在一个大系统中划分清晰的业务边界。

**限界上下文（Bounded Context）**：是 DDD 最重要的概念。同一个"词汇"在不同上下文中含义不同——"商品"在商品上下文中是 SKU/SPU 的管理对象，在订单上下文中只是一个快照（品名+价格+数量），在物流上下文中是一个包裹项（重量+体积）。限界上下文就是这个"词汇含义一致"的边界。

**上下文映射（Context Mapping）**：限界上下文之间的关系模式：

| 关系模式 | 说明 | 典型案例 |
|----------|------|----------|
| 共享内核（Shared Kernel） | 两个上下文共享部分模型 | 订单与支付共享"金额"模型 |
| 客户-供应商（Customer-Supplier） | 上游提供服务，下游消费 | 商品（供应商）→ 搜索（客户） |
| 防腐层（Anti-Corruption Layer） | 下游通过翻译层隔离上游变化 | 对接第三方支付 SDK |
| 开放主机服务（Open Host Service） | 上游提供标准化 API | 用户中心提供 OpenAPI |
| 发布语言（Published Language） | 上下文之间约定的数据格式 | Protobuf / JSON Schema |
| 各行其道（Separate Ways） | 无依赖关系 | 营销系统与物流系统 |

**统一语言（Ubiquitous Language）**：团队（开发+产品+业务）在同一限界上下文中使用一致的术语。代码中的类名、方法名应直接映射业务概念，避免出现 `XxxUtils`、`XxxHelper` 等无业务含义的命名。

---

### 2.2 战术设计

#### 聚合根（Aggregate Root）

聚合是**一组紧密关联的实体和值对象的集合**，聚合根是外部访问聚合内部对象的唯一入口。聚合根保证事务一致性边界——一个事务只修改一个聚合。

```java
// 订单聚合根
public class Order {
    private OrderId orderId;             // 实体标识
    private UserId userId;
    private List<OrderItem> items;       // 聚合内部实体
    private Money totalAmount;           // 值对象
    private OrderStatus status;
    private List<DomainEvent> events = new ArrayList<>();

    // ★ 业务行为封装在聚合根中，而不是 Service（贫血模型的反模式）
    public void addItem(ProductId productId, int quantity, Money price) {
        // 业务规则：最多 50 个商品项
        if (items.size() >= 50) {
            throw new OrderItemLimitExceededException();
        }
        items.add(new OrderItem(productId, quantity, price));
        recalculateTotalAmount();
    }

    public void cancel() {
        // 业务规则：只有待支付状态可取消
        if (status != OrderStatus.PENDING_PAYMENT) {
            throw new IllegalOrderStateException(
                "Cannot cancel order in " + status);
        }
        this.status = OrderStatus.CANCELLED;
        // 发布领域事件
        events.add(new OrderCancelledEvent(this.orderId));
    }

    private void recalculateTotalAmount() {
        this.totalAmount = items.stream()
            .map(OrderItem::getSubtotal)
            .reduce(Money.ZERO, Money::add);
    }
}
```

#### 实体（Entity）vs 值对象（Value Object）

| 特性 | 实体（Entity） | 值对象（Value Object） |
|------|---------------|----------------------|
| 标识 | 有唯一标识（ID），通过 ID 判等 | 无标识，通过所有属性值判等 |
| 可变性 | 可变（有生命周期） | 不可变（Immutable） |
| 示例 | Order、User、Product | Money、Address、DateRange |
| equals/hashCode | 基于 ID | 基于所有属性 |
| 持久化 | 独立表 | 嵌入所属实体的表中 |

```java
// 值对象 — 不可变
public final class Money {
    private final BigDecimal amount;
    private final Currency currency;
    public static final Money ZERO = new Money(BigDecimal.ZERO, Currency.CNY);

    public Money(BigDecimal amount, Currency currency) {
        this.amount = amount;
        this.currency = currency;
    }

    public Money add(Money other) {
        if (!this.currency.equals(other.currency)) {
            throw new CurrencyMismatchException();
        }
        return new Money(this.amount.add(other.amount), this.currency);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money)) return false;
        Money money = (Money) o;
        return amount.compareTo(money.amount) == 0
            && currency.equals(money.currency);
    }

    @Override
    public int hashCode() {
        return Objects.hash(amount.stripTrailingZeros(), currency);
    }
}
```

#### 领域事件（Domain Event）

领域事件是聚合状态变化后发出的通知，用于聚合间的解耦通信。命名规则：**过去式动词**，如 `OrderCreatedEvent`、`PaymentCompletedEvent`。

事件的发布时机：聚合根内部注册事件 → Repository 保存聚合时发布事件。Spring Data 的 `@DomainEvents` 注解可以自动收集并发布聚合中的领域事件。

#### Repository

Repository 是聚合的持久化抽象，只为聚合根定义。它不是 DAO——DAO 面向数据表，Repository 面向领域模型。

```java
// Repository 接口 — 面向领域
public interface OrderRepository {
    Order findById(OrderId id);
    void save(Order order);  // 保存整个聚合（包括内部实体）
    void remove(Order order);
    // ❌ 不应该有 findByUserId()
    // — 这是查询需求，用 CQRS 的 Query 端处理
}
```

---

### 2.3 CQRS（命令查询职责分离）

#### 原理详解

CQRS 将系统分为**命令端（写）**和**查询端（读）**，二者使用不同的模型、甚至不同的数据库。

```
┌─────────┐  Command  ┌────────────────┐  Event  ┌────────────────┐
│  Client  │─────────→ │  Command Side  │────────→│  Query Side    │
│          │←─────────│ (Domain Model) │         │ (Read Model)   │
└─────────┘  Query    └────────────────┘         └────────────────┘
                           │ Write DB                │ Read DB
                           ▼ (MySQL)                 ▼ (ES/Redis)
```

- **写端**：使用聚合根、领域事件，保证业务一致性，存储用关系数据库。
- **读端**：使用宽表/ES/Redis，针对查询场景优化，不需要遵循领域模型。通过订阅领域事件同步数据。

#### 生产踩坑经验

- **坑1**：CQRS 引入最终一致性，读端数据可能延迟。**解决**：关键场景（如下单后查订单）做"读己之写"——写入后将结果缓存到 Redis，短时间内读缓存而非读端数据库。
- **坑2**：事件丢失导致读端数据与写端不一致。**解决**：用事务性发件箱（Transactional Outbox）模式——将事件与业务数据在同一个本地事务中写入 Outbox 表，再通过 CDC（如 Debezium 监听 binlog）异步发送到 MQ。
- **坑3**：不是所有系统都需要 CQRS。简单 CRUD 系统引入 CQRS 是过度设计。

### 2.4 事件溯源（Event Sourcing）

事件溯源不存储当前状态，而是**存储所有状态变化的事件序列**。当前状态通过"重播"事件来重建。

```java
// 事件溯源 — 订单状态通过事件重建
public class Order {
    private OrderId id;
    private OrderStatus status;
    private List<DomainEvent> changes = new ArrayList<>();

    // 从事件流恢复状态
    public static Order reconstitute(List<DomainEvent> events) {
        Order order = new Order();
        for (DomainEvent event : events) {
            order.apply(event); // 依次应用每个事件
        }
        return order;
    }

    private void apply(DomainEvent event) {
        if (event instanceof OrderCreatedEvent e) {
            this.id = e.getOrderId();
            this.status = OrderStatus.CREATED;
        } else if (event instanceof OrderPaidEvent) {
            this.status = OrderStatus.PAID;
        }
        // ... 其他事件处理
    }
}
```

**优势**：完整的审计日志、支持时间旅行（回到任意时刻的状态）、天然支持 CQRS。
**代价**：事件数量膨胀需要快照（Snapshot）机制、最终一致性、查询复杂。

---

### 2.5 六边形架构 / 洋葱架构 / 整洁架构

这三种架构的共同理念是**依赖倒置——内层不依赖外层，外层通过接口适配内层**。

```
┌───────────────────────────────────────────────┐
│              Infrastructure                   │  ← DB、MQ、HTTP Client、框架
│  ┌───────────────────────────────────────┐    │
│  │          Application                  │    │  ← 用例编排、事务管理、DTO 转换
│  │  ┌───────────────────────────────┐    │    │
│  │  │       Domain                  │    │    │  ← 聚合根、实体、值对象、领域服务
│  │  └───────────────────────────────┘    │    │
│  └───────────────────────────────────────┘    │
└───────────────────────────────────────────────┘
```

**关键规则**：Domain 层不依赖任何外部技术（不引入 Spring/MyBatis 注解），Repository 接口定义在 Domain 层，实现在 Infrastructure 层。

#### 面试追问点

> **Q：DDD 落地最大的难点是什么？**
> A：(1) **聚合边界划分**——划大了影响并发（整个聚合是事务一致性边界），划小了丢失业务完整性。经验法则：聚合尽量小，跨聚合用领域事件保持最终一致。(2) **团队共识**——统一语言需要产品和开发共同建模，组织成本高。(3) **过度设计**——简单 CRUD 场景不需要 DDD，强行引入只会增加代码量。判断标准：如果业务逻辑可以用"CRUD + 几个 if-else"搞定，就不要用 DDD。

> **Q：聚合根之间如何通信？**
> A：通过领域事件（进程内用 Spring Event，跨服务用 MQ）。不能直接引用另一个聚合根对象，只能持有其 ID。跨聚合的操作通过应用层服务（Application Service）编排。

---

## 三、微服务架构

### 3.1 服务拆分原则

| 原则 | 说明 | 反例 |
|------|------|------|
| 单一职责 | 一个服务只负责一个业务域 | 一个服务同时管订单+支付+物流 |
| 高内聚低耦合 | 频繁变化的放一起，不相关的分开 | 改 A 功能必须同时部署 B 服务 |
| 业务能力导向 | 按业务域拆分，而不是按技术层 | 按 Controller/Service/DAO 拆成三个服务 |
| 数据自治 | 每个服务拥有自己的数据库 | 多服务共用一张表 |
| 演进式拆分 | 先粗后细，避免过度拆分 | Day 1 就拆 100 个微服务 |

**拆分粒度判断法则**：如果一个需求 80% 的改动都在一个服务内完成，说明粒度合适。如果每次改动都涉及 3 个以上的服务联调，说明拆分过细或边界不合理。

---

### 3.2 服务编排 vs 服务协作（Orchestration vs Choreography）

| 特性 | 编排（Orchestration） | 协作（Choreography） |
|------|---------------------|---------------------|
| 中心化 | 有中心编排器 | 无中心，事件驱动 |
| 耦合度 | 编排器知道所有参与者 | 各服务只关心自己的事件 |
| 可观测性 | 流程清晰，容易监控 | 流程分散，需链路追踪 |
| 适用场景 | 流程明确、步骤固定 | 流程灵活、参与者易变 |
| 典型实现 | Saga 编排器、Camunda | Spring Event、MQ 事件驱动 |
| 失败处理 | 编排器集中处理补偿 | 各服务各自处理（复杂） |

```java
// Saga 编排示例
public class CreateOrderSaga {
    public void execute(CreateOrderCommand cmd) {
        try {
            OrderId orderId = orderService.createOrder(cmd);     // Step 1
            paymentService.reservePayment(orderId, cmd.amount);  // Step 2
            inventoryService.reserveStock(orderId, cmd.items);   // Step 3
        } catch (PaymentFailedException e) {
            orderService.cancelOrder(orderId);                   // 补偿 Step 1
        } catch (StockInsufficientException e) {
            paymentService.cancelPayment(orderId);               // 补偿 Step 2
            orderService.cancelOrder(orderId);                   // 补偿 Step 1
        }
    }
}

// Choreography 协作示例（事件驱动）
// OrderService: 创建订单 → 发布 OrderCreatedEvent
// PaymentService: 监听 OrderCreatedEvent → 冻结金额 → 发布 PaymentReservedEvent
// InventoryService: 监听 PaymentReservedEvent → 预扣库存 → 发布 StockReservedEvent
// OrderService: 监听 StockReservedEvent → 确认订单
```

---

### 3.3 API 版本管理

| 方案 | 示例 | 优点 | 缺点 |
|------|------|------|------|
| URL 路径 | `/api/v1/orders` | 简单直观，便于调试 | URL 膨胀 |
| Header | `Accept: application/vnd.api.v2+json` | URL 干净 | 不易调试 |
| Query 参数 | `/api/orders?version=2` | 灵活 | 容易遗漏 |
| **推荐** | URL 路径（大版本）+ Header（小版本） | 平衡 | — |

**版本兼容策略**：新版本向后兼容（新增字段用默认值），不兼容变更必须升级大版本。同时维护最多 2 个大版本，旧版本设置 Sunset Header 提前告知下线时间。

---

### 3.4 服务网格（Service Mesh）— Istio/Envoy

Service Mesh 将微服务间通信的**治理逻辑（限流/熔断/认证/可观测）从应用代码下沉到基础设施层（Sidecar 代理）**。

**Istio/Envoy 架构**：
- **数据面**：Envoy Sidecar 作为每个 Pod 的网络代理，拦截所有进出流量
- **控制面**：Istiod（合并了 Pilot/Citadel/Galley）下发路由规则、证书、配置到 Envoy

**优势**：服务治理与业务代码完全解耦，支持多语言（Java/Go/Python 统一治理）。
**代价**：增加延迟（约 1-3ms per hop）、运维复杂度高、资源开销（每个 Pod 多一个 Envoy 容器，约 50-100MB 内存）。

#### 面试追问点

> **Q：什么时候该用 Service Mesh？什么时候不该？**
> A：**该用**：多语言技术栈、团队规模大需要统一治理、已有 K8s 基础设施。**不该用**：团队小（< 20人）、纯 Java 技术栈（Spring Cloud 已够用）、对延迟极其敏感（每 hop 多 1-3ms）。

---

### 3.5 灰度发布 / 蓝绿部署 / 金丝雀发布

| 方案 | 原理 | 回滚速度 | 资源开销 | 适用场景 |
|------|------|----------|----------|----------|
| 蓝绿部署 | 两套完整环境，流量一键切换 | 秒级 | 2x 资源 | 要求快速回滚的核心服务 |
| 金丝雀发布 | 先导入少量流量（1%-5%）到新版本 | 分钟级 | 1.x 资源 | 逐步验证新版本稳定性 |
| 灰度发布 | 按规则（用户ID/地域/Header）路由到新版本 | 分钟级 | 1.x 资源 | 精准验证特定用户群体 |

#### 面试追问点

> **Q：微服务拆分后，数据一致性怎么保证？**
> A：(1) **强一致性场景**（如扣款）：尽量放在同一服务内，用本地事务。(2) **最终一致性**：Saga 模式（编排或协作）+ 补偿事务。(3) **可靠事件**：Transactional Outbox + CDC（如 Debezium 监听 binlog）。(4) **TCC 模式**（Try-Confirm-Cancel）适合短事务但实现复杂，需要业务侵入。

---

## 四、高可用设计

### 4.1 限流

#### 原理详解

| 算法 | 原理 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|----------|
| 令牌桶（Token Bucket） | 固定速率往桶中放令牌，请求取走令牌才通过 | 允许突发流量（桶满时可一次消耗多个） | 实现稍复杂 | API Gateway |
| 漏桶（Leaky Bucket） | 请求进入桶中排队，桶以固定速率放出 | 流量绝对平滑 | 不支持突发 | 限流下游调用 |
| 滑动窗口（Sliding Window） | 将时间窗口切分为多个小窗口，统计总请求数 | 比固定窗口更精确 | 内存开销 | Sentinel 默认策略 |

```java
// 令牌桶算法核心实现（Guava RateLimiter 简化版）
public class TokenBucketLimiter {
    private double storedPermits;       // 当前桶中令牌数
    private double maxPermits;          // 桶容量
    private double stableIntervalMicros; // 每个令牌的生成间隔（微秒）
    private long nextFreeTicketMicros;   // 下一个可用令牌的时间

    public synchronized boolean tryAcquire() {
        long nowMicros = System.nanoTime() / 1000;
        // 补充令牌（基于时间流逝）
        if (nowMicros > nextFreeTicketMicros) {
            double newPermits =
                (nowMicros - nextFreeTicketMicros) / stableIntervalMicros;
            storedPermits = Math.min(maxPermits, storedPermits + newPermits);
            nextFreeTicketMicros = nowMicros;
        }
        // 尝试获取令牌
        if (storedPermits >= 1.0) {
            storedPermits -= 1.0;
            return true;  // 放行
        }
        return false;  // 限流
    }
}
```

**分布式限流**：单机令牌桶在集群环境下无法精确控制总 QPS。解决方案是使用 Redis + Lua 脚本实现分布式令牌桶：

```lua
-- Redis + Lua 分布式令牌桶
-- KEYS[1]: 令牌桶key
-- ARGV[1]: 速率  ARGV[2]: 桶容量  ARGV[3]: 当前时间  ARGV[4]: 请求令牌数
local tokens = tonumber(redis.call('hget', KEYS[1], 'tokens') or ARGV[2])
local lastTime = tonumber(redis.call('hget', KEYS[1], 'lastTime') or ARGV[3])
local rate = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])
local delta = math.max(0, now - lastTime)
tokens = math.min(capacity, tokens + delta * rate)
if tokens >= requested then
    tokens = tokens - requested
    redis.call('hset', KEYS[1], 'tokens', tokens)
    redis.call('hset', KEYS[1], 'lastTime', now)
    return 1
end
return 0
```

---

### 4.2 熔断

#### 原理详解

断路器状态机包含三个状态：

```
         失败率 > 阈值                半开状态尝试放行
    ┌──────────────────┐         ┌──────────────────────┐
    │                  ▼         │                      ▼
  CLOSED ────────→ OPEN ──(超时)──→ HALF_OPEN ──(成功)──→ CLOSED
                                       │
                                       │ (失败)
                                       ↓
                                     OPEN
```

- **CLOSED**：正常状态，统计失败率
- **OPEN**：断路器打开，直接拒绝请求（快速失败），一段时间后进入 HALF_OPEN
- **HALF_OPEN**：放行少量请求试探，成功则关闭断路器，失败则继续打开

```java
// Resilience4j 断路器配置
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .failureRateThreshold(50)           // 失败率阈值 50%
    .waitDurationInOpenState(Duration.ofSeconds(30)) // OPEN 持续 30s
    .slidingWindowSize(100)             // 统计窗口大小 100 次请求
    .slidingWindowType(SlidingWindowType.COUNT_BASED)
    .minimumNumberOfCalls(10)           // 最少 10 次调用才计算失败率
    .permittedNumberOfCallsInHalfOpenState(3) // HALF_OPEN 放行 3 次
    .build();

CircuitBreaker breaker = CircuitBreaker.of("orderService", config);

// 使用装饰器模式包装调用
Supplier<String> decoratedSupplier = CircuitBreaker
    .decorateSupplier(breaker, () -> orderService.getOrder(id));
Try<String> result = Try.ofSupplier(decoratedSupplier)
    .recover(CallNotPermittedException.class, e -> "服务暂时不可用"); // fallback
```

---

### 4.3 降级

降级策略按优先级排列：
1. **返回默认值/兜底数据**：如推荐服务不可用时返回热门排行榜
2. **缓存兜底**：使用上一次缓存的结果（虽然可能过期但好过报错）
3. **功能降级**：关闭非核心功能（如评论、推荐），保障核心流程（下单、支付）
4. **服务降级**：拒绝低优先级请求，保障高优先级用户

---

### 4.4 隔离

| 隔离方式 | 原理 | 优点 | 缺点 | 适用场景 |
|----------|------|------|------|----------|
| 线程池隔离 | 每个下游服务分配独立线程池 | 隔离彻底，慢调用不影响其他 | 线程切换开销，线程资源有限 | 调用延迟高或不稳定的下游 |
| 信号量隔离 | 计数器限制并发数 | 无线程切换，性能高 | 不支持超时控制，隔离性弱 | 调用延迟低且稳定的下游 |

线程池隔离的本质：服务 A 调用超时占满线程池时，不会影响服务 B 的调用线程池。牺牲一小部分线程切换性能，换取服务间的故障隔离。

---

### 4.5 超时重试

```java
// 指数退避 + 抖动（防重试风暴的核心算法）
public long calculateRetryDelay(int retryCount) {
    long baseDelay = 1000L;  // 1秒
    long maxDelay = 30000L;  // 最大30秒
    // 指数退避：1s, 2s, 4s, 8s, 16s, 30s
    long delay = Math.min(maxDelay, baseDelay * (1L << retryCount));
    // 加随机抖动（±30%），避免多个客户端同时重试
    long jitter = (long) (delay * 0.3 * (Math.random() * 2 - 1));
    return delay + jitter;
}
```

**重试风暴问题**：下游服务超时 → 上游重试 → 下游压力更大 → 更多超时 → 更多重试 → 雪崩。

**解决方案**：
1. 限制重试次数（最多 2-3 次）
2. 指数退避 + 随机抖动
3. 对 5xx 和超时区分处理——连接超时可重试，读超时慎重重试（请求可能已执行）
4. 下游配合限流/熔断

---

### 4.6 幂等设计

| 方案 | 原理 | 适用场景 | 注意事项 |
|------|------|----------|----------|
| Token 机制 | 请求前获取 token，服务端执行后删除 | 表单重复提交 | Token 需设过期时间 |
| 唯一约束 | 数据库唯一索引 | 创建操作 | 利用 DB 保证原子性 |
| 状态机 | 只允许合法的状态流转 | 订单状态变更 | 配合乐观锁 |
| 去重表 | 记录已处理的请求ID | MQ 消费幂等 | 去重表需定期清理 |

```java
// Token 机制实现幂等
@PostMapping("/order")
public Result createOrder(
        @RequestHeader("Idempotency-Key") String token,
        @RequestBody OrderRequest req) {
    // Redis SETNX: 只有第一次设置成功
    Boolean acquired = redisTemplate.opsForValue()
        .setIfAbsent("idempotent:" + token, "1", 30, TimeUnit.MINUTES);
    if (Boolean.FALSE.equals(acquired)) {
        return Result.fail("请勿重复提交");
    }
    try {
        return orderService.createOrder(req);
    } catch (Exception e) {
        // 失败删除 token，允许用户重试
        redisTemplate.delete("idempotent:" + token);
        throw e;
    }
}
```

#### 面试追问点

> **Q：Sentinel 和 Hystrix 的核心区别？**
> A：(1) Hystrix 基于线程池隔离，Sentinel 默认基于信号量隔离，性能更好；(2) Sentinel 支持更丰富的限流策略（QPS/线程数/热点参数限流），Hystrix 只有线程池和信号量；(3) Sentinel 有 Dashboard 实时调参，Hystrix 需配合 Turbine；(4) Hystrix 已停止维护（2018 年进入维护模式），Sentinel 持续活跃。

> **Q：如何设计一个高可用的限流方案？**
> A：(1) **多级限流**：前端 → Nginx → 网关 → 服务，每层逐级过滤；(2) **本地+分布式结合**：本地令牌桶做第一道防线（无网络开销），Redis 分布式限流做精确控制；(3) **自适应限流**：根据系统负载（CPU/RT）动态调整阈值，Sentinel 的系统自适应保护即此思路。

---

## 五、高并发系统设计

### 5.1 异步化（MQ 削峰填谷）

MQ 削峰的本质是**将同步调用转为异步消息，用时间换空间**。

```
同步：Client → OrderService → InventoryService → PayService  (串行等待 300ms)
异步：Client → OrderService → MQ → [InventoryConsumer | PayConsumer]  (立即返回 50ms)
```

**关键设计**：
- **消息积压监控**：消费者速度 < 生产者速度时报警，并自动扩容消费者
- **消息顺序性**：同一订单的消息发到同一分区（Kafka Partition Key / RocketMQ MessageQueueSelector）
- **消费幂等**：消费者必须做幂等处理（去重表/唯一索引/状态机）

---

### 5.2 缓存化（多级缓存）

```
请求 → L1 本地缓存 (Caffeine, ~0.01ms)
     → L2 分布式缓存 (Redis, ~1ms)
     → L3 数据库 (MySQL, ~10ms)
```

```java
// 多级缓存实现
public Product getProduct(Long id) {
    String key = "product:" + id;

    // L1: 本地缓存（Caffeine）
    Product product = localCache.getIfPresent(key);
    if (product != null) return product;

    // L2: Redis
    product = redisTemplate.opsForValue().get(key);
    if (product != null) {
        localCache.put(key, product); // 回填 L1
        return product;
    }

    // L3: 数据库（加分布式锁，防缓存击穿）
    RLock lock = redisson.getLock("lock:" + key);
    lock.lock();
    try {
        // double check: 可能其他线程已经加载了
        product = redisTemplate.opsForValue().get(key);
        if (product != null) return product;

        product = productMapper.selectById(id);
        if (product != null) {
            redisTemplate.opsForValue().set(key, product,
                30, TimeUnit.MINUTES);
            localCache.put(key, product);
        } else {
            // 缓存空值，防缓存穿透（短过期时间）
            redisTemplate.opsForValue().set(key, NULL_PRODUCT,
                5, TimeUnit.MINUTES);
        }
        return product;
    } finally {
        lock.unlock();
    }
}
```

#### 缓存一致性方案对比

| 方案 | 做法 | 一致性 | 复杂度 | 推荐场景 |
|------|------|--------|--------|----------|
| Cache Aside | 先更新DB，再删缓存 | 最终一致（极端情况下有短暂不一致） | 低 | 大多数场景 |
| 延迟双删 | 先删缓存→更新DB→延迟N秒再删缓存 | 较好 | 中 | 读写并发高的场景 |
| Binlog 监听 | Canal 监听binlog→异步更新缓存 | 较好 | 高 | 要求较高一致性 |
| 读写穿透 | 中间件代理托管缓存读写 | 强一致 | 高 | 特殊场景 |

**为什么是"先更新DB再删缓存"而不是"先删缓存再更新DB"？** 因为后者在并发下可能出现：线程A删缓存 → 线程B读DB旧值写入缓存 → 线程A更新DB。此时缓存中是旧值，DB 是新值，不一致。而"先更新DB再删缓存"出现不一致的概率极低（需要读请求在写请求更新DB之后、删缓存之前完成缓存回填）。

---

### 5.3 池化

池化的本质是**复用昂贵的资源创建过程**。

```java
// HikariCP 连接池核心参数
HikariConfig config = new HikariConfig();
config.setMaximumPoolSize(20);          // 最大连接数
config.setMinimumIdle(10);              // 最小空闲连接
config.setConnectionTimeout(30000);     // 获取连接超时 30s
config.setIdleTimeout(600000);          // 空闲连接存活 10min
config.setMaxLifetime(1800000);         // 连接最大生命 30min（< MySQL wait_timeout）
config.setLeakDetectionThreshold(5000); // 连接泄漏检测 5s
```

**HikariCP 为什么快？**
1. **无锁化设计**：使用 `ConcurrentBag` 而非 `BlockingQueue`，线程先从 `ThreadLocal` 获取之前用过的连接（亲和性），减少竞争
2. **精简字节码**：使用 Javassist 生成代理类而非 JDK/CGLIB 代理
3. **FastList 替代 ArrayList**（移除范围检查 `rangeCheck`）
4. **连接池大小经验公式**：`连接数 = (CPU核数 × 2) + 有效磁盘数`

---

### 5.4 预计算

- **热点数据预加载**：系统启动时/定时任务提前将热点数据加载到缓存
- **排行榜定时刷新**：每 5 分钟计算一次排行榜存入 Redis Sorted Set，查询时直接读取
- **统计数据预聚合**：通过 Flink/Spark 预先计算报表数据，查询时直接读取结果
- **搜索预热**：大促前预热 ES 索引到文件系统缓存

---

### 5.5 分而治之（分库分表/分片）

| 分片策略 | 优点 | 缺点 | 适用场景 |
|----------|------|------|----------|
| 取模（Hash） | 分布均匀 | 扩容需迁移数据 | 数据量可预估 |
| 范围（Range） | 扩容方便 | 可能数据倾斜 | 时间序列数据 |
| 一致性哈希 | 扩容只迁移少量数据 | 实现复杂 | 分布式缓存 |

```yaml
# ShardingSphere 分片规则（4库 × 8表 = 32张表）
rules:
  sharding:
    tables:
      t_order:
        actualDataNodes: ds_${0..3}.t_order_${0..7}
        databaseStrategy:
          standard:
            shardingColumn: user_id
            shardingAlgorithmName: db_mod    # user_id % 4 选库
        tableStrategy:
          standard:
            shardingColumn: order_id
            shardingAlgorithmName: table_mod  # order_id % 8 选表
```

#### 面试追问点

> **Q：分库分表后，跨分片查询怎么处理？**
> A：(1) 建立全局二级索引（ES 或独立索引库）；(2) 设计合理的分片键，使 80% 查询只命中单个分片；(3) 使用 CQRS，读端使用 ES/宽表支持灵活查询；(4) 尽量避免跨分片 JOIN，改为业务层组装。

> **Q：分库分表后全局唯一 ID 怎么生成？**
> A：(1) **Snowflake 算法**（时间戳+机器ID+序列号），性能高但依赖时钟；(2) **号段模式**（如美团 Leaf），从 DB 批量获取 ID 段，本地分配；(3) **Redis INCR**，简单但 Redis 依赖。推荐 Leaf 号段模式，兼顾性能和可靠性。

---

## 六、秒杀系统设计

### 6.1 全链路方案

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ 前端限流  │→│ CDN/Nginx │→│ 网关层    │→│ 本地缓存  │→│ Redis预减 │→│ MQ异步   │→│ DB扣减   │
│ 按钮置灰  │  │ 限流      │  │ 限流      │  │ 预判断    │  │ 库存      │  │ 下单      │  │ 乐观锁   │
│ 答题验证  │  │ 静态CDN   │  │ Token校验 │  │ 库存0拒绝 │  │ Lua原子   │  │ 削峰      │  │ version  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘
  过滤90%       过滤50%       过滤30%       过滤80%       精确控制        异步化        最终保障
```

**核心思想**：层层过滤，让尽可能少的请求到达数据库。

#### Redis 预减库存（Lua 脚本保证原子性）

```lua
-- KEYS[1]: 库存key  KEYS[2]: 已购买用户集合key
-- ARGV[1]: 用户ID  ARGV[2]: 购买数量
-- 返回: -1=已购买  0=库存不足  1=成功

-- 1. 检查是否重复购买（一人一单）
if redis.call('sismember', KEYS[2], ARGV[1]) == 1 then
    return -1
end
-- 2. 检查并扣减库存
local stock = tonumber(redis.call('get', KEYS[1]))
if stock <= 0 then
    return 0
end
-- 3. 原子操作：减库存 + 记录用户
redis.call('decrby', KEYS[1], ARGV[2])
redis.call('sadd', KEYS[2], ARGV[1])
return 1
```

#### DB 乐观锁扣减（最终一致性保障）

```java
// MyBatis — 乐观锁防超卖
@Update("UPDATE t_seckill_goods " +
        "SET stock = stock - #{count}, version = version + 1 " +
        "WHERE id = #{goodsId} AND stock >= #{count} AND version = #{version}")
int deductStock(@Param("goodsId") Long goodsId,
                @Param("count") int count,
                @Param("version") int version);
```

---

### 6.2 核心问题与解决方案

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| **超卖** | Redis 预减和 DB 扣减不原子 | Lua 脚本原子预减 + DB 乐观锁兜底 + `stock >= count` 防负数 |
| **少卖** | Redis 预减成功但下单失败，库存未归还 | 失败回滚：`INCRBY` 归还 Redis 库存 + 定时对账任务 |
| **库存一致性** | Redis 与 DB 数据不一致 | 以 DB 为准，Redis 只是预判过滤层，定时同步 |
| **流量突刺** | 活动开始瞬间 QPS 暴涨 | 前端答题/滑块延迟 1-3s 随机打散请求 |

---

### 6.3 热点隔离与动态限流

- **热点隔离**：秒杀商品独立部署（独立服务实例 + 独立 Redis 集群 + 独立数据库），避免影响正常业务。
- **动态限流**：基于实时 QPS 监控自动调整限流阈值。Sentinel 支持热点参数限流——对 `goodsId` 为热点的请求单独限流。

```java
// Sentinel 热点参数限流
@SentinelResource(value = "seckill",
    blockHandler = "seckillBlockHandler")
public Result seckill(@RequestParam Long goodsId, @RequestParam Long userId) {
    // goodsId 作为热点参数，Sentinel 自动统计并限流
    return seckillService.execute(goodsId, userId);
}
```

#### 面试追问点

> **Q：如果 Redis 挂了怎么办？**
> A：(1) Redis Cluster 集群模式保证高可用（主从切换 < 10s）；(2) 降级方案：Redis 不可用时，直接走 DB 乐观锁扣减（性能下降但正确）；(3) 本地缓存兜底：秒杀开始前将库存加载到 `AtomicInteger`/`Caffeine`，先做粗略预判过滤，减少 DB 压力。

> **Q：如何防止脚本/机器人抢购？**
> A：(1) 前端：滑块验证/答题/随机等待；(2) 网关：同一用户 IP/设备频率限制；(3) 风控：设备指纹 + 行为分析（如点击轨迹检测）；(4) Token 机制：秒杀开始前对合法用户发放限量 Token，无 Token 拒绝。

---

## 七、电商系统设计要点

### 7.1 订单系统

#### 状态机设计

```
          创建订单         支付成功         发货           签收
CREATED ──────→ PENDING_PAY ──────→ PAID ──────→ SHIPPED ──────→ COMPLETED
   │                │                │                                │
   │ 取消            │ 超时关闭        │ 退款                           │ 退货
   ↓                ↓                ↓                                ↓
CANCELLED       CLOSED          REFUNDING → REFUNDED           RETURNING → RETURNED
```

```java
// 状态机实现（防止非法状态流转）
public enum OrderStatus {
    CREATED, PENDING_PAY, PAID, SHIPPED, COMPLETED,
    CANCELLED, CLOSED, REFUNDING, REFUNDED, RETURNING, RETURNED;

    private static final Map<OrderStatus, Set<OrderStatus>> TRANSITIONS = Map.of(
        CREATED,     Set.of(PENDING_PAY, CANCELLED),
        PENDING_PAY, Set.of(PAID, CLOSED, CANCELLED),
        PAID,        Set.of(SHIPPED, REFUNDING),
        SHIPPED,     Set.of(COMPLETED),
        COMPLETED,   Set.of(RETURNING),
        RETURNING,   Set.of(RETURNED),
        REFUNDING,   Set.of(REFUNDED)
    );

    public boolean canTransitTo(OrderStatus target) {
        return TRANSITIONS.getOrDefault(this, Collections.emptySet())
                          .contains(target);
    }

    public OrderStatus transitTo(OrderStatus target) {
        if (!canTransitTo(target)) {
            throw new IllegalStateException(
                "Cannot transit from " + this + " to " + target);
        }
        return target;
    }
}
```

#### 超时关单方案对比

| 方案 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 定时任务轮询 | 每分钟扫描超时订单 | 简单 | 时间精度差、DB 压力大 |
| 延迟消息（RocketMQ） | 发送延迟消息，到期触发 | 精度高、解耦 | 依赖 MQ 可靠性 |
| Redis 过期回调 | Key 过期事件通知 | 简单 | 不可靠（可能丢失、延迟） |
| 时间轮（HashedWheelTimer） | 内存中时间轮调度 | 高效 | 重启丢失，单机限制 |
| **推荐组合** | 延迟消息 + 定时任务兜底 | 可靠 + 精确 | 略复杂 |

```java
// 延迟消息实现超时关单
// 1. 下单时发送延迟消息
Message msg = new Message("ORDER_TIMEOUT_TOPIC", orderId.getBytes());
msg.setDelayTimeLevel(16); // RocketMQ Level 16 = 30min
producer.send(msg);

// 2. 消费者处理
@RocketMQMessageListener(topic = "ORDER_TIMEOUT_TOPIC")
public class OrderTimeoutConsumer implements RocketMQListener<String> {
    @Override
    public void onMessage(String orderId) {
        Order order = orderRepository.findById(orderId);
        // 幂等判断：只处理待支付状态的订单
        if (order != null && order.getStatus() == OrderStatus.PENDING_PAY) {
            order.close();
            orderRepository.save(order);
            inventoryService.releaseStock(orderId); // 归还库存
        }
    }
}

// 3. 定时任务兜底（每5分钟扫描，处理延迟消息漏处理的情况）
@Scheduled(cron = "0 */5 * * * ?")
public void closeTimeoutOrders() {
    LocalDateTime deadline = LocalDateTime.now().minusMinutes(30);
    List<Order> timeoutOrders = orderMapper.selectTimeoutOrders(
        OrderStatus.PENDING_PAY, deadline);
    for (Order order : timeoutOrders) {
        orderService.closeOrder(order.getId()); // 内部做幂等
    }
}
```

---

### 7.2 支付系统

#### 核心设计

1. **对账**：每日凌晨与支付渠道对账（下载对账文件 → 逐笔比对 → 差错处理）
   - 差错类型：**长款**（渠道有支付记录但系统无订单）、**短款**（系统有订单但渠道无支付记录）、**金额不一致**
   - 解决：长款人工审核退款，短款查询支付渠道确认状态后补单

2. **退款**：退款是独立的逆向流程，不能简单回滚。需记录退款单，异步调用支付渠道退款接口，监听退款结果通知。

3. **重复支付防护**：同一订单只能关联一笔有效支付。

```java
// 防重复支付
@Transactional
public PayOrder createPayOrder(String orderId, BigDecimal amount) {
    // 查询是否已有进行中的支付单
    PayOrder existing = payOrderMapper.selectByOrderIdAndStatus(
        orderId, PayStatus.PROCESSING);
    if (existing != null) {
        return existing; // 幂等返回已有支付单
    }
    PayOrder payOrder = new PayOrder(orderId, amount, PayStatus.PROCESSING);
    try {
        payOrderMapper.insert(payOrder); // 唯一索引 (order_id, status) 兜底
    } catch (DuplicateKeyException e) {
        return payOrderMapper.selectByOrderIdAndStatus(
            orderId, PayStatus.PROCESSING);
    }
    return payOrder;
}
```

---

### 7.3 库存系统

#### 预扣库存方案

```
下单时：预扣库存（available_stock - N, frozen_stock + N）
支付成功：确认扣减（frozen_stock - N, sold_stock + N）
取消/超时：释放库存（available_stock + N, frozen_stock - N）
```

```sql
-- 库存表设计
CREATE TABLE t_inventory (
    id BIGINT PRIMARY KEY,
    sku_id BIGINT NOT NULL,
    total_stock INT NOT NULL,       -- 总库存
    available_stock INT NOT NULL,   -- 可用库存（下单时减）
    frozen_stock INT NOT NULL,      -- 冻结库存（下单加，支付后减）
    sold_stock INT NOT NULL,        -- 已售库存（支付后加）
    version INT NOT NULL DEFAULT 0, -- 乐观锁
    UNIQUE INDEX idx_sku(sku_id)
);

-- 预扣库存（乐观锁）
UPDATE t_inventory
SET available_stock = available_stock - #{count},
    frozen_stock = frozen_stock + #{count},
    version = version + 1
WHERE sku_id = #{skuId}
  AND available_stock >= #{count}
  AND version = #{version};
```

#### 面试追问点

> **Q：预扣库存 vs 支付扣库存 vs 下单扣库存，怎么选？**
> A：**下单扣库存**（主流电商选择）：用户体验好（付款必有货），但恶意下单会占用库存——配合超时关单（30min）缓解。**支付扣库存**：不存在恶意占用，但可能出现"付款时库存不足"的差体验。**预扣库存**是下单扣库存的精细化实现，区分"冻结"和"已售"状态，支持精确的库存回滚。

> **Q：库存扣减在高并发下如何保证不超卖？**
> A：三道防线：(1) Redis Lua 脚本原子预判+预减，过滤大量无效请求；(2) DB 乐观锁 `stock >= count AND version = #{version}` 保证最终正确；(3) 唯一索引防止同一用户重复下单。

---

## 八、架构演进

### 8.1 单体 → SOA → 微服务 → 云原生

| 阶段 | 特征 | 通信方式 | 部署方式 | 典型技术 |
|------|------|----------|----------|----------|
| **单体** | 所有功能在一个应用中 | 进程内调用 | WAR 部署到 Tomcat | Spring MVC + JSP |
| **SOA** | 按业务域拆分服务，ESB 集中治理 | SOAP/ESB | 独立部署 | Dubbo、WebService |
| **微服务** | 更细粒度拆分，去中心化治理 | RESTful/gRPC | Docker 容器 | Spring Cloud、K8s |
| **云原生** | 容器化+编排+服务网格+不可变基础设施 | gRPC/Mesh | K8s Pod | Istio、Knative、Serverless |

**每个阶段的驱动力**：
- 单体 → SOA：系统膨胀到单次部署需要 2 小时、改一行代码影响全局
- SOA → 微服务：ESB 成为瓶颈、服务治理需要更细粒度的控制
- 微服务 → 云原生：容器编排的成熟使弹性伸缩和自动化运维成为可能

---

### 8.2 技术选型决策框架

**选型四象限**：

|  | 业务复杂度低 | 业务复杂度高 |
|--|------------|------------|
| **团队规模小** | 单体/模块化单体（快速验证） | 模块化单体（先跑通再拆） |
| **团队规模大** | 微服务（保守拆分，提升交付效率） | 微服务 + DDD（精准拆分） |

**关键决策维度**：

1. **团队能力**：团队是否有微服务运维经验？没有就先单体，积累能力再拆。
2. **业务复杂度**：简单 CRUD 用单体，复杂业务域（电商/金融）考虑微服务。
3. **性能要求**：微服务引入网络开销（1-5ms/hop），极致性能场景考虑进程内通信。
4. **运维成本**：微服务需要完善的 CI/CD、监控（Prometheus/Grafana）、链路追踪（SkyWalking/Jaeger）、日志收集（ELK）。

**演进式架构经验法则**：
- Day 1 不要拆微服务，先用**模块化单体**（Modular Monolith），每个模块有清晰的边界和内部 API
- 当某个模块的迭代速度远超其他模块，或团队扩展到需要独立部署时，才拆出去
- 拆分优先级：流量差异大的先拆（高流量前台 vs 低流量后台）、变更频率差异大的先拆

#### 面试追问点

> **Q：微服务的缺点是什么？什么时候不该用？**
> A：缺点：(1) 分布式事务复杂（Saga/TCC）；(2) 服务间调用的网络延迟和可靠性问题；(3) 运维成本剧增（需要完善的基础设施）；(4) 数据一致性挑战（每个服务有自己的数据库）。**不该用的场景**：(1) 早期创业项目（先验证业务价值）；(2) 团队 < 10 人（管理开销 > 收益）；(3) 业务逻辑简单的工具类应用。

> **Q：你做过最复杂的架构决策是什么？**
> A：这是开放题，建议按以下框架回答：(1) **背景**：面临什么问题/挑战？(2) **方案**：考虑了哪些方案？(3) **权衡**：每个方案的 trade-off？(4) **决策**：为什么选了这个？(5) **结果**：效果如何？有什么教训？关键是展示**系统性思考能力**而非堆砌技术名词。

---

## 附：架构设计面试万能回答框架

面对"如何设计 XXX 系统"类面试题，使用以下结构化框架：

```
1. 明确需求  → 功能需求 + 非功能需求（QPS/延迟/可用性/数据量）
2. 顶层设计  → 画出核心架构图（客户端 → 网关 → 服务 → 存储）
3. 核心设计  → 深入关键模块（数据模型/核心算法/缓存策略）
4. 扩展性    → 如何应对 10x 流量增长（水平扩展/分库分表/缓存）
5. 容错设计  → 限流/熔断/降级/数据一致性
6. 权衡取舍  → 说明 trade-off 和做出选择的理由
```

> 💡 面试官看重的不是"完美方案"，而是**系统性思考能力**和**权衡取舍的判断力**。回答时要展示"我为什么选择 A 而不是 B"的思考过程。

## 相关文章

- [architect-tiered-interview](/posts/architect/architect-tiered-interview/)
- [架构师面试官地图](/posts/architect/architect-interview-map/)
