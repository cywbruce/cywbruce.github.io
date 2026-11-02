import { Link, useParams } from 'react-router-dom';
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
  const slug = normalizePostSlug(params['*']);
  const posts = usePosts();
  const { t } = useLocale();
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return <NotFoundPage />;
  }

  return (
    <article className="post">
      <p className="post-back">
        <Link to="/">{t('post.back')}</Link>
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
