import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  extractInterviewQuestions,
  interviewQuestionHref,
  type InterviewQuestion,
} from '../content/extractQuestions';
import { UNCATEGORIZED_ID } from '../content/groupPosts';
import { usePosts } from '../content/PostsContext';
import { LEVELS, TRACKS, type Level, type Track } from '../content/tracks';
import { useLocale } from '../i18n/LocaleContext';
import type { MessageKey } from '../i18n/zh';

const ALL = 'all';
const UNGRADED = 'ungraded';
type LevelBucket = Level | typeof UNGRADED;

function catOf(q: InterviewQuestion): string {
  return q.category?.trim() || UNCATEGORIZED_ID;
}

function categoryLabel(id: string, t: (key: MessageKey) => string): string {
  return id === UNCATEGORIZED_ID ? t('list.uncategorized') : id;
}

function bucketOf(q: InterviewQuestion): LevelBucket {
  return q.levels?.[0] ?? UNGRADED;
}

type ChipProps = {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
};

function Chip({ active, label, count, onClick }: ChipProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? 'interview-filter is-active' : 'interview-filter'}
      onClick={onClick}
    >
      {label}
      <span className="interview-filter-count">{count}</span>
    </button>
  );
}

export function InterviewPage() {
  const posts = usePosts();
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const track = (params.get('track') ?? ALL) as Track | typeof ALL;
  const level = (params.get('level') ?? ALL) as Level | typeof ALL;
  const [activeCategory, setActiveCategory] = useState(ALL);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === ALL) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  if (typeof window !== 'undefined') {
    sessionStorage.setItem('interviewQuery', params.toString() ? `?${params}` : '');
  }

  const questions = useMemo(() => extractInterviewQuestions(posts), [posts]);

  const inTrack = useMemo(
    () => (track === ALL ? questions : questions.filter((q) => q.track === track)),
    [questions, track],
  );

  const categories = useMemo(() => {
    const ids = new Set(inTrack.map(catOf));
    return [...ids].sort((a, b) => {
      if (a === UNCATEGORIZED_ID) return 1;
      if (b === UNCATEGORIZED_ID) return -1;
      return a.localeCompare(b);
    });
  }, [inTrack]);

  const inCategory = useMemo(
    () =>
      activeCategory === ALL || !categories.includes(activeCategory)
        ? inTrack
        : inTrack.filter((q) => catOf(q) === activeCategory),
    [inTrack, activeCategory, categories],
  );

  const filtered = useMemo(
    () =>
      level === ALL
        ? inCategory
        : inCategory.filter((q) => q.levels?.includes(level)),
    [inCategory, level],
  );

  const sections = useMemo(() => {
    const order: LevelBucket[] =
      level === ALL ? [...LEVELS, UNGRADED] : [level];
    return order
      .map((b) => ({
        bucket: b,
        items: level === ALL ? filtered.filter((q) => bucketOf(q) === b) : filtered,
      }))
      .filter((s) => s.items.length > 0);
  }, [filtered, level]);

  const levelText = (b: LevelBucket) => t(`level.${b}` as MessageKey);

  return (
    <section className="interview-page">
      <p className="post-back">
        <Link to="/">{t('interview.back')}</Link>
      </p>
      <header className="topic-header">
        <h1 className="topic-title">{t('interview.title')}</h1>
        <span className="topic-count">{filtered.length}</span>
      </header>
      <p className="interview-lead">{t('interview.lead')}</p>

      <div className="interview-filters is-track" role="tablist" aria-label={t('interview.track')}>
        <Chip active={track === ALL} label={t('interview.all')} count={questions.length} onClick={() => setParam('track', ALL)} />
        {TRACKS.map((id) => (
          <Chip
            key={id}
            active={track === id}
            label={t(`track.${id}` as MessageKey)}
            count={questions.filter((q) => q.track === id).length}
            onClick={() => {
              setActiveCategory(ALL);
              setParam('track', id);
            }}
          />
        ))}
      </div>

      <div className="interview-filters" role="tablist" aria-label={t('interview.level')}>
        <Chip active={level === ALL} label={t('interview.allLevels')} count={inCategory.length} onClick={() => setParam('level', ALL)} />
        {LEVELS.map((id) => (
          <Chip
            key={id}
            active={level === id}
            label={levelText(id)}
            count={inCategory.filter((q) => q.levels?.includes(id)).length}
            onClick={() => setParam('level', id)}
          />
        ))}
      </div>

      {categories.length > 1 ? (
        <div className="interview-filters is-sub" role="tablist" aria-label={t('interview.filter')}>
          <Chip active={activeCategory === ALL} label={t('interview.all')} count={inTrack.length} onClick={() => setActiveCategory(ALL)} />
          {categories.map((id) => (
            <Chip
              key={id}
              active={activeCategory === id}
              label={categoryLabel(id, t)}
              count={inTrack.filter((q) => catOf(q) === id).length}
              onClick={() => setActiveCategory(id)}
            />
          ))}
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <p className="empty">{t('interview.empty')}</p>
      ) : (
        sections.map((sec) => (
          <section key={sec.bucket} className="interview-level-section">
            <h2 className={`interview-level-title level-${sec.bucket}`}>
              {levelText(sec.bucket)}
              <span className="interview-filter-count">{sec.items.length}</span>
            </h2>
            <ol className="interview-list">
              {sec.items.map((q) => (
                <li key={q.id} className="interview-item">
                  <Link className="interview-link" to={interviewQuestionHref(q)}>
                    <span className="interview-question">{q.question}</span>
                    <span className="interview-meta">
                      {(q.levels ?? []).map((l) => (
                        <span key={l} className={`level-badge level-${l}`}>
                          {levelText(l)}
                        </span>
                      ))}
                      <span className="interview-meta-cat">{categoryLabel(catOf(q), t)}</span>
                      <span className="interview-meta-sep" aria-hidden="true">·</span>
                      <span className="interview-meta-heading">{q.heading}</span>
                      <span className="interview-answer-hint">{t('interview.toAnswer')}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </section>
  );
}
