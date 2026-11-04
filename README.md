# cywbruce

个人 Markdown 博客（Vite + React 静态站），发布至 GitHub Pages。

## 新增文章

在 `content/posts/` 下新增 `*.md` 文件；也可用**子目录分类**，例如 Java 相关：

```text
content/posts/hello-blog.md          → /posts/hello-blog/
content/posts/java/jvm-gc-basics.md  → /posts/java/jvm-gc-basics/
```

相对 `content/posts/` 的路径（不含 `.md`）即为 slug；子目录名会出现在列表的分类标签上。

Frontmatter 必填：

```yaml
---
title: 文章标题
date: 2026-11-01
summary: 可选摘要
---
```

可选 `interview: false`：文章里的「主问」不收录进面试题库，只作为普通文章阅读。

缺少 `title` 或 `date` 时，`npm run build` 会失败并打印文件路径。


## 本地开发

```bash
npm install
npm run dev
```

预览生产构建：

```bash
npm run build
npm run preview
```

## 发布

推送到 `main` 后，GitHub Actions 会自动执行 `npm ci` → `npm run build`，并将 `dist` 部署到 GitHub Pages。

请在仓库 **Settings → Pages → Source** 中选择 **GitHub Actions**（不要使用「Deploy from a branch」）。
