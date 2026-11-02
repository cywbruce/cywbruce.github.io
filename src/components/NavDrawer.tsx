import { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  groupPostsByCategory,
  UNCATEGORIZED_ID,
} from '../content/groupPosts';
import { extractToc } from '../content/toc';
import { usePosts } from '../content/PostsContext';
import { useLocale } from '../i18n/LocaleContext';
import type { MessageKey } from '../i18n/zh';

function categoryLabel(id: string, t: (key: MessageKey) => string): string {
  if (id === UNCATEGORIZED_ID) {
    return t('list.uncategorized');
  }
  return id;
}

type NavDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Current post slug when on a post page, else undefined. */
  activeSlug?: string;
  /** HTML of the active post for in-page toc. */
  activeHtml?: string;
  /** Category id to expand by default. */
  activeCategoryId?: string;
};

export function NavDrawer({
  open,
  onClose,
  activeSlug,
  activeHtml,
  activeCategoryId,
}: NavDrawerProps) {
  const posts = usePosts();
  const { t } = useLocale();
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const groups = groupPostsByCategory(posts);
  const toc = activeHtml ? extractToc(activeHtml) : [];

  useEffect(() => {
    if (!open) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="nav-drawer-root">
      <button
        type="button"
        className="nav-drawer-backdrop"
        aria-label={t('drawer.close')}
        onClick={onClose}
      />
      <aside
        className="nav-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="nav-drawer-header">
          <h2 id={titleId} className="nav-drawer-title">
            {t('drawer.open')}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="nav-drawer-close"
            onClick={onClose}
          >
            {t('drawer.close')}
          </button>
        </header>

        <div className="nav-drawer-body">
          {toc.length > 0 ? (
            <section className="nav-drawer-section" aria-label={t('drawer.toc')}>
              <h3 className="nav-drawer-section-title">{t('drawer.toc')}</h3>
              <ul className="nav-drawer-toc">
                {toc.map((item) => (
                  <li
                    key={item.id}
                    className={
                      item.level === 3
                        ? 'nav-drawer-toc-item is-h3'
                        : 'nav-drawer-toc-item'
                    }
                  >
                    <a
                      href={`#${item.id}`}
                      onClick={onClose}
                    >
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section
            className="nav-drawer-section"
            aria-label={t('drawer.topics')}
          >
            <h3 className="nav-drawer-section-title">{t('drawer.topics')}</h3>
            <div className="nav-drawer-topics">
              {groups.map((group) => {
                const openByDefault =
                  group.id === activeCategoryId ||
                  (!activeCategoryId &&
                    group.posts.some((p) => p.slug === activeSlug));
                return (
                  <details
                    key={group.id}
                    className="nav-drawer-topic"
                    defaultOpen={openByDefault}
                  >
                    <summary className="nav-drawer-topic-summary">
                      <span>{categoryLabel(group.id, t)}</span>
                      <span className="nav-drawer-topic-count">
                        {group.posts.length}
                      </span>
                    </summary>
                    <ul className="nav-drawer-posts">
                      {group.posts.map((post) => (
                        <li key={post.slug}>
                          <Link
                            to={`/posts/${post.slug}/`}
                            className={
                              post.slug === activeSlug
                                ? 'nav-drawer-post is-active'
                                : 'nav-drawer-post'
                            }
                            onClick={onClose}
                          >
                            {post.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
