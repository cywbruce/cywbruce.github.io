---
title: 缓存专题深度面试手册
date: 2026-11-05
summary: 缓存击穿/穿透/雪崩、一致性、Redis 数据结构与编码、持久化、集群、淘汰策略、热 Key、BigKey、多级缓存。
interview: false
kind: handbook
---

> **适用对象**：3-5 年+ Java 后端开发，目标大厂（阿里/美团/字节/腾讯）  
> **核心原则**：深度优先于广度，每个知识点写透 "为什么"

---

## 1. 缓存击穿

### 1.1 原理详解

缓存击穿（Hotspot Key Expiration）指某个 **热点 Key** 在缓存中恰好过期的瞬间，大量并发请求同时穿透到数据库，导致 DB 瞬时压力飙升甚至宕机。

关键条件三要素：
1. **热点 Key**：QPS 极高，比如首页 Banner、秒杀商品详情
2. **缓存恰好过期**：TTL 到达
3. **重建缓存耗时较长**：查 DB + 复杂计算，导致并发窗口被放大

与缓存穿透的本质区别：击穿是"数据存在但缓存失效"，穿透是"数据根本不存在"。

### 1.2 实现方案对比

| 方案 | 原理 | 一致性 | 可用性 | 复杂度 | 适用场景 |
|------|------|--------|--------|--------|----------|
| **互斥锁（SETNX）** | 只有一个线程能重建缓存，其他线程等待/重试 | ✅ 强一致 | ⚠️ 等待期间可能超时 | 中 | 数据一致性要求高 |
| **逻辑过期** | 不设置 TTL，在 value 中存逻辑过期时间，发现过期后异步重建 | ⚠️ 短暂不一致 | ✅ 始终可用 | 高 | 高可用优先场景 |
| **永不过期 + 主动更新** | Key 不设 TTL，数据变更时主动刷新 | ⚠️ 依赖更新时效 | ✅ 始终可用 | 中 | 数据变更频率低 |
| **预热 + 续期** | 后台线程监控热点 Key，在快过期时提前续期 | ✅ 较好 | ✅ 较好 | 高 | 可预测的热点数据 |

### 1.3 代码示例

#### 方案一：互斥锁（基于 Redis SETNX）

```java
public String getWithMutex(String key) {
    // 1. 查缓存
    String value = redis.get(key);
    if (value != null) {
        return value;
    }
    
    // 2. 缓存未命中，尝试获取互斥锁
    String lockKey = "lock:" + key;
    boolean locked = false;
    try {
        // SETNX + EX 原子操作，防止死锁
        locked = redis.set(lockKey, "1", "NX", "EX", 10);
        if (locked) {
            // 3. 获取锁成功 -> 查 DB -> 重建缓存
            value = db.query(key);
            if (value == null) {
                // 空值缓存，防穿透，短 TTL
                redis.setex(key, 60, "");
            } else {
                redis.setex(key, 300, value);
            }
            return value;
        } else {
            // 4. 获取锁失败 -> 休眠重试
            Thread.sleep(50);
            return getWithMutex(key); // 递归重试
        }
    } finally {
        if (locked) {
            // 5. 释放锁（建议用 Lua 脚本保证原子性）
            redis.eval(
                "if redis.call('get',KEYS[1])==ARGV[1] then " +
                "return redis.call('del',KEYS[1]) else return 0 end",
                Collections.singletonList(lockKey), 
                Collections.singletonList("1")
            );
        }
    }
}
```

#### 方案二：逻辑过期

```java
@Data
public class RedisData {
    private Object data;
    private LocalDateTime expireTime; // 逻辑过期时间
}

private static final ExecutorService REBUILD_EXECUTOR = 
    Executors.newFixedThreadPool(10);

public String getWithLogicalExpire(String key) {
    // 1. 查缓存（永不会返回 null，因为不设 TTL，提前预热写入）
    String json = redis.get(key);
    if (json == null) {
        return null; // 非热点数据，不存在
    }
    
    // 2. 反序列化，判断逻辑过期时间
    RedisData redisData = JSON.parseObject(json, RedisData.class);
    String data = (String) redisData.getData();
    LocalDateTime expireTime = redisData.getExpireTime();
    
    if (expireTime.isAfter(LocalDateTime.now())) {
        // 3. 未过期，直接返回
        return data;
    }
    
    // 4. 已逻辑过期，尝试获取锁进行异步重建
    String lockKey = "lock:" + key;
    boolean locked = redis.set(lockKey, "1", "NX", "EX", 10);
    if (locked) {
        // 5. 获取锁成功，开启异步线程重建
        REBUILD_EXECUTOR.submit(() -> {
            try {
                String newData = db.query(key);
                RedisData rd = new RedisData();
                rd.setData(newData);
                rd.setExpireTime(LocalDateTime.now().plusSeconds(300));
                redis.set(key, JSON.toJSONString(rd));
            } finally {
                redis.del(lockKey);
            }
        });
    }
    
    // 6. 无论是否获取锁，都先返回旧数据（牺牲一致性换可用性）
    return data;
}
```

### 1.4 生产踩坑经验

1. **递归重试导致栈溢出**：互斥锁方案中递归调用 `getWithMutex` 需要设置最大重试次数（建议 3-5 次），否则极端情况下栈溢出。
2. **锁超时比重建时间短**：如果 DB 查询 + 计算需要 15 秒，但锁 TTL 只有 10 秒，会导致多个线程同时重建。**解决**：锁的 TTL 要大于重建时间，或使用 Redisson 的 watchdog 续期机制。
3. **逻辑过期方案的冷启动问题**：系统启动时缓存为空，需要做数据预热（`@PostConstruct` 或启动脚本提前写入）。
4. **释放了别人的锁**：线程 A 加锁后执行慢，锁超时释放，线程 B 获取锁，A 执行完却 `DEL` 了 B 的锁。**解决**：value 中存线程标识（UUID），删锁时先比较再删除，且必须用 Lua 脚本保证原子性。

### 1.5 面试追问点

> **Q1：互斥锁方案中，获取锁失败的线程是 sleep 重试好，还是直接返回空好？**  
> A：取决于业务。对于核心链路（如订单详情），必须 sleep + 重试，保证最终拿到数据；对于非核心链路（如推荐列表），可以直接返回降级数据或空，减少线程阻塞。

> **Q2：逻辑过期方案为什么不设 TTL？**  
> A：设 TTL 就回到了击穿的原点——Key 过期后就是 null，并发请求全部打到 DB。不设 TTL 保证 Key 永远在缓存中，通过逻辑时间戳软过期，过期后返回旧数据的同时异步重建。

> **Q3：两个方案能不能组合使用？**  
> A：可以。对一致性要求高的核心数据（如库存）用互斥锁；对一致性要求低但可用性要求高的数据（如商品描述）用逻辑过期。实际项目中往往按数据类型分层使用。

---

## 2. 缓存穿透

### 2.1 原理详解

缓存穿透（Cache Penetration）指请求查询的数据在**缓存和数据库中都不存在**，导致每次请求都绕过缓存直接查 DB。如果被恶意攻击（如遍历不存在的 ID），会持续冲击 DB。

