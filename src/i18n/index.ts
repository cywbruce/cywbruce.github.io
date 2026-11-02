import { en } from './en';
import { zh, type MessageKey } from './zh';

export type Locale = 'zh' | 'en';

export const LOCALE_STORAGE_KEY = 'locale';

export type LocaleStorage = Pick<Storage, 'getItem' | 'setItem'>;

const messages = { zh, en } as const;

let memoryLocale: Locale = 'zh';

function isLocale(value: string | null | undefined): value is Locale {
  return value === 'zh' || value === 'en';
}

function getDefaultStorage(): LocaleStorage | null {
  if (typeof globalThis.localStorage === 'undefined') {
    return null;
  }
  return globalThis.localStorage;
}

export function resolveLocale(storage: LocaleStorage | null = getDefaultStorage()): Locale {
  if (!storage) {
    return memoryLocale;
  }
  try {
    const stored = storage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) {
      return stored;
    }
  } catch {
    // ignore storage errors; fall back to default
  }
  return 'zh';
}

export function setLocale(
  next: string,
  storage: LocaleStorage | null = getDefaultStorage(),
): Locale {
  const locale: Locale = isLocale(next) ? next : 'zh';
  memoryLocale = locale;
  if (storage) {
    try {
      storage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // ignore storage errors
    }
  }
  return locale;
}

export function t(
  key: MessageKey,
  locale: Locale = resolveLocale(),
): string {
  return messages[locale][key] ?? messages.zh[key];
}

export type { MessageKey };
