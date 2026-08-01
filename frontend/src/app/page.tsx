'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { StoriesBar } from '@/components/StoriesBar';

export default function FeedPage() {
  const { session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Post[]>('/posts?sort=hot')
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  // Истории собираем из авторов ленты — своего механизма у них пока нет.
  const storyUsernames = useMemo(
    () => Array.from(new Set(posts.map((p) => p.author.username))),
    [posts]
  );

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--bg)]">
      <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-8">
        <StoriesBar
          usernames={storyUsernames}
          currentUserLetter={session?.user.email?.[0]?.toUpperCase()}
        />

        <Link
          href="/create"
          className="mt-3 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-left transition-colors hover:bg-[var(--surface)]"
        >
          <span
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-semibold"
            style={{ background: 'var(--surface)', color: 'var(--accent)' }}
          >
            {session?.user.email?.[0]?.toUpperCase()}
          </span>
          <span className="text-[15px] text-[var(--text-muted)]">Что нового?</span>
        </Link>

        {loading && <p className="text-[var(--text-muted)]">Загрузка…</p>}
        {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {!loading && !error && posts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-[var(--text-muted)]">В ленте пока пусто.</p>
              <Link
                href="/communities"
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-contrast)]"
              >
                Найти сообщества
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
