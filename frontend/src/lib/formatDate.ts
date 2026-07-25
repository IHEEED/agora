import { differenceInDays, differenceInHours, format, formatDistanceToNow, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  // считаем по фактически прошедшему времени, а не по календарному дню —
  // иначе "3 часа назад" превращается в "вчера" сразу после полуночи
  if (differenceInHours(now, date) < 24) {
    return formatDistanceToNow(date, { addSuffix: true, locale: ru });
  }
  if (isYesterday(date)) {
    return 'вчера';
  }
  if (differenceInDays(now, date) < 7) {
    return formatDistanceToNow(date, { addSuffix: true, locale: ru });
  }
  return format(date, 'd MMM yyyy', { locale: ru });
}
