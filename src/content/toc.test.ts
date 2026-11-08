import { describe, expect, it } from 'vitest';
import { decorateHeadingIds, extractToc } from './toc';

describe('decorateHeadingIds / extractToc', () => {
  it('adds stable text-based ids to h2/h3 and extracts toc', () => {
    const raw = '<h2>一级</h2><p>x</p><h3>二级</h3><h2 id="keep">保留</h2>';
    const html = decorateHeadingIds(raw);
    expect(html).toContain('id="一级"');
    expect(html).toContain('id="二级"');
    expect(html).toContain('id="keep"');
    expect(extractToc(html)).toEqual([
      { id: '一级', text: '一级', level: 2 },
      { id: '二级', text: '二级', level: 3 },
      { id: 'keep', text: '保留', level: 2 },
    ]);
  });

  it('uses question numbers and chapter numerals', () => {
    const html = decorateHeadingIds(
      '<h2>三、事务</h2><h3>4. 会不会丢消息？（中级必考）</h3><h2>十二、附录</h2>',
    );
    expect(html).toContain('id="sec-3"');
    expect(html).toContain('id="q4"');
    expect(html).toContain('id="sec-12"');
  });

  it('uses s-prefixed ids for numbered subsections, not question ids', () => {
    const html = decorateHeadingIds(
      '<h2>一、推特</h2><h3>1.1 用例</h3><h3>1.2 约束与估算</h3><h3>3.2.1 细节</h3><h3>7. 积压（中级）</h3>',
    );
    expect(html).toContain('id="s1-1"');
    expect(html).toContain('id="s1-2"');
    expect(html).toContain('id="s3-2-1"');
    expect(html).toContain('id="q7"');
    expect(html).not.toContain('id="q1"');
  });

  it('dedupes repeated headings with the parent section', () => {
    const html = decorateHeadingIds(
      '<h2>一、渲染</h2><h3>初级</h3><h2>二、Hooks</h2><h3>初级</h3><h3>初级</h3>',
    );
    expect(html).toContain('id="初级"');
    expect(html).toContain('id="sec-2-初级"');
    expect(html).toContain('id="sec-2-初级-2"');
  });

  it('is idempotent when ids already present', () => {
    const once = decorateHeadingIds('<h2>A</h2>');
    const twice = decorateHeadingIds(once);
    expect(twice).toBe(once);
  });
});
