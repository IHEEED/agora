'use client';

import { useEffect, useState, SubmitEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { Community } from '@/lib/types';
import { CommunityAvatar } from '@/components/CommunityAvatar';

export default function CommunitiesPage() {
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
    <div className="flex flex-1 flex-col items-center" style={{ background: 'var(--sunken)' }}>
      <main className="below-header flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-8">
        <div className="flex items-center justify-between px-2">
          <h1 className="text-2xl font-semibold text-[var(--text)]">Сообщества</h1>
          {session && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90"
            >
              {showForm ? 'Отмена' : '+ Создать'}
            </button>
          )}
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <input
              placeholder="Название"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />
            <textarea
              placeholder="Описание (необязательно)"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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

        {loading && <p className="px-2 text-[var(--text-muted)]">Загрузка…</p>}
        {error && <p className="px-2" style={{ color: 'var(--down)' }}>{error}</p>}

        {/* Каждое сообщество — отдельная белая карточка на приглушённом холсте,
            тем же приёмом, что и блоки профиля. */}
        {communities.map((community) => (
          <Link
            key={community.id}
            href={`/c/${community.id}`}
            className="flex items-center gap-3.5 rounded-2xl bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-2)]"
          >
            <CommunityAvatar name={community.name} size={48} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h2 className="truncate font-medium text-[var(--text)]">{community.name}</h2>
              {community.description && (
                <p className="line-clamp-2 text-[13.5px] text-[var(--text-muted)]">
                  {community.description}
                </p>
              )}
              <span className="font-pixel text-[11px] text-[var(--text-muted)]">
                создано {community.creator.username}
              </span>
            </div>
          </Link>
        ))}

        {!loading && !error && communities.length === 0 && (
          <p className="rounded-2xl bg-[var(--surface)] p-6 text-center text-[var(--text-muted)]">
            Сообществ пока нет.
          </p>
        )}
      </main>
    </div>
  );
}
