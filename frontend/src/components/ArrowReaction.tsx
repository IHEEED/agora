'use client';

/**
 * Две свои реакции — стрелки, а не смайлики.
 *
 * Смайликов в наборе двадцать, и все они про чувство: смешно, грустно,
 * удивился. Стрелки про другое — про согласие и несогласие, тот же жест, что
 * под каждой записью в ленте. Поэтому они стоят первыми и отделены от
 * остального: это не «ещё две картинки», а другой разговор.
 *
 * В базе реакции лежат строкой, обычно самим смайликом. Здесь вместо него
 * метка: рисуем мы её своим знаком, а не системным шрифтом, и хранить в базе
 * картинку ради этого не нужно.
 */
export const UP_REACTION = 'up';
export const DOWN_REACTION = 'down';

export const ARROW_REACTIONS = [UP_REACTION, DOWN_REACTION] as const;

export function isArrowReaction(emoji: string): boolean {
  return emoji === UP_REACTION || emoji === DOWN_REACTION;
}

/**
 * Знак реакции.
 *
 * Цвета те же, что у голосов под записью: согласие зелёное, несогласие
 * красное. Один и тот же смысл обязан выглядеть одинаково везде, иначе
 * человеку приходится держать в голове две системы обозначений.
 */
export function ArrowReaction({ kind, size = 16 }: { kind: string; size?: number }) {
  const up = kind === UP_REACTION;

  return (
    <span
      className="flex items-center"
      style={{ color: up ? 'var(--up)' : 'var(--down)' }}
      aria-label={up ? 'Поддержал' : 'Не согласен'}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ transform: up ? 'none' : 'rotate(180deg)' }}
      >
        <path d="M12 19V6" />
        <path d="m5.5 12.5 6.5-7 6.5 7" />
      </svg>
    </span>
  );
}