本质问题：缓存是基于 "数据存在" 的假设建立的，对于不存在的数据没有缓存层保护。

### 2.2 布隆过滤器原理

布隆过滤器（Bloom Filter）是一个位数组 + 多个哈希函数的概率型数据结构：

**工作原理**：
1. **初始化**：创建长度为 m 的位数组，全部置 0
2. **添加元素**：对元素用 k 个不同的哈希函数计算出 k 个位置，将这些位置置 1
3. **查询元素**：对元素用同样 k 个哈希函数计算位置，如果所有位置都为 1 则"可能存在"；如果有任一位置为 0 则"一定不存在"

**误判率公式**：`P = (1 - e^(-kn/m))^k`

其中 n = 已插入元素数，m = 位数组大小，k = 哈希函数个数。

**关键特性**：
- **不存在 → 一定不存在**（无漏判）
- **存在 → 可能存在**（有误判）
- **不支持删除**（一个位可能被多个元素共用），如需删除需使用 Counting Bloom Filter

### 2.3 实现方案对比

| 方案 | 原理 | 优点 | 缺点 | 适用场景 |
|------|------|------|------|----------|
| **布隆过滤器** | 位图 + 多重哈希快速判断不存在 | 内存极小（1亿数据约120MB），O(k)查询 | 有误判率；不支持删除；需预热 | 数据量大、请求 Key 空间可枚举 |
| **空值缓存** | 查 DB 为空时缓存一个 `""` 或特殊标记 | 实现简单 | 可能缓存大量空 Key，浪费内存 | 穿透 Key 有限且可预期 |
| **接口层校验** | 在 Controller/Gateway 层做参数合法性校验 | 拦截在最前端 | 只能拦截明显非法参数 | ID 格式固定、有规律 |

### 2.4 代码示例

#### 布隆过滤器 + 空值缓存组合

```java
// 使用 Redisson 的布隆过滤器
@Component
public class CacheWithBloomFilter {
    
    @Autowired
    private RedissonClient redisson;
    @Autowired
    private RedisTemplate<String, String> redis;
    
    private RBloomFilter<String> bloomFilter;
    
    @PostConstruct
    public void init() {
        // 初始化布隆过滤器：预期插入 100 万元素，误判率 1%
        bloomFilter = redisson.getBloomFilter("product:bloom");
        bloomFilter.tryInit(1_000_000L, 0.01);
        
        // 预热：将 DB 中所有存在的 Key 写入布隆过滤器
        List<String> allProductIds = productDao.selectAllIds();
        allProductIds.forEach(id -> bloomFilter.add(id));
    }
    
    public Product getProduct(String productId) {
        // 第一层：布隆过滤器快速判断
        if (!bloomFilter.contains(productId)) {
            // 布隆过滤器说不存在 → 一定不存在，直接返回
            return null;
        }
        
        // 第二层：查缓存
        String cacheKey = "product:" + productId;
        String cached = redis.opsForValue().get(cacheKey);
        if (cached != null) {
            if ("NULL".equals(cached)) {
                return null; // 空值标记
            }
            return JSON.parseObject(cached, Product.class);
        }
        
        // 第三层：查 DB
        Product product = productDao.selectById(productId);
        if (product == null) {
            // 空值缓存，短 TTL（防止占用太多内存）
            redis.opsForValue().set(cacheKey, "NULL", 2, TimeUnit.MINUTES);
            return null;
        }
        
        redis.opsForValue().set(cacheKey, JSON.toJSONString(product), 
                                30, TimeUnit.MINUTES);
        return product;
    }
    
    // 新增商品时，同步写入布隆过滤器
    public void addProduct(Product product) {
        productDao.insert(product);
        bloomFilter.add(product.getId());
    }
}
```

### 2.5 生产踩坑经验

1. **布隆过滤器预热遗漏**：系统上线时忘记预热布隆过滤器，导致所有请求都被判定为"不存在"。**解决**：启动时强制预热 + 健康检查（检查布隆过滤器元素数量是否合理）。
2. **数据新增但布隆过滤器未同步**：新增了商品但没把 ID 写入布隆过滤器，导致新商品查不到。**解决**：在数据写入 DB 后同步写入布隆过滤器，用消息队列保证最终一致性。
3. **空值缓存的内存膨胀**：恶意攻击用随机 UUID 请求，每个 UUID 都缓存了空值，导致 Redis 内存暴涨。**解决**：空值缓存用极短 TTL（30s-2min）+ 限制空值缓存总数。
4. **布隆过滤器不支持删除**：商品下架后无法从布隆过滤器中移除，导致误判率逐渐升高。**解决**：定期重建布隆过滤器；或使用 Counting Bloom Filter/Cuckoo Filter。

### 2.6 面试追问点

> **Q1：布隆过滤器的 Hash 函数选几个？位数组多大？**  
> A：Google Guava 的实现中，给定预期元素数 n 和误判率 p，会自动计算最优值：`m = -n * ln(p) / (ln2)^2`，`k = (m/n) * ln2`。以 100 万数据、1% 误判率为例：m ≈ 958 万 bit ≈ 1.14MB，k ≈ 7 个哈希函数。

> **Q2：布隆过滤器和 Cuckoo Filter 的区别？**  
> A：Cuckoo Filter 支持删除操作，空间效率在低误判率时更优（< 3%），查询性能相近。Redis 的 `RedisBloom` 模块同时提供了两者。

> **Q3：如果布隆过滤器中数据量超过预期怎么办？**  
> A：误判率会显著上升。方案：(1) 初始化时预留 2-3 倍余量；(2) 监控误判率，超阈值时重建；(3) 使用可扩展布隆过滤器（Scalable Bloom Filter）。

---

## 3. 缓存雪崩

### 3.1 原理详解

缓存雪崩（Cache Avalanche）指**大量缓存 Key 在同一时间段集中过期**，或者 **Redis 服务整体不可用**，导致所有请求瞬间全部涌向数据库，造成 DB 崩溃。

与击穿的区别：击穿是"一个热点 Key"，雪崩是"大批量 Key"。

两种触发场景：
1. **Key 集中过期**：批量导入数据时设置了相同的 TTL
2. **Redis 宕机**：单点故障或集群大面积故障

### 3.2 实现方案对比

| 方案 | 解决的问题 | 原理 | 复杂度 |
|------|-----------|------|--------|
| **随机过期时间** | Key 集中过期 | TTL = baseTime + random(0, 300s) | 低 |
| **多级缓存** | 单层缓存失效 | L1(Caffeine) → L2(Redis) → DB | 高 |
| **熔断降级** | DB 保护 | Sentinel/Hystrix 限流，返回兜底数据 | 中 |
| **Redis 高可用** | Redis 宕机 | 主从 + 哨兵 / Cluster | 高 |
| **预热分散** | Key 集中过期 | 上线前预热，TTL 错峰 | 低 |

### 3.3 代码示例

#### 随机过期时间

```java
public void batchSetCache(Map<String, String> dataMap) {
    int baseTtl = 3600; // 基础过期时间 1 小时
    Random random = new Random();
    
    dataMap.forEach((key, value) -> {
        // 在基础 TTL 上加一个 0~300s 的随机值
        int ttl = baseTtl + random.nextInt(300);
        redis.setex(key, ttl, value);
    });
}
```

