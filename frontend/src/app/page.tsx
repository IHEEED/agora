'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { invalidate, load, useApiData } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { Post, PostSort, StoryGroup } from '@/lib/types';
import { SegmentedControl } from '@/components/SegmentedControl';
import { PostCard } from '@/components/PostCard';
import { StoriesBar } from '@/components/StoriesBar';

import { DefaultAvatar } from '@/components/DefaultAvatar';
import { SuggestedPeople } from '@/components/SuggestedPeople';
import { useBlockedUsers } from '@/lib/blockedUsers';
import { useHiddenStorytellers } from '@/lib/hiddenStories';
import { SkeletonList, SkeletonPost } from '@/components/Skeleton';
import { OverlayLink } from '@/components/OverlayLink';
import { useT } from '@/lib/i18n';
import { PullToRefresh } from '@/components/PullToRefresh';

/**
 * Чем лента отсортирована.
 *
 * Три способа вместо одного «горячего». Горячее — это формула с затуханием по
 * времени, и понять по ней, почему запись стоит именно здесь, нельзя даже
 * автору. Три оставшихся объяснимы одним словом каждый, и человек выбирает
 * сам, что ему сейчас нужно: разговор, охват или новизна.
 *
 * «Свежие» первыми и по умолчанию: в сети такого размера остальные две
 * сортировки становятся осмысленными только на объёме, а порядок «что нового»
 * работает с первого дня.
 */
const SORTS = [
  ['new', 'Свежие'],
  ['commented', 'Обсуждаемые'],
  ['viewed', 'Популярные'],
] as const satisfies ReadonlyArray<readonly [PostSort, string]>;

export default function FeedPage() {
  const { session } = useSession();
  const { t } = useT();
  const [sort, setSort] = useState<PostSort>('new');
  // Данные берём из кеша: возврат в ленту рисует её мгновенно, а свежий
  // запрос уходит фоном. Раньше каждый заход начинался с пустого экрана.
  // Ключ кеша включает сортировку: три порядка — три разных списка, и общий
  // ключ показывал бы прежний, пока не приедет новый ответ.
  const { data, error, loading } = useApiData<Post[]>(`/posts?sort=${sort}`);
  // Через useMemo, а не через ?? прямо в теле: иначе каждый рендер создаёт
  // новый пустой массив и пересчитывает список историй ниже без причины.
  const posts = useMemo(() => data ?? [], [data]);

  // Записи заблокированных не показываем. Фильтруем здесь, а не на сервере:
  // список живёт на устройстве, сервер о нём не знает (см. blockedUsers).
  const blocked = useBlockedUsers();
  const visiblePosts = useMemo(
    () => posts.filter((post) => !post.author.id || !blocked.includes(post.author.id)),
    [posts, blocked]
  );

  // Истории приходят с сервера отдельной сущностью, а не собираются из записей.
  // Заглушка «последние записи автора» врала: история живёт сутки и не
  // обсуждается, запись остаётся навсегда и обсуждается — выдать одно за другое
  // нельзя, не сломав ожидания от обоих (см. миграцию 011).
  //
  // Заблокированных отсеиваем здесь же: список живёт на устройстве, сервер о
  // нём не знает.
  const storyGroups = useApiData<StoryGroup[]>('/stories').data;
  // Плюс те, чьи истории человек скрыл: это настройка своего экрана, а не
  // отношение к автору — его записи в ленте остаются (см. hiddenStories).
  const hiddenStories = useHiddenStorytellers();
  const stories = useMemo(
    () =>
      (storyGroups ?? []).filter(
        (group) => !blocked.includes(group.author.id) && !hiddenStories.includes(group.author.id)
      ),
    [storyGroups, blocked, hiddenStories]
  );

  /**
   * Перечитать ленту и истории.
   *
   * Сбрасываем кеш и ждём, пока данные приедут заново: натяжение снимается по
   * этому обещанию, и без ожидания оно снялось бы мгновенно — то есть человек
   * отпустил бы и увидел, что ничего не произошло.
   */
  async function refresh() {
    invalidate('/posts');
    invalidate('/stories');
    await load(`/posts?sort=${sort}`);
  }

  return (
    <PullToRefresh onRefresh={refresh}>
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-8">
        <StoriesBar
          stories={stories}
          currentUserLetter={session?.user.email?.[0]?.toUpperCase()}
        />

        <OverlayLink
          href="/create"
          // Строка, а не плашка: скруглённая обойма читалась кнопкой,
          // а не местом, куда пишут. Отрицательные поля выводят черту за
          // поля колонки — она идёт от края до края, а не обрубается
          // на ширине текста.
          className="field-line -mx-4 mt-3 flex items-center gap-3 px-5 py-3 text-left"
        >
          <DefaultAvatar name={(session?.user.email ?? '?').split('@')[0]} size={32} />
          <span className="text-[15px] text-[var(--text-muted)]">{t('feed.whatsNew')}</span>
        </OverlayLink>

        {/* Переключатель под строкой ввода, а не над историями: истории —
            отдельный жанр, они не сортируются вместе с лентой, и полоса выбора
            над ними читалась бы как выбор для них. */}
        <SegmentedControl
          value={sort}
          options={SORTS}
          onChange={setSort}
          className="mt-1"
        />

        {/* Заглушки по геометрии настоящих карточек: подмена не двигает
            раскладку, и анимация появления не проигрывается на прыгающем
            экране. Именно это и выглядело рвано. */}
        {loading && (
          <div className="feed-list flex flex-col">
            <SkeletonList count={3}>
              <SkeletonPost />
            </SkeletonList>
          </div>
        )}
        {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

        {/* Лента — сплошной список, разделённый полосками, а не набор плиток.
            Отдельные карточки дробили экран на прямоугольники и съедали ширину
            под поля; полоска отделяет ровно настолько, насколько нужно. */}
        <SuggestedPeople />

        <div className="feed-list flex flex-col">
          {visiblePosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              // Подписаться можно на кого угодно, кроме себя.
              canFollow={post.author.id !== session?.user.id}
            />
          ))}
          {!loading && !error && visiblePosts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-[var(--text-muted)]">{t('feed.empty')}</p>
              <Link
                href="/communities"
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--accent-contrast)]"
              >
                {t('feed.findCommunities')}
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
    </PullToRefresh>
  );
}
