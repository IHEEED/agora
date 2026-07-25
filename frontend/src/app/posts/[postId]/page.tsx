'use client';

import { useCallback, useEffect, useState, SubmitEvent } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { useExpandedComments } from '@/lib/useExpandedComments';
import { markPostViewed } from '@/lib/viewedPosts';
import { Post, Comment, CommentSort } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { CommentThread } from '@/components/CommentThread';

const COMMENT_SORT_OPTIONS: { value: CommentSort; label: string }[] = [
  { value: 'best', label: 'По рейтингу' },
  { value: 'new', label: 'Новые' },
];

export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();
  const { session } = useSession();
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
      setFormError(err instanceof Error ? err.message : 'Не удалось отправить комментарий');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-6 py-12 px-4">
        {loading && <p className="text-zinc-600 dark:text-zinc-400">Загрузка…</p>}
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

        {post && <PostCard post={post} linkToDetail={false} />}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Комментарии</h2>
            <div className="flex gap-1 rounded-full border border-black/[.08] p-1 dark:border-white/[.145]">
              {COMMENT_SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setCommentSort(option.value)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    commentSort === option.value
                      ? 'bg-foreground text-background'
                      : 'text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-[#1a1a1a]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {session ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <textarea
                required
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ваш комментарий…"
                className="rounded-md border border-black/[.08] px-3 py-2 text-sm text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
              />
              {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="self-start rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50 dark:hover:bg-[#ccc]"
              >
                Отправить
              </button>
            </form>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">Войдите, чтобы оставить комментарий.</p>
          )}

          <div className="flex flex-col gap-4">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                postId={postId}
                onAdded={loadComments}
                isExpanded={isExpanded}
                onToggleExpand={toggle}
              />
            ))}
            {!loading && comments.length === 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Комментариев пока нет.</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
