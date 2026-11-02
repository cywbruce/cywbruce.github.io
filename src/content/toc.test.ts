import { describe, expect, it } from 'vitest';
import { decorateHeadingIds, extractToc } from './toc';

describe('decorateHeadingIds / extractToc', () => {
  it('adds sequential ids to h2/h3 and extracts toc', () => {
    const raw = '<h2>一级</h2><p>x</p><h3>二级</h3><h2 id="keep">保留</h2>';
    const html = decorateHeadingIds(raw);
    expect(html).toContain('id="toc-1"');
    expect(html).toContain('id="toc-2"');
    expect(html).toContain('id="keep"');
    expect(extractToc(html)).toEqual([
      { id: 'toc-1', text: '一级', level: 2 },
      { id: 'toc-2', text: '二级', level: 3 },
      { id: 'keep', text: '保留', level: 2 },
    ]);
  });

  it('is idempotent when ids already present', () => {
    const once = decorateHeadingIds('<h2>A</h2>');
    const twice = decorateHeadingIds(once);
    expect(twice).toBe(once);
  });
});
