import { Link } from 'react-router-dom';
import type { Post } from '../content/types';
import { useLocale } from '../i18n/LocaleContext';

export function PostList({ posts }: { posts: Post[] }) {
  const { t } = useLocale();

  if (posts.length === 0) {
    return <p className="empty">{t('list.empty')}</p>;
  }

  return (
    <ul className="post-list">
      {posts.map((post) => (
        <li key={post.slug}>
          <Link to={`/posts/${post.slug}/`} className="post-list-card">
            <span className="post-list-title">{post.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
