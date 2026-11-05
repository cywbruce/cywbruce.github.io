import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import { decorateHeadingIds } from './toc';
import { POST_KINDS, type Post, type PostKind } from './types';

export const DEFAULT_POSTS_DIR = 'content/posts';

function assertValidDate(raw: unknown, filePath: string): string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      return raw.trim();
    }
  }
  throw new Error(`Invalid or missing date in ${filePath}`);
}

/** Relative path under posts dir → URL slug, always with `/` separators. */
export function pathToSlug(rootDir: string, filePath: string): string {
  const rel = relative(rootDir, filePath);
  const withoutExt = rel.slice(0, -extname(rel).length);
  const slug = withoutExt.split(sep).join('/');
  if (!slug || slug.includes('..')) {
    throw new Error(`Invalid slug derived from ${filePath}`);
  }
  return slug;
}

function collectMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) {
      continue;
    }
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...collectMarkdownFiles(full));
    } else if (st.isFile() && name.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

function parsePostFile(rootDir: string, filePath: string): Post {
  const raw = readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);
  const slug = pathToSlug(rootDir, filePath);

  if (typeof data.title !== 'string' || !data.title.trim()) {
    throw new Error(`Missing required frontmatter field "title" in ${filePath}`);
  }
  if (data.date === undefined || data.date === null || data.date === '') {
    throw new Error(`Missing required frontmatter field "date" in ${filePath}`);
  }

  const date = assertValidDate(data.date, filePath);
  const summary =
    typeof data.summary === 'string' && data.summary.trim()
      ? data.summary.trim()
      : undefined;

  const html = decorateHeadingIds(
    marked.parse(content, { async: false }) as string,
  );
  const category = slug.includes('/') ? slug.split('/')[0] : undefined;

  const post: Post = {
    slug,
    title: data.title.trim(),
    date,
    html,
  };
  if (summary !== undefined) {
    post.summary = summary;
  }
  if (category) {
    post.category = category;
  }
  if (data.interview === false) {
    post.interview = false;
  }
  if (typeof data.kind === 'string' && (POST_KINDS as string[]).includes(data.kind)) {
    post.kind = data.kind as PostKind;
  }
  return post;
}

export function loadPosts(dir: string = DEFAULT_POSTS_DIR): Post[] {
  let files: string[];
  try {
    files = collectMarkdownFiles(dir);
  } catch (err) {
    throw new Error(`Failed to read posts directory "${dir}": ${(err as Error).message}`);
  }

  const posts = files.map((filePath) => parsePostFile(dir, filePath));

  return posts.sort((a, b) => {
    const aTime = new Date(a.date).getTime();
    const bTime = new Date(b.date).getTime();
    return bTime - aTime;
  });
}
