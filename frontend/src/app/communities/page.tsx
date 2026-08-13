'use client';

import { useEffect, useMemo, useState, SubmitEvent } from 'react';
import { invalidate, useApiData } from '@/lib/useApiData';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { Community } from '@/lib/types';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { setNavHidden } from '@/lib/navVisibility';
import { BottomSheet } from '@/components/BottomSheet';
import { ScreenTitle } from '@/components/ScreenTitle';
import { useT } from '@/lib/i18n';

export default function CommunitiesPage() {
  const { session } = useSession();
  const { t } = useT();
  const { data, error, loading } = useApiData<Community[]>('/communities');
  // Локальная копия нужна ради только что созданного сообщества: оно должно
  // появиться в списке сразу, не дожидаясь перезапроса.
  const [created, setCreated] = useState<Community[]>([]);
  const communities = useMemo(() => [...created, ...(data ?? [])], [created, data]);
  const [query, setQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Тема, правила и режим доступа колонок в базе пока не имеют — на бэкенд
  // они не уходят. Поля стоят здесь, чтобы форма была полной сразу, а не
  // переделывалась после миграции.
  const [topic, setTopic] = useState('');
  const [rules, setRules] = useState('');
  const [access, setAccess] = useState<'open' | 'closed'>('open');
  const [whoPosts, setWhoPosts] = useState<'all' | 'picked'>('all');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      setCreated((prev) => [community, ...prev]);
      // Сбрасываем кеш списка, иначе при следующем заходе новое сообщество
      // пропадёт: отрисуется закешированный ответ без него.
      invalidate('/communities');
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
          <ScreenTitle>{t('communities.title')}</ScreenTitle>
          {session && (
            // Один «плюс» вместо надписи: действие очевидно из иконки, а
            // текстовая кнопка перетягивала вес с заголовка экрана.
            <button
              onClick={() => setShowForm(true)}
              aria-label={t('communities.submit')}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
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
            className="field-line w-full py-2.5 pl-9 pr-2 text-[15px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
          />
        </div>

        {/* Создание — шторкой снизу, тем же жестом, что и комментарии.
            Раскрывающаяся посреди списка форма сдвигала сообщества вниз, и
            после отправки взгляд терял место, где он был. */}
        <BottomSheet
          open={showForm}
          onClose={() => setShowForm(false)}
          title={t('communities.submit')}
          height="86vh"
          footer={
            <button
              type="submit"
              form="create-community"
              disabled={submitting || !name.trim()}
              className="rounded-full bg-[var(--accent)] py-3 text-[15px] font-medium text-[var(--accent-contrast)] transition-opacity disabled:opacity-40"
            >
              {t('communities.submit')}
            </button>
          }
        >
          <form id="create-community" onSubmit={handleCreate} className="flex flex-col gap-4 py-3">
            {/* Аватар сообщества считается из названия — показываем сразу,
                чтобы было видно, как оно будет выглядеть в списке. */}
            <div className="flex items-center gap-3">
              <CommunityAvatar name={name || '?'} size={56} />
              <input
                placeholder={t('communities.name')}
                required
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-[var(--text-muted)]">{t('communities.description')}</span>
              <textarea
                rows={3}
                maxLength={200}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-[var(--text-muted)]">{t('communities.topic')}</span>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t('communities.topicHint')}
                className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-[var(--text-muted)]">{t('communities.rules')}</span>
              <textarea
                rows={3}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder={t('communities.rulesHint')}
                className="resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-[var(--text-muted)]">{t('communities.whoPosts')}</span>
              <div className="flex gap-1 rounded-full border border-[var(--border)] p-1">
                {(
                  [
                    ['all', t('communities.whoPostsAll')],
                    ['picked', t('communities.whoPostsPicked')],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setWhoPosts(value)}
                    className="flex-1 rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors"
                    style={
                      whoPosts === value
                        ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                        : { color: 'var(--text-muted)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] text-[var(--text-muted)]">{t('communities.access')}</span>
              <div className="flex gap-1 rounded-full border border-[var(--border)] p-1">
                {(
                  [
                    ['open', t('communities.accessOpen')],
                    ['closed', t('communities.accessClosed')],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAccess(value)}
                    className="flex-1 rounded-full px-3 py-1.5 text-[13.5px] font-medium transition-colors"
                    style={
                      access === value
                        ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                        : { color: 'var(--text-muted)' }
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              {t('communities.extraLocalOnly')}
            </p>

            {formError && <p className="text-sm" style={{ color: 'var(--down)' }}>{formError}</p>}
          </form>
        </BottomSheet>

        {loading && <p className="px-2 text-[var(--text-muted)]">{t('common.loading')}</p>}
        {error && <p className="px-2" style={{ color: 'var(--down)' }}>{error}</p>}

        {/* Каждое сообщество — отдельная белая карточка на приглушённом холсте,
            тем же приёмом, что и блоки профиля. */}
        {visible.map((community) => (
          <Link
            key={community.id}
            href={`/c/${community.id}`}
            className="glass glass-sheen relative flex min-h-[104px] items-center overflow-hidden rounded-2xl transition-transform active:scale-[0.99]"
          >
            {/* Аватар во всю высоту карточки у правого края и растворяется
                маской к середине: получается не иконка рядом с текстом, а фон,
                из которого текст выходит. */}
            <span className="community-card-art" aria-hidden>
              <CommunityAvatar name={community.name} size={220} />
            </span>

            <div className="relative z-10 flex min-w-0 flex-1 flex-col gap-1 p-4 pr-[45%]">
              <h2 className="truncate text-[16px] font-semibold text-[var(--text)]">
                {community.name}
              </h2>
              {community.description && (
                <p className="line-clamp-2 text-[13.5px] leading-snug text-[var(--text-muted)]">
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
