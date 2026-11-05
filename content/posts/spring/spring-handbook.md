---
title: Spring 生态深度面试手册
date: 2026-11-05
summary: IOC 与循环依赖、AOP、事务传播与失效、自动装配、MVC 流程、Spring Cloud、Security/OAuth2。
interview: false
kind: handbook
---

> **适用人群**：3-5 年+ Java 开发者 | **目标**：应对阿里/美团/字节/腾讯等大厂深度追问
> 本手册按照 Spring 生态核心知识点逐一深度编写，每个知识点包含**原理详解、方案对比、代码示例、生产踩坑、面试追问**五个维度。

---

## 1. IOC 容器：Bean 生命周期与循环依赖

### 1.1 Bean 生命周期完整流程 — 原理详解

Spring Bean 从出生到销毁，完整经历了 **12 个核心阶段**。理解这个流程是理解 Spring 所有高级特性（AOP、事务、事件）的基础。

**完整流程图**：

```
实例化(Instantiation)
    → 属性注入(Populate Properties)
        → BeanNameAware.setBeanName()
            → BeanFactoryAware.setBeanFactory()
                → ApplicationContextAware.setApplicationContext()
                    → BeanPostProcessor.postProcessBeforeInitialization()
                        → InitializingBean.afterPropertiesSet()
                            → 自定义 init-method
                                → BeanPostProcessor.postProcessAfterInitialization()
                                    → Bean 就绪，投入使用
                                        → DisposableBean.destroy()
                                            → 自定义 destroy-method

```

**源码级解析**：整个生命周期的核心驱动方法在 `AbstractAutowireCapableBeanFactory.doCreateBean()`：

```java
// AbstractAutowireCapableBeanFactory.java 核心流程
protected Object doCreateBean(String beanName, RootBeanDefinition mbd, Object[] args) {
    // 1. 实例化：通过反射或 CGLIB 创建 Bean 的裸对象
    BeanWrapper instanceWrapper = createBeanInstance(beanName, mbd, args);
    Object bean = instanceWrapper.getWrappedInstance();

    // 2. 关键！提前暴露到三级缓存（为解决循环依赖）
    //    此时 bean 尚未属性注入，是"半成品"
    boolean earlySingletonExposure = (mbd.isSingleton()
        && this.allowCircularReferences
        && isSingletonCurrentlyInCreation(beanName));
    if (earlySingletonExposure) {
        // 注意：放入的是 ObjectFactory lambda，不是 bean 本身
        addSingletonFactory(beanName,
            () -> getEarlyBeanReference(beanName, mbd, bean));
    }

    Object exposedObject = bean;
    // 3. 属性注入：@Autowired / @Value / XML 配置的依赖在此注入
    populateBean(beanName, mbd, instanceWrapper);
    // 4. 初始化：Aware回调 → BeanPostProcessor → InitializingBean → init-method
    exposedObject = initializeBean(beanName, exposedObject, mbd);

    return exposedObject;
}

```

`initializeBean()` 内部的执行顺序：

```java
protected Object initializeBean(String beanName, Object bean, RootBeanDefinition mbd) {
    // (1) 调用 Aware 接口
    invokeAwareMethods(beanName, bean);     // BeanNameAware → BeanFactoryAware

    // (2) BeanPostProcessor 前置处理
    //     ApplicationContextAwareProcessor 在此阶段处理 ApplicationContextAware
    Object wrappedBean = applyBeanPostProcessorsBeforeInitialization(wrappedBean, beanName);

    // (3) 初始化方法
    invokeInitMethods(beanName, wrappedBean, mbd);  // InitializingBean → init-method

    // (4) BeanPostProcessor 后置处理（AOP 代理在此生成！）
    wrappedBean = applyBeanPostProcessorsAfterInitialization(wrappedBean, beanName);

    return wrappedBean;
}

```

**关键细节**：

- `ApplicationContextAware` 不是在 `invokeAwareMethods` 中处理的，而是由 `ApplicationContextAwareProcessor`（一个 BeanPostProcessor）在 `postProcessBeforeInitialization` 阶段处理的。
- AOP 代理对象的创建发生在 `postProcessAfterInitialization`，由 `AbstractAutoProxyCreator` 完成。

### 1.2 三级缓存解决循环依赖 — 原理详解

**三级缓存的定义**（`DefaultSingletonBeanRegistry`）：

| 缓存层级 | 变量名 | 存储内容 | 说明 |
| --- | --- | --- | --- |
| 一级缓存 | `singletonObjects` | 完整的 Bean 对象 | 经历了完整生命周期的成品 |
| 二级缓存 | `earlySingletonObjects` | 提前暴露的 Bean（可能是代理） | 半成品，属性尚未注入完成 |
| 三级缓存 | `singletonFactories` | `ObjectFactory<?>` 工厂对象 | 存储的是 lambda 表达式，延迟创建 |

**循环依赖场景分析**：假设 A 依赖 B，B 依赖 A。

```
1. 创建 A → 实例化 A（裸对象）
2. 将 A 的 ObjectFactory 放入三级缓存 singletonFactories
3. A 属性注入 → 发现依赖 B → 去创建 B
4. 创建 B → 实例化 B（裸对象）
5. 将 B 的 ObjectFactory 放入三级缓存
6. B 属性注入 → 发现依赖 A → 去获取 A
7. 先查一级缓存 → 没有
8. 再查二级缓存 → 没有
9. 查三级缓存 → 找到 A 的 ObjectFactory → 调用 getObject()
   → getEarlyBeanReference() → 如果 A 需要 AOP 代理，此时创建代理对象
   → 将结果放入二级缓存，删除三级缓存
10. B 拿到 A（或 A 的代理），完成属性注入 → B 初始化完成 → 放入一级缓存
11. 回到 A 的属性注入 → 从一级缓存拿到 B → A 属性注入完成 → A 初始化
12. A 放入一级缓存

```

**核心代码**：

```java
// DefaultSingletonBeanRegistry.getSingleton()
protected Object getSingleton(String beanName, boolean allowEarlyReference) {
    // 1. 先从一级缓存取
    Object singletonObject = this.singletonObjects.get(beanName);
    if (singletonObject == null && isSingletonCurrentlyInCreation(beanName)) {
        // 2. 再从二级缓存取
        singletonObject = this.earlySingletonObjects.get(beanName);
        if (singletonObject == null && allowEarlyReference) {
            synchronized (this.singletonObjects) {
                // Double-check
                singletonObject = this.singletonObjects.get(beanName);
                if (singletonObject == null) {
                    singletonObject = this.earlySingletonObjects.get(beanName);
                    if (singletonObject == null) {
                        // 3. 从三级缓存取 ObjectFactory
                        ObjectFactory<?> singletonFactory =
                            this.singletonFactories.get(beanName);
                        if (singletonFactory != null) {
                            singletonObject = singletonFactory.getObject();
                            // 升级到二级缓存，移除三级缓存
                            this.earlySingletonObjects.put(beanName, singletonObject);
                            this.singletonFactories.remove(beanName);
                        }
                    }
                }
            }
        }
    }
    return singletonObject;
}

```

### 1.3 为什么需要三级缓存而不是两级？

这是大厂面试必问的经典追问。

**核心原因：AOP 代理对象的延迟创建**。

- 如果只用两级缓存（直接存半成品 Bean），那么循环依赖注入的是原始对象。
- 但如果这个 Bean 需要 AOP 代理，最终放入一级缓存的是代理对象——两者不一致！
- 三级缓存存的是 `ObjectFactory`（即 `getEarlyBeanReference` 方法），调用时会判断：如果有 AOP 增强，则提前创建代理对象返回。

```java
// AbstractAutoProxyCreator.getEarlyBeanReference()
public Object getEarlyBeanReference(Object bean, String beanName) {
    Object cacheKey = getCacheKey(bean.getClass(), beanName);
    // 记录已经提前代理过，后续 postProcessAfterInitialization 不再重复代理
    this.earlyProxyReferences.put(cacheKey, bean);
    return wrapIfNecessary(bean, beanName, cacheKey);
}

```

| 方案 | 能否解决普通循环依赖 | 能否解决 AOP 循环依赖 | 问题 |
| --- | --- | --- | --- |
| 两级缓存（成品+半成品） | ✅ | ❌ | 注入的是原始对象，非代理 |
| 三级缓存（成品+半成品+工厂） | ✅ | ✅ | ObjectFactory 保证返回正确的代理对象 |

**Spring 无法解决的循环依赖场景**：

| 场景 | 原因 |
| --- | --- |
| 构造器注入循环依赖 | 实例化阶段就需要对方，还没来得及放缓存 |
| prototype 作用域 | Spring 不缓存 prototype Bean |
| @Async + 循环依赖 | @Async 后置处理器生成新代理，与提前暴露的不一致 |

### 1.4 生产踩坑经验

**坑1：@Async 导致循环依赖启动失败**

```
BeanCurrentlyInCreationException: Error creating bean with name 'serviceA':
Bean with name 'serviceA' has been injected into other beans [serviceB]
in its raw version as part of a circular reference, but has eventually
been wrapped.

```

