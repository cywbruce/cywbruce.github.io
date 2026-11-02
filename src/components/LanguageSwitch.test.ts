import { beforeEach, describe, expect, it } from 'vitest';
import { resolveLocale, t, type LocaleStorage } from '../i18n';
import { applyLanguage } from './LanguageSwitch';

function createMemoryStorage(initial: Record<string, string> = {}): LocaleStorage {
  const store = { ...initial };
  return {
    getItem(key: string) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
  };
}

describe('LanguageSwitch logic', () => {
  let storage: LocaleStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
    applyLanguage('zh', storage);
  });

  it('switches to en then back to zh', () => {
    expect(applyLanguage('en', storage)).toBe('en');
    expect(resolveLocale(storage)).toBe('en');
    expect(t('nav.home', 'en')).toBe('Home');

    expect(applyLanguage('zh', storage)).toBe('zh');
    expect(resolveLocale(storage)).toBe('zh');
    expect(t('nav.home', 'zh')).toBe('首页');
  });
});
