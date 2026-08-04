'use client';

import { useEffect, useRef, useState } from 'react';
import { useVote } from '@/lib/useVote';
import { RollingNumber } from '@/components/RollingNumber';

const ARROW_PATH =
  'M12 4.5c.45 0 .87.2 1.15.55l5.9 7.2c.65.8.08 2-.96 2H15.2v4.3c0 .8-.65 1.45-1.45 1.45h-3.5c-.8 0-1.45-.65-1.45-1.45V14.25H5.91c-1.04 0-1.61-1.2-.96-2l5.9-7.2c.28-.35.7-.55 1.15-.55Z';

// Круговой салют: искры расходятся во все стороны из центра кнопки.
const SPARK_COUNT = 10;
const SPARK_RADIUS = 26;
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, index) => {
  const angle = (index / SPARK_COUNT) * Math.PI * 2;
  return {
    dx: `${(Math.cos(angle) * SPARK_RADIUS).toFixed(1)}px`,
    dy: `${(Math.sin(angle) * SPARK_RADIUS).toFixed(1)}px`,
  };
});

/**
 * В покое стрелка — только контур. Заливается лишь та, за которую отдан голос;
 * соседняя остаётся контурной и просто перекрашивается вместе со всем блоком.
 */
function VoteArrow({
  direction,
  filled,
  size,
}: {
  direction: 'up' | 'down';
  filled: boolean;
  size: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    >
      <path d={ARROW_PATH} transform={direction === 'down' ? 'rotate(180 12 12)' : undefined} />
    </svg>
  );
}

/**
 * Блок голосования — общий для постов и комментариев.
 *
 * Раньше у комментариев была своя урезанная копия с другими стрелками и без
 * анимаций: один и тот же жест выглядел по-разному на соседних экранах.
 * Разница теперь только в размере.
 */
export function VoteBlock({
  id,
  score,
  myVote,
  kind = 'post',
  compact = false,
}: {
  id: string;
  score: number;
  myVote: 1 | -1 | null;
  kind?: 'post' | 'comment';
  /** Уменьшенный вариант для списков комментариев. */
  compact?: boolean;
}) {
  const vote = useVote(id, score, myVote, kind);
  const [animating, setAnimating] = useState<'up' | 'down' | null>(null);
  const [sparkKey, setSparkKey] = useState(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeout.current) clearTimeout(timeout.current);
    };
  }, []);

  function handleVote(value: 1 | -1) {
    const direction = value === 1 ? 'up' : 'down';
    // Повторный клик по своей же стрелке снимает голос — такой откат
    // проходит без анимации, крутится только постановка реакции.
    if (vote.myVote !== value) {
      setAnimating(direction);
      if (direction === 'up') setSparkKey((k) => k + 1);
      if (timeout.current) clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setAnimating(null), 420);
    }
    vote.vote(value);
  }

  // Цветом отвечает только сама стрелка. Заливка и обводка всего блока
  // превращали реакцию в подсвеченную плашку и перетягивали внимание с текста
  // поста на ряд кнопок под ним.
  const upColor = vote.myVote === 1 ? 'var(--up)' : 'var(--control)';
  const downColor = vote.myVote === -1 ? 'var(--down)' : 'var(--control)';

  // Размер иконки одинаковый везде: рядом стоят комментарий, репост и
  // «поделиться», и разнокалиберные глифы читались случайным набором.
  const hit = compact ? 'h-8 w-8' : 'h-10 w-10';
  const arrow = 22;

  return (
    <div className="flex items-center">
      <button
        onClick={() => handleVote(1)}
        aria-label="Голосовать за"
        aria-pressed={vote.myVote === 1}
        className={`vote-hit relative flex ${hit} items-center justify-center rounded-full`}
        style={{ color: upColor }}
      >
        <span className="arrow-clip">
          <span className={animating === 'up' ? 'animate-vote-up' : undefined} style={{ display: 'block' }}>
            <VoteArrow direction="up" filled={vote.myVote === 1} size={arrow} />
          </span>
        </span>

        {sparkKey > 0 && (
          <span key={sparkKey} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
            {SPARKS.map((spark, index) => (
              <span
                key={index}
                className="vote-spark"
                style={{ '--dx': spark.dx, '--dy': spark.dy } as React.CSSProperties}
              />
            ))}
          </span>
        )}
      </button>

      {/* При голосе «против» счётчик прячем: минус рядом со стрелкой вниз
          читался бы дважды одним и тем же. */}
      {vote.myVote !== -1 && (
        <RollingNumber
          value={vote.score}
          className={`min-w-[1.4em] justify-center font-num ${compact ? 'text-[14px]' : 'text-[15px]'}`}
          // Счётчик подхватывает цвет отданного голоса, но только текстом.
          style={{ color: vote.myVote === 1 ? 'var(--up)' : 'var(--control)' }}
        />
      )}

      <button
        onClick={() => handleVote(-1)}
        aria-label="Голосовать против"
        aria-pressed={vote.myVote === -1}
        className={`vote-hit flex ${hit} items-center justify-center rounded-full`}
        style={{ color: downColor }}
      >
        <span className="arrow-clip">
          <span className={animating === 'down' ? 'animate-vote-down' : undefined} style={{ display: 'block' }}>
            <VoteArrow direction="down" filled={vote.myVote === -1} size={arrow} />
          </span>
        </span>
      </button>
    </div>
  );
}
