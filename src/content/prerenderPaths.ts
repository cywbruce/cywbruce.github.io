import { UNCATEGORIZED_ID } from './groupPosts';
import type { Post } from './types';

function sortedCategoryIds(posts: Pick<Post, 'category'>[]): string[] {
  const ids = new Set<string>();
  for (const post of posts) {
    ids.add(post.category?.trim() || UNCATEGORIZED_ID);
  }
  return [...ids].sort((a, b) => {
    if (a === UNCATEGORIZED_ID) return 1;
    if (b === UNCATEGORIZED_ID) return -1;
    return a.localeCompare(b);
  });
}

export function collectPrerenderPaths(
  posts: Pick<Post, 'slug' | 'category'>[],
): string[] {
  const paths = ['index.html', '404.html'];
  for (const id of sortedCategoryIds(posts)) {
    paths.push(`topics/${id}/index.html`);
  }
  for (const post of posts) {
    paths.push(`posts/${post.slug}/index.html`);
  }
  return paths;
}
