'use client';

import { useId } from 'react';

/**
 * Дефолтная аватарка — на случай, когда человек не поставил своё фото.
 *
 * Не буква на сером кружке: у половины людей ник начинается с одной и той же
 * буквы, и в ленте они становятся неразличимы. Здесь из имени выводится
 * собственный градиент и собственный узор из точек, так что два аккаунта
 * совпадут только при полном совпадении имени.
 *
 * Всё считается детерминированно, без random(): серверный и клиентский рендер
 * обязаны совпасть, иначе React ругается на расхождение разметки.
 */

/** Двенадцать пар оттенков по кругу — фон аватарки. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['#6366f1', '#a855f7'],
  ['#8b5cf6', '#ec4899'],
  ['#d946ef', '#f43f5e'],
  ['#f43f5e', '#fb923c'],
  ['#f97316', '#facc15'],
  ['#eab308', '#84cc16'],
  ['#22c55e', '#14b8a6'],
  ['#10b981', '#06b6d4'],
  ['#06b6d4', '#3b82f6'],
  ['#0ea5e9', '#6366f1'],
  ['#64748b', '#94a3b8'],
  ['#475569', '#0ea5e9'],
];

function hash(seed: string) {
  // FNV-1a: короткая, стабильная и хорошо перемешивает даже близкие строки
  // вроде «anna» и «anno» — соседние ники не должны получать один вид.
  let value = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    value ^= seed.charCodeAt(i);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

export function DefaultAvatar({ name, size = 48 }: { name: string; size?: number }) {
  const gradientId = useId();
  const clipId = `${gradientId}-clip`;

  const seed = hash(name.toLowerCase() || '?');
  const [from, to] = PAIRS[seed % PAIRS.length];
  // Наклон градиента и раскладка точек — тоже из хеша, разными его частями.
  const angle = (seed >> 4) % 360;
  const layout = (seed >> 12) % 6;

  const letter = (name[0] ?? '?').toUpperCase();

  // Точки по сетке 3×3: какие из них горит, решает битовая маска из хеша.
  const dots = Array.from({ length: 9 }, (_, i) => ((seed >> i) & 1) === 1);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className="flex-none"
      role="img"
      aria-label={`Аватар ${name}`}
    >
      <defs>
        <linearGradient id={gradientId} gradientTransform={`rotate(${angle} 0.5 0.5)`}>
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
        <clipPath id={clipId}>
          <circle cx="24" cy="24" r="24" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        <rect width="48" height="48" fill={`url(#${gradientId})`} />

        {/* Узор из точек: тихий слой поверх градиента, добавляет различимости
            там, где два имени случайно попали в одну цветовую пару. */}
        <g fill="#ffffff" opacity="0.18">
          {dots.map((on, i) =>
            on ? (
              <circle
                key={i}
                cx={9 + (i % 3) * 15}
                cy={9 + Math.floor(i / 3) * 15}
                r={layout % 2 === 0 ? 3.2 : 2.2}
              />
            ) : null
          )}
        </g>

        <text
          x="24"
          y="24"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize="21"
          fontWeight="600"
          fontFamily="var(--font-body), system-ui, sans-serif"
          style={{ paintOrder: 'stroke' }}
        >
          {letter}
        </text>
      </g>
    </svg>
  );
}
