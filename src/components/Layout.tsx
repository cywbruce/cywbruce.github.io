import { Link, Outlet, useLocation } from 'react-router-dom';
import { site } from '../config/site';
import { useLocale } from '../i18n/LocaleContext';
import { LanguageSwitch } from './LanguageSwitch';

export function Layout() {
  const { t } = useLocale();
  const { pathname } = useLocation();
  const isHome = pathname === '/';

  return (
    <div className="site">
      <header className="site-header">
        {isHome ? (
          <h1 className="brand">
            <Link to="/" className="brand-link">
              {site.title}
            </Link>
          </h1>
        ) : (
          <Link to="/" className="brand brand-link">
            {site.title}
          </Link>
        )}
        <nav className="site-nav" aria-label="main">
          {!isHome ? <Link to="/">{t('nav.home')}</Link> : null}
          <LanguageSwitch />
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>{site.author}</span>
      </footer>
    </div>
  );
}
