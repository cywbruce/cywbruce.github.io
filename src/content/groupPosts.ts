import type { Post } from './types';

export const UNCATEGORIZED_ID = 'notes';

export type PostGroup = {
  id: string;
  posts: Post[];
};

export function groupPostsByCategory(posts: Post[]): PostGroup[] {
  const map = new Map<string, Post[]>();

  for (const post of posts) {
    const id = post.category?.trim() || UNCATEGORIZED_ID;
    const list = map.get(id);
    if (list) {
      list.push(post);
    } else {
      map.set(id, [post]);
    }
  }

  const groups = [...map.entries()].map(([id, groupPosts]) => ({
    id,
    posts: groupPosts,
  }));

  groups.sort((a, b) => {
    if (a.id === UNCATEGORIZED_ID) return 1;
    if (b.id === UNCATEGORIZED_ID) return -1;
    return a.id.localeCompare(b.id);
  });

  return groups;
}