#### 熔断降级兜底（基于 Sentinel）

```java
@SentinelResource(value = "getProduct", 
                   blockHandler = "getProductFallback",
                   fallback = "getProductFallback")
public Product getProduct(String id) {
    String cache = redis.get("product:" + id);
    if (cache != null) {
        return JSON.parseObject(cache, Product.class);
    }
    // 查 DB
    Product product = productDao.selectById(id);
    redis.setex("product:" + id, 3600 + new Random().nextInt(300),
                JSON.toJSONString(product));
    return product;
}

// 兜底方法：返回默认/缓存的旧数据
public Product getProductFallback(String id, Throwable ex) {
    log.warn("触发降级，key={}", id, ex);
    // 可以从本地缓存返回旧数据
    return localCache.getIfPresent(id);
}
```

### 3.4 生产踩坑经验

1. **批量导入设置统一 TTL**：运营批量上传商品，全部设置 `TTL=3600`，正好 1 小时后全部过期。**解决**：所有 TTL 加随机偏移，这应该写进开发规范。
2. **Redis 哨兵切换期间的请求雪崩**：主节点宕机到哨兵选举完成通常需要 10-30 秒，这段时间所有写操作失败。**解决**：客户端配置重试 + 本地缓存兜底，应用层做好降级。
3. **雪崩和击穿叠加**：大量 Key 过期的同时，其中还包含热点 Key。**解决**：热点 Key 用逻辑过期或永不过期方案单独处理。

### 3.5 面试追问点

> **Q1：随机过期时间的随机范围设多大合适？**  
> A：经验值是基础 TTL 的 5%-15%。如果基础 TTL 是 1 小时，随机范围可设 3-5 分钟。核心是让 Key 过期时间分散到一个窗口内，而不是同一秒。

> **Q2：Redis 完全不可用时怎么保证系统基本可用？**  
> A：(1) 多级缓存，本地缓存 L1 兜底；(2) 熔断器限流，DB 层只放行部分请求；(3) 静态化降级页面；(4) 提前演练 Redis 故障场景。

---

## 4. 缓存一致性

### 4.1 原理详解

缓存一致性是缓存领域最核心也是最难的问题。本质是**分布式系统中，同一份数据有两个存储（Cache + DB），在更新时如何保证两者数据一致**。

根据 CAP 理论，在分布式环境下无法同时保证强一致性和高可用性，实际方案都是在**最终一致性**上做文章。

### 4.2 经典模式对比

| 模式 | 读 | 写 | 一致性 | 适用场景 |
|------|----|----|--------|----------|
| **Cache Aside** | 先读缓存，miss 则读 DB 回填 | 先更新 DB，再删缓存 | 最终一致（有极小窗口不一致） | 最常用，适合大多数场景 |
| **Read Through** | 应用只读缓存，缓存层自动加载 | 同 Cache Aside | 最终一致 | 缓存中间件支持（如 Guava LoadingCache） |
| **Write Through** | 同上 | 应用写缓存，缓存层同步写 DB | 强一致 | 缓存中间件支持同步写 DB |
| **Write Behind (Back)** | 同上 | 应用写缓存，缓存层异步批量写 DB | 弱一致 | 高写入吞吐场景（如计数器） |

### 4.3 Cache Aside 深度分析

#### 为什么是"先更新 DB，再删缓存"而不是"先删缓存，再更新 DB"？

**先删缓存再更新 DB 的问题**：

```
时间线:
T1: 线程A 删除缓存 ✓
T2: 线程B 读缓存 miss → 读 DB（旧值）→ 写入缓存（旧值）
T3: 线程A 更新 DB（新值）
结果: 缓存=旧值, DB=新值 → 不一致！且在 TTL 内一直不一致
```

**先更新 DB 再删缓存的问题**（概率极低）：

```
时间线（需要极端条件：缓存恰好过期 + 读比写快）:
T1: 线程A 读缓存 miss → 读 DB（旧值）
T2: 线程B 更新 DB（新值）
T3: 线程B 删除缓存 ✓
T4: 线程A 将旧值写入缓存
结果: 缓存=旧值, DB=新值 → 不一致！
```

但这种情况概率极低，因为它要求：缓存恰好在读的时候过期 + DB 写操作比 DB 读操作还快（通常写比读慢得多）。

#### 为什么是"删缓存"而不是"更新缓存"？

1. **避免并发写覆盖**：线程 A 和 B 同时更新，A 先写 DB 但后写缓存，导致缓存里是 A 的值而 DB 是 B 的值
2. **Lazy 计算**：有些缓存值是复杂计算的结果，更新可能浪费资源（可能更新了但没人读）
3. **删除是幂等的**：多次删除不会有问题，多次更新可能互相覆盖

### 4.4 延迟双删

```java
public void updateWithDoubleDelete(String key, Object newValue) {
    // 第一次删除缓存
    redis.del(key);
    
    // 更新数据库
    db.update(newValue);
    
    // 延迟第二次删除（覆盖在"第一次删除到DB更新完成"之间其他线程回填的旧值）
    ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    scheduler.schedule(() -> {
        redis.del(key);
        log.info("延迟双删完成, key={}", key);
    }, 500, TimeUnit.MILLISECONDS); // 延迟 500ms ~ 1s
}
```

**延迟时间怎么定？** 需要大于"一次 DB 读取 + 缓存回写"的时间。通常设置 500ms ~ 1s。可以通过监控业务读请求的 P99 延迟来确定。

### 4.5 Canal 监听 Binlog 方案

这是目前大厂最推荐的方案，实现了**彻底的解耦**：

```
应用 → 更新 DB → MySQL Binlog → Canal → MQ → 缓存更新服务 → 删除/更新 Redis
```

```java
// Canal 客户端监听 Binlog 变更
@Component
public class CanalBinlogListener {
    
    @Autowired
    private RedisTemplate<String, String> redis;
    
    @KafkaListener(topics = "canal_product_topic")
    public void onMessage(String message) {
        CanalMessage msg = JSON.parseObject(message, CanalMessage.class);
        
        if ("UPDATE".equals(msg.getType()) || "DELETE".equals(msg.getType())) {
            List<Map<String, String>> data = msg.getData();
            for (Map<String, String> row : data) {
                String productId = row.get("id");
                String cacheKey = "product:" + productId;
                
                // 删除缓存（下次读时自动回填）
                redis.delete(cacheKey);
                log.info("Binlog触发缓存删除: key={}", cacheKey);
            }
        }
    }
}
```

**优势**：应用代码无侵入，只管写 DB，缓存一致性由基础设施保证。  
**缺点**：引入 Canal 和 MQ 增加运维复杂度；有秒级延迟。

### 4.6 生产踩坑经验

1. **删缓存失败导致长期不一致**：网络抖动导致 `redis.del()` 失败。**解决**：删除失败后发 MQ 重试（保证最终一致性），或用 Canal 方案兜底。
2. **延迟双删的延迟时间不合理**：设太短（100ms）没效果，设太长（5s）不一致窗口太大。**解决**：基于监控的 P99 延迟动态调整。
3. **Canal 消息积压**：大促期间 DB 写入量暴增，Canal 消费不过来，导致缓存删除延迟很大。**解决**：MQ 消费端水平扩展；设置告警；对超时消息做补偿。

