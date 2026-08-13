'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { Post, UserProfile } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { FollowButton } from '@/components/FollowButton';
import { PeopleSheet } from '@/components/PeopleSheet';
import { useT } from '@/lib/i18n';

/** Одна метрика в строке под аватаром. Тот же вид, что и в своём профиле. */
function Stat({ value, label, onClick }: { value: number; label: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="font-num text-[19px] font-semibold leading-none text-[var(--text)]">
        {value}
      </span>
      <span className="max-w-full truncate text-[11.5px] leading-tight text-[var(--text-muted)]">
        {label}
      </span>
    </>
  );

  const shape = 'flex min-w-0 flex-1 flex-col items-center gap-0.5';

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`${shape} rounded-xl py-1 transition-transform active:scale-95`}
    >
      {body}
    </button>
  ) : (
    <div className={`${shape} py-1`}>{body}</div>
  );
}

/**
 * Чужой профиль. Свой живёт на /profile и умеет больше — редактирование,
 * настройки, вкладки. Здесь только то, что показывают постороннему: кто это,
 * сколько написал и кнопка подписки.
 */
export default function UserProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { session } = useSession();
  const { t } = useT();

  const [peopleTab, setPeopleTab] = useState<'followers' | 'following' | null>(null);

  const postsResult = useApiData<Post[]>(`/posts/user/${userId}?sort=new`);
  // Раньше профиль искали в общем списке людей: тот отдаёт всего 30 человек по
  // карме, и у кого угодно за его пределами шапка оставалась пустой.
  const person = useApiData<UserProfile>(`/users/${userId}`).data;

  const posts = useMemo(() => postsResult.data ?? [], [postsResult.data]);

  // Имя есть и в постах — берём оттуда, если список людей ещё не пришёл.
  const username = person?.username ?? posts[0]?.author.username ?? '';
  const isMe = session?.user.id === userId;
  const influence = useMemo(() => posts.reduce((sum, post) => sum + post.score, 0), [posts]);

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-10">
        {/* Та же карточка, что и в своём профиле: обложка, растворяющаяся в
            стекло, аватар на ней и строка метрик. Отличие одно — вместо
            «Редактировать» здесь кнопка подписки. */}
        <section className="glass relative z-20 rounded-2xl">
          <div className="profile-cover -mb-9 h-[168px] rounded-t-2xl" />

          <div className="flex flex-col gap-3 px-4 pb-5 sm:px-5">
            <div className="-mt-12 flex items-end gap-3 sm:gap-5">
              <div
                className="relative z-10 flex-none rounded-full"
                style={{ background: 'var(--surface)', padding: 3 }}
              >
                <ProfileAvatar name={username || '?'} size={88} />
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <h1 className="text-[17px] font-semibold leading-tight text-[var(--text)]">
                {username || '—'}
              </h1>
              <span className="text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
                @{username}
              </span>
            </div>

            {/* Метрики отдельной строкой во всю ширину — как в своём профиле. */}
            <div className="flex items-start gap-1 border-y border-[var(--border)] py-1.5">
              <Stat value={posts.length} label={t('profile.stat.posts')} />
              <Stat
                value={person?.followers ?? 0}
                label={t('profile.stat.followers')}
                onClick={() => setPeopleTab('followers')}
              />
              <Stat
                value={person?.following ?? 0}
                label={t('profile.stat.following')}
                onClick={() => setPeopleTab('following')}
              />
              <Stat value={person?.karma ?? influence} label={t('profile.stat.influence')} />
            </div>

            {!isMe && (
              <FollowButton
                userId={userId}
                initiallyFollowing={person?.isFollowing}
                className="w-full max-w-none"
              />
            )}
          </div>
        </section>

        {postsResult.loading && (
          <p className="px-2 text-[var(--text-muted)]">{t('common.loading')}</p>
        )}

        <div className="glass flex flex-col divide-y divide-[var(--border)] rounded-2xl px-4">
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

      <PeopleSheet
        open={peopleTab !== null}
        onClose={() => setPeopleTab(null)}
        title={peopleTab === 'following' ? t('people.following') : t('people.followers')}
        endpoint={peopleTab ? `/users/${userId}/${peopleTab}` : null}
        emptyText={
          peopleTab === 'following' ? t('people.emptyFollowing') : t('people.emptyFollowers')
        }
      />
    </div>
  );
}
