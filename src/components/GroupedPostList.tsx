import { Link } from 'react-router-dom';
import type { Post } from '../content/types';
import { useLocale } from '../i18n/LocaleContext';
import type { MessageKey } from '../i18n/zh';

export type PostSection = {
  id: string;
  label: string;
  note: string;
  posts: Post[];
};

/** 按 order 百位分组：0 / 1 / 2 为导览与速查，100–900 对应板块 A–I。 */
export function groupInterviewPosts(posts: Post[], t: (key: MessageKey) => string): PostSection[] {
  const buckets = new Map<number, Post[]>();
  for (const post of posts) {
    const key = Math.floor((post.order ?? 0) / 100) * 100;
    const list = buckets.get(key);
    if (list) list.push(post);
    else buckets.set(key, [post]);
  }

  const meta: { key: number; id: string; label: MessageKey; note: MessageKey }[] = [
    { key: 0, id: 'intro', label: 'lab.group.intro', note: 'lab.group.intro.note' },
    { key: 100, id: 'A', label: 'lab.group.A', note: 'lab.group.A.note' },
    { key: 200, id: 'B', label: 'lab.group.B', note: 'lab.group.B.note' },
    { key: 300, id: 'C', label: 'lab.group.C', note: 'lab.group.C.note' },
    { key: 400, id: 'D', label: 'lab.group.D', note: 'lab.group.D.note' },
    { key: 500, id: 'E', label: 'lab.group.E', note: 'lab.group.E.note' },
    { key: 600, id: 'F', label: 'lab.group.F', note: 'lab.group.F.note' },
    { key: 700, id: 'G', label: 'lab.group.G', note: 'lab.group.G.note' },
    { key: 800, id: 'H', label: 'lab.group.H', note: 'lab.group.H.note' },
    { key: 900, id: 'I', label: 'lab.group.I', note: 'lab.group.I.note' },
  ];

  return meta
    .map((m) => ({
      id: m.id,
      label: t(m.label),
      note: t(m.note),
      posts: buckets.get(m.key) ?? [],
    }))
    .filter((section) => section.posts.length > 0);
}

export function GroupedPostList({ posts }: { posts: Post[] }) {
  const { t } = useLocale();
  const sections = groupInterviewPosts(posts, t);

  if (sections.length === 0) {
    return <p className="empty">{t('list.empty')}</p>;
  }

  return (
    <div className="grouped-list">
      <nav className="group-jump" aria-label={t('lab.jump.label')}>
        {sections.map((s) => (
          <a key={s.id} className="group-jump-chip" href={`#lab-group-${s.id}`}>
            {s.label}
          </a>
        ))}
      </nav>

      {sections.map((s) => (
        <section key={s.id} id={`lab-group-${s.id}`} className="post-group">
          <header className="post-group-head">
            <div className="post-group-heading">
              <span className="post-group-id">{s.id === 'intro' ? '★' : s.id}</span>
              <h2 className="post-group-title">{s.label}</h2>
              <span className="post-group-count">{s.posts.length}</span>
            </div>
            <p className="post-group-note">{s.note}</p>
          </header>
          <ul className="post-list group-post-list">
            {s.posts.map((post) => (
              <li key={post.slug}>
                <Link to={`/posts/${post.slug}/`} className="post-list-card group-post-card">
                  <span className="group-post-order">
                    {post.order !== undefined ? String(post.order).padStart(3, '0') : '—'}
                  </span>
                  <span className="group-post-main">
                    <span className="post-list-title">{post.title}</span>
                    {post.summary && <span className="summary">{post.summary}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
