import { Link } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleContext';

export function NotFoundPage() {
  const { t } = useLocale();

  return (
    <section className="not-found">
      <h1>{t('notFound.title')}</h1>
      <p>
        <Link to="/">{t('post.back')}</Link>
      </p>
    </section>
  );
}
