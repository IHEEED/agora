import { useColorScheme } from 'react-native';
import { StyleId, useStylePreference, useThemePreference } from './lib/appearance';

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
  /** Гарнитура заголовков стиля: у «Хроники»/«Ателье»/«Сада» — антиква
      (Georgia), у «Полночи»/«Сигнала» — системный гротеск. */
  displayFamily: string;
};

/**
 * Пять оформлений, перенесённых из веба значение в значение (globals.css).
 * Каждый стиль объявляет одиннадцать базовых цветов; --control, --avatar-bg и
 * --avatar-ink досчитаны той же формулой color-mix, что и на сайте; up/down/
 * repost общие для всех стилей. Ключ — `${style}_${L|D}`.
 */
const PALETTES: Record<string, Palette> = {
  chronicle_L: { bg: '#f4ece0', surface: '#fdf8f0', surface2: '#eadfcd', border: '#d8c8ae', text: '#33261a', textMuted: '#7a6551', accent: '#b5522f', accentContrast: '#fffaf4', up: '#1f9d55', down: '#c8453d', control: '#564a3e', repost: '#c98a06', avatarBg: '#e5d2bf', avatarInk: '#8e5f45', displayFamily: 'Georgia' },
  chronicle_D: { bg: '#0d0b08', surface: '#1a1712', surface2: '#241f18', border: 'rgba(240, 228, 205, 0.12)', text: '#f0ebe1', textMuted: '#a09889', accent: '#e08a5f', accentContrast: '#16140f', up: '#43d489', down: '#ff7a70', control: '#c7c3ba', repost: '#f0b429', avatarBg: '#392b20', avatarInk: '#b3947c', displayFamily: 'Georgia' },
  atelier_L: { bg: '#fbfbf9', surface: '#ffffff', surface2: '#f2f2ef', border: '#e4e3df', text: '#0b0b0a', textMuted: '#6f6e6a', accent: '#2b2b26', accentContrast: '#ffffff', up: '#1f9d55', down: '#c8453d', control: '#363635', repost: '#c98a06', avatarBg: '#e0e0dd', avatarInk: '#585753', displayFamily: 'Georgia' },
  atelier_D: { bg: '#060605', surface: '#121211', surface2: '#1c1c1a', border: 'rgba(255, 253, 245, 0.13)', text: '#f5f4f0', textMuted: '#96948d', accent: '#ebe9e3', accentContrast: '#0b0b0a', up: '#43d489', down: '#ff7a70', control: '#cac9c6', repost: '#f0b429', avatarBg: '#333330', avatarInk: '#b0aea7', displayFamily: 'Georgia' },
  midnight_L: { bg: '#f6f7f9', surface: '#ffffff', surface2: '#ecf0f4', border: '#dde2e9', text: '#0e1116', textMuted: '#626b7a', accent: '#3457d5', accentContrast: '#ffffff', up: '#1f9d55', down: '#c8453d', control: '#383a3f', repost: '#c98a06', avatarBg: '#dbe2f1', avatarInk: '#526499', displayFamily: 'System' },
  midnight_D: { bg: '#05070c', surface: '#0f131b', surface2: '#181d27', border: 'rgba(190, 205, 230, 0.11)', text: '#eaeef5', textMuted: '#838d9e', accent: '#86a8ff', accentContrast: '#090b10', up: '#43d489', down: '#ff7a70', control: '#c1c4cb', repost: '#f0b429', avatarBg: '#242c3f', avatarInk: '#8495bb', displayFamily: 'System' },
  garden_L: { bg: '#f5f7f1', surface: '#fdfefb', surface2: '#e9ede1', border: '#dce2d0', text: '#191d15', textMuted: '#666d5b', accent: '#4a6b3a', accentContrast: '#f7faf3', up: '#1f9d55', down: '#c8453d', control: '#41443d', repost: '#c98a06', avatarBg: '#dbe1d2', avatarInk: '#5c6c50', displayFamily: 'Georgia' },
  garden_D: { bg: '#080a06', surface: '#141810', surface2: '#1e2318', border: 'rgba(225, 235, 210, 0.12)', text: '#ebefe4', textMuted: '#939b87', accent: '#a3c47e', accentContrast: '#10130d', up: '#43d489', down: '#ff7a70', control: '#c2c6bc', repost: '#f0b429', avatarBg: '#2d3523', avatarInk: '#98a784', displayFamily: 'Georgia' },
  signal_L: { bg: '#fbfbfd', surface: '#ffffff', surface2: '#f0f0f5', border: '#e3e3ec', text: '#14141a', textMuted: '#66667a', accent: '#5b3ad6', accentContrast: '#ffffff', up: '#1f9d55', down: '#c8453d', control: '#3e3e43', repost: '#c98a06', avatarBg: '#e3e0f2', avatarInk: '#625799', displayFamily: 'System' },
  signal_D: { bg: '#08080b', surface: '#141419', surface2: '#1e1e26', border: 'rgba(222, 222, 245, 0.12)', text: '#f2f2f7', textMuted: '#8b8b9e', accent: '#a88cff', accentContrast: '#0d0d11', up: '#43d489', down: '#ff7a70', control: '#c8c8cd', repost: '#f0b429', avatarBg: '#2d2a3e', avatarInk: '#948bbb', displayFamily: 'System' },
  // «Гламур» — скрытое шестое оформление (пасхалка). Розовое, антиквой.
  glam_L: { bg: '#fff5f9', surface: '#ffffff', surface2: '#ffe6f0', border: '#ffd0e2', text: '#3d0a26', textMuted: '#96556f', accent: '#e0338c', accentContrast: '#ffffff', up: '#1f9d55', down: '#c8453d', control: '#7a3a55', repost: '#c98a06', avatarBg: '#ffd9e8', avatarInk: '#b05a80', displayFamily: 'Georgia' },
  glam_D: { bg: '#14060f', surface: '#220c1a', surface2: '#2f1224', border: 'rgba(255, 190, 225, 0.16)', text: '#ffe8f4', textMuted: '#c894b0', accent: '#ff7ec2', accentContrast: '#14060f', up: '#43d489', down: '#ff7a70', control: '#d8b0c6', repost: '#f0b429', avatarBg: '#3a1a2c', avatarInk: '#c894b0', displayFamily: 'Georgia' },
};

/** Тёмная ли сейчас тема — с учётом настройки и системы. */
export function useIsDark(): boolean {
  const system = useColorScheme();
  const preference = useThemePreference();
  return preference === 'dark' || (preference === 'system' && system === 'dark');
}

export function usePalette(): Palette {
  const dark = useIsDark();
  const style: StyleId = useStylePreference();
  return PALETTES[`${style}_${dark ? 'D' : 'L'}`] ?? PALETTES.chronicle_L;
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
