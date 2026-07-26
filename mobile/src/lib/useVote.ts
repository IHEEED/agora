import { useRef, useState } from 'react';
import { apiFetch } from './api';

export function useVote(
  id: string,
  initialScore: number,
  initialMyVote: 1 | -1 | null,
  kind: 'post' | 'comment' = 'post'
) {
  const [score, setScore] = useState(initialScore);
  const [myVote, setMyVoteState] = useState<1 | -1 | null>(initialMyVote);
  const myVoteRef = useRef(initialMyVote);
  const [error, setError] = useState<string | null>(null);

  const idField = kind === 'post' ? 'post_id' : 'comment_id';

  function setMyVote(value: 1 | -1 | null) {
    myVoteRef.current = value;
    setMyVoteState(value);
  }

  async function vote(value: 1 | -1) {
    setError(null);
    const previousVote = myVoteRef.current;
    const previousScore = score;

    if (previousVote === value) {
      // повторное нажатие той же стрелки — отмена голоса
      setMyVote(null);
      setScore((s) => s - value);

      try {
        await apiFetch('/votes', {
          method: 'DELETE',
          body: JSON.stringify({ [idField]: id }),
        });
      } catch (err) {
        setMyVote(previousVote);
        setScore(previousScore);
        setError(err instanceof Error ? err.message : 'Не удалось отменить голос');
      }
      return;
    }

    const delta = previousVote === null ? value : value * 2;
    setMyVote(value);
    setScore((s) => s + delta);

    try {
      await apiFetch('/votes', {
        method: 'POST',
        body: JSON.stringify({ [idField]: id, value }),
      });
    } catch (err) {
      setMyVote(previousVote);
      setScore(previousScore);
      setError(err instanceof Error ? err.message : 'Не удалось проголосовать');
    }
  }

  return { score, myVote, vote, error };
}
