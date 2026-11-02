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

/** Ensure h2/h3 have ids; return html suitable for in-article anchors. */
export function decorateHeadingIds(html: string): string {
  let index = 0;
  return html.replace(
    /<h([23])(\s[^>]*)?>([\s\S]*?)<\/h\1>/gi,
    (_match, level: string, attrs = '', inner: string) => {
      const existing = readIdAttr(attrs);
      const id = existing && existing.length > 0 ? existing : `toc-${++index}`;
      if (existing) {
        return `<h${level}${attrs}>${inner}</h${level}>`;
      }
      const spacer = attrs.length > 0 ? attrs : '';
      return `<h${level}${spacer} id="${id}">${inner}</h${level}>`;
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
