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
// 'glam' — шестое, скрытое оформление: в списке настроек его нет, оно
// открывается пасхалкой на дне раздела «О приложении» (как в вебе).
export type StyleId = 'chronicle' | 'atelier' | 'midnight' | 'garden' | 'signal' | 'glam';

const THEME_KEY = 'parafraz-theme';
const STYLE_KEY = 'parafraz-style';
const STYLE_IDS: StyleId[] = ['chronicle', 'atelier', 'midnight', 'garden', 'signal', 'glam'];

let currentTheme: ThemePreference = 'system';
let currentStyle: StyleId = 'chronicle';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((cb) => cb());

// Читаем сохранённое один раз при старте; до этого — умолчания.
AsyncStorage.getItem(THEME_KEY)
  .then((value) => {
    if (value === 'light' || value === 'dark' || value === 'system') {
      currentTheme = value;
      emit();
    }
  })
  .catch(() => {});
AsyncStorage.getItem(STYLE_KEY)
  .then((value) => {
    if (value && STYLE_IDS.includes(value as StyleId)) {
      currentStyle = value as StyleId;
      emit();
    }
  })
  .catch(() => {});

export function getThemePreference(): ThemePreference {
  return currentTheme;
}
export function setThemePreference(next: ThemePreference) {
  currentTheme = next;
  emit();
  AsyncStorage.setItem(THEME_KEY, next).catch(() => {});
}
export function getStylePreference(): StyleId {
  return currentStyle;
}
export function setStylePreference(next: StyleId) {
  currentStyle = next;
  emit();
  AsyncStorage.setItem(STYLE_KEY, next).catch(() => {});
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
}
export function useStylePreference(): StyleId {
  return useSyncExternalStore(subscribe, getStylePreference, getStylePreference);
}
