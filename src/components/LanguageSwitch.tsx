import { setLocale, type Locale, type LocaleStorage } from '../i18n';
import { useLocale } from '../i18n/LocaleContext';

/** Logic under LanguageSwitch; used by unit tests without mounting UI. */
export function applyLanguage(
  next: string,
  storage?: LocaleStorage | null,
): Locale {
  return setLocale(next, storage);
}

export function LanguageSwitch() {
  const { locale, setLocale: setUiLocale, t } = useLocale();

  return (
    <div className="lang-switch" role="group" aria-label="language">
      <button
        type="button"
        className={locale === 'zh' ? 'is-active' : undefined}
        onClick={() => setUiLocale('zh')}
      >
        {t('lang.zh')}
      </button>
      <button
        type="button"
        className={locale === 'en' ? 'is-active' : undefined}
        onClick={() => setUiLocale('en')}
      >
        {t('lang.en')}
      </button>
    </div>
  );
}
