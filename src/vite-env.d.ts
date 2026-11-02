/// <reference types="vite/client" />

declare module 'virtual:posts' {
  import type { Post } from './content/types';
  export const posts: Post[];
}
