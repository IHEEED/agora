'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { StoriesBar } from '@/components/StoriesBar';
import { storiesFrom } from '@/components/StoryViewer';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { SuggestedPeople } from '@/components/SuggestedPeople';
import { useBlockedUsers } from '@/lib/blockedUsers';
import { SkeletonList, SkeletonPost } from '@/components/Skeleton';
import { OverlayLink } from '@/components/OverlayLink';
import { useT } from '@/lib/i18n';

export default function FeedPage() {
  const { session } = useSession();
  const { t } = useT();
  // Данные берём из кеша: возврат в ленту рисует её мгновенно, а свежий
  // запрос уходит фоном. Раньше каждый заход начинался с пустого экрана.
  const { data, error, loading } = useApiData<Post[]>('/posts?sort=hot');
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

  // Истории собираем из записей ленты — своей таблицы у них пока нет.
  // Из отфильтрованных: заблокированный не должен остаться кружком наверху.
  // Кадром становится запись целиком: заголовок, начало текста, счётчики, а
  // картинка — фоном под ними, если она есть (см. StoryViewer).
  const stories = useMemo(() => storiesFrom(visiblePosts), [visiblePosts]);

  return (
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
  );
}
