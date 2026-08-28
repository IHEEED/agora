import { useColorScheme } from 'react-native';

/**
 * Палитра, перенесённая из веба один в один.
 *
 * В вебе те же одиннадцать значений на стиль живут переменными в globals.css и
 * выбираются через light-dark(). Здесь выбирает useColorScheme, но набор и
 * оттенки те же — иначе два клиента одного приложения выглядели бы двумя
 * разными приложениями.
 *
 * ── Важное про Liquid Glass ──────────────────────────────────────────────
 * Поверхности здесь непрозрачные, и это не упущение. Система на iOS 26 сама
 * делает стеклянными свои элементы — таб-бар, навигационную панель, шиты, —
 * и накладывает своё стекло поверх нашего контента. Если контент тоже будет
 * полупрозрачным, стекло ляжет на стекло и превратится в муть: система
 * рассчитывает преломление по тому, что под ней, а под ней окажется ещё одно
 * размытие.
 *
 * Ровно по этой же причине в вебе карточки стали плоскими, а стекло осталось
 * только у плавающих панелей. Правило одно на оба клиента: контент плоский,
 * стеклянный только chrome, и делает его система, а не мы.
 */
export type Palette = {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentContrast: string;
  up: string;
  down: string;
  /** Цвет иконок-действий в покое: --control из веба (text 82% + bg 18%). */
  control: string;
  /** Активный репост: --repost из веба. */
  repost: string;
  /** Подложка аватарки-заглушки (--avatar-bg) и цвет силуэта на ней. */
  avatarBg: string;
  avatarInk: string;
};

/**
 * «Хроника» — то же оформление по умолчанию, что и в вебе, значение в значение.
 * Тёплая плотная бумага, терракота, коричневые чернила. Раньше здесь стояла
 * старая, почти белая бумага — из-за этого темы клиентов расходились.
 */
const CHRONICLE_LIGHT: Palette = {
  bg: '#f4ece0',
  surface: '#fdf8f0',
  surface2: '#eadfcd',
  border: '#d8c8ae',
  text: '#33261a',
  textMuted: '#7a6551',
  accent: '#b5522f',
  accentContrast: '#fffaf4',
  up: '#1f9d55',
  down: '#c8453d',
  control: '#564a3e',
  repost: '#c98a06',
  avatarBg: '#e5d2bf',
  avatarInk: '#8e5f45',
};

const CHRONICLE_DARK: Palette = {
  bg: '#0d0b08',
  surface: '#1a1712',
  surface2: '#241f18',
  border: 'rgba(240, 228, 205, 0.12)',
  text: '#f0ebe1',
  textMuted: '#a09889',
  accent: '#e08a5f',
  accentContrast: '#16140f',
  up: '#43d489',
  down: '#ff7a70',
  control: '#c7c2ba',
  repost: '#f0b429',
  avatarBg: '#392b20',
  avatarInk: '#b3947c',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? CHRONICLE_DARK : CHRONICLE_LIGHT;
}

/**
 * Тема для NavigationContainer. React Navigation красит ею то, что рисует сам:
 * фон экрана под ним и заголовки там, где они не нативные.
 */
export function navigationTheme(palette: Palette, dark: boolean) {
  return {
    dark,
    colors: {
      primary: palette.accent,
      background: palette.bg,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
      notification: palette.accent,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '600' as const },
      heavy: { fontFamily: 'System', fontWeight: '700' as const },
    },
  };
}