**原因**：`AsyncAnnotationBeanPostProcessor` 在 `postProcessAfterInitialization` 创建了新的代理对象，与三级缓存提前暴露的对象不一致。

**解决方案**：

```java
// 方案1：打破循环依赖，使用 @Lazy
@Autowired @Lazy
private ServiceB serviceB;

// 方案2：开启配置允许（不推荐）
spring.main.allow-circular-references=true

```

**坑2：Spring Boot 2.6+ 默认禁止循环依赖**

Spring Boot 2.6 开始 `spring.main.allow-circular-references` 默认为 `false`，升级后大量循环依赖项目直接启动失败。正确做法是重构代码消除循环依赖，而不是开启配置绕过。

### 1.5 面试追问点

> **Q1：Bean 生命周期中，BeanPostProcessor 可以做什么？举几个 Spring 内置的 BeanPostProcessor。**

参考答案：

- `AutowiredAnnotationBeanPostProcessor`：处理 `@Autowired`、`@Value` 注解注入
- `CommonAnnotationBeanPostProcessor`：处理 `@PostConstruct`、`@PreDestroy`、`@Resource`
- `AbstractAutoProxyCreator`：在 `postProcessAfterInitialization` 中创建 AOP 代理
- `ApplicationContextAwareProcessor`：处理各种 Aware 接口回调

> **Q2：@PostConstruct 在生命周期的哪个阶段执行？它和 InitializingBean 哪个先执行？**

`@PostConstruct` 由 `CommonAnnotationBeanPostProcessor` 在 `postProcessBeforeInitialization` 阶段处理，**早于** `InitializingBean.afterPropertiesSet()` 和自定义 `init-method`。执行顺序：`@PostConstruct` → `afterPropertiesSet()` → `init-method`。

> **Q3：如果把三级缓存去掉，只用一二级，有什么方法能解决 AOP 循环依赖？**

理论上可以在实例化后、属性注入前就直接判断是否需要 AOP 并创建代理放入二级缓存。但这破坏了 Spring 的设计原则——Bean 的生命周期应该是先完成所有属性注入和初始化，最后再统一做后置处理。三级缓存的 ObjectFactory 是一种**延迟到真正需要时才创建代理**的优雅设计。

---

## 2. AOP：动态代理与切面机制

### 2.1 JDK 动态代理 vs CGLIB — 原理详解

**JDK 动态代理**：基于 `java.lang.reflect.Proxy` + `InvocationHandler`，**要求目标类实现接口**。

```java
// JDK 动态代理核心原理
public class JdkProxyDemo {
    public static void main(String[] args) {
        UserService target = new UserServiceImpl();

        UserService proxy = (UserService) Proxy.newProxyInstance(
            target.getClass().getClassLoader(),
            target.getClass().getInterfaces(), // 必须有接口
            (proxy1, method, args1) -> {
                System.out.println("=== 前置增强 ===");
                Object result = method.invoke(target, args1); // 反射调用
                System.out.println("=== 后置增强 ===");
                return result;
            }
        );
        proxy.saveUser("张三");
    }
}

```

底层原理：运行时通过 `ProxyGenerator.generateProxyClass()` 动态生成一个 `$Proxy0` 类的字节码，该类继承 `Proxy` 并实现目标接口。方法调用会被转发到 `InvocationHandler.invoke()`。

**CGLIB 动态代理**：基于 ASM 字节码操控框架，**通过生成目标类的子类**来实现代理。

```java
// CGLIB 代理核心原理
public class CglibProxyDemo {
    public static void main(String[] args) {
        Enhancer enhancer = new Enhancer();
        enhancer.setSuperclass(UserServiceImpl.class); // 设置父类（不需要接口）
        enhancer.setCallback((MethodInterceptor) (obj, method, args1, proxy) -> {
            System.out.println("=== 前置增强 ===");
            Object result = proxy.invokeSuper(obj, args1); // FastClass 机制，非反射
            return result;
        });
        UserServiceImpl proxy = (UserServiceImpl) enhancer.create();
        proxy.saveUser("张三");
    }
}

```

底层原理：CGLIB 使用 ASM 框架在运行时生成目标类的子类字节码，重写父类所有非 final 方法。调用时通过 **FastClass 机制**（为目标类和代理类各生成一个 FastClass，通过方法索引直接调用，避免反射）来执行方法。

### 2.2 方案对比

| 维度 | JDK 动态代理 | CGLIB |
| --- | --- | --- |
| **实现方式** | 基于接口，运行时生成 `$Proxy` 类 | 基于继承，ASM 生成目标子类 |
| **要求** | 目标类必须实现接口 | 目标类不能是 final，方法不能是 final |
| **调用方式** | 反射调用 `Method.invoke()` | FastClass 索引直接调用（无反射） |
| **性能（创建）** | 快（JDK 内建） | 慢（需要 ASM 生成字节码） |
| **性能（调用）** | JDK 8+ 优化后接近 | 略优（FastClass 免反射） |
| **Spring 默认策略** | 有接口时使用（Spring 5 之前） | **Spring Boot 2.x 默认使用 CGLIB** |

### 2.3 Spring AOP 代理选择策略

```java
// DefaultAopProxyFactory.createAopProxy() — 决定用哪种代理
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

```

**重要**：Spring Boot 2.x 默认设置 `spring.aop.proxy-target-class=true`，即**强制使用 CGLIB**，即使目标类实现了接口。这意味着注入时可以用实现类类型而不仅限于接口类型。

### 2.4 切面执行顺序

正常执行（无异常）：

```
@Around (前半段 proceed 之前)
  → @Before
    → 目标方法执行
  → @AfterReturning
  → @After (finally)
@Around (后半段 proceed 之后)

```

异常执行：

```
@Around (前半段)
  → @Before
    → 目标方法抛异常
  → @AfterThrowing
  → @After (finally)
@Around (异常传播)

```

**多切面排序**：通过 `@Order(n)` 或 `Ordered` 接口。值越小优先级越高。外层切面先执行 Before，后执行 After（类似洋葱模型）。

### 2.5 生产踩坑经验

**坑1：同类方法内部调用 AOP 失效**

```java
@Service
public class OrderService {
    @Transactional
    public void createOrder() { ... }

    public void batchCreate() {
        // 这里 this 是原始对象，不是代理对象，@Transactional 不会生效！
        this.createOrder();
    }
}

```

**解决方案**：

```java
// 方案1：注入自身（推荐）
@Autowired @Lazy
private OrderService self;
public void batchCreate() {
    self.createOrder(); // 通过代理对象调用
}

// 方案2：从 ApplicationContext 获取
((OrderService) AopContext.currentProxy()).createOrder();
// 需要开启 @EnableAspectJAutoProxy(exposeProxy = true)

```

**坑2：CGLIB 代理的 final 方法不会被增强**

CGLIB 通过子类重写实现代理，`final` 方法无法重写，因此切面不会生效，且不会报错——静默失效。

**坑3：AOP 切面中获取注解参数的正确方式**

```java
// 错误：method 可能是代理类的方法，拿不到原始注解
@Around("@annotation(com.example.MyLog)")
public Object around(ProceedingJoinPoint pjp) {
    MethodSignature sig = (MethodSignature) pjp.getSignature();
    // 正确做法：使用 getMethod() 获取接口方法后，再从实现类找注解
    Method method = sig.getMethod();
    Method targetMethod = pjp.getTarget().getClass()
        .getMethod(method.getName(), method.getParameterTypes());
    MyLog annotation = targetMethod.getAnnotation(MyLog.class);
}

// 更简洁的方式：直接在通知方法参数绑定注解
@Around("@annotation(myLog)")
public Object around(ProceedingJoinPoint pjp, MyLog myLog) {
    String value = myLog.value(); // 直接使用
}

```

### 2.6 面试追问点

> **Q1：JDK 动态代理为什么要求必须有接口？能不能代理类？**

因为生成的 `$Proxy0` 已经继承了 `java.lang.reflect.Proxy`（Java 单继承），所以只能通过实现接口来持有目标类型。这是 Java 语言层面的限制。

> **Q2：CGLIB 的 FastClass 机制是什么？相比反射快在哪？**

FastClass 为每个类生成一个辅助类，建立方法签名到方法索引的映射。调用时通过 `switch(index)` 直接调用目标方法，避免了 `Method.invoke()` 的反射开销（查找方法、权限检查、参数装箱拆箱等）。

> **Q3：Spring Boot 为什么默认改为 CGLIB 而不是 JDK 代理？**

避免开发者踩坑。JDK 代理注入时只能用接口类型，如果代码中写 `@Autowired UserServiceImpl impl`（用实现类接收），会直接 `BeanNotOfRequiredTypeException`。CGLIB 生成的是子类，用实现类或接口类型都能注入。

---

## 3. Spring 事务：传播行为与失效场景

### 3.1 七种传播行为 — 原理详解

Spring 事务传播行为定义在 `Propagation` 枚举中，核心实现在 `AbstractPlatformTransactionManager.getTransaction()`。

