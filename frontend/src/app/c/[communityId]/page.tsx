'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { Community, Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { useT } from '@/lib/i18n';

/**
 * Страница сообщества.
 *
 * Раньше здесь открывалась обычная лента со сториз и полем «Что нового» —
 * то есть главный экран, только с другими постами. О самом сообществе не было
 * ни слова: ни названия, ни описания, ни аватара. Теперь сверху шапка
 * сообщества, а ниже — то, что в нём написано.
 */
export default function CommunityPage() {
  const { communityId } = useParams<{ communityId: string }>();
  const router = useRouter();
  const { session } = useSession();
  const { t } = useT();

  // Список сообществ почти всегда уже в кеше — шапка появляется мгновенно.
  const communitiesResult = useApiData<Community[]>('/communities');
  const postsResult = useApiData<Post[]>(`/posts/community/${communityId}?sort=hot`);

  const community = useMemo(
    () => communitiesResult.data?.find((c) => c.id === communityId),
    [communitiesResult.data, communityId]
  );
  const posts = useMemo(() => postsResult.data ?? [], [postsResult.data]);

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

        {/* Шапка сообщества: крупный аватар, название, описание и счётчик
            записей. Это первое, что должно быть видно при заходе. */}
        <section className="glass flex flex-col gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <CommunityAvatar name={community?.name ?? '?'} size={64} />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <h1 className="truncate text-[19px] font-semibold text-[var(--text)]">
                {community?.name ?? '—'}
              </h1>
              <span className="text-[13px] text-[var(--text-muted)]">
                <span className="font-num">{posts.length}</span> {t('community.posts')}
              </span>
            </div>
          </div>

          {community?.description && (
            <p className="text-[14px] leading-relaxed text-[var(--text)]">
              {community.description}
            </p>
          )}
        </section>

        {postsResult.loading && (
          <p className="px-2 text-[var(--text-muted)]">{t('common.loading')}</p>
        )}
        {postsResult.error && (
          <p className="px-2" style={{ color: 'var(--down)' }}>{postsResult.error}</p>
        )}

        <div className="glass flex flex-col divide-y divide-[var(--border)] rounded-2xl px-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              canFollow={post.author.id !== session?.user.id}
            />
          ))}
          {!postsResult.loading && posts.length === 0 && (
            <p className="py-12 text-center text-[var(--text-muted)]">
              {t('community.empty')}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
