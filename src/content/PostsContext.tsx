import { createContext, useContext, type ReactNode } from 'react';
import type { Post } from './types';

const PostsContext = createContext<Post[] | null>(null);

export function PostsProvider({
  posts,
  children,
}: {
  posts: Post[];
  children: ReactNode;
}) {
  return <PostsContext.Provider value={posts}>{children}</PostsContext.Provider>;
}

export function usePosts(): Post[] {
  const posts = useContext(PostsContext);
  if (!posts) {
    throw new Error('usePosts must be used within PostsProvider');
  }
  return posts;
}