| 传播行为 | 当前有事务 | 当前无事务 | 典型场景 |
| --- | --- | --- | --- |
| **REQUIRED**（默认） | 加入当前事务 | 新建事务 | 大多数业务方法 |
| **SUPPORTS** | 加入当前事务 | 以非事务运行 | 查询方法，有则加入 |
| **MANDATORY** | 加入当前事务 | **抛异常** | 强制要求调用方有事务 |
| **REQUIRES_NEW** | **挂起当前事务，新建事务** | 新建事务 | 操作日志、审计（不受外层回滚影响） |
| **NOT_SUPPORTED** | **挂起当前事务**，以非事务运行 | 以非事务运行 | 大批量查询，避免长事务 |
| **NEVER** | **抛异常** | 以非事务运行 | 确保绝对不能在事务中运行 |
| **NESTED** | **创建 Savepoint 嵌套事务** | 新建事务 | 批量处理，部分失败可回滚子事务 |

**REQUIRED vs REQUIRES_NEW vs NESTED 的区别**（高频面试题）：

```java
@Transactional // 外层方法
public void outerMethod() {
    // ... 操作1

    try {
        innerService.innerMethod(); // 内层方法
    } catch (Exception e) {
        log.error("内层失败", e);
    }

    // ... 操作2
}

```

| 内层传播行为 | 内层异常时 | 外层能否继续？ | 外层回滚时 |
| --- | --- | --- | --- |
| REQUIRED | 同一个事务，标记rollback-only | ❌ 外层 commit 时也会回滚 | 内外一起回滚 |
| REQUIRES_NEW | 独立事务，内层回滚 | ✅ 外层不受影响 | 内层已提交不受影响 |
| NESTED | Savepoint 回滚到保存点 | ✅ 外层可继续 | 内外一起回滚（同一物理事务） |

**NESTED 底层实现**：使用 JDBC 的 `Connection.setSavepoint()` / `rollbackToSavepoint()`，在同一个物理连接上通过保存点模拟子事务。注意：Oracle 支持 Savepoint，MySQL InnoDB 也支持，但部分数据库驱动可能不支持。

### 3.2 @Transactional 失效六大场景

**场景1：方法非 public**

Spring 事务是通过 AOP 代理实现的。`TransactionInterceptor` 在创建事务前会调用 `AbstractFallbackTransactionAttributeSource.computeTransactionAttribute()`：

```java
protected TransactionAttribute computeTransactionAttribute(Method method, Class<?> targetClass) {
    // Don't allow non-public methods, as configured.
    if (allowPublicMethodsOnly()
        && !Modifier.isPublic(method.getModifiers())) {
        return null; // 直接返回 null，不开启事务！
    }
    // ...
}

```

**场景2：自调用（this 调用）**

同 AOP 失效原理——`this` 是原始对象，不经过代理。详见 AOP 章节的踩坑分析。

**场景3：异常类型不匹配**

```java
@Transactional // 默认只回滚 RuntimeException 和 Error
public void method() throws Exception {
    // ...
    throw new IOException("文件不存在"); // checked 异常，不回滚！
}

// 正确写法
@Transactional(rollbackFor = Exception.class)
public void method() throws Exception { ... }

```

源码验证（`RuleBasedTransactionAttribute.rollbackOn()`）：

```java
public boolean rollbackOn(Throwable ex) {
    // 如果没有指定 rollbackFor，使用默认规则
    // DefaultTransactionAttribute.rollbackOn()
    return (ex instanceof RuntimeException || ex instanceof Error);
}

```

**场景4：try-catch 吞掉异常**

```java
@Transactional
public void method() {
    try {
        dao.insert(record);
        int i = 1 / 0;
    } catch (Exception e) {
        log.error("出错了", e); // 异常被吞，事务感知不到，不回滚！
    }
}

// 解决方案1：catch 后手动标记回滚
catch (Exception e) {
    log.error("出错了", e);
    TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
}

// 解决方案2：catch 后重新抛出
catch (Exception e) {
    log.error("出错了", e);
    throw new RuntimeException("操作失败", e);
}

```

**场景5：数据库引擎不支持事务**

MySQL 的 MyISAM 引擎不支持事务，只有 InnoDB 支持。这种情况 Spring 事务框架正常运行（调用 commit/rollback），但数据库层面无效。

**场景6：多线程场景事务失效**

```java
@Transactional
public void method() {
    new Thread(() -> {
        // 这里是新线程，没有事务上下文！
        // Spring 事务基于 ThreadLocal（TransactionSynchronizationManager）
        dao.insert(record); // 不在事务中
    }).start();
}

```

Spring 事务的连接绑定在 `TransactionSynchronizationManager` 的 ThreadLocal 中，新线程获取不到当前事务的数据库连接。

### 3.3 编程式事务

当声明式事务不够灵活时（如需要在循环中控制事务粒度），使用编程式事务：

```java
@Autowired
private TransactionTemplate transactionTemplate;

@Autowired
private PlatformTransactionManager txManager;

public void method() {
    // 方式1：TransactionTemplate（推荐，简洁）
    transactionTemplate.execute(status -> {
        try {
            dao.insert(record1);
            dao.update(record2);
            return true;
        } catch (Exception e) {
            status.setRollbackOnly(); // 手动标记回滚
            return false;
        }
    });

    // 方式2：PlatformTransactionManager（更底层，更灵活）
    DefaultTransactionDefinition def = new DefaultTransactionDefinition();
    def.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    TransactionStatus status = txManager.getTransaction(def);
    try {
        dao.insert(record);
        txManager.commit(status);
    } catch (Exception e) {
        txManager.rollback(status);
    }
}

```

| 方式 | 优点 | 缺点 | 适用场景 |
| --- | --- | --- | --- |
| 声明式 `@Transactional` | 无侵入，简洁 | 粒度粗，失效场景多 | 大部分业务方法 |
| `TransactionTemplate` | 灵活，可控粒度 | 侵入业务代码 | 循环中的事务、条件回滚 |
| `PlatformTransactionManager` | 完全控制 | 代码量大 | 框架级封装 |

### 3.4 生产踩坑经验

**坑1：REQUIRED 传播行为下 catch 内层异常导致 UnexpectedRollbackException**

```java
@Transactional
public void outer() {
    try {
        innerService.inner(); // REQUIRED，同一事务
    } catch (Exception e) {
        // 以为 catch 住了就没事
        log.error("inner failed", e);
    }
    dao.update(something); // 这里还能执行
    // 但 commit 时会抛 UnexpectedRollbackException！
    // 因为 inner() 的异常已经把事务标记为 rollback-only
}

```

**根本原因**：REQUIRED 下内外是同一个事务，inner() 抛异常时 `TransactionInterceptor` 已经调用 `txInfo.getTransactionStatus().setRollbackOnly()`。外层 catch 后继续执行，commit 时发现 rollback-only 标记，抛 `UnexpectedRollbackException`。

**解决**：内层方法使用 `REQUIRES_NEW` 或 `NESTED`。

**坑2：长事务导致连接池耗尽**

```java
@Transactional
public void importData() {
    List<Record> records = readHugeFile(); // 读文件不需要事务，但占着连接
    for (Record r : records) {
        dao.insert(r); // 大批量插入
    }
    // 整个方法执行期间一直占着数据库连接
}

// 优化：缩小事务范围
public void importData() {
    List<Record> records = readHugeFile(); // 不在事务中
    Lists.partition(records, 500).forEach(batch -> {
        transactionTemplate.execute(status -> {
            dao.batchInsert(batch);
            return null;
        });
    });
}

```

**坑3：readOnly 事务的误用**

`@Transactional(readOnly = true)` 并不是说不能执行写操作，而是给数据库/JDBC 驱动一个提示（可能开启只读优化，如 MySQL 的 `SET TRANSACTION READ ONLY`），某些数据库/驱动下写操作依然能成功。不要依赖它做写入保护。

### 3.5 面试追问点

> **Q1：NESTED 和 REQUIRES_NEW 有什么区别？什么场景用 NESTED？**

REQUIRES_NEW 是真正的独立事务（不同的数据库连接），外层回滚不影响内层已提交的数据。NESTED 使用 Savepoint 在同一个物理事务和同一个数据库连接内模拟子事务，外层回滚会连内层一起回滚，但内层回滚只回退到 Savepoint，不影响外层。NESTED 适合批量处理：处理 100 条数据，每条是一个 NESTED 子事务，某条失败回滚到 Savepoint，不影响其他条和外层事务。此外 NESTED 不会多占数据库连接，性能更优。

> **Q2：@Transactional 注解的事务和数据库的事务是什么关系？**

@Transactional 最终对应一个 JDBC Connection 的 `setAutoCommit(false)` → SQL 操作 → `commit()` / `rollback()`。Spring 事务本质是对 JDBC 事务的封装。`DataSourceTransactionManager.doBegin()` 源码中可以看到：`con.setAutoCommit(false)`。多个 `@Transactional` 方法的传播行为决定了它们共享还是独立使用 JDBC Connection。

