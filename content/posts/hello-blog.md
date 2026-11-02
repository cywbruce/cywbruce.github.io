---
title: 你好，这是我的博客
date: 2026-10-28
summary: 第一篇 demo：说明这个站点怎么写文章、怎么发布。
---

# 你好

欢迎来到 **cywbruce** 的个人博客。

这里用 Markdown 写作，构建后发布到 GitHub Pages。你现在看到的页面，就是本地预览或线上静态站的效果。

## 怎么写下一篇？

1. 在 `content/posts/` 新建一个 `.md` 文件  
2. 填写 frontmatter：`title`、`date`（可选 `summary`）  
3. 文件名会变成文章地址，例如 `hello-blog.md` → `/posts/hello-blog/`  
4. 本地执行 `npm run dev` 预览，推送到 `main` 后自动部署  

```bash
npm run dev
```

写完保存即可在列表里看到新文章。
