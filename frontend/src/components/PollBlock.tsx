'use client';

import { useState } from 'react';
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
    if (chosen === optionId) return;

    const previous = chosen;
    // Оптимистично: снимаем голос со старого варианта и ставим на новый.
    setChosen(optionId);
    setVotes((prev) =>
      prev.map((option) => {
        if (option.id === optionId) return { ...option, votes: option.votes + 1 };
        if (option.id === previous) return { ...option, votes: Math.max(option.votes - 1, 0) };
        return option;
      })
    );

    try {
      await apiFetch(`/posts/${postId}/poll-vote`, {
        method: 'POST',
        body: JSON.stringify({ option_id: optionId }),
      });
    } catch (err) {
      setChosen(previous);
      setVotes(options);
      setError(err instanceof Error ? err.message : 'Не удалось проголосовать');
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
            {/* Заливка-шкала рисуется только после голосования. */}
            {chosen && (
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 transition-[width] duration-500"
                style={{ width: `${share}%`, background: 'var(--accent-soft)' }}
              />
            )}
            <span className="relative flex items-center justify-between gap-3">
              <span className="truncate text-[14px]">{option.text}</span>
              {chosen && (
                <span className="font-num flex-none text-[13px] text-[var(--text-muted)]">
                  {share}%
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