> **Q3：Spring 事务的隔离级别是什么？和数据库隔离级别什么关系？**

@Transactional 的 `isolation` 属性最终通过 `Connection.setTransactionIsolation()` 设置到数据库连接。如果不设置（DEFAULT），使用数据库默认隔离级别（MySQL 是 REPEATABLE_READ，Oracle 是 READ_COMMITTED）。Spring 本身不实现隔离，只是透传给数据库。

---

## 4. Spring Boot 自动装配

### 4.1 自动装配原理 — 源码级解析

**启动入口调用链**：

```
@SpringBootApplication
  ├── @SpringBootConfiguration  → 本质是 @Configuration
  ├── @ComponentScan            → 扫描当前包及子包
  └── @EnableAutoConfiguration
        └── @Import(AutoConfigurationImportSelector.class)
              └── selectImports() → getAutoConfigurationEntry()
                    └── getCandidateConfigurations()
                          └── SpringFactoriesLoader.loadFactoryNames()
                                └── 读取 META-INF/spring.factories
                                    （2.7+: META-INF/spring/...AutoConfiguration.imports）

```

**核心源码**：

```java
// AutoConfigurationImportSelector.java
protected AutoConfigurationEntry getAutoConfigurationEntry(AnnotationMetadata metadata) {
    // 1. 从 spring.factories 加载所有自动配置类全限定名
    List<String> configurations = getCandidateConfigurations(metadata, attributes);
    // Spring Boot 2.7+: 同时读取 META-INF/spring/...AutoConfiguration.imports

    // 2. 去重
    configurations = removeDuplicates(configurations);

    // 3. 获取排除项（@SpringBootApplication(exclude = {...})）
    Set<String> exclusions = getExclusions(metadata, attributes);
    configurations.removeAll(exclusions);

    // 4. 条件过滤！核心步骤 — 通过 @Conditional 注解过滤
    configurations = getConfigurationClassFilter().filter(configurations);

    // 5. 触发 AutoConfigurationImportEvent
    fireAutoConfigurationImportEvents(configurations, exclusions);

    return new AutoConfigurationEntry(configurations, exclusions);
}

```

**spring.factories 文件示例**（Spring Boot 2.6 及之前）：

```properties
# META-INF/spring.factories
org.springframework.boot.autoconfigure.EnableAutoConfiguration=\
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration,\
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration,\
org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration

```

**Spring Boot 2.7+ / 3.x 新格式**：

```
# 文件路径：META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
# 每行一个全限定类名，无需 key=value 格式
org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
org.springframework.boot.autoconfigure.web.servlet.WebMvcAutoConfiguration

```

### 4.2 条件装配注解体系

所有 `@ConditionalOn*` 注解的底层都是 `@Conditional(XxxCondition.class)`，由 `Condition` 接口的 `matches()` 方法判断是否满足条件。

| 注解 | 作用 | 典型用途 |
| --- | --- | --- |
| `@ConditionalOnClass` | classpath 中存在指定类 | 引入了相关 jar 才启用 |
| `@ConditionalOnMissingClass` | classpath 中不存在指定类 | 排斥性配置 |
| `@ConditionalOnBean` | 容器中已有指定 Bean | 依赖其他配置类的 Bean |
| `@ConditionalOnMissingBean` | 容器中没有指定 Bean | 允许用户自定义覆盖 |
| `@ConditionalOnProperty` | 配置属性满足条件 | 功能开关 |
| `@ConditionalOnWebApplication` | 当前是 Web 应用 | Web 相关配置 |
| `@ConditionalOnExpression` | SpEL 表达式为 true | 复杂条件组合 |

**经典示例：DataSourceAutoConfiguration**

```java
@AutoConfiguration
@ConditionalOnClass({ DataSource.class, EmbeddedDatabaseType.class })
@ConditionalOnMissingBean(type = "io.r2dbc.spi.ConnectionFactory")
@EnableConfigurationProperties(DataSourceProperties.class)
@Import({ DataSourcePoolMetadataProvidersConfiguration.class,
          DataSourceCheckpointRestoreConfiguration.class })
public class DataSourceAutoConfiguration {

    @Configuration
    @Conditional(PooledDataSourceCondition.class)
    @ConditionalOnMissingBean({ DataSource.class, XADataSource.class })
    @Import({ DataSourceConfiguration.Hikari.class,
              DataSourceConfiguration.Tomcat.class, ... })
    protected static class PooledDataSourceConfiguration { }
}

```

这里体现了自动装配的核心哲学：

1. `@ConditionalOnClass(DataSource.class)` — classpath 有 JDBC 依赖才生效
2. `@ConditionalOnMissingBean(DataSource.class)` — 用户没有自定义 DataSource 才创建默认的
3. 默认创建 Hikari 连接池（因为 Spring Boot 默认引入了 HikariCP）

### 4.3 自定义 Starter 实践

标准的 Starter 目录结构：

```
my-starter/
├── my-starter-autoconfigure/
│   ├── src/main/java/
│   │   └── com.example.autoconfigure/
│   │       ├── MyServiceAutoConfiguration.java
│   │       └── MyServiceProperties.java
│   └── src/main/resources/
│       └── META-INF/
│           └── spring/
│               └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
└── my-starter/  (空模块，只有 pom 依赖 autoconfigure + 业务 SDK)
    └── pom.xml

```

```java
// 配置属性类
@ConfigurationProperties(prefix = "my.service")
public class MyServiceProperties {
    private String endpoint = "http://localhost:8080";
    private int timeout = 3000;
    private boolean enabled = true;
    // getters / setters
}

// 自动配置类
@AutoConfiguration
@ConditionalOnClass(MyClient.class)
@ConditionalOnProperty(prefix = "my.service", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(MyServiceProperties.class)
public class MyServiceAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean // 用户自定义 Bean 优先
    public MyClient myClient(MyServiceProperties props) {
        return new MyClient(props.getEndpoint(), props.getTimeout());
    }
}

```

```
# META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.example.autoconfigure.MyServiceAutoConfiguration

```

### 4.4 生产踩坑经验

**坑1：自动配置类加载顺序导致 Bean 覆盖失败**

```java
// 你以为自定义的 DataSource 会覆盖自动配置，但时序问题导致没覆盖
// 解决：使用 @AutoConfigureBefore / @AutoConfigureAfter 控制顺序
@AutoConfiguration(before = DataSourceAutoConfiguration.class)
public class MyDataSourceConfig { ... }

```

**坑2：@ConditionalOnMissingBean 的判断时机问题**

`@ConditionalOnMissingBean` 判断的是"此刻容器中有没有"，所以自动配置类的加载顺序很重要。用户自定义的 `@Configuration` 通常先于自动配置类加载（`@ComponentScan` 先执行），所以 `@ConditionalOnMissingBean` 能正确让用户覆盖。但如果是另一个自动配置类中定义的 Bean，就需要注意 `@AutoConfigureOrder` 和 `@AutoConfigureAfter`。

**坑3：属性配置没有生效的排查思路**

1. 检查 `@ConfigurationProperties` 的 prefix 是否正确
2. 检查是否有 `@EnableConfigurationProperties` 或 `@ConfigurationPropertiesScan`
3. 检查 `application.yml` 缩进是否正确（常见低级错误）
4. 使用 `@Value("${my.service.endpoint}")` 测试属性是否能正常读取

### 4.5 面试追问点

> **Q1：Spring Boot 启动时扫描了多少个自动配置类？都会生效吗？**

Spring Boot 2.7 注册了约 140+ 个自动配置类候选项，但经过 `@Conditional` 过滤后，通常只有 20-30 个真正生效。可以通过 `--debug` 启动参数查看 `CONDITIONS EVALUATION REPORT`，分为 Positive matches（生效的）和 Negative matches（未生效的及原因）。

> **Q2：spring.factories 为什么在 2.7+ 被替换？新方案有什么优势？**

旧方案把所有 SPI 扩展点（AutoConfiguration、ApplicationListener、FailureAnalyzer 等）都放在一个 `spring.factories` 文件中，混杂在一起，类型安全差，加载时需要全部读入再按 key 分类。新方案按扩展点类型拆分为独立文件，文件名就是接口全限定名，一目了然。同时对 GraalVM AOT 编译更友好，能更好地做静态分析和死代码裁剪。

> **Q3：如何调试某个自动配置类为什么没生效？**

1. 启动参数加 `--debug`，查看 ConditionEvaluationReport
2. `ConditionEvaluationReportLoggingListener` 会打印 Positive/Negative matches
3. 配置文件中：`logging.level.org.springframework.boot.autoconfigure=DEBUG`
4. 也可以通过 Actuator 端点 `/actuator/conditions` 查看（需引入 actuator 依赖）

---

## 5. Spring MVC 请求处理流程

### 5.1 DispatcherServlet 全链路 — 原理详解

`DispatcherServlet` 是 Spring MVC 的核心前端控制器（Front Controller），所有请求都经过它。核心处理方法是 `doDispatch()`：

