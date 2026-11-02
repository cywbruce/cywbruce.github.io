import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import App from '../src/App';
import { loadPosts } from '../src/content/loadPosts';
import { PostsProvider } from '../src/content/PostsContext';
import { collectPrerenderPaths } from '../src/content/prerenderPaths';
import type { Post } from '../src/content/types';
import { LocaleProvider } from '../src/i18n/LocaleContext';

function renderRoute(url: string, posts: Post[]): string {
  const appTree = createElement(
    PostsProvider,
    { posts, children: createElement(App) },
  );
  const withLocale = createElement(LocaleProvider, { children: appTree });
  return renderToString(
    createElement(StaticRouter, { location: url }, withLocale),
  );
}

function injectAppHtml(template: string, appHtml: string): string {
  if (!template.includes('<div id="root"></div>')) {
    throw new Error('Vite template missing empty #root container');
  }
  return template.replace(
    '<div id="root"></div>',
    `<div id="root">${appHtml}</div>`,
  );
}

function writePage(outFile: string, html: string): void {
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, 'utf8');
}

export function prerender(options?: {
  outDir?: string;
  postsDir?: string;
}): string[] {
  const outDir = resolve(options?.outDir ?? 'dist');
  const posts = loadPosts(options?.postsDir ?? 'content/posts');
  const templatePath = join(outDir, 'index.html');
  const template = readFileSync(templatePath, 'utf8');

  const outputs = collectPrerenderPaths(posts);

  const homeHtml = injectAppHtml(template, renderRoute('/', posts));
  writePage(join(outDir, 'index.html'), homeHtml);

  for (const post of posts) {
    const url = `/posts/${post.slug}/`;
    const html = injectAppHtml(template, renderRoute(url, posts));
    writePage(join(outDir, 'posts', post.slug, 'index.html'), html);
  }

  const notFoundHtml = injectAppHtml(
    template,
    renderRoute('/not-found-prerender', posts),
  );
  writePage(join(outDir, '404.html'), notFoundHtml);

  return outputs;
}

const isMain =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  try {
    const written = prerender();
    console.log(`Prerendered ${written.length} path(s):`);
    for (const p of written) {
      console.log(`  - ${p}`);
    }
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
