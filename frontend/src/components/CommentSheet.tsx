'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '@/lib/api';
import { Comment } from '@/lib/types';
import { formatRelativeDate } from '@/lib/formatDate';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';

/** Быстрые реакции над строкой ввода — то же, что в Instagram. */
const QUICK_EMOJI = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

/** Ниже этого сдвига отпускание закрывает шторку, выше — возвращает на место. */
const DISMISS_AFTER_PX = 120;

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

  // Сдвиг шторки пальцем. null — палец не касается, идёт обычная анимация.
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // document.body на сервере не существует — портал ставим только на клиенте.
  // useSyncExternalStore вместо флага из эффекта: у него разные снимки для
  // сервера и браузера, поэтому не нужен ни setState, ни лишний перерендер.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Загрузка — производное состояние, а не флаг: пока шторку открыли, список
  // не пришёл и ошибки нет, значит идёт запрос. Отдельный setLoading(true)
  // пришлось бы звать синхронно из эффекта, чего React делать не советует.
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

  // Пока шторка открыта, страница под ней не должна прокручиваться.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Escape закрывает — привычно на десктопе и ничего не стоит.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  async function submit(value: string) {
    const body = value.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    try {
      const created = await apiFetch<Comment>('/comments', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, body }),
      });
      setComments((prev) => {
        const next = [created, ...prev];
        onCountChange?.(next.length);
        return next;
      });
      setText('');
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

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientY;
    setDrag(0);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag === null) return;
    // Тянуть можно только вниз: вверх шторка уже упирается в свой потолок.
    setDrag(Math.max(0, e.clientY - dragStart.current));
  }

  function onPointerUp() {
    if (drag === null) return;
    if (drag > DISMISS_AFTER_PX) onClose();
    setDrag(null);
  }

  const offset = open ? (drag ?? 0) : null;

  // Портал в body обязателен: карточка поста несёт backdrop-filter, а он делает
  // элемент containing block для position: fixed. Без портала шторка привязалась
  // бы к посту, а не к экрану, и вылезала бы посреди ленты.
  if (!mounted) return null;

  return createPortal(
    <>
      {/* Затемнение — оно же зона закрытия по нажатию. */}
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0 z-[60]"
        style={{
          background: 'rgba(0, 0, 0, 0.55)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.26s ease',
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Комментарии"
        className="comment-sheet fixed inset-x-0 bottom-0 z-[61] flex flex-col rounded-t-[22px]"
        style={{
          // 70% высоты: сверху остаётся видимая полоса исходного экрана —
          // именно она объясняет, что это слой поверх, а не новая страница.
          height: '70vh',
          transform: open ? `translateY(${offset ?? 0}px)` : 'translateY(100%)',
          transition: drag === null ? 'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1)' : 'none',
        }}
      >
        {/* Полоска-ухватка: за неё же шторка и тянется вниз. */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex flex-none cursor-grab touch-none flex-col items-center gap-3 pb-2 pt-2.5"
        >
          <span className="h-1 w-9 rounded-full" style={{ background: 'var(--control-border)' }} />
          <span className="text-[15px] font-semibold text-[var(--text)]">Комментарии</span>
        </div>

        <div className="h-px flex-none" style={{ background: 'var(--border)' }} />

        <div className="flex-1 overflow-y-auto overscroll-contain px-4">
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
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[12px] font-semibold"
                  style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
                >
                  {comment.author.username[0]?.toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13px] text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text)]">{comment.author.username}</span>
                    {' · '}
                    {formatRelativeDate(comment.created_at)}
                  </span>
                  <p className="text-[14.5px] leading-relaxed text-[var(--text)]">{comment.body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* Подвал: быстрые смайлики и строка ввода — оба всегда на виду. */}
        <div
          className="flex flex-none flex-col gap-2 px-3 pt-2"
          style={{
            borderTop: '1px solid var(--border)',
            // Домашний индикатор на телефонах без кнопки перекрывал бы строку ввода.
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
          }}
        >
          <div className="no-scrollbar flex gap-1 overflow-x-auto">
            {QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => submit(emoji)}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[19px] transition-transform active:scale-90"
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
              ref={inputRef}
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
        </div>
      </div>
    </>,
    document.body
  );
}