```java
// DispatcherServlet.doDispatch() 简化版
protected void doDispatch(HttpServletRequest request, HttpServletResponse response) {
    HttpServletRequest processedRequest = request;
    HandlerExecutionChain mappedHandler = null;
    ModelAndView mv = null;

    // 1. 查找 Handler（Controller 方法）
    mappedHandler = getHandler(processedRequest);
    if (mappedHandler == null) {
        noHandlerFound(processedRequest, response);
        return;
    }

    // 2. 查找 HandlerAdapter（适配器模式）
    HandlerAdapter ha = getHandlerAdapter(mappedHandler.getHandler());

    // 3. 执行拦截器的 preHandle
    if (!mappedHandler.applyPreHandle(processedRequest, response)) {
        return; // 拦截器拒绝，直接返回
    }

    // 4. 实际调用 Controller 方法（参数解析、方法执行、返回值处理）
    mv = ha.handle(processedRequest, response, mappedHandler.getHandler());

    // 5. 执行拦截器的 postHandle
    mappedHandler.applyPostHandle(processedRequest, response, mv);

    // 6. 视图解析和渲染（如果有 ModelAndView）
    processDispatchResult(processedRequest, response, mappedHandler, mv, dispatchException);
    // 内部调用 render() → ViewResolver.resolveViewName() → View.render()
}

```

**完整请求流程图**：

```
客户端请求
  → Servlet 容器（Tomcat）
    → Filter Chain（过滤器链，如 CharacterEncodingFilter）
      → DispatcherServlet.service()
        → doDispatch()
          → HandlerMapping.getHandler()        // 查找处理器
            → HandlerExecutionChain            // 处理器 + 拦截器列表
          → HandlerAdapter.handle()            // 适配调用
            → 参数解析（ArgumentResolver）
            → 方法调用（反射）
            → 返回值处理（ReturnValueHandler）
              → HttpMessageConverter（@ResponseBody 时）
          → ViewResolver → View.render()       // 非 @ResponseBody 时
        → 响应返回

```

**HandlerMapping 的查找过程**：

`getHandler()` 遍历所有注册的 `HandlerMapping`（按 Order 排序），找到第一个匹配的：

- `RequestMappingHandlerMapping`：处理 `@RequestMapping` / `@GetMapping` 等注解（最常用）
- `BeanNameUrlHandlerMapping`：通过 Bean 名称匹配 URL（传统方式）
- `RouterFunctionMapping`：函数式端点（WebFlux 风格）

**HandlerAdapter 的作用**（适配器模式）：

不同类型的 Handler 有不同的调用方式，HandlerAdapter 统一了调用入口：

- `RequestMappingHandlerAdapter`：调用 `@Controller` 标注的方法，处理参数解析和返回值
- `HttpRequestHandlerAdapter`：调用 `HttpRequestHandler` 实现类
- `SimpleControllerHandlerAdapter`：调用 `Controller` 接口实现类

### 5.2 参数解析器 HandlerMethodArgumentResolver

当 `RequestMappingHandlerAdapter` 调用 Controller 方法时，需要把 HTTP 请求数据转换为方法参数。这由 `HandlerMethodArgumentResolver` 体系完成：

```java
public interface HandlerMethodArgumentResolver {
    // 该解析器是否支持此参数类型
    boolean supportsParameter(MethodParameter parameter);
    // 从请求中解析参数值
    Object resolveArgument(MethodParameter parameter,
                           ModelAndViewContainer mavContainer,
                           NativeWebRequest webRequest,
                           WebDataBinderFactory binderFactory);
}

```

| 参数注解 | 解析器 | 数据来源 |
| --- | --- | --- |
| `@RequestParam` | `RequestParamMethodArgumentResolver` | URL query 参数 |
| `@PathVariable` | `PathVariableMethodArgumentResolver` | URL 路径变量 |
| `@RequestBody` | `RequestResponseBodyMethodProcessor` | 请求体（JSON/XML） |
| `@RequestHeader` | `RequestHeaderMethodArgumentResolver` | 请求头 |
| `@CookieValue` | `ServletCookieValueMethodArgumentResolver` | Cookie |
| 无注解的 POJO | `ServletModelAttributeMethodProcessor` | query + form 数据绑定 |
| `HttpServletRequest` | `ServletRequestMethodArgumentResolver` | 原始请求对象 |

### 5.3 消息转换器 HttpMessageConverter

`@RequestBody` 和 `@ResponseBody` 的数据序列化/反序列化由 `HttpMessageConverter` 完成：

```java
public interface HttpMessageConverter<T> {
    boolean canRead(Class<?> clazz, MediaType mediaType);   // 能否反序列化
    boolean canWrite(Class<?> clazz, MediaType mediaType);  // 能否序列化
    T read(Class<? extends T> clazz, HttpInputMessage inputMessage);       // 请求体 → 对象
    void write(T t, MediaType contentType, HttpOutputMessage outputMessage); // 对象 → 响应体
}

```

常用实现及优先级：

1. `ByteArrayHttpMessageConverter`：byte[] 类型
2. `StringHttpMessageConverter`：String 类型
3. `MappingJackson2HttpMessageConverter`：JSON ↔ Object（Jackson 库）
4. `MappingJackson2XmlHttpMessageConverter`：XML ↔ Object（需额外引入 jackson-dataformat-xml）

**选择逻辑**：请求时根据 `Content-Type` 找能 read 的 Converter；响应时根据 `Accept` 头（内容协商）找能 write 的 Converter。

### 5.4 生产踩坑经验

**坑1：@ResponseBody 返回 String 乱码**

`StringHttpMessageConverter` 默认编码是 `ISO-8859-1`（不是 UTF-8），在优先级上又高于 Jackson Converter。

```java
// 解决方案：配置 StringHttpMessageConverter
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        StringHttpMessageConverter converter =
            new StringHttpMessageConverter(StandardCharsets.UTF_8);
        converters.add(0, converter); // 优先级最高
    }
}

```

**坑2：拦截器 vs 过滤器 vs @ControllerAdvice 执行顺序混淆**

```
Filter.doFilter() (前)
  → DispatcherServlet.doDispatch()
    → HandlerInterceptor.preHandle()
      → Controller 方法执行
      → （如果有异常）@ExceptionHandler / @ControllerAdvice 处理
    → HandlerInterceptor.postHandle()（异常时不执行）
    → HandlerInterceptor.afterCompletion()（总是执行）
  → DispatcherServlet 完成
Filter.doFilter() (后)

```

Filter 在 Servlet 容器层面，Interceptor 在 Spring MVC 层面。`@ControllerAdvice` 的异常处理在 Controller 和 postHandle 之间。注意：如果 Controller 抛异常，`postHandle` 不会执行，但 `afterCompletion` 会执行。

**坑3：POST 请求参数被 POJO 和 @RequestParam 同时接收**

```java
// 如果请求是 POST form 表单，name 参数可能被绑定两次
@PostMapping("/save")
public void save(User user, @RequestParam String name) {
    // user.name 和 name 参数都会接收到值
    // 注意区分数据来源，避免混淆
}

```

### 5.5 面试追问点

> **Q1：@Controller 和 @RestController 有什么区别？底层是怎么区分的？**

`@RestController` = `@Controller` + `@ResponseBody`。区别在返回值处理阶段：`RequestMappingHandlerAdapter` 调用完 Controller 方法后，由 `HandlerMethodReturnValueHandler` 处理返回值。如果方法或类上有 `@ResponseBody`，使用 `RequestResponseBodyMethodProcessor`，通过 `HttpMessageConverter` 将返回对象写入响应体；否则将返回的 String 当作视图名交给 `ViewResolver` 解析。

> **Q2：Spring MVC 是如何匹配到具体的 Controller 方法的？**

`RequestMappingHandlerMapping` 在 Spring 容器启动时扫描所有 `@Controller` Bean，解析每个方法上的 `@RequestMapping` 注解，将 URL 模式、HTTP Method、params、headers、consumes、produces 等条件封装为 `RequestMappingInfo` 并注册到 `MappingRegistry`（一个内部的 Map）。请求到来时，通过 URL 路径快速匹配（使用 PathPattern 或 AntPathMatcher），然后逐条件精确过滤，找到唯一匹配的 `HandlerMethod`。

> **Q3：如何自定义参数解析器？应用场景是什么？**

实现 `HandlerMethodArgumentResolver` 接口，通过 `WebMvcConfigurer.addArgumentResolvers()` 注册。典型场景：自定义 `@CurrentUser` 注解，从 JWT Token 或 Session 中解析当前登录用户信息并注入到 Controller 方法参数，避免每个接口都重复编写解析逻辑。

---

## 6. Spring Cloud 微服务

### 6.1 Gateway 网关 — 原理详解

Spring Cloud Gateway 基于 **WebFlux + Netty**（非阻塞响应式），是 Spring Cloud 生态的标准 API 网关，取代了 Netflix Zuul。核心三要素：

- **Route（路由）**：一组路由规则 = 断言（Predicate）+ 过滤器（Filter）+ 目标 URI
- **Predicate（断言）**：匹配条件（Path、Host、Method、Header、Query、Cookie、时间等）
- **Filter（过滤器）**：请求/响应的前后处理（鉴权、限流、日志、改写头等）

