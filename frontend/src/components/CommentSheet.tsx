'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Comment } from '@/lib/types';
import { formatCompactAge } from '@/lib/formatDate';
import { CommentVote } from '@/components/CommentVote';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';
import { BottomSheet } from '@/components/BottomSheet';
import { DefaultAvatar } from '@/components/DefaultAvatar';

/** Быстрые реакции над строкой ввода — то же, что в Instagram. */
const QUICK_EMOJI = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

export function CommentSheet({
  postId,
  open,
  onClose,
  onCountChange,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}) {
  const { requestVerification } = usePhoneGate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Кому отвечаем. Бэкенд принимает parent_comment_id — дерево он уже умеет,
  // а вот собрать ответ было неоткуда.
  const [replyTo, setReplyTo] = useState<Comment | null>(null);

  // Загрузка — производное состояние, а не флаг: пока шторку открыли, список
  // не пришёл и ошибки нет, значит идёт запрос.
  const loading = open && !loaded && !error;

  useEffect(() => {
    if (!open || loaded) return;

    let cancelled = false;
    apiFetch<Comment[]>(`/comments/post/${postId}`)
      .then((list) => {
        if (cancelled) return;
        setComments(list);
        setLoaded(true);
        onCountChange?.(list.length);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [open, loaded, postId, onCountChange]);

  async function submit(value: string) {
    const body = value.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    try {
      const created = await apiFetch<Comment>('/comments', {
        method: 'POST',
        body: JSON.stringify({
          post_id: postId,
          body,
          parent_comment_id: replyTo?.id ?? null,
        }),
      });
      setComments((prev) => {
        const next = [created, ...prev];
        onCountChange?.(next.length);
        return next;
      });
      setText('');
      setReplyTo(null);
    } catch (err) {
      if (isPhoneNotVerifiedError(err)) {
        requestVerification();
        return;
      }
      setError(err instanceof Error ? err.message : 'Не удалось отправить комментарий');
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Комментарии"
      footer={
        <>
          {replyTo && (
            <div className="flex items-center gap-2 px-1 text-[12.5px] text-[var(--text-muted)]">
              <span className="min-w-0 flex-1 truncate">
                Ответ <span style={{ color: 'var(--accent)' }}>{replyTo.author.username}</span>
              </span>
              <button
                onClick={() => setReplyTo(null)}
                aria-label="Отменить ответ"
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full hover:bg-[var(--surface-2)]"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          )}

          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => submit(emoji)}
                className="emoji flex h-9 w-9 flex-none items-center justify-center rounded-full text-[21px] transition-transform active:scale-90"
              >
                {emoji}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(text);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Поделитесь своим мнением"
              enterKeyHint="send"
              className="w-full flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              aria-label="Отправить"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full transition-opacity disabled:opacity-35"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12h15M13 6l6 6-6 6" />
              </svg>
            </button>
          </form>
        </>
      }
    >
      {loading && <p className="py-6 text-[var(--text-muted)]">Загрузка…</p>}
      {error && <p className="py-3 text-[13px]" style={{ color: 'var(--down)' }}>{error}</p>}

      {!loading && comments.length === 0 && (
        <p className="py-12 text-center text-[var(--text-muted)]">
          Комментариев пока нет. Будьте первым.
        </p>
      )}

      <div className="flex flex-col">
        {comments.map((comment) => (
          <article key={comment.id} className="flex gap-3 py-3">
            <DefaultAvatar name={comment.author.username} size={32} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[13px] text-[var(--text-muted)]">
                <span className="font-semibold text-[var(--text)]">{comment.author.username}</span>
                {' · '}
                {formatCompactAge(comment.created_at)}
              </span>
              <p className="text-[14.5px] leading-relaxed text-[var(--text)]">{comment.body}</p>

              <div className="mt-0.5 flex items-center gap-2">
                <CommentVote
                  commentId={comment.id}
                  score={comment.score}
                  myVote={comment.myVote}
                />
                <button
                  onClick={() => setReplyTo(comment)}
                  className="rounded-full px-2 py-1 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  Ответить
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </BottomSheet>
  );
}
