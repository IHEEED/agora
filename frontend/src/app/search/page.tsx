'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Community, Post, UserSummary } from '@/lib/types';
import { formatRelativeDate } from '@/lib/formatDate';
import { CommunityAvatar } from '@/components/CommunityAvatar';

type Scope = 'all' | 'people' | 'posts' | 'communities';

const SCOPES: ReadonlyArray<readonly [Scope, string]> = [
  ['all', 'Всё'],
  ['people', 'Люди'],
  ['posts', 'Посты'],
  ['communities', 'Сообщества'],
];

export default function SearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<UserSummary[]>([]);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Фокус ставим вручную: на телефоне именно это поднимает клавиатуру.
    inputRef.current?.focus();

    Promise.all([
      apiFetch<Community[]>('/communities'),
      apiFetch<Post[]>('/posts?sort=new'),
      apiFetch<UserSummary[]>('/users'),
    ])
      .then(([loadedCommunities, loadedPosts, loadedPeople]) => {
        setCommunities(loadedCommunities);
        setPosts(loadedPosts);
        setPeople(loadedPeople);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const normalized = query.trim().toLowerCase();

  const foundPeople = useMemo(() => {
    if (!normalized) return [];
    return people.filter((p) => p.username.toLowerCase().includes(normalized));
  }, [people, normalized]);

  const foundCommunities = useMemo(() => {
    if (!normalized) return [];
    return communities.filter(
      (c) =>
        c.name.toLowerCase().includes(normalized) ||
        c.description?.toLowerCase().includes(normalized)
    );
  }, [communities, normalized]);

  const foundPosts = useMemo(() => {
    if (!normalized) return [];
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(normalized) ||
        p.body?.toLowerCase().includes(normalized) ||
        p.author.username.toLowerCase().includes(normalized)
    );
  }, [posts, normalized]);

  const showPeople = (scope === 'all' || scope === 'people') && foundPeople.length > 0;
  const showCommunities = (scope === 'all' || scope === 'communities') && foundCommunities.length > 0;
  const showPosts = (scope === 'all' || scope === 'posts') && foundPosts.length > 0;
  const nothingFound = normalized && !showPeople && !showCommunities && !showPosts;

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--bg)]">
      <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-8">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="6.5" />
                <path d="m20 20-4.3-4.3" />
              </svg>
            </span>
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              placeholder="Посты, люди, сообщества…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-2.5 pl-11 pr-4 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Закрытие поиска — справа от строки, в такой же круглой обойме. */}
          <button
            onClick={() => router.back()}
            aria-label="Закрыть поиск"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <div className="flex justify-center">
          <div className="flex gap-1 rounded-full border border-[var(--border)] p-1">
            {SCOPES.map(([value, label]) => (
              <button
                key={value}
                onClick={() => setScope(value)}
                className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors"
                style={
                  scope === value
                    ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                    : { color: 'var(--text-muted)' }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="text-[var(--text-muted)]">Загрузка…</p>}
        {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

        {!normalized && !loading && (
          <p className="py-10 text-center text-[var(--text-muted)]">
            Начните вводить запрос — поиск идёт по людям, заголовкам, текстам и сообществам.
          </p>
        )}

        {showPeople && (
          <section className="flex flex-col">
            <h2 className="py-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Люди
            </h2>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {foundPeople.map((person) => (
                <div key={person.id} className="flex items-center gap-3 py-3">
                  <span
                    className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-sm font-semibold"
                    style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
                  >
                    {person.username[0]?.toUpperCase()}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-[var(--text)]">{person.username}</span>
                    <span className="text-[12px] text-[var(--text-muted)]">
                      <span className="font-num">{person.karma}</span> influence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {showCommunities && (
          <section className="flex flex-col">
            <h2 className="py-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Сообщества
            </h2>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {foundCommunities.map((community) => (
                <Link key={community.id} href={`/c/${community.id}`} className="flex items-center gap-3 py-3">
                  <CommunityAvatar name={community.name} size={40} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-[var(--text)]">{community.name}</span>
                    {community.description && (
                      <span className="truncate text-[13px] text-[var(--text-muted)]">
                        {community.description}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {showPosts && (
          <section className="flex flex-col">
            <h2 className="py-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              Посты
            </h2>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {foundPosts.map((post) => (
                <Link key={post.id} href={`/posts/${post.id}`} className="flex flex-col gap-1 py-3">
                  <span className="font-medium text-[var(--text)]">{post.title}</span>
                  <span className="text-[12px] text-[var(--text-muted)]">
                    {post.author.username} · {formatRelativeDate(post.created_at)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {nothingFound && (
          <p className="py-10 text-center text-[var(--text-muted)]">
            По запросу «{query.trim()}» ничего не нашлось.
          </p>
        )}
      </main>
    </div>
  );
}
