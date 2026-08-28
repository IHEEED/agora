import { differenceInDays, differenceInHours, format, formatDistanceToNow, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';

/**
 * Сжатая метка возраста записи: «14 ч.», «3 д.», «1 нед.» — как в вебе.
 * Стоит справа от ника в строке автора, где на «около 14 часов назад» ширины
 * нет. Больше месяца — дата понятнее счётчика недель.
 */
export function formatCompactAge(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (minutes < 1) return 'сейчас';
  if (minutes < 60) return `${minutes} мин.`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч.`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} д.`;

  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} нед.`;

  return format(date, 'd MMM', { locale: ru });
}

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
