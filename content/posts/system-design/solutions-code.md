---
title: primer 题解代码精讲（Java 重写版）
date: 2026-11-05
summary: 把 system-design-primer 题解里的核心代码改写成 Java 并逐段讲解：网页爬虫、Mint 记账（交易分类 + 预算 + MapReduce 月度汇总）、查询缓存（LRU）、销售排行（MapReduce 两阶段）、社交关系（分片 BFS），附表结构与扩展要点。
interview: false
kind: primer
---

[system-design-primer](https://github.com/donnemartin/system-design-primer/blob/master/README-zh-Hans.md) 的每道题解都配有一段骨架代码，原文是 Python，而且很多方法只写了签名。这篇把其中最有价值的部分**改写成可以运行的 Java**，并说明每段代码对应设计中的哪个环节。题目本身的分析见[系统设计题（primer 版）](/posts/system-design/design-questions/)。

**怎么用：** 面试时一般只需要写核心类和核心方法（大约 30–50 行），先问面试官「需要写多少代码」，再决定写到多细。

---

## 一、网页爬虫：抓取主循环与去重

**对应设计：** 待抓取的链接存在优先级队列里（primer 用 Redis 有序集合）；已抓取的链接记录在 KV 存储中，并带上页面签名。抓取前先比较签名，签名相似的页面降低优先级，以此避免死循环和重复抓取。

### 1.1 数据存储接口

```java
/** 抽象出存储层：生产环境可以用 Redis ZSet 加 KV 存储实现 */
interface PagesDataStore {
    void addLinkToCrawl(String url, double priority);
    void removeLinkToCrawl(String url);
    void reducePriority(String url);               // 遇到相似页面时降权，而不是直接删除
    Optional<Page> extractMaxPriorityPage();        // 取出优先级最高的待抓页面
    void insertCrawledLink(String url, long signature);
    boolean crawledSimilar(long signature);         // 签名相似，说明内容重复
}

record Page(String url, String contents, List<String> childUrls) {}
```

### 1.2 爬虫主类

```java
class Crawler {
    private final PagesDataStore store;
    private final BlockingQueue<Page> reverseIndexQueue;   // 交给倒排索引服务
    private final BlockingQueue<Page> docIndexQueue;       // 交给标题和摘要服务

    Crawler(PagesDataStore s, BlockingQueue<Page> ri, BlockingQueue<Page> di) {
        store = s; reverseIndexQueue = ri; docIndexQueue = di;
    }

    void crawl() throws InterruptedException {
        Optional<Page> next;
        while ((next = store.extractMaxPriorityPage()).isPresent()) {
            Page page = next.get();
            long sig = SimHash.of(page.contents());
            if (store.crawledSimilar(sig)) {         // 内容和已抓页面重复
                store.reducePriority(page.url());
                continue;
            }
            for (String child : page.childUrls()) store.addLinkToCrawl(child, 1.0);
            reverseIndexQueue.put(page);             // 异步建立索引，抓取线程不阻塞
            docIndexQueue.put(page);
            store.removeLinkToCrawl(page.url());
            store.insertCrawledLink(page.url(), sig);
        }
    }
}
```

### 1.3 内容签名：SimHash

primer 只提到可以用 Jaccard 或余弦相似度来判断重复。工程上常用 **SimHash**：先把文本分词，每个词按哈希值的每一位做加权投票，生成 64 位指纹。两个指纹的**海明距离 ≤ 3** 时，就认为两个页面近似重复。

```java
final class SimHash {
    static long of(String text) {
        int[] v = new int[64];
        for (String token : text.split("\\W+")) {
            if (token.isEmpty()) continue;
            long h = murmur64(token);
            for (int i = 0; i < 64; i++) v[i] += ((h >>> i) & 1) == 1 ? 1 : -1;
        }
        long fp = 0;
        for (int i = 0; i < 64; i++) if (v[i] > 0) fp |= 1L << i;
        return fp;
    }
    static boolean similar(long a, long b) { return Long.bitCount(a ^ b) <= 3; }
    private static long murmur64(String s) { /* 省略：任意 64 位哈希即可 */ return s.hashCode() * 0x9E3779B97F4A7C15L; }
}
```

**海量指纹怎么比较：** 把 64 位指纹切成 4 段，每段 16 位。海明距离 ≤ 3 时，至少有一段完全相同，所以按每一段分别建索引，先按段召回候选，再精确计算海明距离。

### 1.4 海量 URL 去重：MapReduce

数据少的时候可以排序后去重；有 10 亿条 URL 时，用 MapReduce 统计出现次数：

```java
// Mapper：每行一个 URL，输出 (url, 1)
// Reducer：把同一个 URL 的计数加起来，只输出出现过一次的
public void reduce(Text url, Iterable<IntWritable> counts, Context ctx) {
    int total = 0;
    for (IntWritable c : counts) total += c.get();
    if (total == 1) ctx.write(url, new IntWritable(total));
}
```

**容量参考：** 每月抓取 40 亿个页面，每页 500 KB，每月新增 2 PB；平均约 1600 次写入每秒，40000 次搜索每秒。

---

## 二、Mint 记账：交易分类、预算、月度汇总

**题目：** 用户绑定银行账户，系统自动拉取交易记录并分类，按类别统计每月支出，接近或超出预算时提醒用户。
**约束：** 1000 万用户、3000 万个账户、每月 50 亿条交易；**写多读少**（每天都有交易，但用户很少打开网站）。

### 2.1 表结构

```sql
CREATE TABLE accounts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  account_url VARCHAR(255) NOT NULL,
  account_login VARCHAR(32) NOT NULL,
  account_password_enc VARBINARY(256) NOT NULL,   -- 需要代用户登录银行，必须用可逆加密（KMS），不能存哈希
  created_at DATETIME NOT NULL, last_update DATETIME NOT NULL,
  KEY idx_user (user_id)
);

CREATE TABLE transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  seller VARCHAR(32) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category SMALLINT,
  created_at DATETIME NOT NULL,
  KEY idx_user_time (user_id, created_at)
);

CREATE TABLE monthly_spending (
  user_id BIGINT NOT NULL, month_year DATE NOT NULL, category SMALLINT NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  PRIMARY KEY (user_id, month_year, category)       -- 联合主键，方便按 UPSERT 累加
);
```

**和 primer 原文不同的地方：** 原文的 accounts 表存的是密码哈希。但这个系统要**代替用户登录银行**，必须能还原出明文，所以只能可逆加密，密钥交给 KMS 管理。面试时主动指出这一点是加分项。现实中更好的做法是用银行的 OAuth 授权，或者通过 Plaid 这类聚合服务，系统完全不接触用户密码。

### 2.2 数据流

```text
用户绑定或手动刷新 → 账户 API → 任务队列（SQS / RabbitMQ）
                          ↓
                    交易拉取服务：拉取交易 → 原始日志存入对象存储
                          ↓
              分类服务 → 写入 transactions → 更新 monthly_spending
                          ↓
              预算服务 → 接近或超出预算 → 通知服务（异步队列）
```

**自动刷新只针对最近 30 天活跃的用户**，这样可以大幅减少拉取量，这一点是 primer 里的约束。

### 2.3 分类器：商户字典加众包修正

```java
enum Category { HOUSING, FOOD, GAS, SHOPPING, OTHER }

class Categorizer {
    /** 热门商户和类别的对应表：5 万个商户约 12 MB，可以直接放在内存里 */
    private final Map<String, Category> sellerCategory = new ConcurrentHashMap<>();
    /** 用户手动改过的分类，按投票数统计 */
    private final Map<String, Map<Category, LongAdder>> crowdVotes = new ConcurrentHashMap<>();

    Category categorize(String seller) {
        Category c = sellerCategory.get(seller);
        if (c != null) return c;
        Map<Category, LongAdder> votes = crowdVotes.get(seller);
        if (votes == null) return Category.OTHER;
        Category top = votes.entrySet().stream()
            .max(Comparator.comparingLong(e -> e.getValue().sum())).get().getKey();
        sellerCategory.put(seller, top);              // 采纳投票最多的类别，写回字典
        return top;
    }

    void userOverride(String seller, Category c) {
        crowdVotes.computeIfAbsent(seller, k -> new ConcurrentHashMap<>())
                  .computeIfAbsent(c, k -> new LongAdder()).increment();
    }
}
```

### 2.4 预算模板

**节省存储的技巧：** 预算不用为每个用户都存一份，那样会有 1000 万 × 10 个类别 = 1 亿行。改成**按收入比例生成默认模板**，只存用户修改过的部分（budget_overrides 表）。

```java
class Budget {
    private static final Map<Category, Double> TEMPLATE =
        Map.of(Category.HOUSING, .4, Category.FOOD, .2, Category.GAS, .1, Category.SHOPPING, .2);
    private final Map<Category, BigDecimal> limits = new EnumMap<>(Category.class);

    Budget(BigDecimal monthlyIncome, Map<Category, BigDecimal> overrides) {
        TEMPLATE.forEach((c, ratio) -> limits.put(c, monthlyIncome.multiply(BigDecimal.valueOf(ratio))));
        limits.putAll(overrides);                    // 用户修改过的值覆盖默认模板
    }
    boolean nearLimit(Category c, BigDecimal spent) {
        BigDecimal limit = limits.get(c);
        return limit != null && spent.compareTo(limit.multiply(new BigDecimal("0.9"))) >= 0;
    }
}
```

### 2.5 月度汇总：MapReduce 跑在原始日志上

每月 50 亿条交易，如果都用 SQL 实时聚合，数据库扛不住。所以**对对象存储里的原始交易日志跑批处理**，结果再写回 monthly_spending 表。

```java
// 输入每行：user_id \t timestamp \t seller \t amount
// Mapper：只处理当月数据，key = (user_id, 月份, 类别)，value = 金额
public void map(LongWritable off, Text line, Context ctx) throws IOException, InterruptedException {
    String[] f = line.toString().split("\t");
    String period = f[1].substring(0, 7);                 // yyyy-MM
    if (!period.equals(currentMonth)) return;
    Category c = categorizer.categorize(f[2]);
    ctx.write(new Text(f[0] + "|" + period + "|" + c), new DoubleWritable(Double.parseDouble(f[3])));
}

// Reducer：求和，然后判断是否需要发预算提醒
public void reduce(Text key, Iterable<DoubleWritable> vals, Context ctx) throws IOException, InterruptedException {
    double total = 0;
    for (DoubleWritable v : vals) total += v.get();
    ctx.write(key, new DoubleWritable(total));
    budgetNotifier.checkAndNotify(key.toString(), total); // 预算提醒不要求实时，批处理时顺带检查即可
}
```

**扩展要点：**
- **写入：** 平均每秒 2000 条交易，单个主库扛不住，需要按用户 ID 分片。
- **读取：** 用户打开网站时，摘要数据走缓存（旁路缓存）。
- **历史数据：** 只在数据库里保留最近一个月的交易，更早的转存到数据仓库（Redshift / BigQuery / ClickHouse）。

---

## 三、查询缓存：搜索结果的 LRU

**题目：** 搜索引擎每月处理 100 亿次查询，热门查询的结果需要缓存起来，减轻倒排索引服务的压力。
**设计：** 查询服务先查缓存，未命中再去查倒排索引和文档服务，最后把结果写回缓存。

```java
class QueryCache {
    private final LRUCache<String, List<Result>> cache;   // 实现见 OOD 题 1
    private final ReverseIndexService index;

    List<Result> search(String rawQuery) {
        String q = normalize(rawQuery);            // 统一大小写、去除多余空格，提高命中率
        List<Result> r = cache.get(q);
        if (r != null) return r;
        r = index.search(q);
        cache.put(q, r);
        return r;
    }
    private String normalize(String s) { return s.trim().toLowerCase().replaceAll("\\s+", " "); }
}
```

**单机放不下时：**
- 每台机器各自缓存，命中率会低，因为同一个查询可能落在不同机器上；
- **按查询的哈希值分片**，同一个查询总是路由到同一个缓存节点，能提高命中率。
- **缓存什么时候更新：** 页面内容变化时，用 TTL 让结果自然过期；热门查询可以主动刷新（提前刷新模式）。

LRU 的实现、线程安全和 W-TinyLFU，见 [OOD 题 · LRU](/posts/system-design/ood-questions/#q1)。

---

## 四、销售排行：MapReduce 两阶段

**题目：** 按类别统计亚马逊这类电商平台上一周的畅销商品排行，每小时更新一次。
**做法：** 订单日志放在对象存储里，用**两轮 MapReduce** 计算：第一轮按（类别，商品）汇总销量，第二轮按类别排序。

```java
// 第一轮 Mapper：每行 timestamp \t product_id \t category \t quantity，只处理最近 7 天
//   输出 key = category|product_id，value = quantity
// 第一轮 Reducer：求和，输出 (category|product_id, total)

// 第二轮 Mapper：把 total 放进 key，利用框架的排序：key = category|<补零后的销量取反>，value = product_id
public void map(Text k, LongWritable total, Context ctx) {
    String[] p = k.toString().split("\\|");
    String sortKey = p[0] + "|" + String.format("%019d", Long.MAX_VALUE - total.get()); // 销量取反，实现降序
    ctx.write(new Text(sortKey), new Text(p[1]));
}
// 自定义分区器：按 category 分区，保证同一个类别的数据进入同一个 Reducer
// 第二轮 Reducer：数据已经按销量降序排好，每个类别只取前 N 条
```

**工程上的替代方案：**
- **实时性要求高时：** 用 Flink 按滑动窗口计算，每个分区先算出本地 Top-N 再合并，见 [Top-K 题](/posts/system-design/design-questions/#q4)。
- **展示：** 每个类别的排行结果写进 Redis ZSet，前端直接读取。
- **只看前若干名的场景：** 用 Count-Min Sketch 近似统计，以很小的误差换取大幅节省内存。

---

## 五、社交关系：分片上的双向 BFS

**对应设计：** 好友关系按用户 ID 分片存储；通过一个查找服务，找到「某个用户存在哪个分片」。BFS 每一层都按分片**批量**获取好友列表，减少网络往返。

```java
class SocialGraphService {
    private final LookupService lookup;            // userId → 分片编号
    private final Map<Integer, PersonShard> shards;

    /** 双向 BFS：从两端同时扩展，每次扩展规模较小的一侧 */
    List<Long> shortestPath(long src, long dst) {
        if (src == dst) return List.of(src);
        Map<Long, Long> prevA = new HashMap<>(Map.of(src, -1L)), prevB = new HashMap<>(Map.of(dst, -1L));
        Set<Long> frontA = Set.of(src), frontB = Set.of(dst);
        for (int depth = 0; depth < 6 && !frontA.isEmpty() && !frontB.isEmpty(); depth++) {
            boolean expandA = frontA.size() <= frontB.size();
            Set<Long> front = expandA ? frontA : frontB;
            Map<Long, Long> prev = expandA ? prevA : prevB, other = expandA ? prevB : prevA;
            Set<Long> next = new HashSet<>();
            for (Map.Entry<Long, List<Long>> e : batchFriends(front).entrySet()) {
                for (long f : e.getValue()) {
                    if (prev.containsKey(f)) continue;
                    prev.put(f, e.getKey());
                    if (other.containsKey(f)) return join(f, prevA, prevB);   // 两侧相遇，拼出完整路径
                    next.add(f);
                }
            }
            if (expandA) frontA = next; else frontB = next;
        }
        return List.of();                                   // 6 度以内不连通
    }

    /** 按分片分组批量查询，一层只需要做 #分片数 次 RPC */
    private Map<Long, List<Long>> batchFriends(Set<Long> users) {
        Map<Integer, List<Long>> byShard = users.stream().collect(Collectors.groupingBy(lookup::shardOf));
        Map<Long, List<Long>> out = new HashMap<>();
        byShard.forEach((sid, ids) -> out.putAll(shards.get(sid).friendsOf(ids)));
        return out;
    }

    private List<Long> join(long meet, Map<Long, Long> a, Map<Long, Long> b) {
        LinkedList<Long> path = new LinkedList<>();
        for (Long x = meet; x != -1L; x = a.get(x)) path.addFirst(x);
        for (Long x = b.get(meet); x != -1L; x = b.get(x)) path.addLast(x);
        return path;
    }
}
```

**这段代码的要点：**
- 每次扩展**规模更小的那一侧**，这是双向 BFS 节省开销的关键。
- 按分片批量查询好友列表，把单个节点一次次查询的 RPC 合并成每一层几次批量 RPC。
- 限制搜索深度（6 度），避免在大图上无限扩展。
- 大 V 的好友列表会一下子展开出几千万个节点，需要单独处理，比如抽样或跳过，见[社交网络题的追问](/posts/system-design/design-questions/#q3)。

---

## 六、primer 题解的共同模式

把这几道题解对比着看，能总结出一套可以反复使用的套路：

| 模式 | 出现在 |
| --- | --- |
| **原始数据先放对象存储，再用批处理（MapReduce）计算** | 爬虫去重、Mint 月度汇总、销售排行 |
| **耗时任务放进队列异步处理** | 爬虫的索引任务、Mint 拉取交易、通知发送 |
| **热点读请求用内存缓存（旁路缓存）挡住** | 搜索结果、Mint 摘要页、排行榜 |
| **写多时按用户分片** | Mint 交易表、社交关系 |
| **小而热的字典直接放在内存里** | 商户分类表（约 12 MB） |
| **存默认值加用户修改，不存全量** | Mint 的预算模板 |
| **扩展时一步一步来**：先压测找瓶颈，再选方案并说明取舍 | 所有题 |

## 相关文章

- [系统设计入门导读](/posts/system-design/overview/)
- [系统设计题（primer 版）](/posts/system-design/design-questions/)
- [题解完整拆解：推特、Pastebin、查询缓存、销售排行](/posts/system-design/solutions-walkthrough/)
- [面向对象设计题](/posts/system-design/ood-questions/)
