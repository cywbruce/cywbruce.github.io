/**
 * Wrap every Markdown-generated `<table>` in a `<div class="table-wrap">`.
 *
 * `marked` (GFM) emits a bare `<table>` with no wrapper, which leaves tables
 * with no surface for a card border / horizontal-scroll fallback. Adding the
 * wrapper here (rather than in MD source) keeps the 40+ question-bank files
 * clean and applies the enhancement to every table on the site.
 */
export function wrapTables(html: string): string {
  return html.replace(/<table>[\s\S]*?<\/table>/gi, (table) => (
    `<div class="table-wrap">${table}</div>`
  ));
}