### 4.7 面试追问点

> **Q1：Cache Aside 的极端不一致场景能完全避免吗？**  
> A：不能 100% 避免，只能降低概率。通过 TTL 兜底（最终一致）+ 延迟双删（缩短窗口）+ Canal 监听（双保险）多层保障。在分布式系统中追求的是"最终一致性"。

> **Q2：Write Behind 模式有什么风险？**  
> A：最大风险是数据丢失——数据只在缓存中还没来得及写 DB 时缓存宕机。适用于可容忍少量丢失的场景（如页面浏览量计数）。

> **Q3：为什么大厂倾向于用 Canal 方案？**  
> A：(1) 代码零侵入，业务开发不用关心缓存一致性；(2) 可以订阅多种下游（缓存/ES/数仓）；(3) Binlog 是 DB 的 WAL，可靠性有保障。

---

## 5. Redis 数据结构与底层编码

### 5.1 核心数据结构底层实现

Redis 对外暴露 5 种基本数据类型，但底层使用了多种编码方式，根据数据量自动切换以优化内存和性能。

#### 5.1.1 String → SDS（Simple Dynamic String）

Redis 没有使用 C 语言原生字符串，而是自己实现了 SDS：

```c
struct sdshdr {
    int len;      // 已使用长度
    int free;     // 剩余空间
    char buf[];   // 实际数据
};
```

**SDS vs C 字符串**：

| 特性 | C 字符串 | SDS |
|------|---------|-----|
| 获取长度 | O(n) 遍历 | O(1) 直接读 len |
| 缓冲区溢出 | 可能溢出 | 自动扩容 |
| 修改内存重分配 | 每次都要 | 空间预分配 + 惰性释放 |
| 二进制安全 | 不安全（\0 截断） | 安全（用 len 判断结束） |

**空间预分配策略**：
- 修改后 len < 1MB：分配 2*len + 1 byte
- 修改后 len >= 1MB：分配 len + 1MB + 1 byte

String 编码有三种：`int`（纯整数）、`embstr`（≤44 字节的短字符串，SDS 与 redisObject 在一块连续内存中）、`raw`（>44 字节）。

#### 5.1.2 Hash → ziplist / hashtable

- **ziplist（压缩列表）**：元素数 ≤ `hash-max-ziplist-entries`（默认 128）且所有值大小 ≤ `hash-max-ziplist-value`（默认 64 字节）时使用。连续内存，遍历查找 O(n)，但数据量小时内存效率极高。
- **hashtable**：超过阈值后转换。渐进式 rehash：同时维护 ht[0] 和 ht[1] 两张表，在每次 CRUD 操作时迁移一部分数据，避免一次性 rehash 阻塞。

> 注意：Redis 7.0 开始，ziplist 被 **listpack** 替代，解决了 ziplist 的级联更新问题。

#### 5.1.3 List → quicklist（ziplist 的双向链表）

Redis 3.2 之后，List 底层统一使用 quicklist：

```
quicklistNode ↔ quicklistNode ↔ quicklistNode
    ↓               ↓               ↓
 ziplist          ziplist          ziplist
```

每个 quicklistNode 内部是一个 ziplist，节点之间用双向链表连接。`list-max-ziplist-size` 控制每个 ziplist 的大小。这样既利用了 ziplist 的内存紧凑，又避免了单个 ziplist 太大导致的性能问题。

#### 5.1.4 Set → intset / hashtable

- **intset**：所有元素都是整数且数量 ≤ `set-max-intset-entries`（默认 512）时使用。有序整数数组，支持二分查找，内存极省。
- **hashtable**：包含非整数或超出阈值时转换。

#### 5.1.5 ZSet → ziplist / skiplist + hashtable

- **ziplist**：元素数 ≤ `zset-max-ziplist-entries`（默认 128）且值大小 ≤ `zset-max-ziplist-value`（默认 64 字节）。元素和分数交替存储。
- **skiplist + hashtable**：超出阈值后同时使用两种结构——skiplist 支持范围查询 O(logN)，hashtable 支持单元素查找 O(1)。两者共享元素的 SDS 指针，不会额外占用内存。

**跳跃表核心特性**：
- 最高 32 层，晋升概率 1/4（`ZSKIPLIST_P = 0.25`）
- 查找、插入、删除平均 O(logN)
- 比红黑树实现简单，范围查询更高效（直接沿 level[0] 遍历）

### 5.2 高级数据结构

#### Stream（Redis 5.0+）

基于 Radix Tree 实现的消息队列，支持消费者组：

```java
// 生产者
redis.xadd("mystream", StreamEntryID.NEW_ENTRY, 
           Map.of("action", "buy", "product", "iPhone"));

// 创建消费者组
redis.xgroupCreate("mystream", "group1", StreamEntryID.LAST_ENTRY, true);

// 消费者读取（阻塞）
List<Map.Entry<String, List<StreamEntry>>> result = 
    redis.xreadGroup("group1", "consumer1", 
                     XReadGroupParams.xReadGroupParams().count(10).block(2000),
                     Map.of("mystream", StreamEntryID.UNRECEIVED_ENTRY));

// ACK 确认
redis.xack("mystream", "group1", entryId);
```

#### Bitmap / HyperLogLog / GEO

| 结构 | 底层 | 用途 | 命令 |
|------|------|------|------|
| **Bitmap** | String（位操作） | 签到、在线状态、布隆过滤器 | SETBIT / GETBIT / BITCOUNT |
| **HyperLogLog** | 基于概率的基数估计 | UV 统计（误差 0.81%） | PFADD / PFCOUNT / PFMERGE |
| **GEO** | ZSet（GeoHash 编码为 score） | 附近的人/店铺 | GEOADD / GEORADIUS / GEODIST |

### 5.3 面试追问点

> **Q1：为什么 ZSet 要同时使用 skiplist 和 hashtable？**  
> A：skiplist 擅长范围查询（ZRANGE/ZRANGEBYSCORE），hashtable 擅长单点查找（ZSCORE）。两者配合覆盖所有操作的高效性。共享 SDS 指针，内存开销可控。

> **Q2：ziplist 的级联更新是什么问题？**  
> A：ziplist 中每个 entry 的 prevlen 字段记录前一个 entry 的长度，用 1 或 5 字节表示。如果一个 entry 变大导致 prevlen 从 1 字节变为 5 字节，可能引发后续所有 entry 的连锁更新。Redis 7.0 引入 listpack 解决了这个问题——listpack 不记录前一个 entry 的长度，而是记录自身长度，从根本上避免了级联更新。

> **Q3：Redis 为什么用跳跃表而不是红黑树？**  
> A：Redis 作者 antirez 的解释：(1) 跳跃表实现更简单，易于调试和维护；(2) 范围操作时，跳跃表直接沿底层链表遍历，比红黑树做中序遍历更高效；(3) 通过调整晋升概率可以灵活平衡时间和空间；(4) 并发场景下跳跃表比红黑树更容易实现无锁。

---

## 6. Redis 持久化

### 6.1 RDB（Redis Database）

