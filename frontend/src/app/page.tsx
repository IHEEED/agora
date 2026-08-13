'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { StoriesBar } from '@/components/StoriesBar';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { SuggestedPeople } from '@/components/SuggestedPeople';
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

  // Истории собираем из авторов ленты — своего механизма у них пока нет.
  const storyUsernames = useMemo(
    () => Array.from(new Set(posts.map((p) => p.author.username))),
    [posts]
  );

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-8">
        <StoriesBar
          usernames={storyUsernames}
          currentUserLetter={session?.user.email?.[0]?.toUpperCase()}
        />

        <Link
          href="/create"
          // Строка, а не плашка: скруглённая обойма читалась кнопкой,
          // а не местом, куда пишут.
          className="field-line mt-3 flex items-center gap-3 px-1 py-3 text-left"
        >
          <DefaultAvatar name={(session?.user.email ?? '?').split('@')[0]} size={32} />
          <span className="text-[15px] text-[var(--text-muted)]">{t('feed.whatsNew')}</span>
        </Link>

        {loading && <p className="text-[var(--text-muted)]">{t('common.loading')}</p>}
        {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

        {/* Лента — сплошной список, разделённый полосками, а не набор плиток.
            Отдельные карточки дробили экран на прямоугольники и съедали ширину
            под поля; полоска отделяет ровно настолько, насколько нужно. */}
        <SuggestedPeople storageKey="parafraz-suggest-feed" />

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              // Подписаться можно на кого угодно, кроме себя.
              canFollow={post.author.id !== session?.user.id}
            />
          ))}
          {!loading && !error && posts.length === 0 && (
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
