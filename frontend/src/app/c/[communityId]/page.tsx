'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { Community, Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { CommunityAvatar, communityPalette } from '@/components/CommunityAvatar';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { FollowButton } from '@/components/FollowButton';
import { TranslationKey, useT } from '@/lib/i18n';

type Tab = 'posts' | 'people' | 'about';

const TABS: ReadonlyArray<readonly [Tab, TranslationKey]> = [
  ['posts', 'community.tab.posts'],
  ['people', 'community.tab.people'],
  ['about', 'community.tab.about'],
];

/** Метрика в строке под аватаром — тот же вид, что в профиле человека. */
function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-1">
      <span className="font-num text-[19px] font-semibold leading-none text-[var(--text)]">
        {value}
      </span>
      <span className="max-w-full truncate text-[11.5px] leading-tight text-[var(--text-muted)]">
        {label}
      </span>
    </div>
  );
}

/**
 * Страница сообщества, устроенная как профиль человека: обложка, аватар на
 * ней, строка метрик, описание и вкладки.
 *
 * До этого здесь была скромная плитка с названием — сообщество выглядело
 * подписью к ленте, а не местом, куда приходят. У ВКонтакте и Reddit группа
 * подана ровно как профиль, и это правильно: снаружи она такой же субъект,
 * у неё есть лицо, описание и люди.
 *
 * Обложка красится в цвет сообщества, а не в общий акцент: иначе все
 * сообщества выглядят одинаково и различаются только буквой на аватаре.
 */
