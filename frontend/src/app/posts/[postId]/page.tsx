'use client';

import { useCallback, useEffect, useState, useSyncExternalStore, SubmitEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/useSession';
import { useExpandedComments } from '@/lib/useExpandedComments';
import { markPostViewed } from '@/lib/viewedPosts';
import { Post, Comment, CommentSort } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { CommentThread } from '@/components/CommentThread';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';

const COMMENT_SORT_OPTIONS: { value: CommentSort; label: string }[] = [
  { value: 'best', label: 'По рейтингу' },
  { value: 'new', label: 'Новые' },
];

export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const router = useRouter();
  const { t } = useT();
  const { session } = useSession();
  const { requestVerification } = usePhoneGate();
  const { isExpanded, toggle } = useExpandedComments(postId);

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
    () => () => {},
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
        <button
          onClick={() => router.back()}
          className="flex w-fit items-center gap-2 rounded-full px-2 py-1.5 text-[15px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="flex gap-1 rounded-full border border-[var(--border)] p-1">
              {COMMENT_SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCommentSort(option.value)}
                  className="whitespace-nowrap rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors"
                  style={
                    commentSort === option.value
                      ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {session && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <textarea
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Поделитесь своим мнением"
                className="resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              {formError && <p className="text-[13px]" style={{ color: 'var(--down)' }}>{formError}</p>}
              <button
                type="submit"
                disabled={submitting || !body.trim()}
                className="self-start rounded-full px-5 py-2 text-[14px] font-medium transition-opacity disabled:opacity-40"
                style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                Отправить
              </button>
            </form>
          )}

          <div className="flex flex-col gap-5">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                postId={postId}
                onAdded={loadComments}
                isExpanded={isExpanded}
                onToggleExpand={toggle}
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