```yaml
spring:
  cloud:
    gateway:
      routes:
        - id: order-service
          uri: lb://order-service   # lb:// 表示使用负载均衡
          predicates:
            - Path=/api/order/**
            - Method=GET,POST
          filters:
            - StripPrefix=1          # 去掉第一段路径前缀
            - AddRequestHeader=X-Request-Source, gateway
            - name: RequestRateLimiter # 限流过滤器
              args:
                redis-rate-limiter.replenishRate: 100  # 每秒填充令牌数
                redis-rate-limiter.burstCapacity: 200  # 令牌桶容量

```

**请求处理流程**：

```
Client Request
  → Netty HttpServer（接收连接）
    → HttpWebHandlerAdapter
      → DispatcherHandler（WebFlux 的核心处理器）
        → RoutePredicateHandlerMapping（匹配路由断言）
          → 找到匹配的 Route
        → FilteringWebHandler（构建过滤器链）
          → GlobalFilter 链 + GatewayFilter 链（按 Order 排序）
            → ... 各种过滤器执行 ...
            → NettyRoutingFilter / WebClientRoutingFilter（最终转发请求到下游）
          → 响应回传，反向经过过滤器链

```

**Gateway 集成 Sentinel 限流**：

```java
@PostConstruct
public void initGatewayRules() {
    Set<GatewayFlowRule> rules = new HashSet<>();
    rules.add(new GatewayFlowRule("order-service")
        .setCount(100)               // QPS 阈值
        .setIntervalSec(1)            // 时间窗口（秒）
        .setControlBehavior(RuleConstant.CONTROL_BEHAVIOR_DEFAULT) // 直接拒绝
        .setParamItem(new GatewayParamFlowItem()
            .setParseStrategy(SentinelGatewayConstants.PARAM_PARSE_STRATEGY_URL_PARAM)
            .setFieldName("userId"))  // 按 userId 维度的热点限流
    );
    GatewayRuleManager.loadRules(rules);
}

```

### 6.2 Feign 远程调用 — 原理详解

Feign 是一个声明式 HTTP 客户端，核心原理是**JDK 动态代理 + 编解码器 + 负载均衡 + 熔断**。

```java
@FeignClient(name = "user-service", fallbackFactory = UserFeignFallbackFactory.class)
public interface UserFeignClient {
    @GetMapping("/api/users/{id}")
    UserDTO getUser(@PathVariable("id") Long id);
}

```

**底层调用链路**：

```
UserFeignClient.getUser(1L)                 // 接口方法调用
  → ReflectiveFeign.FeignInvocationHandler   // JDK 动态代理的 InvocationHandler
    → SynchronousMethodHandler.invoke()       // 方法级处理器
      → RequestTemplate 构造请求              // 解析 @GetMapping、@PathVariable 等注解
        → Encoder 编码请求体（如果有 @RequestBody）
          → RequestInterceptor 链            // 添加公共 Header、Token 等
            → LoadBalancerFeignClient         // 负载均衡（替换服务名为真实 IP:Port）
              → Spring Cloud LoadBalancer
                → 选择实例（轮询 / 随机 / 权重）
                  → Client.execute()           // 发送 HTTP 请求
                    → Decoder 解码响应体       // JSON → UserDTO
                      → 返回结果
        ← 异常时 → ErrorDecoder 处理          // 可自定义错误处理
          ← 或 fallback 降级

```

**Feign 集成组件生态**：

| 组件 | 作用 | 状态 |
| --- | --- | --- |
| Ribbon | 客户端负载均衡 | 已维护模式，被 Spring Cloud LoadBalancer 替代 |
| Spring Cloud LoadBalancer | 新一代负载均衡 | 默认轮询，可自定义 `ReactorLoadBalancer` |
| Hystrix | 熔断降级 | 已维护模式，被 Resilience4j / Sentinel 替代 |
| Sentinel | 熔断降级 + 限流 | 推荐，阿里生态 |
| OkHttp / Apache HttpClient | HTTP 客户端替换 | 替代默认的 HttpURLConnection，支持连接池 |

### 6.3 熔断器状态机 — Resilience4j / Sentinel

熔断器核心是一个**有限状态机**，防止级联故障：

```
        失败率 ≥ 阈值
  CLOSED ─────────────→ OPEN（快速失败，不再请求下游）
     ↑                     │
     │                     │ 等待超时时间（waitDurationInOpenState）
     │   成功率 ≥ 阈值      ↓
     └──────────────── HALF_OPEN（放行少量探测请求）
                           │
                           │ 失败率仍高
                           └──→ OPEN（重新熔断）

```

**Resilience4j 配置示例**：

```java
CircuitBreakerConfig config = CircuitBreakerConfig.custom()
    .slidingWindowType(SlidingWindowType.COUNT_BASED) // 基于计数的滑动窗口
    .slidingWindowSize(100)           // 窗口大小：最近 100 次请求
    .minimumNumberOfCalls(20)         // 最少 20 次调用才开始计算失败率
    .failureRateThreshold(50)         // 失败率 50% 触发 OPEN
    .slowCallRateThreshold(80)        // 慢调用率 80% 也触发 OPEN
    .slowCallDurationThreshold(Duration.ofSeconds(2)) // 超过 2s 算慢调用
    .waitDurationInOpenState(Duration.ofSeconds(30))  // OPEN 持续 30s 后转 HALF_OPEN
    .permittedNumberOfCallsInHalfOpenState(10)        // HALF_OPEN 允许 10 次探测
    .build();

CircuitBreaker circuitBreaker = CircuitBreaker.of("userService", config);

// 装饰调用
Supplier<UserDTO> decorated = CircuitBreaker
    .decorateSupplier(circuitBreaker, () -> userService.getUser(1L));

Try<UserDTO> result = Try.ofSupplier(decorated)
    .recover(throwable -> fallbackUser()); // 降级

```

**Sentinel 与 Resilience4j 对比**：

| 维度 | Sentinel | Resilience4j |
| --- | --- | --- |
| **定位** | 流量治理全家桶（限流+熔断+热点+系统自适应保护） | 轻量级容错库（熔断+重试+限流+隔离） |
| **滑动窗口** | LeapArray（高性能环形数组，精确到秒级） | Ring Bit Buffer（位级别，内存效率高） |
| **规则管理** | Dashboard 动态推送（支持 Nacos/Apollo/ZK） | 代码或配置文件，静态为主 |
| **限流算法** | 滑动窗口计数/令牌桶/漏桶/排队等待 | 内置 RateLimiter（基于信号量） |
| **生态集成** | 深度集成 Spring Cloud/Dubbo/gRPC | 原生支持 Spring Boot Actuator |
| **适用场景** | 大规模微服务集群（阿里双11验证） | 中小规模/追求轻量/Spring 原生生态 |

### 6.4 生产踩坑经验

**坑1：Feign 默认不传递请求头（Token/TraceId 丢失）**

```java
// 用户请求带了 Authorization 头，Feign 调用下游时丢失了
// 解决：自定义 RequestInterceptor
@Configuration
public class FeignConfig {
    @Bean
    public RequestInterceptor requestInterceptor() {
        return template -> {
            ServletRequestAttributes attrs = (ServletRequestAttributes)
                RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                template.header("Authorization",
                    request.getHeader("Authorization"));
                // 同时传递链路追踪 ID
                template.header("X-Trace-Id",
                    request.getHeader("X-Trace-Id"));
            }
        };
    }
}

```

**坑2：Feign 异步/多线程调用时 RequestContextHolder 丢失**

```java
// 子线程中 RequestContextHolder 是 ThreadLocal，取不到请求上下文
RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
CompletableFuture.supplyAsync(() -> {
    RequestContextHolder.setRequestAttributes(attrs); // 手动设置到子线程
    try {
        return userFeignClient.getUser(1L);
    } finally {
        RequestContextHolder.resetRequestAttributes(); // 清理防止内存泄漏
    }
}, executor);

```

**坑3：Gateway 与 spring-boot-starter-web 不兼容**

Spring Cloud Gateway 基于 WebFlux（Reactor + Netty），不能与 `spring-boot-starter-web`（基于 Servlet + Tomcat）共存。如果网关工程误引入了 web starter，会导致启动报错或路由失效。

```xml
<!-- 网关工程的 pom.xml 中排除 web -->
<dependency>
    <groupId>org.springframework.cloud</groupId>
    <artifactId>spring-cloud-starter-gateway</artifactId>
</dependency>
<!-- 千万不要引入 spring-boot-starter-web -->

```

**坑4：Feign 超时配置的层次**

```yaml
# Feign 有多层超时配置，优先级从高到低：
# 1. Feign 自身配置（最高优先级）
feign:
  client:
    config:
      user-service:          # 针对特定服务
        connectTimeout: 3000
        readTimeout: 5000
      default:               # 全局默认
        connectTimeout: 5000
        readTimeout: 10000

# 2. Ribbon 配置（如果还在用 Ribbon）
user-service:
  ribbon:
    ConnectTimeout: 3000
    ReadTimeout: 5000

```

