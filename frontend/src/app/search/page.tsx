'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import { Community, Post, UserSummary } from '@/lib/types';
import { formatRelativeDate } from '@/lib/formatDate';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { FollowButton } from '@/components/FollowButton';
import { SuggestedPeople } from '@/components/SuggestedPeople';
import { ScreenTitle } from '@/components/ScreenTitle';
import { TranslationKey, useT } from '@/lib/i18n';

type Scope = 'all' | 'people' | 'posts' | 'communities';

const HISTORY_KEY = 'parafraz-search-history';

const SCOPES: ReadonlyArray<readonly [Scope, TranslationKey]> = [
  ['all', 'search.all'],
  ['people', 'search.people'],
  ['posts', 'search.posts'],
  ['communities', 'search.communities'],
];

export default function SearchPage() {
  const router = useRouter();
  const { t } = useT();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');

  // История запросов живёт на устройстве: серверу она не нужна, а человеку
  // удобно вернуться к тому, что искал вчера.
  const [removing, setRemoving] = useState<string | null>(null);
  // Версия-счётчик заставляет перечитать хранилище после правки списка.
  const [historyVersion, setHistoryVersion] = useState(0);

  const history = useMemo<string[]>(() => {
    void historyVersion;
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]');
    } catch {
      // Повреждённая запись — просто начинаем с пустой истории.
      return [];
    }
  }, [historyVersion]);

  function writeHistory(next: string[]) {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistoryVersion((v) => v + 1);
  }

  function remember(value: string) {
    const item = value.trim();
    if (item.length < 2) return;
    writeHistory([item, ...history.filter((x) => x !== item)].slice(0, 8));
  }

  function removeFromHistory(item: string) {
    // Сначала схлопываем строку, и только потом убираем её из списка —
    // иначе анимации нечего проигрывать, узел исчезает мгновенно.
    setRemoving(item);
    window.setTimeout(() => {
      writeHistory(history.filter((x) => x !== item));
      setRemoving(null);
    }, 240);
  }

  // Через общий кеш: три этих ответа уже есть после ленты и сообществ,
  // поэтому поиск открывается с готовыми данными, а не с «Загрузка…».
  const communitiesResult = useApiData<Community[]>('/communities');
  const postsResult = useApiData<Post[]>('/posts?sort=new');
  const peopleResult = useApiData<UserSummary[]>('/users');

  const communities = useMemo(() => communitiesResult.data ?? [], [communitiesResult.data]);
  const posts = useMemo(() => postsResult.data ?? [], [postsResult.data]);
  const people = useMemo(() => peopleResult.data ?? [], [peopleResult.data]);
  const loading = communitiesResult.loading || postsResult.loading || peopleResult.loading;
  const error = communitiesResult.error ?? postsResult.error ?? peopleResult.error;

  useEffect(() => {
    // Фокус ставим вручную: на телефоне именно это поднимает клавиатуру.
    inputRef.current?.focus();
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
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-8">
        {/* Крупный заголовок со стрелкой назад — как в системных экранах
            поиска: понятно, куда попал и как выйти, без охоты за крестиком. */}
        <div className="flex items-center gap-2 px-0.5">
          <button
            onClick={() => router.back()}
            aria-label={t('common.back')}
            className="-ml-2 flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <ScreenTitle>{t('nav.search')}</ScreenTitle>
        </div>

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
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // В историю пишем по «Найти» и по уходу из поля — не на каждое
              // нажатие, иначе туда попадут все промежуточные обрывки слова.
              onBlur={() => remember(query)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') remember(query);
              }}
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-2.5 pl-11 pr-4 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>

          {/* Крестика здесь больше нет: экран закрывает кнопка в шапке,
              которая на поиске сама превращается в крестик. */}
        </div>

        {/* Во всю ширину, а не по центру: узкая обойма стояла в отрыве и от
            поля поиска, и от крестика — их края теперь совпадают. */}
        <div className="flex w-full gap-1 rounded-full border border-[var(--border)] p-1">
          {SCOPES.map(([value, labelKey]) => (
            <button
              key={value}
              onClick={() => setScope(value)}
              className="flex-1 whitespace-nowrap rounded-full px-2 py-1.5 text-center text-[13px] font-medium transition-colors"
              style={
                scope === value
                  ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                  : { color: 'var(--text-muted)' }
              }
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        {loading && <p className="text-[var(--text-muted)]">{t('common.loading')}</p>}
        {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

        {/* Пока запроса нет, экран не должен быть пустым: показываем, кого
            почитать — это и есть самый частый сценарий захода в поиск. */}
        {!normalized && (
          <>
            {history.length > 0 && (
              <section className="flex flex-col">
                <h2 className="px-0.5 pb-1 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {t('search.history')}
                </h2>
                {history.map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 overflow-hidden"
                    style={{
                      // Строка схлопывается по высоте, а не исчезает рывком.
                      maxHeight: removing === item ? 0 : 48,
                      opacity: removing === item ? 0 : 1,
                      transition: 'max-height 0.24s cubic-bezier(0.32,0.72,0,1), opacity 0.18s ease',
                    }}
                  >
                    <button
                      onClick={() => setQuery(item)}
                      className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 text-left"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      <span className="truncate text-[15px] text-[var(--text)]">{item}</span>
                    </button>
                    <button
                      onClick={() => removeFromHistory(item)}
                      aria-label={t('search.historyRemove')}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </section>
            )}

            <SuggestedPeople storageKey="parafraz-suggest-search" />
          </>
        )}

        {showPeople && (
          <section className="flex flex-col">
            <h2 className="py-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t('search.people')}
            </h2>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {foundPeople.map((person) => (
                <div key={person.id} className="flex items-center gap-3 py-3">
                  <DefaultAvatar name={person.username} size={40} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-[var(--text)]">{person.username}</span>
                    <span className="text-[12px] text-[var(--text-muted)]">
                      <span className="font-num">{person.karma}</span> influence
                    </span>
                  </div>
                  <FollowButton userId={person.id} initiallyFollowing={person.isFollowing} />
                </div>
              ))}
            </div>
          </section>
        )}

        {showCommunities && (
          <section className="flex flex-col">
            <h2 className="py-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {t('search.communities')}
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
              {t('search.posts')}
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
