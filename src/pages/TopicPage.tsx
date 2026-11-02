import { Link, useParams } from 'react-router-dom';
import { PostList } from '../components/PostList';
import {
  findPostGroup,
  UNCATEGORIZED_ID,
} from '../content/groupPosts';
import { usePosts } from '../content/PostsContext';
import { useLocale } from '../i18n/LocaleContext';
import type { MessageKey } from '../i18n/zh';
import { NotFoundPage } from './NotFoundPage';

function categoryLabel(id: string, t: (key: MessageKey) => string): string {
  if (id === UNCATEGORIZED_ID) {
    return t('list.uncategorized');
  }
  return id;
}

export function TopicPage() {
  const { categoryId = '' } = useParams();
  const posts = usePosts();
  const { t } = useLocale();
  const group = findPostGroup(posts, categoryId);

  if (!group) {
    return <NotFoundPage />;
  }

  return (
    <section className="topic-page">
      <p className="post-back">
        <Link to="/">{t('topic.back')}</Link>
      </p>
      <header className="topic-header">
        <h1 className="topic-title">{categoryLabel(group.id, t)}</h1>
        <span className="topic-count">{group.posts.length}</span>
      </header>
      <PostList posts={group.posts} />
    </section>
  );
}
