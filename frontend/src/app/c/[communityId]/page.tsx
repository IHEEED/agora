'use client';

import { useCallback, useEffect, useMemo, useState, SubmitEvent } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { StoriesBar } from '@/components/StoriesBar';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';

export default function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const { session } = useSession();
  const { requestVerification } = usePhoneGate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPosts = useCallback(() => {
    apiFetch<Post[]>(`/posts/community/${communityId}?sort=hot`)
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [communityId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const storyUsernames = useMemo(
    () => Array.from(new Set(posts.map((p) => p.author.username))),
    [posts]
  );

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      await apiFetch<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({ title, body, community_id: communityId }),
      });
      setTitle('');
      setBody('');
      setShowForm(false);
      loadPosts();
    } catch (err) {
      if (isPhoneNotVerifiedError(err)) {
        setShowForm(false);
        requestVerification();
        return;
      }
      setFormError(err instanceof Error ? err.message : 'Не удалось создать пост');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--bg)]">
      <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-8">
        <StoriesBar
          usernames={storyUsernames}
          currentUserLetter={session?.user.email?.[0]?.toUpperCase()}
        />

        {session && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface)]"
          >
            <span
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold"
              style={{ background: 'var(--surface)', color: 'var(--accent)' }}
            >
              {session.user.email?.[0]?.toUpperCase()}
            </span>
            <span className="text-[15px] text-[var(--text-muted)]">
              {showForm ? 'Отмена' : 'Что нового?'}
            </span>
          </button>
        )}

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <input
              placeholder="Заголовок"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />
            <textarea
              placeholder="Текст (необязательно)"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />
            {formError && <p className="text-sm" style={{ color: 'var(--down)' }}>{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="self-start rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-50"
            >
              Создать
            </button>
          </form>
        )}

        {loading && <p className="text-[var(--text-muted)]">Загрузка…</p>}
        {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {!loading && !error && posts.length === 0 && (
            <p className="py-4 text-[var(--text-muted)]">В этом сообществе пока нет постов.</p>
          )}
        </div>
      </main>
    </div>
  );
}
