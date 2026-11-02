import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  resolveLocale,
  setLocale as persistLocale,
  t as translate,
  type Locale,
  type MessageKey,
} from './index';

/** Must match prerender default so SSR HTML and first client render agree. */
export const HYDRATION_LOCALE: Locale = 'zh';

interface LocaleContextValue {
  locale: Locale;
  setLocale: (next: string) => void;
  t: (key: MessageKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // First paint always uses HYDRATION_LOCALE to avoid hydrate mismatch with prerender.
  const [locale, setLocaleState] = useState<Locale>(HYDRATION_LOCALE);

  useEffect(() => {
    // After hydrate, apply persisted preference (refresh keeps language choice).
    setLocaleState(resolveLocale());
  }, []);

  const setLocale = useCallback((next: string) => {
    setLocaleState(persistLocale(next));
  }, []);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: MessageKey) => translate(key, locale),
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error('useLocale must be used within LocaleProvider');
  }
  return ctx;
}
