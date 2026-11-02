import { beforeEach, describe, expect, it } from 'vitest';
import { HYDRATION_LOCALE } from './LocaleContext';
import {
  resolveLocale,
  setLocale,
  t,
  type LocaleStorage,
} from './index';

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

describe('locale', () => {
  beforeEach(() => {
    setLocale('zh', createMemoryStorage());
  });

  it('defaults to zh when storage is empty', () => {
    const storage = createMemoryStorage();
    expect(resolveLocale(storage)).toBe('zh');
  });

  it('reads back en after setLocale writes en', () => {
    const storage = createMemoryStorage();
    expect(setLocale('en', storage)).toBe('en');
    expect(resolveLocale(storage)).toBe('en');
  });

  it('falls back to zh for illegal stored values', () => {
    const storage = createMemoryStorage({ locale: 'fr' });
    expect(resolveLocale(storage)).toBe('zh');
    expect(setLocale('nope', storage)).toBe('zh');
    expect(resolveLocale(storage)).toBe('zh');
  });

  it('returns different non-empty list.empty strings for zh and en', () => {
    const zhText = t('list.empty', 'zh');
    const enText = t('list.empty', 'en');
    expect(zhText.length).toBeGreaterThan(0);
    expect(enText.length).toBeGreaterThan(0);
    expect(zhText).not.toBe(enText);
  });

  it('uses zh for first paint while still reading stored en preference', () => {
    expect(HYDRATION_LOCALE).toBe('zh');
    const storage = createMemoryStorage({ locale: 'en' });
    expect(resolveLocale(storage)).toBe('en');
    // First client render stays on HYDRATION_LOCALE; effect later applies resolveLocale().
    expect(t('nav.home', HYDRATION_LOCALE)).toBe('首页');
    expect(t('nav.home', resolveLocale(storage))).toBe('Home');
  });
});