### 6.5 面试追问点

> **Q1：Spring Cloud Gateway 为什么选择 WebFlux 而不是 Servlet？**

网关是所有请求的入口，并发量极高且主要是 IO 转发操作。Servlet 模型一请求一线程，高并发时线程数暴增（如 10000 并发需要 10000 线程），上下文切换开销巨大。WebFlux 基于 Reactor 响应式编程 + Netty 的 EventLoop 模型，少量线程（通常 CPU 核心数 × 2）即可处理大量并发连接。网关作为 IO 密集型应用，非阻塞模型的吞吐量优势可达数倍。

> **Q2：Feign 和 RestTemplate 有什么区别？为什么推荐 Feign？**

RestTemplate 是命令式 HTTP 客户端，需要手写 URL 拼接、请求体构造、响应解析、异常处理。Feign 是声明式的，定义接口 + 注解即可，像调用本地方法一样调用远程服务。Feign 天然集成负载均衡、熔断、重试、请求拦截。接口定义既是 API 文档，也可以通过共享接口模块实现调用方和提供方的契约约束。

> **Q3：熔断器 HALF_OPEN 状态是怎么实现的？如果探测请求正好碰到下游个别超时怎么办？**

HALF_OPEN 状态放行 `permittedNumberOfCallsInHalfOpenState`（如 10）个请求进行探测。这些请求的成功率如果达到 `failureRateThreshold`（如 50%）以下就关闭熔断器（CLOSED），否则重新打开（OPEN）。单个请求的偶然超时不会直接影响决策，因为是按整体成功率/失败率统计的。但如果探测数量设置太小（如 1-2 个），单个请求的偶然失败确实可能导致误判，因此建议设置合理的探测数量（如 5-10）。

---

## 7. Spring Security / OAuth2

### 7.1 认证流程 — SecurityFilterChain 详解

Spring Security 的核心是一条**过滤器链（SecurityFilterChain）**。请求经过层层过滤器，完成认证和授权。一个典型链包含 15+ 个过滤器：

```
请求进入
  → SecurityContextPersistenceFilter    // 从 Session/Token 恢复 SecurityContext
    → HeaderWriterFilter                 // 添加安全响应头（X-Frame-Options 等）
      → CsrfFilter                      // CSRF 防护
        → LogoutFilter                   // 处理登出请求
          → UsernamePasswordAuthenticationFilter  // 表单登录认证
            → BasicAuthenticationFilter           // HTTP Basic 认证
              → BearerTokenAuthenticationFilter   // OAuth2 / JWT 认证
                → RequestCacheAwareFilter         // 恢复缓存的请求
                  → AnonymousAuthenticationFilter  // 未认证用户赋予匿名身份
                    → ExceptionTranslationFilter   // 异常翻译（401/403 响应）
                      → AuthorizationFilter        // 鉴权（最终的访问控制决策）
                        → Controller（目标资源）

```

**核心认证流程（以表单登录为例）**：

```java
// UsernamePasswordAuthenticationFilter.attemptAuthentication()
public Authentication attemptAuthentication(HttpServletRequest request, ...) {
    String username = obtainUsername(request);
    String password = obtainPassword(request);
    // 1. 构建未认证的 Token
    UsernamePasswordAuthenticationToken authRequest =
        UsernamePasswordAuthenticationToken.unauthenticated(username, password);
    // 2. 委托给 AuthenticationManager 认证
    return this.getAuthenticationManager().authenticate(authRequest);
}

// AuthenticationManager 的默认实现是 ProviderManager
// ProviderManager.authenticate() 遍历所有 AuthenticationProvider
//   → DaoAuthenticationProvider.authenticate()
//     → UserDetailsService.loadUserByUsername(username) // 开发者实现
//     → PasswordEncoder.matches(rawPassword, encodedPassword) // 密码校验
//     → 认证成功：返回已认证的 UsernamePasswordAuthenticationToken
//     → SecurityContextHolder.getContext().setAuthentication(authToken)

```

