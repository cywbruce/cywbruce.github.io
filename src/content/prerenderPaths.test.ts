import { describe, expect, it } from 'vitest';
import { collectPrerenderPaths } from './prerenderPaths';

describe('collectPrerenderPaths', () => {
  it('includes home, 404, and post paths', () => {
    const paths = collectPrerenderPaths([{ slug: 'a' }]);
    expect(paths).toEqual(
      expect.arrayContaining(['index.html', 'posts/a/index.html', '404.html']),
    );
  });

  it('still includes home and 404 when posts are empty', () => {
    const paths = collectPrerenderPaths([]);
    expect(paths).toEqual(['index.html', '404.html']);
  });
});
