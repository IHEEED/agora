export type Theme = 'light' | 'dark';
/** То, что выбрано в настройках: «системная» следует за настройкой ОС. */
export type ThemePreference = Theme | 'system';
export type AccentId =
  | 'indigo'
  | 'ocean'
  | 'emerald'
  | 'sunset'
  | 'rose'
  | 'amethyst'
  | 'teal'
  | 'amber'
  | 'graphite'
  | 'cherry';

export const THEME_STORAGE_KEY = 'parafraz-theme';
export const ACCENT_STORAGE_KEY = 'parafraz-accent';

/**
 * Образцы для кружков выбора в настройках. Показываем светлый вариант —
 * в тёмной теме подставляется осветлённый (см. data-accent в globals.css).
 */
export const ACCENTS: ReadonlyArray<{ id: AccentId; label: string; swatch: string }> = [
  { id: 'indigo', label: 'Индиго', swatch: '#5b3ad6' },
  { id: 'ocean', label: 'Океан', swatch: '#2563eb' },
  { id: 'teal', label: 'Бирюза', swatch: '#0d9488' },
  { id: 'emerald', label: 'Изумруд', swatch: '#059669' },
  { id: 'amber', label: 'Янтарь', swatch: '#b45309' },
  { id: 'sunset', label: 'Закат', swatch: '#ea580c' },
  { id: 'cherry', label: 'Вишня', swatch: '#dc2626' },
  { id: 'rose', label: 'Роза', swatch: '#e11d48' },
  { id: 'amethyst', label: 'Аметист', swatch: '#9333ea' },
  { id: 'graphite', label: 'Графит', swatch: '#475569' },
];

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * «Системная» не пишется в data-theme — там всегда конкретное значение,
 * иначе CSS не знал бы, какую палитру брать. В localStorage при этом
 * сохраняется именно предпочтение, чтобы тема продолжала следовать за ОС.
 */
export function applyTheme(preference: ThemePreference) {
  const resolved = preference === 'system' ? systemTheme() : preference;
  document.documentElement.setAttribute('data-theme', resolved);

  if (preference === 'system') {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
}

export function applyAccent(accent: AccentId) {
  document.documentElement.setAttribute('data-accent', accent);
  window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
}

/** Что выбрано в настройках. Отсутствие записи означает «системная». */
export function readThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function readAccent(): AccentId {
  const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
  return ACCENTS.some((a) => a.id === stored) ? (stored as AccentId) : 'indigo';
}