**Spring Security 6.x / Spring Boot 3.x 配置方式**（Lambda DSL）：

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // 前后端分离通常禁用 CSRF
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/public/**", "/api/auth/**").permitAll()
                .requestMatchers("/api/admin/**").hasRole("ADMIN")
                .requestMatchers("/api/user/**").hasAnyRole("USER", "ADMIN")
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(oauth2 ->
                oauth2.jwt(jwt -> jwt.decoder(jwtDecoder()))
            )
            // 添加自定义 JWT 过滤器（如果不用 oauth2ResourceServer）
            // .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
            ;
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(); // 推荐，自带盐值
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withPublicKey(rsaPublicKey).build();
    }
}

```

### 7.2 JWT Token 机制

JWT（JSON Web Token）由三部分组成，用 `.` 分隔：`Header.Payload.Signature`

```
eyJhbGciOiJSUzI1NiJ9                     ← Header (Base64URL)
.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNjk...  ← Payload (Base64URL)
.tL8k9OxQn7C_Ff3RM1...                   ← Signature (RSA/HMAC 签名)

```

- **Header**：签名算法（HS256/RS256）和类型（JWT）
- **Payload**：声明（Claims），包括 sub（主题）、exp（过期时间）、iat（签发时间）、自定义字段
- **Signature**：对 Header + Payload 的签名，防篡改

**JWT 生成与验证**：

```java
// 使用 Spring Security 的 JwtEncoder 生成 JWT
@Service
public class TokenService {
    @Autowired
    private JwtEncoder jwtEncoder;

    public String generateToken(UserDetails user) {
        Instant now = Instant.now();
        String roles = user.getAuthorities().stream()
            .map(GrantedAuthority::getAuthority)
            .collect(Collectors.joining(","));

        JwtClaimsSet claims = JwtClaimsSet.builder()
            .issuer("my-app")
            .issuedAt(now)
            .expiresAt(now.plus(2, ChronoUnit.HOURS))
            .subject(user.getUsername())
            .claim("roles", roles)
            .claim("userId", getUserId(user))
            .build();

        return jwtEncoder.encode(JwtEncoderParameters.from(claims))
            .getTokenValue();
    }
}

// 验证流程（Spring Security 自动处理）：
// 请求头 Authorization: Bearer <token>
// → BearerTokenAuthenticationFilter 提取 token
//   → JwtAuthenticationProvider.authenticate()
//     → JwtDecoder.decode(token)
//       → 验证签名（RSA/HMAC）
//       → 检查过期时间 exp
//       → 检查签发者 issuer 等
//     → 构建 JwtAuthenticationToken 放入 SecurityContext

```

**Token 续期方案对比**：

| 方案 | 优点 | 缺点 | 适用场景 |
| --- | --- | --- | --- |
| 单 Token + 短过期（30分钟） | 简单安全 | 频繁重新登录，体验差 | 高安全要求（银行系统） |
| 单 Token + 长过期（7天） | 体验好 | Token 泄露风险窗口大 | 不推荐 |
| **双 Token（Access + Refresh）** | 兼顾安全和体验 | 实现复杂，需存储 Refresh Token | **推荐，大多数场景** |
| 滑动过期（活跃时自动续期） | 活跃用户无感 | 实现需要前后端配合 | 管理后台等内部系统 |

**双 Token 方案的核心代码**：

```java
// Access Token: 短时效（如 30 分钟），无状态，用于接口鉴权
// Refresh Token: 长时效（如 7 天），存 Redis/DB，仅用于刷新 Access Token

@PostMapping("/auth/refresh")
public TokenResponse refreshToken(@RequestBody RefreshRequest request) {
    String refreshToken = request.getRefreshToken();

    // 1. 从 Redis 查找 Refresh Token
    String key = "refresh_token:" + refreshToken;
    String username = redisTemplate.opsForValue().get(key);
    if (username == null) {
        throw new InvalidTokenException("Refresh token invalid or expired");
    }

    // 2. 生成新的 Access Token
    UserDetails user = userDetailsService.loadUserByUsername(username);
    String newAccessToken = tokenService.generateToken(user);

    // 3. Refresh Token Rotation（安全最佳实践：每次刷新也换新的 Refresh Token）
    redisTemplate.delete(key); // 旧 Refresh Token 失效
    String newRefreshToken = UUID.randomUUID().toString();
    redisTemplate.opsForValue().set(
        "refresh_token:" + newRefreshToken, username,
        7, TimeUnit.DAYS
    );

    return new TokenResponse(newAccessToken, newRefreshToken);
}

```

### 7.3 OAuth2 四种授权模式

| 授权模式 | 适用场景 | 安全性 | 是否传递用户密码给客户端 |
| --- | --- | --- | --- |
| **授权码模式**（Authorization Code） | Web 应用服务端（最推荐） | ★★★★★ | 否 |
| **PKCE 授权码模式**（Code + PKCE） | SPA / 移动端（无法安全存 secret） | ★★★★★ | 否 |
| **客户端凭证模式**（Client Credentials） | 服务间 M2M 调用 | ★★★★ | 不涉及用户 |
| **密码模式**（Password Grant） | 已废弃，仅限高度信任的第一方应用 | ★★ | 是（直接传密码） |

**授权码模式完整流程**（面试重点）：

```
1. 用户访问客户端应用（如第三方网站）

2. 客户端重定向到授权服务器的授权端点：
   GET /oauth2/authorize
     ?response_type=code
     &client_id=my-app
     &redirect_uri=https://myapp.com/callback
     &scope=openid profile email
     &state=random_csrf_token  (随机值，防 CSRF)

3. 用户在授权服务器登录并点击"同意授权"

4. 授权服务器重定向回客户端（通过浏览器）：
   GET https://myapp.com/callback?code=AUTH_CODE_xxx&state=random_csrf_token

5. 客户端后端（服务器到服务器，不经过浏览器）用 code 换 Token：
   POST /oauth2/token
     Content-Type: application/x-www-form-urlencoded
     grant_type=authorization_code
     &code=AUTH_CODE_xxx
     &redirect_uri=https://myapp.com/callback
     &client_id=my-app
     &client_secret=my-secret

6. 授权服务器验证 code 有效且未使用过，返回：
   {
     "access_token": "eyJhbGci...",
     "token_type": "Bearer",
     "expires_in": 3600,
     "refresh_token": "dGhpcyBpcyBh...",
     "scope": "openid profile email"
   }

```

**核心安全设计：为什么先返回 code 再换 token？**

步骤 4 的重定向经过浏览器（前端通道，不安全），如果直接在 URL 中返回 Access Token，会被：

- 浏览器历史记录泄露
- Referer 头传递给其他网站
- 服务器日志记录
- 中间人攻击截获

而 Authorization Code 是一次性的、有极短有效期（通常 10 分钟），且步骤 5 的换 Token 请求需要 `client_secret`，在后端通道完成，攻击者即使截获了 code 也无法使用。

### 7.4 生产踩坑经验

**坑1：JWT 无法主动失效（用户注销/修改密码场景）**

JWT 是无状态的，一旦签发无法撤销。需要额外机制：

```java
// 方案1：Token 黑名单（Redis 实现）
public void logout(String token) {
    String jti = parseToken(token).getClaim("jti"); // JWT ID
    long ttl = getExpiration(token).getTime() - System.currentTimeMillis();
    if (ttl > 0) {
        // 将 JTI 加入黑名单，TTL 设为 token 剩余有效期
        redisTemplate.opsForValue().set("jwt:blacklist:" + jti, "1",
            ttl, TimeUnit.MILLISECONDS);
    }
}

// 验证时检查黑名单
@Component
public class JwtBlacklistValidator implements OAuth2TokenValidator<Jwt> {
    @Override
    public OAuth2TokenValidatorResult validate(Jwt jwt) {
        if (redisTemplate.hasKey("jwt:blacklist:" + jwt.getId())) {
            return OAuth2TokenValidatorResult.failure(
                new OAuth2Error("token_revoked", "Token has been revoked", null));
        }
        return OAuth2TokenValidatorResult.success();
    }
}

// 方案2：版本号机制（密码修改场景）
// 用户表增加 token_version 字段，JWT payload 含 version
// 修改密码时 version++，验证时比对 version 是否一致

```

**坑2：Spring Security 过滤器顺序导致 CORS 预检请求被拦截**

```java
// 错误表现：前端 CORS 预检请求（OPTIONS）被 Security 拦截返回 403
// 原因：CorsFilter 在 SecurityFilterChain 之后执行

// 正确方案：在 Security 配置中开启 CORS
@Bean
public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
    http.cors(cors -> cors.configurationSource(corsConfigurationSource()));
    // ...
    return http.build();
}

@Bean
public CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration config = new CorsConfiguration();
    config.setAllowedOrigins(List.of("https://myapp.com"));
    config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE"));
    config.setAllowedHeaders(List.of("*"));
    config.setAllowCredentials(true);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", config);
    return source;
}

```

**坑3：SecurityContext 在异步线程中丢失**

```java
// SecurityContext 基于 ThreadLocal，@Async 或 CompletableFuture 的子线程拿不到
// 解决方案1：使用 DelegatingSecurityContextExecutor
@Bean("securityExecutor")
public Executor taskExecutor() {
    ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
    executor.setCorePoolSize(10);
    executor.setMaxPoolSize(50);
    executor.initialize();
    return new DelegatingSecurityContextAsyncTaskExecutor(executor);
}

// 解决方案2：设置 SecurityContext 传播策略（全局生效）
@PostConstruct
public void init() {
    SecurityContextHolder.setStrategyName(
        SecurityContextHolder.MODE_INHERITABLETHREADLOCAL);
    // 注意：只对直接创建的子线程生效，线程池复用的线程不生效
}

```

**坑4：BCryptPasswordEncoder 每次编码结果不同**

```java
// BCrypt 每次加密结果不同（因为内置随机盐），这是正确的！
BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
String encoded1 = encoder.encode("password"); // $2a$10$abcd...
String encoded2 = encoder.encode("password"); // $2a$10$efgh...（不同！）
// 验证时用 matches()，它会从 encoded 中提取盐值再比对
boolean matches = encoder.matches("password", encoded1); // true

```

### 7.5 面试追问点

> **Q1：JWT 和 Session 的优缺点对比？什么场景适合用哪个？**

| 维度 | Session | JWT |
| --- | --- | --- |
| **存储位置** | 服务端（内存/Redis） | 客户端（无服务端存储） |
| **分布式扩展** | 需要集中式 Session 存储（如 Spring Session + Redis） | 天然无状态，任意节点可验证 |
| **主动失效** | 直接删除 Session 即可 | 需要额外机制（黑名单/版本号） |
| **信息携带** | 仅 Session ID，需查库获取用户信息 | 可携带用户信息（减少查库次数） |
| **网络开销** | Cookie 很小（几十字节） | JWT 通常较大（1KB+） |
| **适合场景** | 传统 Web、需要严格即时登出 | 微服务、前后端分离、移动端、跨域 |

> **Q2：OAuth2 的 state 参数有什么作用？不加会怎样？**

state 参数用于防止 **CSRF 攻击**。攻击场景：攻击者用自己的账号完成 OAuth 授权获得一个 code，构造回调 URL 诱导受害者点击。如果没有 state 验证，受害者的账号就会绑定攻击者的第三方账号。state 是客户端在授权前生成的随机值，存入 Session，回调时必须校验 state 参数与 Session 中的值一致才处理。

> **Q3：如何设计一个支持多租户的认证系统？**

核心架构设计：

1. **数据隔离**：每个租户有独立的用户库，或在同一库中以 `tenant_id` 字段区分
2. **Token 设计**：JWT 的 payload 中嵌入 `tenant_id` claim
3. **认证流程**：登录时根据域名/请求头/子路径确定租户 → 从对应租户库查用户 → 生成含 tenant_id 的 Token
4. **鉴权流程**：资源服务器从 JWT 解析 tenant_id → 注入到 `TenantContext`（ThreadLocal）→ MyBatis/JPA 拦截器自动拼接 `WHERE tenant_id = ?`
5. **Spring Authorization Server 方案**：通过自定义 `OAuth2TokenCustomizer` 在 Token 中注入租户信息，多 issuer 支持不同租户的密钥隔离

---

## 总结：Spring 生态面试知识图谱

| 主题 | 核心考点 | 大厂出现频率 |
| --- | --- | --- |
| IOC 容器 | Bean 生命周期 12 步、三级缓存循环依赖、为什么不是两级 | ★★★★★ |
| AOP | JDK vs CGLIB 原理、FastClass 机制、自调用失效原因 | ★★★★ |
| Spring 事务 | 7 种传播行为场景区分、6 大失效场景、NESTED vs REQUIRES_NEW | ★★★★★ |
| 自动装配 | @SpringBootApplication 完整调用链、条件注解、自定义 Starter | ★★★★ |
| Spring MVC | DispatcherServlet 全链路、参数解析器、消息转换器 | ★★★ |
| Spring Cloud | Gateway 响应式架构、Feign 代理链路、熔断器状态机 | ★★★★ |
| Spring Security | FilterChain 认证流程、JWT 双 Token 方案、OAuth2 授权码模式 | ★★★★ |

> **面试核心建议**：
> 1. **说"为什么"而不只是"是什么"** — 例如三级缓存不是为了解决循环依赖（两级就够），是为了 AOP 代理的一致性。
> 2. **带源码类名增加可信度** — 说出 `AbstractAutowireCapableBeanFactory.doCreateBean()`、`DefaultAopProxyFactory.createAopProxy()` 等关键类名方法名。
> 3. **结合生产经验** — 光说原理不够，要说"我在项目中遇到过 XXX 问题，原因是 XXX，解决方案是 XXX"。
> 4. **主动延伸** — 面试官问循环依赖时，主动提"Spring Boot 2.6+ 默认禁止了循环依赖"，展现知识的时效性。

## 相关文章

- [spring-interview-map](/posts/spring/spring-interview-map/)
