'use client';

import { useEffect, useState, SubmitEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { Community } from '@/lib/types';

export default function Home() {
  const { session } = useSession();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<Community[]>('/communities')
      .then(setCommunities)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: SubmitEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const community = await apiFetch<Community>('/communities', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      setCommunities((prev) => [community, ...prev]);
      setName('');
      setDescription('');
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось создать сообщество');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col gap-4 py-12 px-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Сообщества</h1>
          {session && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              {showForm ? 'Отмена' : '+ Сообщество'}
            </button>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
          >
            <input
              placeholder="Название"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-black/[.08] px-3 py-2 text-sm text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
            />
            <textarea
              placeholder="Описание (необязательно)"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
          {communities.map((community) => (
            <Link
              key={community.id}
              href={`/c/${community.id}`}
              className="rounded-lg border border-black/[.08] bg-white p-4 transition-colors hover:bg-black/[.03] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-[#1a1a1a]"
            >
              <h2 className="font-medium text-black dark:text-zinc-50">{community.name}</h2>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                создано {community.creator.username}
              </span>
              {community.description && (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{community.description}</p>
              )}
            </Link>
          ))}
          {!loading && !error && communities.length === 0 && (
            <p className="text-zinc-600 dark:text-zinc-400">Сообществ пока нет.</p>
          )}
        </div>
      </main>
    </div>
  );
}
