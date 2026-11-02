import { describe, expect, it } from 'vitest';
import {
  findPostGroup,
  groupPostsByCategory,
  UNCATEGORIZED_ID,
} from './groupPosts';
import type { Post } from './types';

function post(partial: Partial<Post> & Pick<Post, 'slug' | 'title'>): Post {
  return {
    date: '2026-01-01',
    html: '<p>x</p>',
    ...partial,
  };
}

describe('groupPostsByCategory', () => {
  it('groups by category and puts uncategorized last', () => {
    const groups = groupPostsByCategory([
      post({ slug: 'a', title: 'A' }),
      post({ slug: 'java/b', title: 'B', category: 'java' }),
      post({ slug: 'java/c', title: 'C', category: 'java' }),
      post({ slug: 'ops/d', title: 'D', category: 'ops' }),
    ]);

    expect(groups.map((g) => g.id)).toEqual(['java', 'ops', UNCATEGORIZED_ID]);
    expect(groups[0].posts.map((p) => p.slug)).toEqual(['java/b', 'java/c']);
    expect(groups[2].posts).toHaveLength(1);
  });

  it('findPostGroup returns matching group or undefined', () => {
    const posts = [
      post({ slug: 'java/b', title: 'B', category: 'java' }),
      post({ slug: 'a', title: 'A' }),
    ];
    expect(findPostGroup(posts, 'java')?.posts).toHaveLength(1);
    expect(findPostGroup(posts, UNCATEGORIZED_ID)?.posts[0].slug).toBe('a');
    expect(findPostGroup(posts, 'missing')).toBeUndefined();
  });
});
