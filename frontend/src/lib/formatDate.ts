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
