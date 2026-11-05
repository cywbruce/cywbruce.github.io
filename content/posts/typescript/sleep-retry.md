---
title: TypeScript：sleep 与请求重试
date: 2026-11-03
summary: 用 Promise + setTimeout 实现 sleep；并给出失败等待 4 秒再重试、轮询任务状态的完整例子。
kind: guide
---

JS/TS 没有语言级 `sleep`，标准写法是返回 Promise，在 `async` 函数里 `await`。

## 核心实现

```ts
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
```

```ts
async function main() {
  console.log('开始')
  await sleep(4000) // 4 秒
  console.log('4 秒后继续')
}

main()
```

| 点 | 说明 |
| --- | --- |
| 原理 | `setTimeout` 到点后 `resolve` |
| 单位 | 毫秒；4000 = 4s |
| 线程 | 不阻塞事件循环，只挂起当前 async 流程 |
| 内联 | `await new Promise((r) => setTimeout(r, 4000))` |

## 案例：失败后等 4 秒重试

适合第三方接口限流、偶发失败。

```ts
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchData(attempt: number): Promise<string> {
  console.log(`第 ${attempt} 次尝试...`)
  if (attempt < 3) throw new Error('请求失败')
  return '请求成功'
}

async function fetchWithRetry(maxRetries: number): Promise<void> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      console.log(await fetchData(i))
      return
    } catch (e) {
      console.log(`出错: ${(e as Error).message}`)
      if (i < maxRetries) {
        console.log('等待 4 秒后重试...')
        await sleep(4000)
      } else {
        console.log('达到最大重试次数，放弃')
      }
    }
  }
}

fetchWithRetry(3)
```

模拟时间线：失败 → 等 4s → 再失败 → 再等 4s → 第三次成功。

## 变体：轮询任务状态

```ts
async function pollTaskStatus(taskId: string) {
  while (true) {
    const status = await checkStatus(taskId)
    if (status === 'completed') {
      console.log('任务完成')
      break
    }
    console.log('进行中，4 秒后再查...')
    await sleep(4000)
  }
}
```

文件处理、转码进度等场景常见。生产环境建议加**超时上限**和**退避策略**（指数退避 + 抖动），避免固定 4 秒打爆对方。

## 相关文章

- [TS/JS 深水区](/posts/typescript/ts-js-deep-water/)  
- [事件循环（市场高频）](/posts/react/market-hot-questions/)  
