---
title: primer 题解完整拆解：推特时间线、Pastebin/短链、查询缓存、销售排行
date: 2026-11-05
summary: 按 primer 四步法完整拆解 4 道经典题解：用例与约束、容量估算、核心组件（表结构 / API / Java 代码）、扩展瓶颈，并指出原题解里的 5 处疏漏与修正。
interview: false
kind: primer
---

这篇按 [system-design-primer](https://github.com/donnemartin/system-design-primer/blob/master/README-zh-Hans.md) 题解的原始结构，把 4 道题**从头到尾**拆一遍：用例 → 约束和估算 → 核心组件 → 扩展。原文是 Python 骨架代码，这里改写成 Java，并补上原文省略的部分。

[题解代码精讲](/posts/system-design/solutions-code/)里已经讲过查询缓存和销售排行的核心代码，这篇补齐它们的用例、估算和扩展部分；推特时间线和 Pastebin 是新增的。

**原题解的疏漏：** 读的过程中发现 5 处问题，在每题的「修正」小节里说明，汇总在文末。

---

## 一、推特时间线与搜索

### 1.1 用例

**要做：**
- 用户发推，系统推送给关注者，并发送通知
- 查看**用户时间线**（某个人自己发的推）
- 查看**主页时间线**（我关注的人发的推）
- 按关键词搜索
- 服务高可用

**不做：** 向第三方推送数据流、按可见性设置过滤推文。

### 1.2 约束与估算

| 项 | 数值 | 怎么算 |
| --- | --- | --- |
| 活跃用户 | 1 亿 | 已知 |
| 每天新推文 | 5 亿条 | 已知；每月 150 亿条 |
| 平均扇出 | 每条推送给 5 人 | 已知；每天 50 亿次投递 |
| 单条推文大小 | 约 10 KB | 文本 140 字节，媒体平均 10 KB 占大头 |
| 每月新增存储 | **150 TB** | 10 KB × 5 亿 × 30 天；3 年约 5.4 PB |
| 读 QPS | **约 10 万** | 每月 2500 亿次读 ÷ 250 万秒 |
| 发推 QPS | **约 6000** | 150 亿 ÷ 250 万秒 |
| 投递 QPS | **约 6 万** | 1500 亿 ÷ 250 万秒 |
| 搜索 QPS | **约 4000** | 100 亿 ÷ 250 万秒 |

**结论：** 读远多于写，主页时间线必须**预先算好放在内存里**。

**换算口诀：** 一个月约 250 万秒。每秒 1 次请求，等于每月 250 万次；每秒 400 次，等于每月 10 亿次。

### 1.3 核心组件

**发推（写扩散）：**

```text
客户端 → Web 服务器 → 写 API
  ├─ 推文写入 SQL（作者自己的用户时间线）
  └─ 调用扇出服务：
       ├─ 从用户关系服务（内存）查出所有粉丝
       ├─ 把推文 ID 写进每个粉丝的主页时间线缓存（Redis List），O(粉丝数)
       ├─ 写入搜索索引
       ├─ 媒体文件存入对象存储
       └─ 通知服务（通过队列异步发送）
```

**主页时间线在 Redis 里的结构：** 每个元素只存 `tweet_id`（8 字节）+ `user_id`（8 字节）+ 元数据（1 字节），一共 17 字节，不存推文正文。读取时再批量查询正文。

```java
class FanOutService {
    private final Jedis redis;
    private final UserGraphService graph;
    private static final int TIMELINE_MAX = 800;   // 每人只保留最近几百条

    void fanOut(long authorId, long tweetId) {
        byte[] entry = ByteBuffer.allocate(17).putLong(tweetId).putLong(authorId).put((byte) 0).array();
        try (Pipeline p = redis.pipelined()) {       // 用 pipeline 批量写，减少网络往返
            for (long follower : graph.activeFollowers(authorId)) {   // 只推给活跃粉丝
                byte[] key = ("home:" + follower).getBytes();
                p.lpush(key, entry);
                p.ltrim(key, 0, TIMELINE_MAX - 1);
            }
            p.sync();
        }
    }
}
```

**读主页时间线：**

```java
class TimelineService {
    List<TweetView> home(long userId, int count) {
        List<byte[]> entries = redis.lrange(("home:" + userId).getBytes(), 0, count - 1); // O(1) 定位
        List<Long> tweetIds = new ArrayList<>(), userIds = new ArrayList<>();
        for (byte[] e : entries) { ByteBuffer b = ByteBuffer.wrap(e); tweetIds.add(b.getLong()); userIds.add(b.getLong()); }
        Map<Long, Tweet> tweets = tweetInfo.multiGet(tweetIds);   // 批量取正文，O(n)
        Map<Long, User> users = userInfo.multiGet(userIds);       // 批量取作者信息，O(n)
        return tweetIds.stream().map(id -> TweetView.of(tweets.get(id), users.get(tweets.get(id).authorId()))).toList();
    }
}
```

**用户时间线：** 直接从 SQL 按 `user_id + created_at` 索引查询，不需要扇出。

**搜索：** 解析查询（去标点、分词、纠错、统一大小写、转成布尔表达式）→ **分发到搜索集群的所有分片，再汇总结果**（scatter-gather）→ 合并、打分、排序后返回。

**API：** 对外用 REST（`POST /api/v1/tweet`、`GET /api/v1/home_timeline?user_id=`、`GET /api/v1/search?query=`），服务之间用 RPC。

### 1.4 扩展与瓶颈

- **扇出服务是最大的瓶颈：** 一个有几百万粉丝的大 V 发一条推，扇出要几分钟，还可能导致 @回复比原推先到达（竞态）。
  - **解决办法（推拉结合）：** 大 V 的推文**不扇出**，粉丝读主页时间线时，再单独拉取他关注的大 V 的最新推文，和缓存里的时间线合并，按时间排序。
- **省内存：**
  - 每人的主页时间线只缓存几百条；
  - **只为活跃用户缓存**。30 天没活跃的用户，下次登录时再从 SQL 重建时间线。
  - 推文信息服务只保留最近一个月的推文；用户信息服务只缓存活跃用户。
- **搜索：** 索引放在内存里，以降低延迟。
- **数据库：** 读请求靠缓存加只读从库；每秒 6000 次的写入，单个主库扛不住，需要按功能拆库、分片、做反范式，或者把部分数据迁到 NoSQL。

### 1.5 修正与补充

1. **估算公式有笔误。** 原文中文版写的是「每秒 400 次请求 / **每月 10 次**请求」，少了「亿」字，应该是每月 10 亿次。
2. **字段大小不合理。** `user_id` 写成了 32 字节，实际用 8 字节的 long 就够了（Snowflake ID）。
3. **补充：** 国内微博的做法类似，普通用户写扩散，大 V 读扩散。站内对应的题见 [架构师分级题 · Feed 流](/posts/architect/architect-tiered-interview/#q7)。

---

## 二、Pastebin / 短链（Bit.ly）

**两者的区别：** Pastebin 要存储文本**内容**；短链只存储**原始 URL**。生成短码的方法完全相同。

### 2.1 用例与约束

**要做：**
- 用户粘贴文本，得到一个随机链接；可以设置过期时间，默认永不过期
- 访问链接，看到内容
- 用户匿名使用
- 统计访问量
- 清理过期内容
- 服务高可用

**不做：** 注册登录、编辑内容、设置可见性、自定义短链。

| 项 | 数值 | 怎么算 |
| --- | --- | --- |
| 用户 | 1000 万 | 已知 |
| 每月写入 | 1000 万条 | 写 QPS ≈ **4** |
| 每月读取 | 1 亿次 | 读 QPS ≈ **40**，读写比 10:1 |
| 单条大小 | 约 1.27 KB | 内容 1 KB，加上短码、过期时间、创建时间、存储路径 |
| 每月新增 | **12.7 GB** | 3 年约 450 GB，共 3.6 亿条 |

**结论：** 这道题的规模很小，单个主库加缓存就够了。**面试时要能看出「不需要过度设计」**。

### 2.2 核心组件

**表结构：** 关系数据库当作一张大哈希表用，内容本身放对象存储。

```sql
CREATE TABLE pastes (
  shortlink CHAR(7) PRIMARY KEY,
  paste_path VARCHAR(255) NOT NULL,          -- 对象存储里的路径
  expiration_length_in_minutes INT NOT NULL,  -- 0 表示永不过期
  created_at DATETIME NOT NULL,
  expire_at DATETIME NULL,                    -- 补充：冗余存一个过期时间点，方便建索引批量清理
  KEY idx_expire (expire_at)
);
```

**短码生成：** primer 的做法是 `base62(md5(ip + 时间戳))`，取前 7 位。62^7 约 3.5 万亿，远大于 3 年 3.6 亿条的需要。

```java
final class ShortLink {
    private static final char[] ALPHABET =
        "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".toCharArray();

    static String base62(long num) {          // O(k)，k 是位数
        StringBuilder sb = new StringBuilder();
        do { sb.append(ALPHABET[(int) (num % 62)]); num /= 62; } while (num > 0);
        return sb.reverse().toString();
    }

    /** primer 原方案：取哈希值再截断，冲突时需要重试 */
    static String fromHash(String ip, long ts) throws Exception {
        byte[] md5 = MessageDigest.getInstance("MD5").digest((ip + ts).getBytes());
        long n = ByteBuffer.wrap(md5).getLong() & Long.MAX_VALUE;
        String s = base62(n);
        return s.substring(0, Math.min(7, s.length()));
    }
}
```

**写入流程：**
1. 生成短码；
2. 用插入语句的主键冲突来检查是否重复，冲突了就重新生成；
3. 内容写入对象存储；
4. 元数据写入 pastes 表；
5. 返回短码。

```java
String create(String content, int expireMinutes, String ip) throws Exception {
    for (int attempt = 0; attempt < 5; attempt++) {
        String code = ShortLink.fromHash(ip, System.nanoTime() + attempt);
        String path = "pastes/" + code;
        try {
            jdbc.update("INSERT INTO pastes(shortlink, paste_path, expiration_length_in_minutes, created_at, expire_at) VALUES (?,?,?,NOW(),?)",
                code, path, expireMinutes, expireMinutes == 0 ? null : Timestamp.from(Instant.now().plus(expireMinutes, ChronoUnit.MINUTES)));
            objectStore.put(path, content);     // 先占住短码再上传内容；上传失败时删除这条记录
            return code;
        } catch (DuplicateKeyException e) { /* 冲突了，重新生成 */ }
    }
    throw new IllegalStateException("短码冲突次数过多");
}
```

**读取：** 用短码查元数据。查不到或已过期，返回 404；否则从对象存储读取内容。热门内容加缓存。

**访问统计：** 不需要实时，所以离线**对 Web 服务器日志跑 MapReduce**。Map 阶段输出 `(年月, 短码) → 1`，Reduce 阶段求和。

**清理过期：** 定时任务删除 `expire_at < NOW()` 的记录，或者只标记为过期，同时删除对象存储里的内容。

### 2.3 扩展

- 写入只有 4 QPS，单主库足够；读取 40 QPS，热点内容由内存缓存承担，缓存没命中的请求交给只读从库。
- 每月 12.7 GB 的新内容，对象存储轻松应对；分析数据放数据仓库（Redshift / BigQuery / ClickHouse）。
- 只有规模扩大 100 倍以上，才需要考虑分片和 NoSQL。

### 2.4 修正与补充

1. **哈希截断会冲突。** 7 位短码只用了哈希值的一部分，冲突概率不能忽略；同一个 IP 在同一毫秒内多次提交，结果也完全一样。所以必须用唯一约束来检查冲突，冲突后重试，上面的代码已经补上。
2. **更好的方案：** 用**发号器**（Snowflake 或数据库号段）生成全局唯一的自增 ID，再转成 62 进制，**完全不会冲突**。缺点是短码可以被按顺序猜出来，可以先对 ID 做一次可逆的混淆（比如乘以一个大质数再取模，或者 Feistel 置换），再转成 62 进制。
3. **安全：** 内容要做 XSS 转义；同一个 IP 限制提交频率；防止被用来分发恶意链接（短链场景要接入风控）。

---

## 三、查询缓存（搜索结果 KV 缓存）

### 3.1 用例与约束

**要做：**
- 用户搜索时命中缓存，直接返回
- 用户搜索时没命中缓存，查询后写回缓存
- 服务高可用

**约束：**
- 流量不均匀，**热门查询要一直留在缓存里**；
- 要决定缓存的过期和刷新策略；
- 机器之间的网络延迟低；
- 需要缓存几百万个查询。

| 项 | 数值 | 怎么算 |
| --- | --- | --- |
| 用户 | 1000 万 | 已知 |
| 每月查询 | 100 亿次 | QPS ≈ **4000** |
| 单条缓存大小 | 270 字节 | 查询词 50 字节，标题 20 字节，摘要 200 字节 |
| 全部缓存需要的空间 | **2.7 TB / 月** | 假设所有查询都不重复。内存放不下，所以**必须有淘汰策略** |

### 3.2 核心组件

**查询服务的处理流程：**
1. 解析查询：去掉多余内容、分词、纠正拼写、统一大小写、转成布尔表达式；
2. 查缓存，命中就把这条记录移到 LRU 链表头部，然后返回；
3. 没命中：查倒排索引服务，按相关度排序取出最匹配的文档 → 文档服务返回标题和摘要 → 写入缓存，放在链表头部。

LRU 的实现（哈希表加双向链表）见 [OOD 题 · LRU](/posts/system-design/ood-questions/#q1)，查询服务的代码见[题解代码精讲 · 查询缓存](/posts/system-design/solutions-code/)。

**缓存什么时候更新：** 页面内容变化、页面被删除或新增、页面权重变化时，缓存里的结果都会过时。**最简单的办法是设置 TTL**，到期后自然重新加载。

### 3.3 扩展：缓存放不下一台机器时

| 方案 | 优点 | 缺点 |
| --- | --- | --- |
| 每台机器各自缓存 | 简单 | 同一个查询分散在不同机器上，**命中率低** |
| 每台机器缓存全量副本 | 简单 | **浪费内存** |
| **按查询分片**：`machine = hash(query)`，或者用一致性哈希 | 内存利用率和命中率都最好 | 实现更复杂；扩缩容时要迁移数据，用一致性哈希可以减少迁移量 |

**推荐分片方案。**

### 3.4 修正与补充

1. **原代码会抛异常。** Python 原版的 `get` 和 `set` 都用 `self.lookup[query]` 取值，键不存在时会抛 `KeyError`，而不是返回 None。应该用 `self.lookup.get(query)`。
2. **原代码参数顺序不一致。** `set(self, results, query)` 定义的参数顺序，和调用处 `set(query, results)` 是反的。
3. **补充：**
   - 热门查询用「提前刷新」模式，避免过期那一刻大量请求同时打到索引服务（缓存击穿）；
   - 冷门的长尾查询可以不缓存，或者只缓存很短时间；
   - 用 W-TinyLFU（Caffeine 的算法）代替 LRU，能防止偶发的大量冷门查询把热门结果挤出缓存。

---

## 四、按类别的销售排行（Amazon）

### 4.1 用例与约束

**要做：**
- 系统按类别计算过去一周最畅销的商品
- 用户按类别浏览排行
- 服务高可用

**约束：**
- 一个商品可以属于多个类别，但类别不会变；没有子类别；
- **每小时更新一次**，越热门的商品更新越频繁；
- 1000 万个商品、1000 个类别。

| 项 | 数值 | 怎么算 |
| --- | --- | --- |
| 每月交易 | 10 亿笔 | 写 QPS ≈ **400** |
| 每月读取 | 1000 亿次 | 读 QPS ≈ **4 万**，读写比 100:1 |
| 单笔交易 | 约 40 字节 | 时间、商品、类别、卖家、买家、数量、总价 |
| 每月新增 | **40 GB** | 3 年约 1.44 TB |

### 4.2 核心组件

- **数据流：** 销售 API 把交易日志写入对象存储（不用自己搭分布式文件系统）→ 每小时跑一次 MapReduce → 结果写入 SQL 的 `sales_rank` 表 → 查询 API 读这张表。
- **MapReduce 分两轮：**
  - 第一轮：输出 `(类别, 商品) → 销量`，求和；
  - 第二轮：把销量放进 key 里，利用框架的排序完成按销量排序。

Java 实现（包括按类别分区、销量取反实现降序）见[题解代码精讲 · 销售排行](/posts/system-design/solutions-code/)。

```sql
CREATE TABLE sales_rank (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  product_id BIGINT NOT NULL,
  total_sold INT NOT NULL,
  KEY idx_cat_sold (category_id, total_sold DESC)    -- 补充：按类别取前 N 名直接走索引
);
```

**API：** `GET /api/v1/popular?category_id=1234`，返回这个类别下按销量排序的商品列表。

### 4.3 扩展

- **读取：** 每秒 4 万次读，大部分请求要由**内存缓存**挡住。排行每小时才变一次，缓存命中率非常高。
- **写入：** 每秒 400 次的交易写入，单个主库比较吃力，需要按功能拆库、分片，或者使用 NoSQL。
- **分析：** 数据仓库（Redshift / BigQuery）；数据库里只保留最近一段时间的数据。

### 4.4 修正与补充

1. **原代码排出来是升序。** 第二轮 MapReduce 用 `(类别, 销量)` 做 key，框架默认**升序**排序，结果是销量最少的排在最前面，和「畅销榜」的要求相反。需要把销量取反或者自定义排序比较器，Java 版本已经处理。
2. **原代码会输出全量数据。** 原文的第二轮 Reduce 原样输出所有数据，1000 万个商品全部写进表里。实际上每个类别只需要前 N 名（比如 100 个），在 Reduce 阶段截断即可。
3. **补充：**
   - 想要分钟级更新，用 Flink 滑动窗口实时计算 Top-N，见 [Top-K 题](/posts/system-design/design-questions/#q4)；
   - 排行结果写进 Redis ZSet，前端直接读取；
   - 要过滤刷单（按买家去重、接入风控）。

---

## 五、四道题的对比

| | 推特时间线 | Pastebin | 查询缓存 | 销售排行 |
| --- | --- | --- | --- | --- |
| 读 QPS | 10 万 | 40 | 4000 | 4 万 |
| 写 QPS | 6000（扇出后 6 万） | 4 | — | 400 |
| 主要矛盾 | 扇出、大 V | 短码唯一性 | 内存放不下，热点数据 | 海量日志聚合 |
| 核心手段 | 写扩散、推拉结合、只缓存活跃用户 | 关系库当哈希表、内容放对象存储 | LRU 加 TTL、按查询分片 | 两轮 MapReduce、结果缓存 |
| 是否要分片 | 要 | 不需要 | 缓存层要 | 写入量大时要 |

**共同规律：** 先根据估算判断「量级到底有多大」，再决定架构复杂度。Pastebin 只有 4 QPS 写入，用不上分布式；推特每秒 6 万次扇出，不用缓存根本扛不住。

## 原题解疏漏汇总

| # | 题 | 问题 | 修正 |
| --- | --- | --- | --- |
| 1 | 推特 | 估算公式里「每月 10 亿」写成了「每月 10」，`user_id` 写成 32 字节 | 改为每月 10 亿；`user_id` 用 8 字节 |
| 2 | Pastebin | 哈希截断后会冲突，同一个 IP 同一毫秒提交会生成相同的短码 | 用唯一约束检查冲突后重试，或者改用发号器加混淆 |
| 3 | 查询缓存 | 用 `dict[key]` 取值，键不存在会抛异常；`set` 的参数顺序和调用处相反 | 改用 `.get()`，统一参数顺序 |
| 4 | 销售排行 | 第二轮按升序排序，畅销榜顺序是反的 | 销量取反，或者自定义比较器 |
| 5 | 销售排行 | 第二轮输出了全量商品 | 每个类别只保留前 N 名 |

## 相关文章

- [系统设计入门导读](/posts/system-design/overview/)
- [题解代码精讲（Java）](/posts/system-design/solutions-code/)
- [系统设计题（primer 版）](/posts/system-design/design-questions/)
- [估算与延迟数字](/posts/system-design/estimation/)
