export type Theme = 'light' | 'dark';
/** То, что выбрано в настройках: «системная» следует за настройкой ОС. */
export type ThemePreference = Theme | 'system';
export type AccentId =
  | 'indigo'
  | 'violet'
  | 'amethyst'
  | 'plum'
  | 'magenta'
  | 'rose'
  | 'cherry'
  | 'clay'
  | 'sunset'
  | 'amber'
  | 'sand'
  | 'lime'
  | 'emerald'
  | 'forest'
  | 'teal'
  | 'sky'
  | 'ocean'
  | 'slate'
  | 'graphite'
  | 'ink';

/** Обои — повторяющаяся пиксельная надпись PARAFRAZ под углом. */
export type WallpaperId =
  | 'none'
  | 'accent'
  | 'violet'
  | 'ocean'
  | 'emerald'
  | 'sunset'
  | 'rose'
  | 'ink';

export const THEME_STORAGE_KEY = 'parafraz-theme';
export const ACCENT_STORAGE_KEY = 'parafraz-accent';
export const WALLPAPER_STORAGE_KEY = 'parafraz-wallpaper';

/**
 * Только идентификаторы и подписи: сами оттенки живут в globals.css рядом с
 * градиентом, который их использует. Дублировать палитру здесь означало бы
 * править её в двух местах при каждой правке фона.
 */
export const WALLPAPERS: ReadonlyArray<{ id: WallpaperId; label: string }> = [
  { id: 'none', label: 'Без обоев' },
  { id: 'accent', label: 'По акценту' },
  { id: 'violet', label: 'Фиалка' },
  { id: 'ocean', label: 'Океан' },
  { id: 'emerald', label: 'Изумруд' },
  { id: 'sunset', label: 'Закат' },
  { id: 'rose', label: 'Роза' },
  { id: 'ink', label: 'Чернила' },
];

/**
 * Образцы для кружков выбора в настройках. Показываем светлый вариант —
 * в тёмной теме подставляется осветлённый (см. data-accent в globals.css).
 */
// Порядок — по кругу оттенков: фиолетовые, красные, тёплые, зелёные,
// синие, нейтральные. Так палитра в настройках читается как радуга.
export const ACCENTS: ReadonlyArray<{ id: AccentId; label: string; swatch: string }> = [
  { id: 'indigo', label: 'Индиго', swatch: '#5b3ad6' },
  { id: 'violet', label: 'Фиалка', swatch: '#7c3aed' },
  { id: 'amethyst', label: 'Аметист', swatch: '#9333ea' },
  { id: 'plum', label: 'Слива', swatch: '#86198f' },
  { id: 'magenta', label: 'Маджента', swatch: '#c026d3' },
  { id: 'rose', label: 'Роза', swatch: '#e11d48' },
  { id: 'cherry', label: 'Вишня', swatch: '#dc2626' },
  { id: 'clay', label: 'Терракота', swatch: '#c2410c' },
  { id: 'sunset', label: 'Закат', swatch: '#ea580c' },
  { id: 'amber', label: 'Янтарь', swatch: '#b45309' },
  { id: 'sand', label: 'Песок', swatch: '#a16207' },
  { id: 'lime', label: 'Лайм', swatch: '#4d7c0f' },
  { id: 'emerald', label: 'Изумруд', swatch: '#059669' },
  { id: 'forest', label: 'Лес', swatch: '#15803d' },
  { id: 'teal', label: 'Бирюза', swatch: '#0d9488' },
  { id: 'sky', label: 'Небо', swatch: '#0284c7' },
  { id: 'ocean', label: 'Океан', swatch: '#2563eb' },
  { id: 'slate', label: 'Сланец', swatch: '#334155' },
  { id: 'graphite', label: 'Графит', swatch: '#475569' },
  { id: 'ink', label: 'Чернила', swatch: '#1e293b' },
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

export function applyWallpaper(wallpaper: WallpaperId) {
  document.documentElement.setAttribute('data-wallpaper', wallpaper);
  window.localStorage.setItem(WALLPAPER_STORAGE_KEY, wallpaper);
}

export function readWallpaper(): WallpaperId {
  const stored = window.localStorage.getItem(WALLPAPER_STORAGE_KEY);
  return WALLPAPERS.some((w) => w.id === stored) ? (stored as WallpaperId) : 'none';
}
