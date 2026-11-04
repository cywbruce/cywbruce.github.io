import { describe, expect, it } from 'vitest';
import { UNCATEGORIZED_ID } from './groupPosts';
import { collectPrerenderPaths } from './prerenderPaths';

describe('collectPrerenderPaths', () => {
  it('includes home, 404, topic, and post paths', () => {
    const paths = collectPrerenderPaths([
      { slug: 'a', category: 'java' },
      { slug: 'b' },
    ]);
    expect(paths).toEqual(
      expect.arrayContaining([
        'index.html',
        '404.html',
        'interview/index.html',
        'topics/java/index.html',
        `topics/${UNCATEGORIZED_ID}/index.html`,
        'posts/a/index.html',
        'posts/b/index.html',
      ]),
    );
  });

  it('still includes home, 404, and interview when posts are empty', () => {
    const paths = collectPrerenderPaths([]);
    expect(paths).toEqual(['index.html', '404.html', 'interview/index.html']);
  });
});