#### 6.1.1 fork + COW 原理

RDB 持久化的核心机制是 **fork 子进程 + Copy-On-Write**：

1. **fork()**：Redis 主进程调用 `fork()` 创建子进程。fork 使用操作系统的 COW 机制，子进程与父进程共享内存页
2. **子进程遍历内存**，将数据写入临时 RDB 文件
3. **写时复制**：fork 后如果主进程修改了某个内存页，OS 会复制该页（只复制被修改的页），子进程仍然读取原始数据
4. 子进程完成后用临时文件**原子替换**旧的 RDB 文件

**触发时机**：
- `save m n`：m 秒内有 n 次修改（如 `save 900 1`）
- `BGSAVE` 命令手动触发
- 主从全量同步时自动触发
- `SHUTDOWN` 关闭服务时

#### 6.1.2 RDB 优缺点

| 优点 | 缺点 |
|------|------|
| 紧凑的二进制文件，恢复速度快 | 两次快照间的数据可能丢失 |
| 适合做备份/容灾 | fork 大内存实例时可能阻塞（copy 页表） |
| 对主进程性能影响小（子进程完成工作） | COW 在写入密集时内存可能翻倍 |

### 6.2 AOF（Append Only File）

AOF 记录每一条写命令，追加到文件末尾。

#### 写入策略

| 策略 | 行为 | 数据安全 | 性能 |
|------|------|----------|------|
| `always` | 每条命令都 fsync | 最多丢 1 条命令 | 最差 |
| `everysec` | 每秒 fsync 一次 | 最多丢 1 秒数据 | 推荐 |
| `no` | 由 OS 决定何时 flush | 可能丢较多数据 | 最好 |

#### AOF 重写（BGREWRITEAOF）

AOF 文件会越来越大，重写机制将多条命令合并为等效的最小命令集：

```
原始 AOF:
SET name "Alice"
SET name "Bob"      → 重写后: SET name "Charlie"
SET name "Charlie"

LPUSH list a
LPUSH list b        → 重写后: RPUSH list a b c
LPUSH list c
```

重写同样使用 fork 子进程。重写期间新的写命令同时追加到 **AOF 缓冲区**和 **AOF 重写缓冲区**，重写完成后将重写缓冲区的内容追加到新 AOF 文件，再原子替换。

### 6.3 混合持久化（Redis 4.0+）

```
aof-use-rdb-preamble yes  # 开启混合持久化
```

AOF 重写时，先将当前数据以 RDB 格式写入 AOF 文件头部，然后将重写期间的增量命令以 AOF 格式追加到文件尾部。

**AOF 文件结构**：
```
[RDB 格式的全量快照 | AOF 格式的增量命令]
```

**优势**：兼顾 RDB 的快速恢复和 AOF 的数据完整性。恢复时先加载 RDB 部分（快），再重放 AOF 增量部分（少量命令）。

### 6.4 生产踩坑经验

1. **fork 阻塞主线程**：20GB 内存实例做 BGSAVE，fork 可能耗时数百毫秒，期间 Redis 完全阻塞。**解决**：(1) 控制单实例内存 ≤ 10GB；(2) 使用物理机而非虚拟机（VM fork 更慢）；(3) 关闭 THP（Transparent Huge Pages）。
2. **AOF 文件过大导致恢复慢**：AOF 文件几十 GB，Redis 重启加载半小时。**解决**：开启混合持久化 + 定期 BGREWRITEAOF。
3. **COW 导致内存翻倍**：高写入场景下，fork 后大量内存页被复制，内存可能翻倍。**解决**：预留足够内存（物理内存 ≥ 2 × Redis 数据量）；在低峰期做 RDB。

### 6.5 面试追问点

> **Q1：RDB 和 AOF 如何选择？**  
> A：生产环境推荐**同时开启**，用 AOF 保证数据安全，用 RDB 做备份和快速恢复。Redis 4.0+ 直接用混合持久化。如果是纯缓存场景且可以接受丢数据，可以只开 RDB 或都不开。

> **Q2：fork 的 COW 机制的内存开销如何估算？**  
> A：最坏情况内存翻倍（每个页都被修改），但实际场景一般增加 10%-30%。可以通过 `INFO` 命令的 `latest_fork_usec` 看 fork 耗时，`used_memory_rss` 看实际物理内存。

> **Q3：如果 AOF 文件损坏了怎么办？**  
> A：`redis-check-aof --fix <filename>` 可以修复损坏的 AOF 文件，它会截断最后一条不完整的命令。但如果中间部分损坏则无法修复，所以 RDB 备份很重要。

---

## 7. Redis 集群

### 7.1 主从复制

#### 全量同步

```
1. Slave 发送 PSYNC ? -1（首次同步）
2. Master 执行 BGSAVE 生成 RDB
3. Master 将 RDB 发送给 Slave
4. Slave 清空旧数据，加载 RDB
5. Master 将"RDB生成期间"的写命令从 repl_backlog 发送给 Slave
```

#### 增量同步

```
1. Slave 断线重连后发送 PSYNC <replid> <offset>
2. Master 检查 offset 是否在 repl_backlog 缓冲区范围内
3. 如果在 → 发送 offset 之后的增量数据（增量同步）
4. 如果不在 → 降级为全量同步
```

**repl_backlog_size**（默认 1MB）决定了增量同步的窗口大小。如果 Slave 断线时间过长导致 offset 被覆盖，就必须全量同步。

### 7.2 哨兵（Sentinel）

哨兵负责**监控 + 自动故障转移**：

1. **主观下线（SDOWN）**：单个 Sentinel 发现 Master 无响应
2. **客观下线（ODOWN）**：`quorum` 个 Sentinel 都认为 Master 下线
3. **Sentinel 选主**：基于 Raft 协议选出 Leader Sentinel
4. **故障转移**：Leader Sentinel 从 Slave 中选一个提升为新 Master（优先级 → offset 最大 → runid 最小）

### 7.3 Cluster

#### 16384 Slot 分配

Redis Cluster 将所有 Key 映射到 16384 个 slot：`slot = CRC16(key) % 16384`

为什么是 16384？
- 心跳包中每个节点携带的 slot 位图大小 = 16384/8 = 2KB，可以接受
- 如果用 65536，位图就是 8KB，gossip 消息太大
- Redis Cluster 通常不超过 1000 个节点，16384 个 slot 足够

#### Gossip 协议

节点间通过 Gossip 协议交换状态信息：
- **PING**：随机选择节点发送，携带自己和已知节点的状态
- **PONG**：PING 的回复
- **MEET**：将新节点加入集群
- **FAIL**：广播某节点已下线

#### ASK / MOVED 重定向

```
Client → Node A: GET key
Node A: 正在迁移中 → (error) ASK 12345 127.0.0.1:7002
                      （临时重定向，下次还是问 Node A）

Client → Node A: GET key
Node A: 已完成迁移 → (error) MOVED 12345 127.0.0.1:7002
                      （永久重定向，更新客户端 slot 路由表）
```

### 7.4 代码示例（JedisCluster）

