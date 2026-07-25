import { useEffect, useRef, useState } from 'react';
import { apiFetch } from './api';

const MESSAGE_TIMEOUT_MS = 2500;

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
  const [message, setMessage] = useState<string | null>(null);
  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const idField = kind === 'post' ? 'post_id' : 'comment_id';

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    };
  }, []);

  function setMyVote(value: 1 | -1 | null) {
    myVoteRef.current = value;
    setMyVoteState(value);
  }

  function showMessage(text: string | null) {
    if (messageTimeoutRef.current) clearTimeout(messageTimeoutRef.current);
    setMessage(text);
    if (text) {
      messageTimeoutRef.current = setTimeout(() => setMessage(null), MESSAGE_TIMEOUT_MS);
    }
  }

  async function vote(value: 1 | -1) {
    setError(null);
    const previousVote = myVoteRef.current;
    const previousScore = score;

    if (previousVote === value) {
      // повторный клик по той же стрелке — отмена голоса
      setMyVote(null);
      setScore((s) => s - value);

      try {
        await apiFetch('/votes', {
          method: 'DELETE',
          body: JSON.stringify({ [idField]: id }),
        });
        showMessage('Вы убрали голос');
      } catch (err) {
        setMyVote(previousVote);
        setScore(previousScore);
        setError(err instanceof Error ? err.message : 'Не удалось отменить голос');
      }
      return;
    }

    showMessage(null);
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

  return { score, myVote, vote, error, message };
}
