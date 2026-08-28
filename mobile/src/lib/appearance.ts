import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Настройка темы: следовать за системой или зафиксировать светлую/тёмную.
 *
 * В вебе тем-стиль и тема-светлость раздельны; здесь пока один стиль (Хроника),
 * но выбор светлой/тёмной/системной работает по-настоящему. Значение живёт в
 * AsyncStorage и раздаётся через внешнее хранилище, чтобы usePalette
 * перерисовался у всех разом при смене.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'parafraz-theme';
let current: ThemePreference = 'system';
const listeners = new Set<() => void>();

// Читаем сохранённое один раз при старте; до этого стоит «системная».
AsyncStorage.getItem(KEY)
  .then((value) => {
    if (value === 'light' || value === 'dark' || value === 'system') {
      current = value;
      listeners.forEach((cb) => cb());
    }
  })
  .catch(() => {});

export function getThemePreference(): ThemePreference {
  return current;
}

export function setThemePreference(next: ThemePreference) {
  current = next;
  listeners.forEach((cb) => cb());
  AsyncStorage.setItem(KEY, next).catch(() => {});
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
}