```java
Set<HostAndPort> nodes = new HashSet<>();
nodes.add(new HostAndPort("10.0.0.1", 7001));
nodes.add(new HostAndPort("10.0.0.2", 7002));
nodes.add(new HostAndPort("10.0.0.3", 7003));

JedisPoolConfig config = new JedisPoolConfig();
config.setMaxTotal(200);
config.setMaxIdle(50);

// JedisCluster 自动处理 MOVED/ASK 重定向
JedisCluster cluster = new JedisCluster(nodes, 2000, 2000, 5, 
                                         "password", config);

cluster.set("user:1001", "Tom");
String value = cluster.get("user:1001");

// 注意：不支持跨 slot 的 pipeline/multi-key 操作
// 可以用 Hash Tag 强制相关 Key 分配到同一 slot
cluster.set("{order:1001}.info", "...");
cluster.set("{order:1001}.items", "...");
// {order:1001} 部分相同 → CRC16 计算时只用大括号内的内容 → 同一 slot
```

### 7.5 生产踩坑经验

1. **repl_backlog 太小导致频繁全量同步**：网络抖动 5 秒，写入量大导致 offset 被覆盖，触发全量同步，全量同步又导致主节点压力大。**解决**：根据写入 QPS 和可容忍断线时间计算 `repl_backlog_size = QPS * 平均命令大小 * 断线秒数 * 2`。
2. **Cluster 的跨 slot 操作报错**：`MGET key1 key2` 如果 key1 和 key2 不在同一 slot 会报错。**解决**：使用 Hash Tag；或客户端拆分为多次单 Key 请求。
3. **脑裂问题**：网络分区导致 Sentinel 误判 Master 下线，提升了新 Master，旧 Master 恢复后有两个 Master。**解决**：配置 `min-slaves-to-write 1` 和 `min-slaves-max-lag 10`，旧 Master 在没有 Slave 连接时拒绝写入。

### 7.6 面试追问点

> **Q1：Redis Cluster 为什么不用一致性哈希？**  
> A：一致性哈希在节点变化时迁移数据量不均匀（只影响相邻节点）。Slot 方案可以精确控制每个节点负责多少 slot，迁移时灵活指定，运维更可控。

> **Q2：Gossip 协议的收敛时间怎么保证？**  
> A：Redis Cluster 的 Gossip 频率：每秒随机选 5 个节点，选最久没通信的发 PING；每 100ms 检查有没有超过 `cluster-node-timeout/2` 没通信的节点。集群越大收敛越慢，因此建议节点数 ≤ 1000。

---

## 8. Redis 内存淘汰策略

### 8.1 八种策略详解

当 Redis 内存达到 `maxmemory` 时触发淘汰。Redis 提供 8 种策略：

| 策略 | 范围 | 算法 | 说明 |
|------|------|------|------|
| `noeviction` | - | 拒绝写入 | 默认策略，写命令返回 OOM 错误 |
| `allkeys-lru` | 所有 Key | 近似 LRU | 淘汰最久未使用的 Key |
| `volatile-lru` | 有 TTL 的 Key | 近似 LRU | 只在有过期时间的 Key 中淘汰 |
| `allkeys-lfu` | 所有 Key | 近似 LFU | 淘汰使用频率最低的 Key |
| `volatile-lfu` | 有 TTL 的 Key | 近似 LFU | 只在有过期时间的 Key 中淘汰 |
| `allkeys-random` | 所有 Key | 随机 | 随机淘汰 |
| `volatile-random` | 有 TTL 的 Key | 随机 | 只在有过期时间的 Key 中随机淘汰 |
| `volatile-ttl` | 有 TTL 的 Key | TTL 最小 | 优先淘汰 TTL 剩余时间最短的 |

### 8.2 LRU vs LFU 深度对比

#### Redis 的近似 LRU

Redis 并不维护全局的 LRU 链表（太消耗内存），而是使用**近似 LRU**：

1. 每个 key 的 `redisObject` 结构中有一个 24 bit 的 `lru` 字段，记录最后访问时间戳（秒级，精度约 194 天循环一次）
2. 淘汰时随机抽样 `maxmemory-samples`（默认 5）个 Key
3. 在样本中淘汰 LRU 值最小的（最久未访问的）
4. `maxmemory-samples` 越大越接近真实 LRU，但性能开销越大。设 10 已非常接近理想 LRU

#### Redis 的 LFU（Redis 4.0+）

LFU 复用了 `lru` 字段的 24 bit：

```
高 16 bit: ldt (Last Decrement Time) —— 上次衰减时间（分钟精度）
低 8 bit:  logc (Logarithmic Counter) —— 对数计数器（0~255）
```

**logc 的增长逻辑**（`LFULogIncr`）：
```c
uint8_t LFULogIncr(uint8_t counter) {
    if (counter == 255) return 255;     // 最大值
    double r = (double)rand()/RAND_MAX; // 随机数 [0,1)
    double baseval = counter - LFU_INIT_VAL; // 初始值为 5
    if (baseval < 0) baseval = 0;
    double p = 1.0/(baseval * lfu_log_factor + 1); // 默认 factor=10
    if (r < p) counter++;               // 概率递增
    return counter;
}
```

**衰减逻辑**：每次访问时根据距上次衰减的时间间隔来衰减 logc，`lfu-decay-time`（默认 1 分钟）控制衰减速度。

**LRU vs LFU 核心差异**：

| 维度 | LRU | LFU |
|------|-----|-----|
| 关注点 | 最近一次访问时间 | 访问频率 |
| 全表扫描问题 | 容易被"批量扫描"污染（一次性访问大量冷数据后这些冷数据变成"最新"） | 不受影响，低频数据不会因偶尔访问就避免淘汰 |
| 新 Key | 立即可能被淘汰（如果没被很快再次访问） | 初始 logc=5，有保护期 |
| 适用场景 | 访问模式稳定 | 热点明显，有频率差异 |

### 8.3 面试追问点

> **Q1：为什么 Redis 不用精确 LRU？**  
> A：精确 LRU 需要维护全局双向链表 + HashMap，每次访问都要移动节点，在 Redis 的海量 Key 场景下内存和 CPU 开销太大。近似 LRU 通过抽样达到了极好的近似效果，`maxmemory-samples=10` 时曲线几乎与理想 LRU 重合。

> **Q2：volatile-lru 如果没有设置过期时间的 Key 怎么办？**  
> A：如果没有带 TTL 的 Key 可淘汰，行为退化为 noeviction，写命令会报 OOM 错误。所以用 volatile-* 策略时要确保有足够多的 Key 设置了 TTL。

> **Q3：生产环境推荐哪种策略？**  
> A：缓存场景推荐 `allkeys-lfu`（Redis 4.0+）或 `allkeys-lru`。如果 Redis 中既有缓存数据又有持久化数据（如分布式锁），推荐 `volatile-lru`，这样不带 TTL 的持久化数据不会被淘汰。

---

## 9. 热点 Key

### 9.1 发现方式

| 方式 | 原理 | 优缺点 |
|------|------|--------|
| `redis-cli --hotkeys` | 基于 LFU 策略的采样统计 | 需开启 LFU；可能阻塞 |
| `MONITOR` 命令 | 实时输出所有命令 | **禁止生产使用**！性能损耗极大 |
| 代理层统计 | 在 Proxy（如 Twemproxy/Codis）层统计 | 无侵入，推荐 |
| 客户端统计 | 在 Jedis/Lettuce 封装层统计 | 需要改代码 |
| `redis-faina` | 分析 MONITOR 输出 | 线下分析用 |

