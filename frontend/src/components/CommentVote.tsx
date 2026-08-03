'use client';

import { useVote } from '@/lib/useVote';
import { RollingNumber } from '@/components/RollingNumber';

/**
 * Голосование за комментарий — та же механика, что и у поста, но компактнее:
 * в списке комментариев их десятки, и полноразмерный блок из ленты забивал бы
 * собой сам текст.
 */
export function CommentVote({
  commentId,
  score,
  myVote,
}: {
  commentId: string;
  score: number;
  myVote: 1 | -1 | null;
}) {
  const vote = useVote(commentId, score, myVote, 'comment');

  const tone =
    vote.myVote === 1
      ? { color: 'var(--up)', borderColor: 'var(--up)', background: 'var(--up-bg)' }
      : vote.myVote === -1
        ? { color: 'var(--down)', borderColor: 'var(--down)', background: 'var(--down-bg)' }
        : {};

  return (
    <div className="control-pill flex items-center rounded-full" style={tone}>
      <button
        onClick={() => vote.vote(1)}
        aria-label="Голосовать за"
        aria-pressed={vote.myVote === 1}
        className="flex h-7 w-7 items-center justify-center rounded-full"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={vote.myVote === 1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12l7-7 7 7" />
        </svg>
      </button>

      <RollingNumber value={vote.score} className="min-w-[1.3em] justify-center font-num text-[13px]" />

      <button
        onClick={() => vote.vote(-1)}
        aria-label="Голосовать против"
        aria-pressed={vote.myVote === -1}
        className="flex h-7 w-7 items-center justify-center rounded-full"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill={vote.myVote === -1 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 19V5M5 12l7 7 7-7" />
        </svg>
      </button>
    </div>
  );
}
