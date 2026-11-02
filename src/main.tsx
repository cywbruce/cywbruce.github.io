import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { posts } from 'virtual:posts';
import App from './App';
import { PostsProvider } from './content/PostsContext';
import { LocaleProvider } from './i18n/LocaleContext';
import './styles/global.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

const app = (
  <StrictMode>
    <BrowserRouter>
      <LocaleProvider>
        <PostsProvider posts={posts}>
          <App />
        </PostsProvider>
      </LocaleProvider>
    </BrowserRouter>
  </StrictMode>
);

if (rootEl.hasChildNodes()) {
  hydrateRoot(rootEl, app);
} else {
  createRoot(rootEl).render(app);
}
