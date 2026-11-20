---
title: "Java 基础与语法核心面试题库（含追问链与定级指南）"
date: 2026-11-20
summary: "equals/hashCode、String 常量池、异常/泛型/Lambda 与 JDK 语言演进。"
kind: handbook
interview: false
---

> 适用场景：面试官用一套递进问题，把候选人对 **Java 语言本质（面向对象 / 语法语义 / 类型系统）** 的真实深度"问出来"。
> 核心原则：**基础题的每一道追问，最终都会落到"Java 只有值传递、== 比的是值、泛型编译期擦除、String 不可变"这几条语言底层主线**。背过八股却讲不清"为什么"的人，基本停留在 API 记忆层。
> 配套：本题库与集合 / 并发（AQS、ThreadPoolExecutor）/ JVM 三套共同构成"Java 基础面试定级体系"。

---

## 目录

- [Part 0：30 秒标准总答（判断候选人是否入门）](#part-0)
- [Part 1：基础认知题](#part-1)
- [Part 2：底层原理题](#part-2)
- [Part 3：核心区分度题（题眼，定级主战场）](#part-3)
- [Part 4：实战与陷阱题](#part-4)
- [Part 5：2026 新趋势：JDK 21–25 语言演进](#part-5)
- [Part 6：能否用它定级？如何定级](#part-6)
- [附录：面试官速查表](#part-7)

---

<a id="part-0"></a>

## Part 0：30 秒标准总答

**Q：谈谈你对 Java 基础与语法核心的理解。**

**标准答法（30 秒，涵盖五个得分点）：**

> Java 基础的核心，是理解它"**一切皆对象，但基本类型是值**"这一底层设定，以及由此衍生的一整套语义。
>
> 第一，**== 与 equals**：`==` 对基本类型比值、对引用类型比地址；`equals` 默认是 `Object` 里的 `==`，需要重写才能按内容比较。重写 `equals` 必须同时重写 `hashCode`，以遵守"相等对象必须有相等哈希"的契约。
>
> 第二，**String 不可变**：底层是 `final char[]`（JDK 9 后改为 `byte[]` + `coder`），不可变带来常量池复用、线程安全、哈希可缓存等好处，也因此才有 StringBuilder/StringBuffer。
>
> 第三，**Java 只有值传递**：方法参数传的是副本，引用类型传的是"引用的副本"。
>
> 第四，**泛型是编译期特性**：类型擦除让 `List<String>` 和 `List<Integer>` 运行时都是 `List`，通配符的 extends/super 遵循 PECS 原则。
>
> 第五，**异常分体系**：Error 与 Exception、受检与非受检，配合 try-with-resources 与异常链做资源管理。

**评分要点：** 值传递 / ==与equals / hashCode契约 / String不可变 / 泛型擦除 / 异常体系 这几个点，对应入门到高级。能讲清"为什么重写 equals 必须重写 hashCode"的，直接往 Part 3 追问。

---

<a id="part-1"></a>

## Part 1：基础认知题

### Q1. `==` 和 `equals` 的区别是什么？

**标准答案：**
- `==` 是**运算符**：比较基本类型比的是**值**，比较引用类型比的是**内存地址**（是否同一对象）。
- `equals` 是 `Object` 的方法：`Object` 默认实现是 `return (this == obj)`（即也比较地址）；`String`、`Integer` 等重写后改为按**内容**比较。
- 结论：判断引用类型内容是否相等要用 `equals`，且用 `"常量".equals(变量)` 避免空指针。

**追问 1：`Object.equals` 需要满足哪几个契约？**
> **答案：** 五个特性——① **自反性**（x.equals(x) 为 true）；② **对称性**（x.equals(y) 与 y.equals(x) 结果一致）；③ **传递性**；④ **一致性**（多次调用结果不变）；⑤ **非空性**（x.equals(null) 必为 false）。重写时通常用 `==` 判同一对象、用 `instanceof` 判类型、逐字段比较——这是标准套路。

**追问 2：Object 类都有哪些方法？**
> **答案：** 常见 11 个：`equals`、`hashCode`、`toString`、`getClass`（final）、`clone`（protected）、`finalize`（已废弃）、`wait`/`wait(long)`/`wait(long,int)`、`notify`、`notifyAll`。其中 `getClass`、`wait`、`notify`、`notifyAll` 是 **final** 的，不能被重写——常作为陷阱题。

---

### Q2. `final`、`finally`、`finalize` 三者有什么区别？

**标准答案：** 三者只是名字像，**毫无关系**：

| 关键字 | 类别 | 作用 |
|--------|------|------|
| **final** | 修饰符 | 修饰类：不可被继承；修饰方法：不可被重写；修饰变量：引用不可再指向别的对象（**对象内容仍可变**） |
| **finally** | 异常处理结构 | `try-catch-finally` 中**通常必定执行**的块，用于释放资源 |
| **finalize** | Object 的方法 | GC 回收对象前被调用的回调，**不可靠**，已废弃 |

- `finalize` 是 `Object` 的 `protected` 方法，JVM 不保证它一定被调用、何时被调用，且会影响 GC 效率。**JDK 9 起被标记 `@Deprecated(forRemoval=true)`，JDK 18 已移除相关支持**，替代方案是 `Cleaner` / 虚引用（`PhantomReference`）。

**追问 1：`finally` 一定会被执行吗？**
> **答案：** 不一定。以下情况 finally **不会**执行：`System.exit(0)` 提前终止 JVM、线程被强制杀死、try/catch 块中出现死循环或抛出未捕获的 `Error`、JVM 崩溃（如 `OutOfMemoryError` 导致进程退出）。所以资源释放**优先用 try-with-resources**，别把命脉全押在 finally。

**追问 2：`final` 修饰引用类型变量，对象内容能改吗？**
> **答案：** 能改。`final` 只保证引用本身不能重新赋值（不能指向另一个对象），对象内部字段仍可修改，如 `final List<String> list = new ArrayList<>();` 仍可 `list.add("x")`，只是不能 `list = new ArrayList<>()`。这是高频陷阱。

---

### Q3. Java 的异常体系是怎样的？Error 和 Exception、受检和非受检怎么分？

**标准答案：**
- 顶层 `Throwable`，两大分支：**Error**——JVM 级严重错误（如 `OutOfMemoryError`、`StackOverflowError`、`NoClassDefFoundError`），程序**通常不应捕获**、难以恢复；**Exception**——程序可处理的异常。
- Exception 又分两类：**受检（Checked）**——编译期强制处理（catch 或 throws），如 `IOException`、`SQLException`，表示外部可恢复状况；**非受检（RuntimeException）**——编译期不强制，如 `NullPointerException`、`IndexOutOfBoundsException`，多由代码逻辑错误引起。
- 处理手段：`try-catch-finally`、`throw`、`throws`，以及 JDK 7 的 **try-with-resources**。

**追问 1：try-with-resources 的原理是什么？什么叫抑制异常（suppressed exception）？**
> **答案：** 实现 `AutoCloseable` / `Closeable` 的资源写在 try 后的括号里，编译器会自动在 finally 中调用 `close()`，无需手写。若 try 块抛异常、close() 也抛异常，**close 的异常会作为"抑制异常"通过 `addSuppressed()` 挂到主异常上**，可通过 `getSuppressed()` 获取，避免主异常被覆盖丢失——这是手写 finally 很难正确处理的点。

**追问 2：什么是异常链（exception chaining）？为什么要用？**
> **答案：** 把底层异常作为 `cause` 包装进高层异常（构造器传 cause 或 `initCause()`，用 `getCause()` 读取）。作用是**保留原始故障信息**：上层抛出语义清晰的业务异常时，不丢失底层的根因（如 SQLException），便于排查。切忌 `catch` 后只 `e.printStackTrace()` 再吞掉异常。

---

<a id="part-2"></a>

## Part 2：底层原理题

> 这一层区分"会背 String 不可变结论"和"理解语言设计动机"的人，L2→L3 的门槛。

### Q4. String 为什么不可变？StringBuilder 和 StringBuffer 有什么区别？

**标准答案：**
- `String` 底层是**私有且 final 的字符数组**（JDK 8 是 `private final char[] value`；JDK 9 起改为 `private final byte[] value` + `byte coder` 做紧凑字符串优化）。数组是 final 且内容不对外暴露，`String` 类也没有修改它的方法，所以**一旦创建不可改变**。任何 `substring`、`concat`、`replace` 都返回新对象。
- **不可变的好处**：① **字符串常量池**才能复用（否则多引用共享对象时内容互相污染）；② **线程安全**，不可变对象天然安全；③ **hashCode 可缓存**，String 缓存 hash 值，作 HashMap key 高效；④ **安全性**，用于 URL、文件路径、密码等参数时不会被中途篡改。
- 拼接效率：`String` 的 `+` 在循环里会不断创建新对象（编译器虽优化为 StringBuilder，但循环内仍反复 new）；**大量拼接用 StringBuilder**。
- `StringBuilder` 与 `StringBuffer`：`StringBuilder` **非线程安全但效率高**；`StringBuffer` 的方法加了 `synchronized`，**线程安全但效率低**。单线程用 StringBuilder，多线程共享才用 StringBuffer。

**追问 1：JDK 9 为什么把 `char[]` 改成 `byte[]`？**
> **答案：** 大部分字符串是 Latin-1（单字节）字符，用 `char`（2 字节）浪费一半空间。JDK 9 引入 **Compact String**：用 `byte[]` 存储，加一个 `coder` 字段标识编码（LATIN1=0 / UTF16=1），纯 Latin-1 时省一半内存。这是典型的"**以空间换性能**"优化，API 行为不变。

**追问 2：`String s = "a" + "b" + "c";` 创建了几个对象？**
> **答案：** **1 个**。因为是编译期常量表达式，编译器会**折叠**为 `"abc"`，直接在常量池中生成一个对象。但如果其中有变量（如 `String a = "a"; String s = a + "bc";`），则走 StringBuilder 拼接，会在堆上产生新对象。这个区别是经典陷阱。

---

### Q5. 什么是字符串常量池？`intern()` 方法什么作用？

**标准答案：**
- **字符串常量池（String Constant Pool）** 是 JVM 为字符串开辟的一块特殊存储区，目的是**避免重复创建相同字符串**、节省内存。
  - 用字面量 `String s = "abc";` 创建时，JVM 先去池里找，有则返回引用，没有则创建并放入池。
  - 用 `new String("abc")` 则**强制在堆上新建一个对象**（池里的字面量对象可能已有）。
- **位置演变**：JDK 6 及之前在方法区（PermGen）的运行时常量池；**JDK 7 起移到堆中**；JDK 8 元空间取代 PermGen 后，字符串常量池仍在堆里。移到堆的原因之一是 PermGen 空间小、GC 不积极，容易 OOM。
- **`intern()`**：返回字符串对象的**规范化引用**。JDK 7+ 的逻辑：若常量池已包含该字符串（equals 相等），返回池中引用；否则把**当前对象引用**加入池中并返回。

**追问 1：`new String("ab")` 一共创建了几个对象？**
> **答案：** 分情况——若常量池中**没有** `"ab"`，创建 **2 个**：堆中一个 `new` 出来的 String 对象 + 常量池中一个字面量对象；若池中**已有** `"ab"`，只创建 **1 个**（堆中那个）。注意这是"最多两个"，别死记数字。

**追问 2：下面代码结果是什么？为什么？**
```java
String s1 = new String("abc");
String s2 = s1.intern();
String s3 = "abc";
System.out.println(s1 == s2);
System.out.println(s2 == s3);
```
> **答案：** `s1 == s2` 为 **false**，`s2 == s3` 为 **true**。因为 `s1` 是堆上新对象；`s1.intern()` 后，池中已有 `"abc"`（由 `new String("abc")` 的字面量产生），返回池中引用给 `s2`；`s3` 是字面量，也指向池中引用。所以 `s2` 与 `s3` 同一地址，而 `s1` 是堆对象。`intern()` 曾是内存优化手段，但 JDK 7+ 因池在堆上、会驻留更多对象，**滥用反而增加 GC 压力**。

---

### Q6. Java 是值传递还是引用传递？

**标准答案：**
- **Java 只有值传递（pass by value）**，没有引用传递。这是必须明确的结论。
- 传**基本类型**：传递的是**值的副本**，方法内改动不影响实参。
- 传**引用类型**：传递的是**引用的副本**（"地址值的一份拷贝"）。方法内改变副本指向（如 `obj = new Object()`）**不影响实参**；但通过副本修改**对象内容**（如 `obj.setName(...)`）**会影响实参指向的同一对象**。
- 之所以常被误认为引用传递，是因为"改对象内容会生效"——但那是"两份引用指向同一对象"，并非引用传递。

**追问 1：写一个方法交换两个整数，能成功吗？为什么？**
> **答案：** 不能。`swap(int a, int b)` 里 exchange 的只是栈上两个副本，方法结束即销毁，实参没变。即使传 `Integer` 也不行（不可变 + 值传递）。要交换得用数组或容器等可变载体。这题能答出"值传递"本质才算过关。

**追问 2：为什么在方法里改 String 参数的值，外面看不到变化？**
> **答案：** 双重原因叠加：① **值传递**——传入的是引用副本；② **String 不可变**——任何"修改"操作都会创建新对象并让副本指向它，原对象没变，实参自然感知不到。这是值传递与不可变结合的经典陷阱。

---

<a id="part-3"></a>

## Part 3：核心区分度题（题眼，定级主战场）

> **这一部分是全题的题眼**——能否讲清 hashCode 契约、泛型擦除、包装类缓存池，直接决定 L2 还是 L3/L4。定级主要看这里。

### Q7. 为什么重写 `equals` 必须重写 `hashCode`？

**标准答案：** （能完整讲清契约与哈希容器行为基本是 L3+）

- **契约规定**（`Object.hashCode` 通用约定）：① 两对象 `equals` 为 true，`hashCode` **必须相等**；② `hashCode` 相等，`equals` **不一定**为 true（哈希碰撞）。
- **原因**：为支撑 **HashMap / HashSet / Hashtable** 等哈希容器。HashMap 查找时先用 hashCode 定位桶（bucket），再用 equals 在桶内比较。若只重写 equals 不重写 hashCode，两个"逻辑相等"的对象会有**不同哈希值**被放进不同桶 → **查不到、去不掉、可重复存入**，破坏集合语义。例：`Map<Person,String>` 两次 `new Person("张三")` 内容相同，若未重写 hashCode，put 两次产生两个条目，get 时可能取不到。
- **正确做法**：用同一组关键字段同时实现 equals 和 hashCode；可用 `Objects.hash(field1, field2)` 或 IDE 生成。

**追问 1：hashCode 相等、equals 不等，会怎样？**
> **答案：** 这属于**哈希碰撞**，是允许的。HashMap 会用**链表/红黑树**把碰撞元素串在同一桶里，再用 equals 区分。hashCode 实现得越分散、碰撞越少，性能越好；但**正确性不依赖无碰撞，只依赖"equals 相等 ⇒ hashCode 相等"**——这条被破坏才出大问题。

**追问 2：为什么不建议用可变字段做 equals/hashCode 的依据？**
> **答案：** 若对象作为 HashMap 的 key 后，参与 hashCode 的字段被修改，其哈希值变化，会导致"**找不到自己**"——对象还躺在旧桶里，但用新哈希去查永远定位不到，造成内存泄漏般的"幽灵条目"。所以 key 最好用不可变对象（如 String、Integer），或用不可变字段计算 hashCode。

---

### Q8. 什么是泛型擦除？`? extends T` 和 `? super T` 的区别？PECS 原则是什么？

**标准答案：** （考察是否真正理解 Java 泛型的"伪泛型"本质）

- **类型擦除（Type Erasure）**：Java 泛型是**编译期特性**，编译后泛型信息被擦除：
  - 无界泛型擦除为 `Object`，有上界擦除为第一个上界（如 `<T extends Number>` 擦除为 `Number`）。
  - 所以 `List<String>` 和 `List<Integer>` 在运行时**都是 `List`**，`getClass()` 相同——这是为了兼容 JDK 5 之前的字节码（**向后兼容**）。
  - 为保证多态正确，编译器会生成**桥接方法（bridge method）**。
  - 限制：不能 `new T()`、不能 `instanceof List<String>`、静态方法不能引用类的泛型参数、不能创建泛型数组。
- **通配符**：
  - `? extends T`（**上界通配符**）：表示"T 或其子类"，作为**生产者（Producer）**——只能**安全地读取**（读出当 T 用），不能写入（除 null）。如 `List<? extends Number>` 可读出 Number。
  - `? super T`（**下界通配符**）：表示"T 或其父类"，作为**消费者（Consumer）**——可以**写入** T 及其子类，读取只能当 Object。如 `List<? super Integer>` 可 add(Integer)。
- **PECS 原则**：**Producer Extends, Consumer Super**——频繁读取（生产数据）用 extends，频繁写入（消费数据）用 super。经典例子：`Collections.copy(List<? super T> dest, List<? extends T> src)`：源只读用 extends，目标只写用 super。

**追问 1：为什么 `List<String>` 不能赋值给 `List<Object>`？**
> **答案：** 因为泛型**不协变**。若允许，就能往 `List<Object>` 里塞入 Integer，而它实际指向的是 `List<String>`，破坏类型安全（这就是"堆污染"）。数组的**协变**则不同（`String[]` 是 `Object[]` 的子类型），但因此有 `ArrayStoreException` 风险——这正是泛型设计要规避的。

**追问 2：擦除后字节码里真的完全没有泛型信息吗？**
> **答案：** 不是完全消失。为了支持反射和某些框架（如 Gson、Jackson），编译器会把泛型签名写入 class 文件的 **Signature 属性**，可通过 `getGenericType()` 反射获取。但**运行时类型转换仍靠编译器插入的 checkcast**，擦除的本质不变——所以 Guava 等库才需要传 `TypeToken` 来保留泛型类型。

---

### Q9. 什么是自动装箱/拆箱？Integer 缓存池是怎么回事？

**标准答案：**
- **装箱**：基本类型 → 包装类（如 `int` → `Integer`，调用 `Integer.valueOf()`）；**拆箱**：包装类 → 基本类型（如 `Integer` → `int`，调用 `intValue()`）。JDK 5 引入，编译器自动完成。
- **`Integer` 缓存池**：`Integer.valueOf(int)` 内部使用 `IntegerCache`，默认缓存 **-128 ~ 127** 的 `Integer` 对象。在此范围内直接返回缓存对象（同一个引用），超出范围则 `new Integer()` 新建。
  - 上限可通过 JVM 参数 `-XX:AutoBoxCacheMax=<size>` 调整。
  - 其他包装类也有类似缓存：`Byte`、`Short`、`Character`（0~127）、`Long`（-128~127）；`Boolean` 缓存 true/false；`Float`、`Double` **无缓存**。
- 因此：`Integer a = 127, b = 127; a == b` 为 **true**（缓存内同一对象）；`Integer c = 128, d = 128; c == d` 为 **false**（各自 new）。包装类比较**必须用 equals**，`==` 比较的是引用。

**追问 1：`Integer i = 100; i += 1;` 发生了什么？**
> **答案：** 三步：① 拆箱（`i.intValue()` 得 100）；② 做加法得 101；③ 装箱（调用 `Integer.valueOf(101)` 转回 Integer）。频繁装箱拆箱有性能开销，热点代码应避免——这也是 `int` 与 `Integer` 在性能敏感场景要分清的原因。

**追问 2：为什么 "-128~127" 这个范围？**
> **答案：** 这是经过权衡的经验值：覆盖了绝大多数日常使用的小整数（循环下标、状态码、年龄等），缓存命中率高、收益明显；再扩大缓存会增加启动时创建对象数量和内存占用，边际收益递减。该范围受 JVM 参数可调，说明它是**性能与内存的工程折中**，不是语言规范硬性规定。

---

<a id="part-4"></a>

## Part 4：实战与陷阱题

### Q10. JDK 动态代理和 CGLIB 动态代理有什么区别？Spring AOP 怎么选？

**标准答案：**
- **JDK 动态代理**：
  - 基于**接口**：通过 `Proxy.newProxyInstance()` + `InvocationHandler` 生成**实现了目标接口**的代理类。
  - **要求目标类必须实现接口**，否则用不了。
  - 是 JDK 原生能力，无需额外依赖。
- **CGLIB 动态代理**：
  - 基于**继承**：通过生成目标类的**子类**来代理，用 `MethodInterceptor` 拦截方法（底层用 ASM 操作字节码）。
  - **无需接口**，但**不能代理 final 类 / final 方法**（无法继承/重写）。
  - 需要引入 cglib 依赖（Spring Core 已内置）。
- **Spring AOP 选择**：
  - 传统规则：目标类**有接口用 JDK 代理，无接口用 CGLIB**。
  - 可通过 `spring.aop.proxy-target-class=true` 强制使用 CGLIB；**Spring Boot 2.x 起默认开启 CGLIB**。
  - 现代 JDK（8+）下 JDK 动态代理性能已大幅优化，差距很小，选型更多看是否需要接口。
- 两者都属于**运行期增强**；AspectJ 则是**编译期/织入期**增强，能力更强。

**追问 1：JDK 动态代理为什么只能代理接口？**
> **答案：** 由实现机制决定——`Proxy` 生成的代理类在运行时**只能实现传入的接口列表**，它是接口的实现类，无法再继承目标类（Java 单继承，代理类已继承 `Proxy`）。所以没有接口就没有可生成的方法签名契约。

**追问 2：为什么 final 方法无法被 CGLIB 代理？这会带来什么坑？**
> **答案：** CGLIB 靠生成子类并**重写**方法来织入增强逻辑，`final` 方法不可被重写，因此增强会**静默失效**——典型坑是 Spring `@Transactional` 或 `@Async` 标在 final/private 方法上**不生效**，且不报错，极难排查。同理，private 方法也无法被代理。

---

### Q11. Java 8 的 Lambda、Stream、Optional 有哪些常见坑？

**标准答案：** （考察新特性的"用对"而非"用过"）

- **Lambda**：
  - 捕获的外部局部变量必须是 **final 或 effectively final**（事实最终），不能在 Lambda 内修改。
  - Lambda **不是匿名内部类**，它**没有自己的 this**——Lambda 体内的 `this` 指向外围类实例（匿名内部类的 this 指向自己）。
  - 底层靠 `invokedynamic` 实现，不是简单语法糖。
- **Stream**：
  - **一次性消费**：Stream 只能被一个终端操作消费，用完即废，不能复用（复用抛 `IllegalStateException`）。
  - **惰性求值**：中间操作（map/filter）不执行，遇到终端操作（collect/forEach）才触发。
  - **parallelStream 陷阱**：并行流共享状态、有副作用（如往普通 ArrayList `add`）会出线程安全问题；且并非总比串行快，小数据量或高开销操作反而更慢。
- **Optional**：
  - 设计初衷是**表达"可能为空"的返回值**，不应作为**类字段或方法参数**（不利于序列化、语义啰嗦）。
  - `orElse(x)` 的 x **总会被求值**，而 `orElseGet(() -> x)` 惰性求值——若 x 构造昂贵，用错有性能问题。
  - 用前先 `isPresent()` / `ifPresent()`，直接 `get()` 在 empty 时抛 `NoSuchElementException`。
- **函数式接口**：`@FunctionalInterface` 标记的接口**只能有一个抽象方法**（default / static 方法不算）。常用四大类：`Function`（T→R）、`Predicate`（T→boolean）、`Supplier`（无参→T）、`Consumer`（T→无返回）。

**追问 1：Stream 的 `map` 和 `flatMap` 有什么区别？**
> **答案：** `map` 把每个元素映射成**一个**结果，流元素是"一进一出"（可能嵌套成 `Stream<Stream<T>>`）；`flatMap` 把每个元素映射成**一个流**再**拍平合并**成单一流（"多进一出"扁平化）。例如把 `List<List<String>>` 展开成 `List<String>` 必须用 flatMap。

**追问 2：为什么 Lambda 要求局部变量 effectively final？**
> **答案：** Lambda 可能在另一个线程、在原方法栈帧销毁后才执行。若允许修改局部变量，就会与主线程不同步，产生数据竞争。Java 选择**直接禁止修改**（要求事实最终值）来规避这个问题，简单而安全。它捕获的是变量**值**，不是变量本身——这与匿名内部类一致。

---

<a id="part-5"></a>

## Part 5：2026 新趋势：JDK 21–25 语言演进

> 加分题，考察候选人的技术视野。**注意各特性的正式版 JDK 版本**，答错版本说明没真正跟进。

### Q12. 近年 Java 语言有哪些重要演进？它们解决了什么问题？

**标准答案：** （按正式版时间线，标注版本）

- **文本块 — JDK 15 正式**（JEP 378）：用 `"""` 包裹多行字符串，免去转义拼接，写 JSON/SQL/HTML 更清爽。**`instanceof` 模式匹配 — JDK 16 正式**（JEP 394）：`if (obj instanceof String s)` 可直接用 `s`，省去强转。
- **记录类 Record — JDK 16 正式**（JEP 395）：`record Point(int x, int y) {}` 一行定义**不可变数据载体**，编译器自动生成构造器、equals/hashCode/toString、访问器，是 POJO / DTO 的极简替代。**密封类 Sealed — JDK 17 正式**（JEP 409）：用 `sealed ... permits` **限制哪些类可继承/实现**，让继承闭合、配合模式匹配做穷尽检查，是代数数据类型（ADT）的基础。
- **switch 模式匹配 + 记录模式 — JDK 21 正式**（JEP 441 / JEP 440，17–20 预览）：switch 可按类型匹配并绑定变量，配合 Record 解构与 sealed 做穷尽匹配，`case` 无需 break，大幅简化类型分发逻辑。
- **虚拟线程 Virtual Threads — JDK 21 正式**（JEP 444，19/20 预览）：轻量级线程，由 JVM 调度、可创建百万级，**大幅降低高并发 I/O 编程成本**——用同步写法拿到异步吞吐。注意它**不提升 CPU 密集型性能**，且阻塞时仍要关注 synchronized pinning（JDK 24 的 JEP 491 已解决相关问题）。
- **Valhalla 值类型（Value Types）— 仍在推进**：目标是无对象头、可内联的**值类（Value Classes，JEP 401）**，消除包装类型开销、让 `List<int>` 成为可能。截至 JDK 25 **仍处预览/推进中，尚未正式定版**，面试不要说"已 GA"。

**追问 1：Record 能替代所有 POJO 吗？**
> **答案：** 不能。Record 是**final 且不可变**的，字段不能修改，也不能继承其他类（但可实现接口），无无参构造器、无法附加实例字段。适合**纯数据载体**（DTO、查询结果、多返回值）；需要可变、继承、JPA 实体（需无参构造）等场景仍用普通类。它本质是"**透明载体**"语法糖。

**追问 2：虚拟线程普及后，还需要 Stream/parallelStream 或线程池吗？**
> **答案：** 要分清场景。虚拟线程解决的是**高并发 I/O 阻塞**的线程成本问题，让"一请求一线程"重新可行；但它**不加速 CPU 密集计算**。CPU 密集并行仍靠 ForkJoinPool / parallelStream（且受核心数限制）。此外虚拟线程**不应池化**，要用 `Executors.newVirtualThreadPerTaskExecutor()`，并发控制转向对数据库连接等真实稀缺资源用 **Semaphore 显式限流**。

---

<a id="part-6"></a>

## Part 6：能否用基础与语法核心定级？如何定级？

### 结论先行

**可以，而且这是所有 Java 面试里区分度最稳的模块**——因为基础题天然分层：会用 API → 懂语言结构 → 讲清底层原理 → 源码级 + 生产实战 → 懂演进与选型。但基础题**人人都"觉得会"**，越是看似简单的题（值传递、==/equals、String 不可变）越能靠追问挖出真实深度。关键不在"答对没有"，而在"**能不能讲清为什么**"。

---

### 定级标准

| 级别 | 典型年限 | 能达到的深度 | 关键判据 |
|------|---------|-------------|---------|
| **初级（L1）** | 0–2 年 | Part 0 + Part 1 | 会用 ==/equals、知道 final/finally/finalize 字面区别、能分 Error/Exception；讲不清底层原因 |
| **中级（L2）** | 2–5 年 | Part 2 | 懂 String 不可变及其好处、常量池与 intern、能说清"Java 只有值传递" |
| **中高级（L3）** | 5–8 年 | Part 3 | 讲清 hashCode 契约与哈希容器行为、泛型擦除与 PECS、Integer 缓存池原理 |
| **高级（L4）** | 8 年+ | Part 4 | 源码级 + 生产实战：动态代理选型与 final 陷阱、Java 8 新特性踩坑与性能判断 |
| **资深/架构（L5）** | 10 年+ | Part 5 | 掌握 JDK 21–25 演进与版本、能结合虚拟线程/Valhalla 做编程模型与选型权衡 |

---

### 定级操作方法

**第一步：Part 0 摸底。** 能说出"值传递 + ==/equals + String 不可变 + 泛型擦除"主线 → 至少 L2；只知道零散结论、讲不成体系 → 从 Part 1 问起。

**第二步：沿追问链下探。** 重点追问"为什么"：
- 为什么重写 equals 必须重写 hashCode？（哈希容器定位机制）
- 为什么 Java 只有值传递，引用类型却像"引用传递"？（引用副本指向同一对象）
- 为什么泛型不能协变、为什么要 extends/super？（类型安全与 PECS）

**第三步：三类信号防背题。**
1. **真实性**：能否举出实际踩过的坑（如 final 方法上 @Transactional 失效、hashCode 用可变字段导致 key 丢失）。
2. **抽象能力**：能否把 String 不可变、包装类缓存、常量池统一到"**空间/时间/安全权衡**"的设计思想。
3. **权衡能力**：能否讲清 StringBuilder/StringBuffer、JDK/CGLIB 代理、orElse/orElseGet 的取舍，而非死记结论。

**第四步：按最深层级定级，不按正确率。** 一两个点答到 L4 即可给到 L4，但要配合岗位难度调整追问深度——招初中级时强问源码只会考察背诵。

---

### 面试官避坑提醒

- **别在"是不是引用传递"上纠缠措辞**：核心是看他能否解释清楚"传引用副本、改内容生效、改指向无效"的行为，结论正确即可，不必抠字眼。
- **把"hashCode 契约 + 哈希容器"作为 L3 分水岭**：能讲清"为什么破坏契约会导致 HashMap 查不到"的人，一定真懂，不是背八股。
- **新特性要核对版本**：Record/JDK16、Sealed/JDK17、虚拟线程/JDK21 答错版本，说明只是听过名词——这本身就是有效的区分信号。

---

<a id="part-7"></a>

## 附录：面试官速查表（一页纸）

**递进主线（照着问）：**

1. == 和 equals 区别？→（基本类型比值、引用比地址；equals 默认也是 ==）
2. final / finally / finalize？→（修饰符 / 必执行块 / GC回调已废弃）
3. 异常体系？→（Error vs Exception、受检 vs 非受检、try-with-resources、异常链）
4. String 为什么不可变？→（final byte[]+coder、常量池/线程安全/hash缓存；SB vs SBF）
5. 常量池与 intern？→（池位置 JDK7 入堆；new String("ab") 最多两个对象）
6. 值传递还是引用传递？→（只有值传递；引用副本指向同一对象）
7. 重写 equals 为何必须重写 hashCode？→（契约；HashMap 先定位桶再 equals）
8. 泛型擦除与通配符？→（擦除到上界、桥接方法；extends 生产者 / super 消费者 / PECS）
9. 自动装箱与 Integer 缓存池？→（-128~127 valueOf 复用；127 与 128 的 == 差异）
10. JDK 代理 vs CGLIB？→（接口 vs 继承；final 方法无法代理致增强失效）
11. Java 8 新特性坑？→（Lambda effectively final/无自己 this、Stream 一次性/惰性、Optional orElse）
12. JDK 21–25 演进？→（Record16 / Sealed17 / 模式匹配switch21 / 虚拟线程21 / Valhalla 未定版）

**定级速判：**
- 答到第 1–3 问 → L1
- 答到第 4–6 问 → L2
- 答到第 7–9 问 → L3
- 答到第 10–11 问 + 有实战踩坑 → L4
- 答到第 12 问 + 版本准确 + 体系化权衡 → L5

**一票否决信号：** 认为"Java 是引用传递"却讲不清副本机制、认为"hashCode 相等就一定要 equals 相等"、说"String 底层是 final char[] 且 JDK9 后没变过"、把 Record/虚拟线程说成很早就有 → 无论年限，基础项最高 L2。

---

*资料整理于 2026-11-19，参考 JDK 8/11/17/21/25 官方文档与 JEP（JEP 378 文本块、JEP 394/395 instanceof与Record、JEP 409 密封类、JEP 440/441 模式匹配、JEP 444 虚拟线程、JEP 491 synchronized 无 pinning）、《Effective Java》、Java 语言规范（JLS）及 2026 年 Java 面试趋势资料。*
