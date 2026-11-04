import { useEffect } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { usePosts } from '../content/PostsContext';
import { useLocale } from '../i18n/LocaleContext';
import { NotFoundPage } from './NotFoundPage';

function normalizePostSlug(splat: string | undefined): string {
  if (!splat) {
    return '';
  }
  return splat.replace(/^\/+|\/+$/g, '');
}

export function PostPage() {
  const params = useParams();
  const { hash } = useLocation();
  const [searchParams] = useSearchParams();
  const slug = normalizePostSlug(params['*']);
  const posts = usePosts();
  const { t } = useLocale();
  const post = posts.find((p) => p.slug === slug);
  const fromInterview = searchParams.get('from') === 'interview';

  useEffect(() => {
    if (!post || !hash) {
      return;
    }
    const id = decodeURIComponent(hash.replace(/^#/, ''));
    if (!id) {
      return;
    }
    // Wait a tick so innerHTML is in the DOM before scrolling to the answer.
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [post, hash, slug]);

  if (!post) {
    return <NotFoundPage />;
  }

  return (
    <article className="post">
      <p className="post-back">
        {fromInterview ? (
          <Link to={`/interview${typeof window !== 'undefined' ? sessionStorage.getItem('interviewQuery') ?? '' : ''}`}>{t('post.backInterview')}</Link>
        ) : (
          <Link to="/">{t('post.back')}</Link>
        )}
      </p>
      {post.category ? (
        <p>
          <Link to={`/topics/${post.category}`} className="post-category">
            {post.category}
          </Link>
        </p>
      ) : null}
      <h1>{post.title}</h1>
      <time dateTime={post.date}>{post.date}</time>
      <div
        className="post-body"
        dangerouslySetInnerHTML={{ __html: post.html }}
      />
    </article>
  );
}
