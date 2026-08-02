'use client';

import { SegmentRing, segmentsFor } from '@/components/SegmentRing';

/**
 * Аватар в том же кольце из дуг, что и кружки сториз в ленте, только крупнее.
 * Раньше здесь был рваный многоугольник с зашитым сиреневым градиентом — он не
 * следовал за акцентом и не совпадал с обрамлением того же человека в ленте.
 */
export function ProfileAvatar({
  letter,
  size = 96,
  muted = false,
  segments,
}: {
  letter: string;
  size?: number;
  muted?: boolean;
  /** Сколько дуг рисовать. По умолчанию выводится из буквы аватара. */
  segments?: number;
}) {
  const inset = size * 0.072;

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <SegmentRing
        size={size}
        segments={segments ?? segmentsFor(letter)}
        viewed={muted}
        strokeWidth={size * 0.04}
        gap={size * 0.082}
      />
      <div
        className="absolute flex items-center justify-center rounded-full font-semibold"
        style={{
          inset: inset * 1.15,
          background: 'var(--surface-2)',
          color: muted ? 'var(--text-muted)' : 'var(--accent)',
          fontSize: size * 0.34,
        }}
      >
        {letter}
      </div>
    </div>
  );
}