### 9.2 解决方案

#### 二级缓存（L1 本地 + L2 Redis）

```java
@Component
public class TwoLevelCache {
    
    // L1：本地缓存（Caffeine），每个应用实例一份
    private final Cache<String, String> localCache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(5, TimeUnit.SECONDS) // 短 TTL 保证一致性
            .build();
    
    @Autowired
    private RedisTemplate<String, String> redis;
    
    public String get(String key) {
        // L1: 本地缓存
        String value = localCache.getIfPresent(key);
        if (value != null) {
            return value;
        }
        
        // L2: Redis
        value = redis.opsForValue().get(key);
        if (value != null) {
            localCache.put(key, value);
            return value;
        }
        
        // DB
        value = db.query(key);
        if (value != null) {
            redis.opsForValue().set(key, value, 30, TimeUnit.MINUTES);
            localCache.put(key, value);
        }
        return value;
    }
}
```

#### Key 拆分/分片

```java
// 将一个热点 Key 拆成多个副本，分散到不同 Redis 节点
public String getHotKey(String key) {
    // 随机后缀，分散到多个分片
    int shard = ThreadLocalRandom.current().nextInt(10);
    String shardKey = key + ":" + shard;
    
    String value = redis.get(shardKey);
    if (value == null) {
        value = db.query(key);
        if (value != null) {
            // 写入所有分片
            for (int i = 0; i < 10; i++) {
                redis.setex(key + ":" + i, 300, value);
            }
        }
    }
    return value;
}
```

### 9.3 面试追问点

> **Q1：本地缓存和 Redis 缓存的一致性怎么维护？**  
> A：(1) 本地缓存 TTL 设极短（1-5 秒），到期自动失效；(2) Redis Pub/Sub 或 MQ 广播失效通知，各实例监听后清除本地缓存；(3) 接受短暂不一致，毕竟这是缓存。

> **Q2：Key 分片方案更新数据时怎么保证所有分片一致？**  
> A：更新时用 Lua 脚本或 Pipeline 批量删除所有分片 Key。如果对一致性要求不高，也可以等 TTL 自然过期。

---

## 10. BigKey 问题

### 10.1 定义与危害

**BigKey 的标准**（业界共识）：
- String 类型：value 大小 > 10KB
- Hash/List/Set/ZSet：元素数量 > 5000，或总大小 > 10MB

**危害**：
1. **内存分布不均**：BigKey 所在节点内存远高于其他节点（Cluster 数据倾斜）
2. **网络阻塞**：一个 BigKey 的请求/响应可能占满带宽
3. **阻塞 Redis**：大 Key 的删除（DEL）可能耗时数秒，阻塞主线程
4. **持久化影响**：AOF 重写、RDB 备份时内存占用暴增

### 10.2 发现方式

```bash
# 方式一：--bigkeys 扫描（推荐线上使用，使用 SCAN 不阻塞）
redis-cli --bigkeys -i 0.1  # -i 0.1 表示每次 SCAN 间隔 0.1s

# 方式二：MEMORY USAGE（Redis 4.0+，精确到字节）
MEMORY USAGE mykey

# 方式三：DEBUG OBJECT（查看编码和序列化大小）
DEBUG OBJECT mykey
```

### 10.3 删除方案

```java
// ❌ 错误方式：直接 DEL
redis.del("big:hash:key"); // 可能阻塞 Redis 数秒

// ✅ 正确方式 1：UNLINK 异步删除（Redis 4.0+）
redis.unlink("big:hash:key"); // 在后台线程异步释放内存

// ✅ 正确方式 2：渐进式删除（兼容低版本）
public void progressiveDeleteHash(String key) {
    ScanParams params = new ScanParams().count(100);
    String cursor = "0";
    do {
        ScanResult<Map.Entry<String, String>> result = 
            redis.hscan(key, cursor, params);
        cursor = result.getCursor();
        List<Map.Entry<String, String>> entries = result.getResult();
        
        if (!entries.isEmpty()) {
            String[] fields = entries.stream()
                .map(Map.Entry::getKey)
                .toArray(String[]::new);
            redis.hdel(key, fields); // 批量删除
        }
    } while (!"0".equals(cursor));
    
    redis.del(key); // 最后删除空 Key
}
```

### 10.4 拆分方案

```java
// 拆分前：一个 Hash 存了 100 万用户属性
// HGETALL user:all → BigKey!

// 拆分后：按 ID 范围分片
// user:0   → 存 ID 0~9999
// user:1   → 存 ID 10000~19999
// user:99  → 存 ID 990000~999999

public String getUserField(long userId, String field) {
    int shard = (int) (userId / 10000);
    String key = "user:" + shard;
    return redis.hget(key, userId + ":" + field);
}
```

### 10.5 生产踩坑经验

1. **DEL BigKey 导致主从延迟**：在主节点删了一个 500 万元素的 Set，主线程阻塞 3 秒，从节点同步延迟。**解决**：使用 UNLINK 异步删除，或渐进式删除。
2. **序列化导致 BigKey**：把整个 Java 对象序列化后存入 String，对象中有大列表。**解决**：拆分存储，大列表单独用 List/Hash 存。

### 10.6 面试追问点

> **Q1：UNLINK 和 DEL 的区别？**  
> A：DEL 在主线程同步释放内存；UNLINK 在主线程中移除 Key 的引用（O(1)），然后将内存释放操作交给后台的 `lazyfree` 线程异步执行。对于小 Key 两者差异不大，对于 BigKey 差异巨大。

> **Q2：Redis 4.0+ 的 lazy-free 机制有哪些配置？**  
> A：`lazyfree-lazy-expire yes`（过期删除异步化）、`lazyfree-lazy-server-del yes`（隐式删除异步化，如 RENAME 覆盖）、`lazyfree-lazy-user-del yes`（DEL 命令等同于 UNLINK）。建议全部开启。

---

## 11. 多级缓存架构

### 11.1 架构设计

```
请求 → L1 Caffeine (本地缓存，毫秒级)
        ↓ miss
       L2 Redis (分布式缓存，1-3ms)
        ↓ miss
       DB (MySQL/PG，10-100ms)
```

各层职责：

| 层级 | 实现 | TTL | 容量 | 特点 |
|------|------|-----|------|------|
| L1 | Caffeine / Guava | 极短（1-10s） | 小（按应用实例） | 零网络开销，极低延迟 |
| L2 | Redis Cluster | 中等（5-30min） | 大（集群共享） | 分布式共享，持久化 |
| DB | MySQL | - | 全量 | 权威数据源 |

### 11.2 JetCache 框架示例

JetCache 是阿里开源的多级缓存框架，原生支持 L1 + L2 两级缓存：