export default function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('posts');

  // Список сообществ почти всегда уже в кеше — шапка появляется мгновенно.
  const communitiesResult = useApiData<Community[]>('/communities');
  const postsResult = useApiData<Post[]>(`/posts/community/${communityId}?sort=hot`);

  const community = useMemo(
    () => communitiesResult.data?.find((c) => c.id === communityId),
    [communitiesResult.data, communityId]
  );
  const posts = useMemo(() => postsResult.data ?? [], [postsResult.data]);

  // Участников как таблицы нет, и выдумывать число нельзя. Считаем тех, кто
  // здесь писал: это честная величина и ровно та, что человеку интересна —
  // кто в сообществе живёт.
  const people = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; username: string; posts: number; isFollowing?: boolean }
    >();
    for (const post of posts) {
      // Пост от имени сообщества автора не отдаёт — такие строки пропускаем,
      // иначе в участниках появится безымянная запись без ссылки.
      const id = post.author.id;
      if (!id) continue;
      const found = seen.get(id);
      if (found) {
        found.posts += 1;
        continue;
      }
      seen.set(id, {
        id,
        username: post.author.username,
        posts: 1,
        isFollowing: post.author.isFollowing,
      });
    }
    return [...seen.values()].sort((a, b) => b.posts - a.posts);
  }, [posts]);

  const influence = useMemo(() => posts.reduce((sum, post) => sum + post.score, 0), [posts]);

  const counts: Record<Tab, number | null> = {
    posts: posts.length,
    people: people.length,
    about: null,
  };

  const [from, to] = communityPalette(community?.name ?? '?');

  // Капля под активной вкладкой — как в профиле: ездит трансформацией,
  // поэтому переезд считает видеокарта.
  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [tabBlob, setTabBlob] = useState<{ x: number; width: number; height: number } | null>(null);
  const activeTabIndex = TABS.findIndex(([value]) => value === tab);

  useLayoutEffect(() => {
    function measure() {
      const element = tabRefs.current[activeTabIndex];
      if (!element) return;
      setTabBlob({
        x: element.offsetLeft,
        width: element.offsetWidth,
        height: element.offsetHeight,
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    if (tabsRef.current) observer.observe(tabsRef.current);
    return () => observer.disconnect();
    // Подписи вкладок несут счётчики — при их смене ширина меняется.
  }, [activeTabIndex, counts.posts, counts.people]);

  const created = community?.created_at
    ? new Date(community.created_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-10">
        <button
          onClick={() => router.back()}
          className="flex w-fit items-center gap-2 rounded-full px-2 py-1.5 text-[15px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {t('common.back')}
        </button>

        <section className="glass relative z-20 rounded-2xl">
          {/* Локальный --accent перекрывает акцент темы только внутри обложки:
              градиенты в .profile-cover читают именно эту переменную. */}
          <div
            className="profile-cover -mb-9 h-[168px] rounded-t-2xl"
            style={{ '--accent': from, '--accent-deep': to } as React.CSSProperties}
          />

          <div className="flex flex-col gap-3 px-4 pb-5 sm:px-5">
            <div className="-mt-12 flex items-end gap-3 sm:gap-5">
              <div
                className="relative z-10 flex-none rounded-[20px]"
                style={{ background: 'var(--surface)', padding: 3 }}
              >
                <CommunityAvatar name={community?.name ?? '?'} size={88} />
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <h1 className="text-[17px] font-semibold leading-tight text-[var(--text)]">
                {community?.name ?? '—'}
              </h1>
              <span className="text-[13px] font-medium" style={{ color: from }}>
                c/{community?.name?.toLowerCase().replace(/\s+/g, '') ?? ''}
              </span>
              {community?.description && (
                <p className="mt-1 text-[14px] leading-snug text-[var(--text)]">
                  {community.description}
                </p>
              )}
            </div>

            {/* Метрики во всю ширину — как в профиле человека: рядом с аватаром
                подписям не хватало места и они обрезались. */}
            <div className="flex items-start gap-1 border-y border-[var(--border)] py-1.5">
              <Stat value={posts.length} label={t('community.stat.posts')} />
              <Stat value={people.length} label={t('community.stat.people')} />
              <Stat value={influence} label={t('community.stat.influence')} />
            </div>

            <Link
              href="/create"
              className="w-full rounded-full border py-2 text-center text-[14px] font-medium transition-colors"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text)' }}
            >
              {t('community.write')}
            </Link>
          </div>
        </section>

        <section className="glass rounded-2xl px-4 pb-2">
          <div
            ref={tabsRef}
            className="relative flex items-center justify-between gap-1 border-b border-[var(--border)] px-1 py-2"
          >
            {tabBlob && (
              <span
                aria-hidden
                className="tab-blob"
                style={{
                  transform: `translate(${tabBlob.x}px, -50%)`,
                  width: tabBlob.width,
                  height: tabBlob.height,
                }}
              />
            )}

            {TABS.map(([value, labelKey], index) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                className="relative z-10 flex-1 whitespace-nowrap rounded-full px-2 py-2 text-center text-[13.5px] font-medium transition-colors"
                style={{ color: tab === value ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {t(labelKey)}
                {counts[value] !== null && <span className="font-num"> {counts[value]}</span>}
              </button>
            ))}
          </div>

          {postsResult.loading && (
            <p className="py-6 text-[var(--text-muted)]">{t('common.loading')}</p>
          )}
          {postsResult.error && (
            <p className="py-6" style={{ color: 'var(--down)' }}>
              {postsResult.error}
            </p>
          )}

          {tab === 'posts' && (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  canFollow={post.author.id !== session?.user.id}
                />
              ))}
              {!postsResult.loading && posts.length === 0 && (
                <p className="py-12 text-center text-[var(--text-muted)]">{t('community.empty')}</p>
              )}
            </div>
          )}

          {tab === 'people' && (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {people.map((person) => (
                <div key={person.id} className="flex items-center gap-3 py-3">
                  <Link href={`/u/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <DefaultAvatar name={person.username} size={44} />
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-[15px] font-medium text-[var(--text)]">
                        {person.username}
                      </span>
                      <span className="text-[12.5px] text-[var(--text-muted)]">
                        <span className="font-num">{person.posts}</span> {t('community.posts')}
                      </span>
                    </div>
                  </Link>
                  {person.id !== session?.user.id && (
                    <FollowButton userId={person.id} initiallyFollowing={person.isFollowing} />
                  )}
                </div>
              ))}
              {people.length === 0 && (
                <p className="py-12 text-center text-[var(--text-muted)]">
                  {t('community.emptyPeople')}
                </p>
              )}
            </div>
          )}

          {tab === 'about' && (
            <div className="flex flex-col gap-4 py-4">
              <p className="text-[14.5px] leading-relaxed text-[var(--text)]">
                {community?.description || t('community.noDescription')}
              </p>

              <div className="flex flex-col gap-2.5 text-[13.5px]">
                {community?.creator && (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">{t('community.founder')}</span>
                    <Link
                      href={`/u/${community.creator.id}`}
                      className="font-medium"
                      style={{ color: 'var(--accent)' }}
                    >
                      {community.creator.username}
                    </Link>
                  </div>
                )}
                {created && (
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--text-muted)]">{t('community.since')}</span>
                    <span className="text-[var(--text)]">{created}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
