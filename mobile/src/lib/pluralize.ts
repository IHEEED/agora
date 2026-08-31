/** Склонения по числу — как в вебе (src/lib/pluralize.ts). */

export function pluralizeComments(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return 'комментарий';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'комментария';
  return 'комментариев';
}

export function pluralizeReplies(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return 'ответ';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'ответа';
  return 'ответов';
}
