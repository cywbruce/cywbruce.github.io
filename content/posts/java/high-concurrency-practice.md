---
title: 没有大流量，怎么积累高并发 / 性能调优经验？
date: 2026-11-08
summary: 用普通 Spring Boot CRUD 做压测→定位→优化闭环：N+1、连接池、缓存、异步。面试讲过程比吹 QPS 更有用。
kind: guide
---

面试常问高并发，但手里只有日活三位数的后台——不必干等「百万 QPS 项目」。面试官更想听的是：**你有没有从慢到快完整走过一遍，每一步为什么、怎么验证。**

下面是一套在**普通 Spring Boot 项目**上就能做的练习（思路参考业界常见实战分享）。

---

## 1. 先制造「慢」的基线

默认配置：Tomcat 线程偏多、HikariCP 连接很少、业务代码未优化。用 JMeter（或 wrk）打订单列表：

```bash
jmeter -n -t order_list_test.jmx -l result.jtl -e -o report/
```

假设基线类似：平均 RT 数秒、吞吐几十、还有超时错误。**这就是高并发经验的起点**——有数字，才能谈优化。

---

## 2. 别先调 Tomcat 线程数

线程不是瓶颈时，调到再大也只是在排队。用 Arthas 看方法耗时：

```bash
java -jar arthas-boot.jar
# trace com.example.OrderController listOrders
```

若发现列表查询很快，时间全在 `fillOrderDetails` 的循环里——对每条订单再查用户、商品、物流，就是经典 **N+1**。

### 改法

收集 id，批量 `IN` 查询，内存组装（注意 IN 列表过长要分批）。

**面试可展开：** N+1 识别、批量查询、MyBatis `<foreach>`、IN 过大对执行计划的影响。

---

## 3. 第二个瓶颈：数据库连接池

平均 RT 下来后，若 **TP99 仍很高**，看 Hikari 是否大量：

```text
Connection is not available, request timed out after ...
```

连接太少、并发线程来抢；超时设太长会让线程挂很久。

可调：`maximum-pool-size`、更短的 `connection-timeout`（快速失败）。  
但**不是越大越好**——连接过多会加重数据库内存与锁压力；需结合 CPU、DB 规格与官方池大小建议做验证。

**面试可展开：** 池化原理、为何连接数有上限、泄漏检测（`leak-detection-threshold`）。

---

## 4. 热点只读：缓存

商品等变更少、读多的数据，加 Redis / `@Cacheable`，避免每次打 DB。  
同时准备好：**更新时失效缓存**、并发下的一致性（删缓存与写库的竞态）、穿透/击穿等——这些才是工程题。

详见 [Redis 面试题](/posts/redis/redis-interview/)。

---

## 5. 非核心逻辑异步化

下单：扣库存 + 建单必须同步；短信、邮件、加积分可 `@Async` 或 MQ。  
缩短占用 Web 线程的时间 = 同样线程数可接更多请求。

**面试可展开：** 线程池拒绝策略、MQ 可靠性与幂等、事务与发消息的顺序。

---

## 6. 回头看数字

典型结果形态（示例量级，以你机器为准）：

| 阶段 | 你要能说清的变化 |
| --- | --- |
| 基线 | RT / QPS / 错误率 |
| 消 N+1 | RT 与 DB 次数下降 |
| 调池 | 错误率、TP99 |
| 缓存 | 读路径延迟 |
| 异步 | 核心接口 RT |

全程可能用不到分布式锁、分库分表、K8s 扩容——但你讲的是**完整排查链**，这正是多数面试官要的「高并发经验」。

---

## 7. 面试怎么讲（结构）

1. 基线怎么压、指标是什么  
2. 如何定位（Arthas / 慢 SQL / 池日志）  
3. 每一步改动与**复测对比**  
4. 代价与边界（缓存一致、异步失败补偿）  
5. 若流量再大 10 倍，下一步才会上什么（限流、拆分、读写分离……）

百万 QPS 全国也没多少人天天碰；**会把慢系统变快的人**更好招。

---

## 相关

- [生产向 JVM](/posts/java/jvm-production-guide/)  
- [Java 面试场景题](/posts/java/java-interview/)  
- [MySQL](/posts/mysql/mysql-interview/) · [Redis](/posts/redis/redis-interview/) · [Spring](/posts/spring/spring-interview/)  
