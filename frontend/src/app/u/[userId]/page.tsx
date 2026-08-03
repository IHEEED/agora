'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { Post, UserSummary } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { FollowButton } from '@/components/FollowButton';
import { useT } from '@/lib/i18n';

/**
 * Чужой профиль. Свой живёт на /profile и умеет больше — редактирование,
 * настройки, вкладки. Здесь только то, что показывают постороннему: кто это,
 * сколько написал и кнопка подписки.
 */
export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { session } = useSession();
  const { t } = useT();

  const postsResult = useApiData<Post[]>(`/posts/user/${userId}?sort=new`);
  const peopleResult = useApiData<UserSummary[]>('/users');

  const posts = useMemo(() => postsResult.data ?? [], [postsResult.data]);
  const person = useMemo(
    () => peopleResult.data?.find((user) => user.id === userId),
    [peopleResult.data, userId]
  );

  // Имя есть и в постах — берём оттуда, если список людей ещё не пришёл.
  const username = person?.username ?? posts[0]?.author.username ?? '';
  const isMe = session?.user.id === userId;
  const influence = useMemo(() => posts.reduce((sum, post) => sum + post.score, 0), [posts]);

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-10">
        <section className="glass flex flex-col gap-4 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <ProfileAvatar name={username || '?'} size={76} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-[17px] font-semibold text-[var(--text)]">
                {username || '—'}
              </span>
              <span className="text-[13px] text-[var(--text-muted)]">
                <span className="font-num">{posts.length}</span> {t('profile.stat.posts')}
                {' · '}
                <span className="font-num">{person?.karma ?? influence}</span>{' '}
                {t('profile.stat.influence')}
              </span>
            </div>
            {!isMe && (
              <FollowButton userId={userId} initiallyFollowing={person?.isFollowing} />
            )}
          </div>
        </section>

        {postsResult.loading && <p className="text-[var(--text-muted)]">{t('common.loading')}</p>}

        <div className="flex flex-col divide-y divide-[var(--border)]">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {!postsResult.loading && posts.length === 0 && (
            <p className="py-12 text-center text-[var(--text-muted)]">
              {t('profile.emptyPosts')}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
