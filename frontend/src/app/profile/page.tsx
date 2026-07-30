'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { apiFetch } from '@/lib/api';
import { Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { ProfileAvatar } from '@/components/ProfileAvatar';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="font-num text-[19px] font-semibold text-[var(--text)]">{value}</span>
      <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { session, loading: sessionLoading } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      setLoadingPosts(false);
      return;
    }
    setLoadingPosts(true);
    apiFetch<Post[]>(`/posts/user/${userId}?sort=new`)
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingPosts(false));
  }, [userId]);

  const karma = useMemo(() => posts.reduce((sum, post) => sum + post.score, 0), [posts]);
  const commentsReceived = useMemo(
    () => posts.reduce((sum, post) => sum + post.commentCount, 0),
    [posts]
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  if (!sessionLoading && !session) {
    return (
      <div className="flex flex-1 flex-col items-center bg-[var(--bg)]">
        <main className="flex w-full max-w-2xl flex-col items-center gap-4 px-4 py-16 text-center">
          <ProfileAvatar letter="?" size={96} muted />
          <p className="text-[var(--text-muted)]">Войдите, чтобы открыть свой профиль.</p>
          <Link
            href="/login"
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90"
          >
            Войти
          </Link>
        </main>
      </div>
    );
  }

  const email = session?.user.email ?? '';
  const handle = email.split('@')[0];

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--bg)]">
      <main className="flex w-full max-w-2xl flex-col gap-5 px-4 py-6">
        <div className="flex items-center gap-5">
          <ProfileAvatar letter={handle[0]?.toUpperCase() ?? '?'} size={96} />

          <div className="flex flex-1 items-center justify-around">
            <Stat value={posts.length} label="постов" />
            <Stat value={karma} label="карма" />
            <Stat value={commentsReceived} label="ответов" />
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <h1 className="text-[17px] font-semibold text-[var(--text)]">{handle}</h1>
          <span className="text-[13px] text-[var(--text-muted)]">{email}</span>
        </div>

        <div className="flex gap-2">
          <Link
            href="/"
            className="flex-1 rounded-full border border-[var(--border)] py-2.5 text-center text-sm font-medium text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            К ленте
          </Link>
          <button
            onClick={handleSignOut}
            className="flex-1 rounded-full border border-[var(--border)] py-2.5 text-center text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--down)' }}
          >
            Выйти
          </button>
        </div>

        <div className="border-t border-[var(--border)] pt-1">
          <h2 className="py-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Мои посты
          </h2>

          {loadingPosts && <p className="py-4 text-[var(--text-muted)]">Загрузка…</p>}
          {error && <p className="py-4" style={{ color: 'var(--down)' }}>{error}</p>}

          <div className="flex flex-col divide-y divide-[var(--border)]">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>

          {!loadingPosts && !error && posts.length === 0 && (
            <p className="py-8 text-center text-[var(--text-muted)]">
              Вы пока ничего не опубликовали.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
