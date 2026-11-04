import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { site } from '../config/site';
import { usePosts } from '../content/PostsContext';
import { useLocale } from '../i18n/LocaleContext';
import { LanguageSwitch } from './LanguageSwitch';
import { NavDrawer } from './NavDrawer';

function postSlugFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/posts\/(.+?)\/?$/);
  if (!match) {
    return undefined;
  }
  return match[1].replace(/\/+$/, '');
}

export function Layout() {
  const { t } = useLocale();
  const { pathname } = useLocation();
  const posts = usePosts();
  const isHome = pathname === '/';
  const activeSlug = postSlugFromPath(pathname);
  const isPost = activeSlug !== undefined;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activePost = activeSlug
    ? posts.find((p) => p.slug === activeSlug)
    : undefined;

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

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
          {isPost ? (
            <button
              type="button"
              className="nav-drawer-trigger"
              aria-expanded={drawerOpen}
              aria-controls="site-nav-drawer"
              onClick={() => setDrawerOpen(true)}
            >
              {t('drawer.open')}
            </button>
          ) : null}
          {!isHome ? <Link to="/">{t('nav.home')}</Link> : null}
          {pathname !== '/interview' ? (
            <Link to="/interview">{t('nav.interview')}</Link>
          ) : null}
          <LanguageSwitch />
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>{site.author}</span>
      </footer>
      {isPost ? (
        <div id="site-nav-drawer">
          <NavDrawer
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            activeSlug={activePost?.slug}
            activeHtml={activePost?.html}
            activeCategoryId={activePost?.category}
          />
        </div>
      ) : null}
    </div>
  );
}
