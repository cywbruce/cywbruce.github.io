export interface Post {
  /** Path under content/posts without .md, e.g. `hello-blog` or `java/jvm-gc`. */
  slug: string;
  title: string;
  date: string;
  summary?: string;
  /** First path segment when slug is nested, e.g. `java`. */
  category?: string;
  html: string;
}
