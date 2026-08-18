import { DefaultAvatar } from '@/components/DefaultAvatar';

// Палитра сообщества. Цвет выбирается детерминированно по имени, поэтому одно
// и то же сообщество всегда выглядит одинаково — и на сервере, и на клиенте,
// без расхождения при гидратации.
const PALETTE = [
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
] as const;

function paletteIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) % 997;
  }
  return hash % PALETTE.length;
}

/**
 * Пара цветов сообщества. Нужна не только аватару: шапка на странице
 * сообщества красится в тот же цвет, иначе она везде одинаково фиолетовая
 * и сообщества не различить с первого взгляда.
 */
export function communityPalette(name: string): readonly [string, string] {
  return PALETTE[paletteIndex(name)];
}

/**
 * Знак сообщества — общий для всех, как и аватарка человека.
 *
 * Буква на цветном квадрате читалась как поставленная картинка, и сообщество
 * с настоящим логотипом ничем не выделялось бы среди тех, у кого его нет.
 * Цвет сообщества никуда не делся: им красится обложка на его странице.
 */
export function CommunityAvatar({ name, size = 44 }: { name: string; size?: number }) {
  return <DefaultAvatar name={name} size={size} kind="community" />;
}
