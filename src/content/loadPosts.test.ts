import { copyFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadPosts } from './loadPosts';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

describe('loadPosts', () => {
  it('loads a valid post with correct slug, title, and html', () => {
    const dir = mkdtempSync(join(tmpdir(), 'posts-valid-'));
    copyFileSync(join(fixturesDir, 'valid-hello.md'), join(dir, 'valid-hello.md'));

    const loaded = loadPosts(dir);
    expect(loaded).toHaveLength(1);
    expect(loaded[0].slug).toBe('valid-hello');
    expect(loaded[0].title).toBe('Hello Fixture');
    expect(loaded[0].html).toContain('<h1');
    expect(loaded[0].html).toContain('Hello');
    expect(loaded[0].summary).toBeUndefined();
  });

  it('throws when title is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'posts-missing-'));
    copyFileSync(join(fixturesDir, 'missing-title.md'), join(dir, 'missing-title.md'));

    expect(() => loadPosts(dir)).toThrow(/title/i);
    expect(() => loadPosts(dir)).toThrow(/missing-title\.md/);
  });

  it('sorts multiple posts by date descending', () => {
    const dir = mkdtempSync(join(tmpdir(), 'posts-sort-'));
    copyFileSync(join(fixturesDir, 'older-post.md'), join(dir, 'older-post.md'));
    copyFileSync(join(fixturesDir, 'with-summary.md'), join(dir, 'with-summary.md'));

    const posts = loadPosts(dir);
    expect(posts.map((p) => p.slug)).toEqual(['with-summary', 'older-post']);
    expect(posts[0].summary).toBe('A short summary');
  });

  it('leaves summary undefined when omitted', () => {
    const dir = mkdtempSync(join(tmpdir(), 'posts-nosummary-'));
    writeFileSync(
      join(dir, 'valid-hello.md'),
      `---
title: Hello Fixture
date: 2024-06-01
---

# Hello
`,
    );

    const posts = loadPosts(dir);
    expect(posts[0].summary).toBeUndefined();
  });

  it('loads nested category directories into slug with category', () => {
    const dir = mkdtempSync(join(tmpdir(), 'posts-nested-'));
    mkdirSync(join(dir, 'java'));
    writeFileSync(
      join(dir, 'java', 'nested.md'),
      `---
title: Nested Java Post
date: 2024-07-01
---

# Nested
`,
    );

    const posts = loadPosts(dir);
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe('java/nested');
    expect(posts[0].category).toBe('java');
  });
});

