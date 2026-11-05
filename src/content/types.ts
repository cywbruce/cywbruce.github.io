/** 内容模块：深度手册 / 面试官地图 / 题目与答案 / 学习与经验 */
export type PostKind = 'handbook' | 'map' | 'qa' | 'guide';
export const POST_KINDS: PostKind[] = ['map', 'qa', 'handbook', 'guide'];

export interface Post {
  /** Path under content/posts without .md, e.g. `hello-blog` or `java/jvm-gc`. */
  slug: string;
  title: string;
  date: string;
  summary?: string;
  /** First path segment when slug is nested, e.g. `java`. */
  category?: string;
  /** frontmatter `interview: false` → 不收录进题库 */
  interview?: boolean;
  /** frontmatter `kind` → 首页模块分区 */
  kind?: PostKind;
  html: string;
}
