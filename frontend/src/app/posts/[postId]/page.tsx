'use client';

import { useCallback, useEffect, useState, useSyncExternalStore, SubmitEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/useSession';
import { useCollapsedComments } from '@/lib/useCollapsedComments';
import { markPostViewed } from '@/lib/viewedPosts';
import { Post, Comment, CommentSort } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { CommentThread } from '@/components/CommentThread';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';
import { SegmentedControl } from '@/components/SegmentedControl';

const COMMENT_SORT_OPTIONS: ReadonlyArray<readonly [CommentSort, string]> = [
  ['best', 'По рейтингу'],
  ['new', 'Новые'],
];

export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const { t } = useT();
  const { session } = useSession();
  const { requestVerification } = usePhoneGate();
  const { isCollapsed, toggle } = useCollapsedComments(postId);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentSort, setCommentSort] = useState<CommentSort>('best');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [body, setBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(() => {
    apiFetch<Comment[]>(`/comments/post/${postId}?sort=${commentSort}`).then(setComments);
  }, [postId, commentSort]);

  useEffect(() => {
    if (markPostViewed(postId)) {
      apiFetch(`/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
    }
  }, [postId]);

  useEffect(() => {
    apiFetch<Post>(`/posts/${postId}`)
      .then(setPost)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  // Пришли по ссылке вида #comment-<id> из профиля. Цель берём из адреса прямо
  // при рендере, а не ставим состоянием из эффекта: от неё зависит, какая ветка
  // раскроется, и лишний кадр со свёрнутой веткой был бы виден.
  const highlightId = useSyncExternalStore(
    (notify) => {
      // Сервер рисует разметку, не зная адресной строки, поэтому его снимок
      // всегда пуст. Без толчка после гидратации React так с ним и остаётся —
      // и при прямом заходе по ссылке цель терялась: подсвечивать было нечего.
      const frame = requestAnimationFrame(notify);
      window.addEventListener('hashchange', notify);
      return () => {
        cancelAnimationFrame(frame);
        window.removeEventListener('hashchange', notify);
      };
    },
    () => {
      const hash = window.location.hash;
      return hash.startsWith('#comment-') ? hash.slice('#comment-'.length) : null;
    },
    () => null
  );

  // Прокручиваем уже после того, как ветка раскрылась и узел появился.
  useEffect(() => {
    if (!highlightId || comments.length === 0) return;
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`comment-${highlightId}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return () => cancelAnimationFrame(frame);
  }, [highlightId, comments]);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await apiFetch('/comments', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, body }),
      });
      setBody('');
      loadComments();
    } catch (err) {
      if (isPhoneNotVerifiedError(err)) {
        requestVerification();
        return;
      }
      setFormError(err instanceof Error ? err.message : 'Не удалось отправить комментарий');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    // Фон и цвета берём из темы, а не из палитры Tailwind: этот экран остался
    // единственным, куда редизайн не дошёл, — отсюда и вид «чёрного листа».
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-5 px-4 pb-10">
        {/* Отрицательный отступ ставит стрелку по одной линии с текстом поста:
            собственные поля кнопки иначе сдвигали её вправо, и колонка
            начиналась в двух разных местах. */}
        <button
          onClick={() => router.back()}
          className="-ml-2.5 flex w-fit items-center gap-1.5 rounded-full py-2 pl-2 pr-3.5 text-[16px] font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {t('common.back')}
        </button>

        {loading && <p className="text-[var(--text-muted)]">{t('common.loading')}</p>}
        {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

        {post && <PostCard post={post} linkToDetail={false} />}

        <div className="flex flex-col gap-4 border-t border-[var(--border)] pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-[var(--text)]">Комментарии</h2>
            <SegmentedControl
              value={commentSort}
              onChange={setCommentSort}
              options={COMMENT_SORT_OPTIONS}
              className="flex-none"
            />
          </div>

          {/* Одна строка с кнопкой внутри — как в шторке комментариев. Блок в
              три ряда с отдельной кнопкой снизу занимал четверть экрана под
              действие, которое чаще всего умещается в одну фразу. */}
          {session && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <div className="field-line flex w-full items-center gap-2 pl-1">
                <input
                  required
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Поделитесь своим мнением"
                  enterKeyHint="send"
                  className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[15px] text-[var(--text)] outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting || !body.trim()}
                  aria-label="Отправить"
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-full transition-opacity disabled:opacity-30"
                  style={{ color: 'var(--accent)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12h15M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>
              {formError && <p className="text-[13px]" style={{ color: 'var(--down)' }}>{formError}</p>}
            </form>
          )}

          <div className="comment-list flex flex-col gap-5">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                postId={postId}
                onAdded={loadComments}
                isCollapsed={isCollapsed}
                onToggleCollapse={toggle}
                highlightId={highlightId}
              />
            ))}
            {!loading && comments.length === 0 && (
              <p className="py-8 text-center text-[var(--text-muted)]">
                Комментариев пока нет. Будьте первым.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
