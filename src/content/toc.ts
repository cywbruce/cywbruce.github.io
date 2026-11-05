export type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function readIdAttr(attrs: string): string | undefined {
  const match = attrs.match(/\sid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!match) {
    return undefined;
  }
  return match[1] ?? match[2] ?? match[3];
}

const CN_NUM: Record<string, number> = {
  〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10,
};

function cnToNumber(s: string): number | undefined {
  if (s === '十') return 10;
  if (s.length === 1) return CN_NUM[s];
  if (s.length === 2 && s[0] === '十') return 10 + (CN_NUM[s[1]] ?? NaN);
  if (s.length === 2 && s[1] === '十') return (CN_NUM[s[0]] ?? NaN) * 10;
  if (s.length === 3 && s[1] === '十') return (CN_NUM[s[0]] ?? NaN) * 10 + (CN_NUM[s[2]] ?? NaN);
  return undefined;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** Text → URL-safe slug; keeps CJK, drops punctuation and the trailing（级别）tag. */
export function slugifyHeading(text: string): string {
  return decodeEntities(text)
    .replace(/[（(][^（）()]*[）)]\s*$/, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Stable id for a heading:
 * - h3「4. xxx」→ `q4`（题号，改标题文字不影响链接）
 * - h2「三、xxx」→ `sec-3`
 * - otherwise a slug of the heading text
 */
export function headingIdFor(level: number, text: string): string {
  const plain = decodeEntities(text).trim();
  if (level === 3) {
    const m = plain.match(/^(\d+)[.、．]\s*/);
    if (m) return `q${m[1]}`;
  }
  if (level === 2) {
    const m = plain.match(/^([〇一二三四五六七八九十]+)、/);
    const n = m ? cnToNumber(m[1]) : undefined;
    if (n !== undefined && !Number.isNaN(n)) return `sec-${n}`;
  }
  return slugifyHeading(plain) || 'section';
}

/** Ensure h2/h3 have stable ids; return html suitable for in-article anchors. */
export function decorateHeadingIds(html: string): string {
  const used = new Set<string>();
  let parent = '';
  return html.replace(
    /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (_match, level: string, attrs = '', inner: string) => {
      const existing = readIdAttr(attrs);
      if (existing) {
        used.add(existing);
        if (level === '2') parent = existing;
        return `<h${level}${attrs}>${inner}</h${level}>`;
      }
      const base = headingIdFor(Number(level), stripTags(inner));
      let id = base;
      if (used.has(id) && level === '3' && parent) id = `${parent}-${base}`;
      let n = 2;
      const root = id;
      while (used.has(id)) id = `${root}-${n++}`;
      used.add(id);
      if (level === '2') parent = id;
      return `<h${level}${attrs} id="${id}">${inner}</h${level}>`;
    },
  );
}

/** Read toc entries from html that already has heading ids (h2/h3). */
export function extractToc(html: string): TocItem[] {
  const toc: TocItem[] = [];
  const re = /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const level = Number(match[1]) as 2 | 3;
    const attrs = match[2] ?? '';
    const text = stripTags(match[3] ?? '');
    const id = readIdAttr(attrs);
    if (!id || !text) {
      continue;
    }
    toc.push({ id, text, level });
  }
  return toc;
}
