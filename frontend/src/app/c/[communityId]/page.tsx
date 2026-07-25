'use client';

import { useCallback, useEffect, useState, SubmitEvent } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { Post, PostSort } from '@/lib/types';
import { PostCard } from '@/components/PostCard';

const SORT_OPTIONS: { value: PostSort; label: string }[] = [
  { value: 'hot', label: 'Горячее' },
  { value: 'new', label: 'Новое' },
  { value: 'top', label: 'Топ' },
  { value: 'commented', label: 'Обсуждаемые' },
];

export default function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const { session } = useSession();
  const [sort, setSort] = useState<PostSort>('hot');
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadPosts = useCallback(() => {
    apiFetch<Post[]>(`/posts/community/${communityId}?sort=${sort}`)
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [communityId, sort]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

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
      setFormError(err instanceof Error ? err.message : 'Не удалось создать пост');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-4 py-12 px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Посты</h1>
          {session && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              {showForm ? 'Отмена' : '+ Пост'}
            </button>
          )}
        </div>

        <div className="flex gap-1 rounded-full border border-black/[.08] p-1 dark:border-white/[.145] w-fit">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSort(option.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                sort === option.value
                  ? 'bg-foreground text-background'
                  : 'text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-[#1a1a1a]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
          >
            <input
              placeholder="Заголовок"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-md border border-black/[.08] px-3 py-2 text-sm text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
            />
            <textarea
              placeholder="Текст (необязательно)"
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="rounded-md border border-black/[.08] px-3 py-2 text-sm text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
            />
            {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="self-start rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background disabled:opacity-50 dark:hover:bg-[#ccc]"
            >
              Создать
            </button>
          </form>
        )}

        {loading && <p className="text-zinc-600 dark:text-zinc-400">Загрузка…</p>}
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {!loading && !error && posts.length === 0 && (
            <p className="text-zinc-600 dark:text-zinc-400">В этом сообществе пока нет постов.</p>
          )}
        </div>
      </main>
    </div>
  );
}
