import { Link } from 'react-router-dom';
import {
  groupPostsByCategory,
  UNCATEGORIZED_ID,
} from '../content/groupPosts';
import { usePosts } from '../content/PostsContext';
import { useLocale } from '../i18n/LocaleContext';
import type { MessageKey } from '../i18n/zh';

function categoryLabel(id: string, t: (key: MessageKey) => string): string {
  if (id === UNCATEGORIZED_ID) {
    return t('list.uncategorized');
  }
  return id;
}

export function HomePage() {
  const posts = usePosts();
  const { t } = useLocale();
  const groups = groupPostsByCategory(posts);

  if (posts.length === 0) {
    return (
      <section className="home">
        <p className="empty">{t('list.empty')}</p>
      </section>
    );
  }

  return (
    <section className="home">
      <nav className="topic-portal" aria-label={t('topic.nav')}>
        {groups.map((group) => (
          <Link
            key={group.id}
            className="topic-portal-item"
            to={`/topics/${group.id}`}
          >
            <span className="topic-portal-name">
              {categoryLabel(group.id, t)}
            </span>
            <span className="topic-portal-count">{group.posts.length}</span>
          </Link>
        ))}
      </nav>
    </section>
  );
}
