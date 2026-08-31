import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DICTIONARY } from './translations';

/**
 * Локализация мобильного приложения.
 *
 * Строки в экранах зашиты по-русски, поэтому ключ перевода — это сама русская
 * строка (подход gettext): `t('Настройки')`. Русская локаль возвращает ключ как
 * есть, английская и испанская — перевод из словаря, а если перевода ещё нет —
 * откат на русский. Так перенос строк механический, а отсутствие части
 * переводов не ломает экран, а лишь оставляет его по-русски.
 *
 * Выбор локали хранится на устройстве (AsyncStorage) и живёт во внешнем store,
 * чтобы useT перерисовывал экраны при смене языка.
 */
export type Locale = 'ru' | 'en' | 'es';

export const LOCALES: ReadonlyArray<{ id: Locale; label: string }> = [
  { id: 'ru', label: 'Русский' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

const STORAGE_KEY = 'parafraz-locale';

let currentLocale: Locale = 'ru';
const listeners = new Set<() => void>();

function notify() { listeners.forEach((l) => l()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function getSnapshot(): Locale { return currentLocale; }

/** Прочитать сохранённую локаль один раз при старте (вызывается из App). */
export async function initLocale(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es' || stored === 'ru') {
      currentLocale = stored;
      notify();
    }
  } catch {
    // остаётся русский по умолчанию
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(next: Locale) {
  currentLocale = next;
  notify();
  AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
}

/** Перевод по русскому ключу. Русский — сам ключ; иначе словарь или откат. */
export function translate(ru: string, locale: Locale = currentLocale): string {
  if (locale === 'ru') return ru;
  return DICTIONARY[locale]?.[ru] ?? ru;
}

export function useLocale(): Locale {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useT() {
  const locale = useLocale();
  return {
    locale,
    setLocale,
    t: (ru: string) => translate(ru, locale),
  };
}

// Гидратация на импорте — как у appearance: сохранённая локаль подхватывается
// при старте, до первого рендера экранов.
void initLocale();
