'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { PollOption } from '@/lib/types';

/**
 * Опрос под текстом поста. До своего голоса показываются только варианты,
 * после — доли в процентах: так первый выбор не смещается чужими цифрами.
 */
export function PollBlock({
  postId,
  options,
  myVote,
}: {
  postId: string;
  options: PollOption[];
  myVote: string | null;
}) {
  const [votes, setVotes] = useState(options);
  const [chosen, setChosen] = useState(myVote);
  const [error, setError] = useState<string | null>(null);

  const total = votes.reduce((sum, option) => sum + option.votes, 0);

  async function choose(optionId: string) {
    const previous = chosen;
    // Повторный клик по своему варианту снимает голос.
    const removing = previous === optionId;

    setChosen(removing ? null : optionId);
    setVotes((prev) =>
      prev.map((option) => {
        if (!removing && option.id === optionId) return { ...option, votes: option.votes + 1 };
        if (option.id === previous) return { ...option, votes: Math.max(option.votes - 1, 0) };
        return option;
      })
    );

    try {
      await apiFetch(
        `/posts/${postId}/poll-vote`,
        removing
          ? { method: 'DELETE' }
          : { method: 'POST', body: JSON.stringify({ option_id: optionId }) }
      );
    } catch (err) {
      setChosen(previous);
      setVotes(options);
      setError(err instanceof Error ? err.message : 'Не удалось изменить голос');
    }
  }

  return (
    <div className="mt-1 flex flex-col gap-1.5">
      {votes.map((option) => {
        const share = total > 0 ? Math.round((option.votes / total) * 100) : 0;
        const selected = chosen === option.id;

        return (
          <button
            key={option.id}
            onClick={() => choose(option.id)}
            className="relative overflow-hidden rounded-full border px-4 py-2.5 text-left transition-colors"
            style={{
              borderColor: selected ? 'var(--accent)' : 'var(--border)',
              color: 'var(--text)',
            }}
          >
            {/* Шкала стоит в разметке всегда, а не появляется после голоса.
                Раньше её не было вовсе, пока не проголосуешь, — и первый голос
                выдавал полосу уже готовой длины: переходу не от чего было
                считать, потому что предыдущего состояния не существовало.
                Пятьсот честных миллисекунд отрабатывали только на втором голосе
                и позже, а самый первый — единственный, который человек смотрит
                внимательно, — проходил рывком.

                Теперь до голоса ширина ноль, и первое же нажатие разворачивает
                полосу из ничего. */}
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 transition-[width] duration-500"
              style={{
                  width: chosen ? `${share}%` : 0,
                  // Свой процент вместо --accent-soft (12%): шкалу должно быть
                  // видно с первого взгляда, а выбранный вариант — плотнее прочих.
                  background: selected
                    ? 'color-mix(in srgb, var(--accent) 34%, transparent)'
                    : 'color-mix(in srgb, var(--accent) 20%, transparent)',
                }}
              />
            <span className="relative flex items-center justify-between gap-3">
              <span className="truncate text-[14px]">{option.text}</span>
              {chosen && (
                <span className="font-num flex-none text-[13px] text-[var(--text-muted)]">
                  <CountUp to={share} />%
                </span>
              )}
            </span>
          </button>
        );
      })}

      <span className="text-[12px] text-[var(--text-muted)]">
        {total === 0 ? 'Голосов пока нет' : <><span className="font-num">{total}</span> голосов</>}
      </span>

      {error && <span className="text-[12px]" style={{ color: 'var(--down)' }}>{error}</span>}
    </div>
  );
}

/**
 * Число, добегающее до значения.
 *
 * Проценты появлялись готовыми — рядом с полосой, которая свои полсекунды
 * едет. Разнобой: половина ответа движется, половина уже на месте, и итог
 * выглядит так, будто число посчитали заранее, а полосу нарисовали для вида.
 *
 * Бежит быстрее полосы (380 против 500), и это намеренно: число дочитывают
 * раньше, чем домеряют полосу глазом, — сначала узнаёшь «сорок процентов»,
 * потом видишь, насколько это много. Обратный порядок читался бы задержкой.
 *
 * Отсчёт по времени, а не по кадрам: на слабом телефоне кадров меньше, и
 * пошаговый счётчик тянулся бы дольше ровно там, где всё и так небыстро.
 */
function CountUp({ to }: { to: number }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const from = 0;
    const started = performance.now();
    let frame = 0;

    const step = () => {
      const passed = Math.min(1, (performance.now() - started) / 380);
      // Торможение к концу: число подъезжает к своему значению, а не
      // втыкается в него.
      const eased = 1 - (1 - passed) ** 3;
      setShown(Math.round(from + (to - from) * eased));
      if (passed < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [to]);

  return <>{shown}</>;
}
