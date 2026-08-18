import { differenceInDays, differenceInHours, format, formatDistanceToNow, isYesterday } from 'date-fns';
import { enUS, es, ru } from 'date-fns/locale';
import { readLocale } from './i18n';

const DATE_LOCALES = { ru, en: enUS, es } as const;
const YESTERDAY = { ru: 'вчера', en: 'yesterday', es: 'ayer' } as const;

/**
 * Локаль читаем из хранилища на каждый вызов: даты рисуются в списках,
 * тащить сюда хук ради одной строки дороже, чем прочитать localStorage.
 * На сервере окна нет — там всегда русский, как и у остального текста
 * до гидратации.
 */
function currentLocale(): 'ru' | 'en' | 'es' {
  return typeof window === 'undefined' ? 'ru' : readLocale();
}

/** Единицы для сжатой формы: минуты, часы, дни, недели. */
const COMPACT_UNITS = {
  ru: { m: 'мин.', h: 'ч.', d: 'д.', w: 'нед.', now: 'сейчас' },
  en: { m: 'm', h: 'h', d: 'd', w: 'w', now: 'now' },
  es: { m: 'min', h: 'h', d: 'd', w: 'sem', now: 'ahora' },
} as const;

/**
 * Сжатая метка возраста поста: «14 ч.», «3 д.». Стоит справа в строке автора,
 * где на полную фразу вроде «около 14 часов назад» просто нет ширины — она
 * вытесняла имя и превращала строку в две.
 */
export function formatCompactAge(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const units = COMPACT_UNITS[currentLocale()];

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return units.now;
  if (minutes < 60) return `${minutes} ${units.m}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${units.h}`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${units.d}`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} ${units.w}`;

  // Больше месяца — дата понятнее любого счётчика недель.
  return format(date, 'd MMM', { locale: DATE_LOCALES[currentLocale()] });
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const key = currentLocale();
  const locale = DATE_LOCALES[key];

  // считаем по фактически прошедшему времени, а не по календарному дню —
  // иначе "3 часа назад" превращается в "вчера" сразу после полуночи
  if (differenceInHours(now, date) < 24) {
    return formatDistanceToNow(date, { addSuffix: true, locale });
  }
  if (isYesterday(date)) {
    return YESTERDAY[key];
  }
  if (differenceInDays(now, date) < 7) {
    return formatDistanceToNow(date, { addSuffix: true, locale });
  }
  return format(date, 'd MMM yyyy', { locale });
}
