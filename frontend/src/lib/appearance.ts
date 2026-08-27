export type Theme = 'light' | 'dark';
/** То, что выбрано в настройках: «системная» следует за настройкой ОС. */
export type ThemePreference = Theme | 'system';

/**
 * Стиль оформления — законченный набор, а не одна ручка из трёх.
 *
 * Прежде вид приложения собирался пользователем из темы, одного из двадцати
 * акцентов и одних из семи обоев. Сочетаний выходило под три сотни, и почти
 * все были случайными: фиолетовый акцент на сером фоне поверх оранжевых пятен.
 * Ни одно из них никто не подбирал — они просто оказались возможны.
 *
 * Здесь наоборот: фон, поверхности, текст, акцент, гарнитура заголовков и
 * фактура подложки подобраны вместе и меняются вместе. Сами значения живут в
 * globals.css рядом с правилами, которые их читают, — дублировать палитру
 * ещё и здесь значило бы править её в двух местах при каждой правке.
 */
/**
 * 'glam' в списке ниже намеренно отсутствует: это шестое оформление, которое
 * не выбирают, а находят — пролистав настройки до самого дна и дальше. В типе
 * он есть, потому что применяется и сохраняется тем же способом, что
 * остальные; нет его только в STYLES, откуда строится список выбора.
 */
export type StyleId = 'chronicle' | 'clarity' | 'atelier' | 'midnight' | 'garden' | 'signal' | 'glam';

/**
 * Обои переписки — фон одного экрана, не всего приложения.
 *
 * Приём из Telegram, и взят он оттуда не ради красоты: переписка — почти
 * единственное место, где интерфейс принадлежит двоим, и фон под пузырями
 * отличает её от остальных экранов сильнее любой рамки. Общий фон приложения
 * они при этом не трогают: обои, лезущие в ленту, — это уже не оформление,
 * а помеха чтению.
 */

export const THEME_STORAGE_KEY = 'parafraz-theme';
export const STYLE_STORAGE_KEY = 'parafraz-style';

/**
 * Только идентификаторы и подписи: сами оттенки живут в globals.css рядом с
 * градиентом, который их читает, и оттуда же их берёт образец в настройках.
 */

/**
 * Описания для карточек выбора в настройках.
 *
 * `swatch` — три цвета образца в порядке «фон, поверхность, акцент». Это
 * единственное место, где палитра продублирована, и продублирована намеренно:
 * образец обязан показывать стиль, который сейчас не применён, а прочитать
 * чужие переменные из CSS нельзя.
 */
export const STYLES: ReadonlyArray<{
  id: StyleId;
  label: string;
  hint: string;
  /** [фон, поверхность, акцент] в светлом варианте. */
  swatch: readonly [string, string, string];
  /** То же в тёмном: образец рисуется в текущей теме, а не всегда в светлой. */
  swatchDark: readonly [string, string, string];
  /** Набрана ли антиквой верхняя строка образца. */
  serif: boolean;
}> = [
  {
    id: 'chronicle',
    label: 'Хроника',
    hint: 'Тёплая бумага, терракота, газетная антиква',
    swatch: ['#faf7f2', '#fffdf9', '#bf5b38'],
    swatchDark: ['#16140f', '#1f1c16', '#e08a5f'],
    serif: true,
  },
  {
    id: 'clarity',
    label: 'Чистота',
    hint: 'Ничего своего — чтобы стекло на iPhone осталось стеклом',
    swatch: ['#ffffff', '#f2f2f7', '#007aff'],
    swatchDark: ['#000000', '#1c1c1e', '#0a84ff'],
    serif: false,
  },
  {
    id: 'atelier',
    label: 'Ателье',
    hint: 'Чернила на бумаге, без единого лишнего цвета',
    swatch: ['#fbfbf9', '#ffffff', '#141412'],
    swatchDark: ['#0b0b0a', '#141412', '#f5f4f0'],
    serif: true,
  },
  {
    id: 'midnight',
    label: 'Полночь',
    hint: 'Синий полумрак и ледяной акцент',
    swatch: ['#f6f7f9', '#ffffff', '#3457d5'],
    swatchDark: ['#090b10', '#12151c', '#86a8ff'],
    serif: false,
  },
  {
    id: 'garden',
    label: 'Сад',
    hint: 'Приглушённая зелень и тёплый небелый',
    swatch: ['#f5f7f1', '#fdfefb', '#4a6b3a'],
    swatchDark: ['#10130d', '#181c14', '#a3c47e'],
    serif: true,
  },
  {
    id: 'signal',
    label: 'Сигнал',
    hint: 'Нейтральный холст и одна фиолетовая нота',
    swatch: ['#fbfbfd', '#ffffff', '#5b3ad6'],
    swatchDark: ['#0d0d11', '#16161d', '#a88cff'],
    serif: false,
  },
];

export const DEFAULT_STYLE: StyleId = 'atelier';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => void) => unknown;
};

/**
 * Применяет смену оформления кроссфейдом.
 *
 * View Transitions снимают снимок «до», выполняют изменение и плавно смешивают
 * его со снимком «после» — вся работа уходит на видеокарту. Альтернатива —
 * CSS-переход на каждом элементе — заставляла браузер анимировать сотни узлов
 * разом и роняла частоту кадров до слайдшоу.
 *
 * Где API нет, изменение просто применяется мгновенно: это не ошибка, а
 * отсутствие украшения.
 */
function withTransition(change: () => void) {
  const doc = document as DocumentWithViewTransition;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || typeof doc.startViewTransition !== 'function') {
    change();
    return;
  }

  doc.startViewTransition(change);
}

/**
 * «Системная» не пишется в data-theme — там всегда конкретное значение,
 * иначе CSS не знал бы, какую палитру брать. В localStorage при этом
 * сохраняется именно предпочтение, чтобы тема продолжала следовать за ОС.
 */
export function applyTheme(preference: ThemePreference) {
  const resolved = preference === 'system' ? systemTheme() : preference;

  withTransition(() => {
    document.documentElement.setAttribute('data-theme', resolved);
  });

  if (preference === 'system') {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
  } else {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  }
}

/** Что выбрано в настройках. Отсутствие записи означает «системная». */
export function readThemePreference(): ThemePreference {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

export function applyStyle(style: StyleId) {
  withTransition(() => {
    document.documentElement.setAttribute('data-style', style);
  });
  window.localStorage.setItem(STYLE_STORAGE_KEY, style);
}

/** Оформления, которые можно применить, включая ненайденное. */
const ALL_STYLE_IDS: readonly string[] = [...STYLES.map((s) => s.id), 'glam'];

export function readStyle(): StyleId {
  const stored = window.localStorage.getItem(STYLE_STORAGE_KEY);
  // Сверяемся с полным набором, а не со списком выбора: найденный «Гламур»
  // обязан пережить перезагрузку, хотя в настройках его в ряду нет.
  return ALL_STYLE_IDS.includes(stored ?? '') ? (stored as StyleId) : DEFAULT_STYLE;
}

/**
 * Обои переписки применяются без кроссфейда: их не видно с экрана настроек,
 * а анимировать то, чего человек сейчас не видит, — впустую гонять снимок
 * всей страницы через видеокарту.
 */

