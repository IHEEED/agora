'use client';

import { useEffect, useMemo, useState, SubmitEvent } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { Community } from '@/lib/types';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { setNavHidden } from '@/lib/navVisibility';
import { useT } from '@/lib/i18n';

export default function CommunitiesPage() {
  const { session } = useSession();
  const { t } = useT();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

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

  // Уход со страницы с открытой клавиатурой не должен оставить бар спрятанным.
  useEffect(() => () => setNavHidden(false), []);

  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!normalized) return communities;
    return communities.filter(
      (community) =>
        community.name.toLowerCase().includes(normalized) ||
        community.description?.toLowerCase().includes(normalized)
    );
  }, [communities, normalized]);

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
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-8">
        <div className="flex items-center justify-between px-2">
          <h1 className="font-pixel text-[32px] text-[var(--text)]">{t('communities.title')}</h1>
          {session && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90"
            >
              {showForm ? t('common.cancel') : t('communities.create')}
            </button>
          )}
        </div>

        {/* Свой поиск по сообществам: общий экран поиска ищет вообще всё,
            а здесь нужен быстрый фильтр по уже открытому списку. */}
        {/* Без вертикальных отступов: они сдвинули бы центр обёртки,
            а лупа выравнивается именно по нему. */}
        <div className="relative px-2">
          {/* z-10 обязателен: поле ниже — стеклянное, и его backdrop-filter
              размывает всё, что нарисовано под ним, включая эту лупу. */}
          <span className="pointer-events-none absolute left-6 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted)]">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m20 20-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            enterKeyHint="search"
            placeholder={t('communities.search')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Фокус убирает нижний бар вниз — там, где сейчас встанет клавиатура.
            onFocus={() => setNavHidden(true)}
            onBlur={() => setNavHidden(false)}
            className="glass w-full rounded-full py-2.5 pl-10 pr-4 text-[15px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
          />
        </div>

        {showForm && (
          <form
            onSubmit={handleCreate}
            className="glass flex flex-col gap-3 rounded-2xl p-4"
          >
            <input
              placeholder={t('communities.name')}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />
            <textarea
              placeholder={t('communities.description')}
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
              {t('communities.submit')}
            </button>
          </form>
        )}

        {loading && <p className="px-2 text-[var(--text-muted)]">{t('common.loading')}</p>}
        {error && <p className="px-2" style={{ color: 'var(--down)' }}>{error}</p>}

        {/* Каждое сообщество — отдельная белая карточка на приглушённом холсте,
            тем же приёмом, что и блоки профиля. */}
        {visible.map((community) => (
          <Link
            key={community.id}
            href={`/c/${community.id}`}
            className="glass glass-sheen flex items-center gap-3.5 rounded-2xl p-4 transition-transform active:scale-[0.99]"
          >
            <CommunityAvatar name={community.name} size={48} />
            <div className="relative flex min-w-0 flex-col gap-0.5">
              <h2 className="truncate font-medium text-[var(--text)]">{community.name}</h2>
              {community.description && (
                <p className="line-clamp-2 text-[13.5px] text-[var(--text-muted)]">
                  {community.description}
                </p>
              )}
            </div>
          </Link>
        ))}

        {!loading && !error && visible.length === 0 && (
          <p className="glass rounded-2xl p-6 text-center text-[var(--text-muted)]">
            {normalized ? t('communities.nothing') : t('communities.empty')}
          </p>
        )}
      </main>
    </div>
  );
}
