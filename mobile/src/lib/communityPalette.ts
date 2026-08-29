/**
 * Пара цветов клуба — из веба один в один. Цвет выбирается детерминированно по
 * имени, поэтому один клуб всегда выглядит одинаково. Ею красится обложка на
 * странице клуба, чтобы клубы различались с первого взгляда, а не одинаковым
 * акцентом.
 */
const PALETTE: readonly (readonly [string, string])[] = [
  ['#5b3ad6', '#a880ff'],
  ['#2563eb', '#7ba6ff'],
  ['#0d9488', '#5ee0d0'],
  ['#059669', '#4ade9f'],
  ['#b45309', '#ffc457'],
  ['#ea580c', '#ffa76b'],
  ['#dc2626', '#ff8a80'],
  ['#e11d48', '#ff7d9c'],
  ['#9333ea', '#c99bff'],
  ['#475569', '#a8b6cc'],
];

export function communityPalette(name: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return PALETTE[hash % PALETTE.length];
}
