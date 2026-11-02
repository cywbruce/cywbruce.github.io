import { PostList } from '../components/PostList';
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
      <nav className="topic-nav" aria-label={t('nav.topics')}>
        {groups.map((group) => (
          <a
            key={group.id}
            className="topic-nav-item"
            href={`#topic-${group.id}`}
          >
            {categoryLabel(group.id, t)}
            <span className="topic-nav-count">{group.posts.length}</span>
          </a>
        ))}
      </nav>

      <div className="topic-sections">
        {groups.map((group) => (
          <section
            key={group.id}
            id={`topic-${group.id}`}
            className="topic-section"
          >
            <header className="topic-header">
              <h2 className="topic-title">
                {categoryLabel(group.id, t)}
              </h2>
              <span className="topic-count">{group.posts.length}</span>
            </header>
            <PostList posts={group.posts} />
          </section>
        ))}
      </div>
    </section>
  );
}
