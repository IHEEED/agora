// Палитра для аватаров сообществ. Цвет выбирается детерминированно по имени,
// поэтому одно и то же сообщество всегда выглядит одинаково — и на сервере,
// и на клиенте, без расхождения при гидратации.
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

export function CommunityAvatar({ name, size = 44 }: { name: string; size?: number }) {
  const [from, to] = PALETTE[paletteIndex(name)];

  return (
    <span
      aria-hidden
      className="flex flex-none items-center justify-center rounded-2xl font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `linear-gradient(135deg, ${from}, ${to})`,
      }}
    >
      {name.trim()[0]?.toUpperCase() ?? '#'}
    </span>
  );
}
