import type { Post } from './types';

export function collectPrerenderPaths(posts: Pick<Post, 'slug'>[]): string[] {
  const paths = ['index.html', '404.html'];
  for (const post of posts) {
    paths.push(`posts/${post.slug}/index.html`);
  }
  return paths;
}
