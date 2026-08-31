'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { invalidate, useApiData } from '@/lib/useApiData';
import { apiFetch } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/useSession';
import { Community, Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { BottomSheet } from '@/components/BottomSheet';
import { CommunityAvatar, communityPalette } from '@/components/CommunityAvatar';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { FollowButton } from '@/components/FollowButton';
import { useScreenLeave } from '@/lib/useScreenLeave';
import { OverlayLink } from '@/components/OverlayLink';
import { useT } from '@/lib/i18n';
import { BackButton } from '@/components/BackButton';

/**
 * Страница сообщества, устроенная как профиль человека: обложка, аватар на
 * ней, справка о сообществе и его стена.
 *
 * До этого здесь была скромная плитка с названием — сообщество выглядело
 * подписью к ленте, а не местом, куда приходят. У ВКонтакте и Reddit группа
 * подана ровно как профиль, и это правильно: снаружи она такой же субъект,
 * у неё есть лицо, описание и люди.
 *
 * Вкладок нет: читают здесь одно — стену. Участники и справка живут в шторке,
 * которую открывают раз, а место три таблетки занимали всегда.
 *
 * Обложка красится в цвет сообщества, а не в общий акцент: иначе все
 * сообщества выглядят одинаково и различаются только названием.
 */
export default function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const { session } = useSession();
  const { t } = useT();
  const [aboutOpen, setAboutOpen] = useState(false);
  // Уход вправо и свайп от кромки — как на остальных вложенных экранах.
  const { goBack, style: leaveStyle, swipeHandlers } = useScreenLeave();

  // Список сообществ почти всегда уже в кеше — шапка появляется мгновенно.
  const communitiesResult = useApiData<Community[]>('/communities');
  const postsResult = useApiData<Post[]>(`/posts/community/${communityId}?sort=hot`);

  const community = useMemo(
    () => communitiesResult.data?.find((c) => c.id === communityId),
    [communitiesResult.data, communityId]
  );
  const posts = useMemo(() => postsResult.data ?? [], [postsResult.data]);

  /**
   * Подписка на клуб.
   *
   * Держим своё состояние поверх серверного: показать результат нажатия надо
   * сразу, а список клубов перечитается фоном. Пока он не приехал, правду
   * знает только эта переменная.
   */
  const [joinedLocal, setJoinedLocal] = useState<boolean | null>(null);
  const joined = joinedLocal ?? community?.isMember ?? false;
  const [joining, setJoining] = useState(false);

  async function toggleJoin() {
    if (joining) return;
    haptic();
    const next = !joined;
    setJoinedLocal(next);
    setJoining(true);

    try {
      await apiFetch(`/communities/${communityId}/join`, {
        method: next ? 'POST' : 'DELETE',
      });
      invalidate('/communities');
    } catch {
      // Не получилось — возвращаем кнопку как была, а не оставляем её
      // показывать несуществующую подписку.
      setJoinedLocal(!next);
    } finally {
      setJoining(false);
    }
  }

  // Участников как таблицы нет, и выдумывать число нельзя. Считаем тех, кто
  // здесь писал: это честная величина и ровно та, что человеку интересна —
  // кто в сообществе живёт.
  const people = useMemo(() => {
    const seen = new Map<
      string,
      { id: string; username: string; posts: number; isFollowing?: boolean; avatar_url?: string | null }
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

  const [from, to] = communityPalette(community?.name ?? '?');

  const created = community?.created_at
    ? new Date(community.created_at).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="flex flex-1 flex-col items-center" style={leaveStyle} {...swipeHandlers}>
      <main className="below-header flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-10">
        <BackButton onClick={goBack} />

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

            {/* Подписка. Кнопка меняет вид, а не только подпись: «Вы подписаны»
                акцентной заливкой читалось бы призывом нажать ещё раз. */}
            <button
              type="button"
              onClick={toggleJoin}
              className="rounded-full py-2.5 text-[14px] font-medium transition-opacity active:opacity-80"
              style={
                joined
                  ? { background: 'var(--surface-2)', color: 'var(--text)' }
                  : { background: 'var(--accent)', color: 'var(--accent-contrast)' }
              }
            >
              {joined ? 'Вы подписаны' : 'Подписаться'}
            </button>

            {/* Участники — единственная цифра, за которой есть список; она и
                открывает его. Остальное справкой в строку, без линий. */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                className="flex items-baseline gap-1.5 rounded-xl transition-transform active:scale-95"
              >
                <span className="font-num text-[16px] font-semibold text-[var(--text)]">
                  {people.length}
                </span>
                <span className="text-[13.5px] text-[var(--text-muted)]">
                  {t('community.stat.people')}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
              <span>
                <span className="font-num text-[var(--text)]">{posts.length}</span>{' '}
                {t('community.stat.posts')}
              </span>
              <span aria-hidden>·</span>
              <span>
                <span className="font-num text-[var(--text)]">{influence}</span>{' '}
                {t('community.stat.influence')}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Запись сразу от имени сообщества: сообщество уже выбрано тем,
                  что человек стоит на его странице, и спрашивать об этом на
                  следующем экране — переспрашивать очевидное. */}
              <OverlayLink
                href={`/create?community=${communityId}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-[14px] font-semibold transition-transform active:scale-[0.98]"
                style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {t('community.publish')}
              </OverlayLink>

              {/* Справка о сообществе — маленькой кнопкой, а не вкладкой во всю
                  ширину: её открывают один раз, а место она занимала всегда. */}
              <button
                type="button"
                onClick={() => setAboutOpen(true)}
                aria-label={t('community.tab.about')}
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full transition-transform active:scale-90"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5.5M12 7.6v.1" />
                </svg>
              </button>
            </div>
          </div>
        </section>

        {/* Вкладок нет: в сообществе всё, что читают, — это его стена.
            Участники и справка ушли в шторку, и вместо трёх таблеток осталось
            одно название раздела. */}
        <section className="glass rounded-2xl px-4 pb-2">
          <h2 className="px-1 py-3 text-[15px] font-semibold text-[var(--text)]">
            {t('community.wall')}
          </h2>

          {postsResult.loading && (
            <p className="py-6 text-[var(--text-muted)]">{t('common.loading')}</p>
          )}
          {postsResult.error && (
            <p className="py-6" style={{ color: 'var(--down)' }}>
              {postsResult.error}
            </p>
          )}

          <div className="flex flex-col">
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
        </section>
      </main>

      <BottomSheet
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title={t('community.tab.about')}
      >
        <div className="flex flex-col gap-5 py-2">
          <p className="text-[14.5px] leading-relaxed text-[var(--text)]">
            {community?.description || t('community.noDescription')}
          </p>

          <div className="flex flex-col gap-2.5 text-[13.5px]">
            {community?.creator && (
              <div className="flex items-center gap-2">
                <span className="text-[var(--text-muted)]">{t('community.founder')}</span>
                <Link
                  href={`/u/${community.creator.id}`}
                  onClick={() => setAboutOpen(false)}
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

          <div className="flex flex-col gap-1">
            <h3 className="text-[14px] font-semibold text-[var(--text)]">
              {t('community.tab.people')}
            </h3>
            {people.map((person) => (
              <div key={person.id} className="flex items-center gap-3 py-2.5">
                <Link
                  href={`/u/${person.id}`}
                  onClick={() => setAboutOpen(false)}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <DefaultAvatar name={person.username} size={40} src={person.avatar_url} />
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
              <p className="py-6 text-[14px] text-[var(--text-muted)]">
                {t('community.emptyPeople')}
              </p>
            )}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
