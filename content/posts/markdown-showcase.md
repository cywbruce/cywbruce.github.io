---
title: Markdown 展示：标题、列表与代码
date: 2026-10-30
summary: 第二篇 demo：常见 Markdown 语法在博客里的渲染效果。
---

本页用来快速扫一眼排版是否舒服。


## 二级标题

正文段落应有合适行宽与行高。下面是一张无序列表：

- 强调：*斜体* 与 **粗体**
- 链接：[GitHub Pages](https://pages.github.com/)
- 行内代码：`npm run build`

### 有序列表

1. 写稿  
2. 本地预览  
3. 推送发布  

## 代码块

```ts
type Post = {
  slug: string;
  title: string;
  date: string;
  summary?: string;
  html: string;
};

function newestFirst(a: Post, b: Post) {
  return b.date.localeCompare(a.date);
}
```

> 引用块：适合放一句短评或注意事项。

结束。若代码高亮或引用样式不对，再回头调 CSS 即可。
