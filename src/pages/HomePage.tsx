import { Link } from 'react-router-dom';
import {
  groupPostsByCategory,
  UNCATEGORIZED_ID,
} from '../content/groupPosts';
import { usePosts } from '../content/PostsContext';
import { LEVELS, TRACKS } from '../content/tracks';
import { useLocale } from '../i18n/LocaleContext';
import type { MessageKey } from '../i18n/zh';
import { POST_KINDS } from '../content/types';

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
      <section className="roadmap-hero" aria-label={t('roadmap.title')}>
        <header className="roadmap-hero-head">
          <h2 className="roadmap-hero-title">{t('roadmap.title')}</h2>
          <Link to="/posts/guides/interview-roadmap/" className="roadmap-hero-more">
            {t('roadmap.more')}
          </Link>
        </header>
        <div className="roadmap-grid">
          {TRACKS.map((track) => (
            <div key={track} className="roadmap-card">
              <Link to={`/interview?track=${track}`} className="roadmap-card-title">
                {t(`track.${track}` as MessageKey)}
              </Link>
              <div className="roadmap-levels">
                {LEVELS.map((level) => (
                  <Link
                    key={level}
                    to={`/interview?track=${track}&level=${level}`}
                    className={`level-badge level-${level}`}
                  >
                    {t(`level.${level}` as MessageKey)}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="module-section" aria-label={t('module.title')}>
        <h2 className="module-section-title">{t('module.title')}</h2>
        <div className="module-grid">
          {POST_KINDS.map((kind) => {
            const list = posts
              .filter((p) => p.kind === kind)
              .sort((a, b) => a.slug.localeCompare(b.slug));
            if (list.length === 0) return null;
            return (
              <details key={kind} className={`module-card module-${kind}`}>
                <summary className="module-card-head">
                  <span className="module-card-name">{t(`module.${kind}` as MessageKey)}</span>
                  <span className="module-card-count">{list.length}</span>
                  <span className="module-card-desc">{t(`module.${kind}.desc` as MessageKey)}</span>
                </summary>
                {kind === 'qa' && (
                  <Link to="/interview" className="module-card-cta">{t('module.toQuestions')}</Link>
                )}
                <ul className="module-card-list">
                  {list.map((p) => (
                    <li key={p.slug}>
                      <Link to={`/posts/${p.slug}/`}>{p.title}</Link>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      </section>
      <nav className="topic-portal" aria-label={t('topic.nav')}>
        <Link className="topic-portal-item topic-portal-interview" to="/interview">
          <span className="topic-portal-name">{t('interview.title')}</span>
          <span className="topic-portal-count">{t('interview.portalHint')}</span>
        </Link>
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
