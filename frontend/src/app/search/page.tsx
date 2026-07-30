'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Community } from '@/lib/types';

export default function SearchPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Community[]>('/communities')
      .then(setCommunities)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
  }, [communities, query]);

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--bg)]">
      <main className="flex w-full max-w-2xl flex-col gap-4 py-12 px-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Поиск</h1>

        <input
          autoFocus
          placeholder="Найти сообщество…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />

        {loading && <p className="text-[var(--text-muted)]">Загрузка…</p>}
        {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {results.map((community) => (
            <Link key={community.id} href={`/c/${community.id}`} className="flex flex-col gap-0.5 py-3">
              <span className="font-medium text-[var(--text)]">{community.name}</span>
              {community.description && (
                <span className="text-sm text-[var(--text-muted)]">{community.description}</span>
              )}
            </Link>
          ))}
          {!loading && !error && results.length === 0 && (
            <p className="py-4 text-[var(--text-muted)]">Ничего не найдено.</p>
          )}
        </div>
      </main>
    </div>
  );
}
