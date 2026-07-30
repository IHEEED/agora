'use client';

import { useEffect, useRef } from 'react';

/**
 * Показывает число так, что при изменении прокручивается только тот разряд,
 * который реально поменялся: 128 → 129 крутит одну цифру, 99 → 100 — три.
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const previous = useRef(value);
  const from = previous.current;

  useEffect(() => {
    previous.current = value;
  }, [value]);

  const current = String(value);
  const old = String(from);
  const width = Math.max(current.length, old.length);
  const currentPadded = current.padStart(width, ' ');
  const oldPadded = old.padStart(width, ' ');
  const direction = value >= from ? 'up' : 'down';

  return (
    <span className={className} style={{ display: 'inline-flex', overflow: 'hidden' }}>
      {currentPadded.split('').map((char, index) => {
        if (char === ' ') return null;
        const changed = char !== oldPadded[index];
        return (
          <span
            // Ключ меняется вместе с цифрой — только изменившийся разряд перемонтируется
            // и проигрывает анимацию, остальные остаются на месте.
            key={`${index}-${char}`}
            className={changed ? `animate-digit-${direction}` : undefined}
            style={{ display: 'inline-block' }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}