```java
// JetCache 配置
@EnableMethodCache(basePackages = "com.example")
@EnableCreateCacheAnnotation
@Configuration
public class JetCacheConfig {
    // application.yml 中配置
    // jetcache:
    //   local:
    //     default:
    //       type: caffeine
    //       limit: 10000
    //       keyConvertor: fastjson2
    //       expireAfterWriteInMillis: 5000
    //   remote:
    //     default:
    //       type: redis.lettuce
    //       keyConvertor: fastjson2
    //       valueEncoder: java
    //       valueDecoder: java
    //       uri: redis://localhost:6379/
    //       expireAfterWriteInMillis: 1800000
}

// 使用注解
@Service
public class ProductService {
    
    // 方式一：注解声明式多级缓存
    @Cached(name = "product:", key = "#id", expire = 1800,
            cacheType = CacheType.BOTH, // BOTH = L1 + L2
            localExpire = 5, localLimit = 1000)
    public Product getProduct(Long id) {
        return productDao.selectById(id);
    }
    
    // 方式二：编程式 API
    @CreateCache(name = "product:", expire = 1800, 
                 cacheType = CacheType.BOTH,
                 localExpire = 5, localLimit = 1000)
    private Cache<Long, Product> productCache;
    
    public Product getById(Long id) {
        return productCache.computeIfAbsent(id, 
            key -> productDao.selectById(key));
    }
    
    // 更新时同时清除两级缓存
    @CacheInvalidate(name = "product:", key = "#product.id")
    public void updateProduct(Product product) {
        productDao.updateById(product);
    }
}
```

### 11.3 一致性维护

多级缓存的一致性维护是核心难点——**多个应用实例各有一份 L1，如何在数据变更时通知所有实例清除本地缓存？**

#### 方案一：Redis Pub/Sub 广播

```java
@Component
public class CacheInvalidateListener {
    
    private static final String CACHE_INVALIDATE_CHANNEL = "cache:invalidate";
    
    @Autowired
    private Cache<String, Object> localCache;
    @Autowired
    private RedisTemplate<String, String> redis;
    
    // 数据变更时发布消息
    public void publishInvalidate(String cacheKey) {
        redis.delete(cacheKey); // 清除 L2
        redis.convertAndSend(CACHE_INVALIDATE_CHANNEL, cacheKey); // 通知所有实例
    }
    
    // 所有实例订阅，收到消息后清除本地缓存
    @Bean
    public MessageListenerAdapter listenerAdapter() {
        return new MessageListenerAdapter((message, pattern) -> {
            String cacheKey = new String(message.getBody());
            localCache.invalidate(cacheKey); // 清除 L1
            log.info("收到缓存失效通知，清除本地缓存: {}", cacheKey);
        });
    }
}
```

#### 方案二：MQ 广播（更可靠）

Redis Pub/Sub 是 fire-and-forget 的，如果实例恰好不在线就收不到。改用 RocketMQ/Kafka 的广播模式更可靠：

```java
@RocketMQMessageListener(topic = "CACHE_INVALIDATE_TOPIC",
                          consumerGroup = "${spring.application.name}_${random.value}",
                          messageModel = MessageModel.BROADCASTING)
@Component
public class CacheInvalidateMQListener implements RocketMQListener<String> {
    
    @Autowired
    private Cache<String, Object> localCache;
    
    @Override
    public void onMessage(String cacheKey) {
        localCache.invalidate(cacheKey);
        log.info("MQ广播 → 清除本地缓存: {}", cacheKey);
    }
}
```

### 11.4 Caffeine vs Guava Cache 对比

| 特性 | Guava Cache | Caffeine |
|------|-------------|----------|
| 淘汰算法 | LRU | W-TinyLFU（命中率更高） |
| 并发性能 | 基于分段锁 | 基于 ConcurrentHashMap，更高 |
| 异步支持 | 不支持 | 支持 AsyncLoadingCache |
| 刷新机制 | refreshAfterWrite | 同上 + 更精细控制 |
| 性能基准 | 基准线 | 读写性能约 Guava 的 2-3 倍 |

**W-TinyLFU 算法**：Window TinyLFU 是 Caffeine 的核心创新——使用三个区域（Window Cache → Probation → Protected）和 Count-Min Sketch 频率统计，结合了 LRU 的"新鲜度"和 LFU 的"频率"优势，命中率在各种访问模式下都优于纯 LRU/LFU。

### 11.5 生产踩坑经验

1. **L1 缓存导致多实例数据不一致**：实例 A 更新了数据，实例 B 的本地缓存还是旧的，用户在两个实例间负载均衡，看到数据"闪烁"。**解决**：L1 的 TTL 必须极短（1-5 秒）+ 消息广播通知清除。
2. **JetCache 序列化坑**：L1 用 Java 引用，L2 用序列化存储。从 L1 拿到的对象修改后会影响缓存本身（因为是同一引用），而 L2 不会。**解决**：取出对象后 clone 再修改，或 JetCache 配置 `copyOnGet` 和 `copyOnSet`。
3. **缓存穿透到 DB 后，回填顺序错误**：查 DB 后只写了 L2 没写 L1，导致下次还是 L1 miss → 查 L2。**解决**：回填必须 L1 + L2 同时写入。

### 11.6 面试追问点

> **Q1：什么场景需要多级缓存，而不是单纯用 Redis？**  
> A：(1) 极高 QPS 的热点数据（Redis 单分片也扛不住，需要 L1 分担）；(2) 对延迟极敏感的场景（Redis 网络 RTT 1-3ms，Caffeine 几百纳秒）；(3) Redis 故障时需要兜底。典型如：商品详情页、活动页配置。

> **Q2：L1 的容量和 TTL 怎么设？**  
> A：容量按"热点数据量"估算，一般一个应用实例 1000-50000 个 Key。TTL 越短一致性越好但命中率越低，经验值 1-10 秒。可以监控 L1 的命中率来调优。

> **Q3：Canal + MQ + 多级缓存怎么组合成完整的缓存更新链路？**  
> A：应用写 DB → MySQL Binlog → Canal → MQ → 缓存更新服务同时做两件事：(1) 删除 Redis L2 缓存；(2) 发送广播消息通知所有实例清除 L1。这样实现了全链路的数据变更感知，业务代码零侵入。

---

## 附录：面试高频综合题

### Q：一个完整的缓存系统需要考虑哪些方面？

一个生产级缓存系统至少要考虑以下 8 个维度：

1. **缓存策略**：Cache Aside / Read Through / Write Through / Write Behind —— 根据业务选型
2. **异常处理**：击穿（互斥锁/逻辑过期）、穿透（布隆过滤器+空值缓存）、雪崩（随机 TTL+多级缓存+熔断）
3. **一致性保障**：延迟双删 + Canal Binlog 监听 + MQ 广播
4. **高可用**：Redis Sentinel / Cluster + 本地缓存降级
5. **热点处理**：热点发现 + 本地缓存 + Key 分片
6. **BigKey 治理**：定期扫描 + UNLINK 异步删除 + 数据拆分
7. **内存管理**：合理的淘汰策略 + 内存监控告警
8. **监控运维**：命中率、延迟 P99、内存使用率、慢日志 —— 缺一不可

> 记住这个框架，面试中无论从哪个角度追问，都能展开讲。

---

*本手册覆盖大厂缓存面试高频考点，建议结合源码阅读和实际项目实践加深理解。*

## 相关文章

- [redis-interview-map](/posts/redis/redis-interview-map/)
