import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadPosts } from './loadPosts';

describe('loadPosts integration with content/posts', () => {
  it('loads root and nested category posts', () => {
    const posts = loadPosts(resolve('content/posts'));
    expect(posts.length).toBeGreaterThanOrEqual(3);
    expect(posts.some((p) => p.slug === 'markdown-showcase')).toBe(true);
    expect(posts.some((p) => p.slug === 'java/jvm-gc-basics')).toBe(true);
    const javaPost = posts.find((p) => p.slug === 'java/spring-boot-notes');
    expect(javaPost?.category).toBe('java');
    expect(javaPost?.html.length).toBeGreaterThan(0);
  });
});
