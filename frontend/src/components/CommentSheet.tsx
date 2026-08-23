'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Comment } from '@/lib/types';
import { useCollapsedComments } from '@/lib/useCollapsedComments';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';
import { BottomSheet } from '@/components/BottomSheet';
import { CommentThread } from '@/components/CommentThread';
import { useCommentSpotlight } from '@/lib/useCommentSpotlight';
import { SkeletonComment, SkeletonList } from '@/components/Skeleton';
import { useT } from '@/lib/i18n';

/** Быстрые реакции над строкой ввода — то же, что в Instagram. */
const QUICK_EMOJI = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

export function CommentSheet({
  postId,
  open,
  onClose,
  onCountChange,
  highlightId,
}: {
  postId: string;
  open: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
  /** Комментарий, к которому нужно прокрутить и подсветить его на секунду. */
  highlightId?: string;
}) {
  const { t } = useT();
  const { requestVerification } = usePhoneGate();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Кому отвечаем. Бэкенд принимает parent_comment_id — дерево он уже умеет,
  // а вот собрать ответ было неоткуда.
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const { isCollapsed, toggle } = useCollapsedComments(postId);
  // Счётчик перезагрузок: отправленный ответ должен попасть в дерево, а собрать
  // его на клиенте сложнее, чем перечитать — комментариев на пост немного.
  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  // Загрузка — производное состояние, а не флаг: пока шторку открыли, список
  // не пришёл и ошибки нет, значит идёт запрос.
  const loading = open && !loaded && !error;

  useEffect(() => {
    if (!open) return;

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
  }, [open, postId, reloads, onCountChange]);

  // Прокрутка к найденному комментарию и снятие указания через полторы
  // секунды. Тем же хуком, что и на странице поста: комментарии открываются
  // двумя способами, но ведут себя одинаково.
  const spotlight = useCommentSpotlight(highlightId, comments.length > 0);

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
      title={t('comments.title')}
      // Почти во весь экран: комментариев на пост десятки, и семьдесят
      // процентов высоты означали, что за раз видно четыре.
      height="84dvh"
      footer={
        <>
          {replyTo && (
            <div className="flex items-center gap-2 px-1 text-[12.5px] text-[var(--text-muted)]">
              <span className="min-w-0 flex-1 truncate">
                Ответ <span style={{ color: 'var(--accent)' }}>{replyTo.author.username}</span>
              </span>
              <button
                onClick={() => setReplyTo(null)}
                aria-label={t('comments.cancelReply')}
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
            {/* Строка с кнопкой отправки внутри, справа: таблетка с отдельным
                кружком рядом занимала две формы под одно действие. */}
            <div className="field-line flex w-full items-center gap-2 pl-1">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={t('comments.placeholder')}
                enterKeyHint="send"
                className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[15px] text-[var(--text)] outline-none"
              />
              <button
                type="submit"
                disabled={!text.trim() || sending}
                aria-label={t('comments.send')}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-full transition-opacity disabled:opacity-30"
                style={{ color: 'var(--accent)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12h15M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </form>
        </>
      }
    >
      {/* Заглушки, а не строка «Загрузка…»: они занимают ту же высоту, что и
          комментарии, поэтому подмена ничего не двигает. */}
      {loading && (
        <div className="py-1">
          <SkeletonList count={4}>
            <SkeletonComment />
          </SkeletonList>
        </div>
      )}
      {error && <p className="py-3 text-[13px]" style={{ color: 'var(--down)' }}>{error}</p>}

      {!loading && comments.length === 0 && (
        <p className="py-12 text-center text-[var(--text-muted)]">
          Комментариев пока нет. Будьте первым.
        </p>
      )}

      {/* Рисуем деревом, а не плоским списком корневых комментариев. Плоский
          список был причиной, по которой переход «к нужному комментарию» не
          работал: если искомый комментарий — ответ, его просто не было
          в разметке, и прокручивать было не к чему. */}
      <div
        className={`comment-list flex flex-col gap-5 py-1${
          spotlight ? ' comment-list-spotlight' : ''
        }`}
      >
        {comments.map((comment) => (
          <CommentThread
            key={comment.id}
            comment={comment}
            postId={postId}
            onAdded={reload}
            isCollapsed={isCollapsed}
            onToggleCollapse={toggle}
            highlightId={spotlight}
          />
        ))}
      </div>
    </BottomSheet>
  );
}
