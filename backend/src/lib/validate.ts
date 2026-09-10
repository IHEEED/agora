import { isUuid } from './uuid';

/**
 * Проверка того, что пришло от клиента.
 *
 * Сервер верил клиенту на слово: интерфейс режет заголовок на восемьдесят
 * знаков — значит, длиннее не бывает. Но клиент — это не только наш интерфейс,
 * а любой, кто умеет слать запросы. Прогон это показал: заголовок в пять тысяч
 * знаков, записи по двести килобайт, объект вместо строки и ссылки
 * `javascript:` в аватарке — всё ложилось в базу молча.
 *
 * Отказ бросается исключением, а не возвращается. Иначе каждую проверку
 * сопровождало бы ветвление, и забытое ветвление снова пропускало бы что
 * угодно. Исключение ловит общий обработчик (index.ts) и отвечает 400 тем же
 * текстом — он написан для человека.
 */
export class BadInput extends Error {}

/**
 * Пределы.
 *
 * Там, где у интерфейса есть свой предел, здесь ровно он: сервер строже
 * интерфейса отвергал бы то, что интерфейс разрешил, и человек узнавал бы об
 * этом только после нажатия «Отправить». Где предела в интерфейсе нет — число
 * с запасом, которое отсекает не длинную мысль, а мусор.
 */
export const LIMITS = {
  /** create/page.tsx, TITLE_MAX */
  title: 80,
  postBody: 20_000,
  pollOption: 100,
  pollOptions: 6,
  /** create/page.tsx, MAX_SHOTS */
  images: 10,
  comment: 5_000,
  /** Столько же у Telegram. */
  message: 4_000,
  /** Конструктор даёт двести; запас — на старые клиенты. */
  story: 500,
  /** Один эмодзи, пусть и составной: семья или флаг — до десятка кодовых точек. */
  emoji: 32,
  /** communities/page.tsx */
  clubName: 40,
  clubDescription: 200,
} as const;

/** Необязательный текст. Пустой после обрезки пробелов — это null. */
export function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new BadInput(`${label}: ожидается текст`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new BadInput(`${label}: не длиннее ${max} знаков`);
  return trimmed || null;
}

export function requiredText(value: unknown, max: number, label: string): string {
  const text = optionalText(value, max, label);
  if (!text) throw new BadInput(`${label}: не может быть пустым`);
  return text;
}

/**
 * Адрес картинки или звука — только https.
 *
 * Сейчас адреса уходят в CSS и в src, где `javascript:` не исполняется. Но это
 * свойство нынешней разметки, а не данных: первая же ссылка `<a href>` на
 * вложение сделала бы сохранённое исполняемым. Проверить на входе один раз
 * дешевле, чем помнить об этом в каждом новом компоненте.
 */
export function optionalHttpsUrl(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) {
    throw new BadInput(`${label}: некорректный адрес`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadInput(`${label}: некорректный адрес`);
  }
  if (url.protocol !== 'https:') throw new BadInput(`${label}: нужен адрес https`);
  return value;
}

export function optionalUuid(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (!isUuid(value)) throw new BadInput(`${label}: некорректный идентификатор`);
  return value;
}

export function requiredUuid(value: unknown, label: string): string {
  const id = optionalUuid(value, label);
  if (!id) throw new BadInput(`${label}: обязателен`);
  return id;
}

/**
 * Кадрирование картинки — три конечных числа, и ничего кроме.
 *
 * Раньше в поле ложилось что угодно: прогон сохранил туда пятьдесят килобайт
 * произвольного JSON, и они уезжали вместе с профилем каждому, кто его открыл.
 * Значения не зажимаем в диапазон — это решает редактор кадра, — только
 * отсекаем то, что числом кадра быть не может.
 */
export function optionalFit(value: unknown): { x: number; y: number; zoom: number } | null {
  if (!value || typeof value !== 'object') return null;
  const { x, y, zoom } = value as Record<string, unknown>;
  const sane = (n: unknown): n is number =>
    typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 10_000;
  if (!sane(x) || !sane(y) || !sane(zoom)) return null;
  return { x, y, zoom };
}
