'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApiData } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { CommentWithPost, Post, UserProfile } from '@/lib/types';
import { SegmentedControl } from '@/components/SegmentedControl';
import { formatCompactAge } from '@/lib/formatDate';
import { VoteBlock } from '@/components/VoteBlock';
import { PostCard } from '@/components/PostCard';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { FollowButton } from '@/components/FollowButton';
import { PeopleSheet } from '@/components/PeopleSheet';
import { PersonMenuSheet } from '@/components/PersonMenuSheet';
import { VerifiedMark } from '@/components/VerifiedMark';
import { setBlocked, useIsBlocked } from '@/lib/blockedUsers';
import { useScreenLeave } from '@/lib/useScreenLeave';
import { useStickyTab } from '@/lib/useStickyTab';
import { useT } from '@/lib/i18n';
import { BackButton } from '@/components/BackButton';

type Tab = 'posts' | 'comments' | 'reposts';

/** Счётчик людей — строкой. Тот же вид, что и в своём профиле. */
function PeopleStat({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-baseline gap-1.5 rounded-xl transition-transform active:scale-95"
    >
      <span className="font-num text-[16px] font-semibold text-[var(--text)]">{value}</span>
      <span className="text-[13.5px] text-[var(--text-muted)]">{label}</span>
    </button>
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
  // Своя вкладка на каждый профиль: возврат должен вернуть туда, где стоял.
  const [tab, setTab] = useStickyTab<Tab>(`u:${userId}`, 'posts');
  const [menuOpen, setMenuOpen] = useState(false);
  const blocked = useIsBlocked(userId);
  // Уход вправо — тем же движением, каким экран приехал слева.
  const { goBack, style: leaveStyle, swipeHandlers } = useScreenLeave();

  const postsResult = useApiData<Post[]>(`/posts/user/${userId}?sort=new`);
  // Комментарии и репосты подтягиваем только когда на них перешли: в чужой
  // профиль чаще заходят посмотреть записи, и тянуть остальное наперёд —
  // два лишних запроса на каждое открытие.
  const commentsResult = useApiData<CommentWithPost[]>(
    tab === 'comments' ? `/comments/user/${userId}` : null
  );
  const repostsResult = useApiData<Post[]>(tab === 'reposts' ? `/posts/reposts/${userId}` : null);
  // Раньше профиль искали в общем списке людей: тот отдаёт всего 30 человек по
  // карме, и у кого угодно за его пределами шапка оставалась пустой.
  const person = useApiData<UserProfile>(`/users/${userId}`).data;

  const posts = useMemo(() => postsResult.data ?? [], [postsResult.data]);
  const comments = useMemo(() => commentsResult.data ?? [], [commentsResult.data]);
  const reposts = useMemo(() => repostsResult.data ?? [], [repostsResult.data]);

  // Имя есть и в постах — берём оттуда, если список людей ещё не пришёл.
  const username = person?.username ?? posts[0]?.author.username ?? '';
  const isMe = session?.user.id === userId;
  const influence = useMemo(() => posts.reduce((sum, post) => sum + post.score, 0), [posts]);

  // Галочку здесь только показываем. Выдают её на своём экране: Настройки →
  // Модерация → Подтверждение личности. Кнопка в чужом профиле смешивала два
  // разных занятия — смотреть на человека и управлять им.
  const verified = person?.verified_at ?? null;

  return (
    <div className="flex flex-1 flex-col items-center" style={leaveStyle} {...swipeHandlers}>
      <main className="below-header flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-10">
        {/* Выход из чужого профиля. Крестика в шапке здесь нет — она показывает
            лупу, — и вернуться было нечем, кроме системного жеста.
            Три точки справа: всё, что делают с человеком и что не заслуживает
            своей кнопки в карточке. */}
        <div className="flex items-center justify-between">
          <BackButton onClick={goBack} />

          {!isMe && (
            <button
              onClick={() => setMenuOpen(true)}
              aria-label="Действия"
              className="-mr-1 flex h-10 w-10 flex-none items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--control)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          )}
        </div>

        {/* Заблокированного не прячем целиком: человек пришёл сюда сам, по
            ссылке или из поиска, и пустой экран вместо профиля выглядел бы
            поломкой. Достаточно сказать, что записи скрыты, и дать снять. */}
        {blocked && (
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'var(--surface-2)' }}
          >
            <span className="min-w-0 flex-1 text-[13.5px] leading-snug text-[var(--text-muted)]">
              Вы заблокировали этого человека. Его записи скрыты на этом устройстве.
            </span>
            <button
              onClick={() => setBlocked(userId, false)}
              className="flex-none rounded-full px-3 py-1.5 text-[13px] font-medium"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              Разблокировать
            </button>
          </div>
        )}

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
              <h1 className="flex items-center gap-1 text-[17px] font-semibold leading-tight text-[var(--text)]">
                {username || '—'}
                <VerifiedMark verified={verified} size={19} />
              </h1>
              <span className="text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
                @{username}
              </span>
            </div>


            {/* Люди отдельно, цифры про профиль — отдельно, как в своём. */}
            <div className="flex items-center gap-4">
              <PeopleStat
                value={person?.followers ?? 0}
                label={t('profile.stat.followers')}
                onClick={() => setPeopleTab('followers')}
              />
              <PeopleStat
                value={person?.following ?? 0}
                label={t('profile.stat.following')}
                onClick={() => setPeopleTab('following')}
              />
            </div>

            <div className="flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
              <span>
                <span className="font-num text-[var(--text)]">{posts.length}</span>{' '}
                {t('profile.stat.posts')}
              </span>
              <span aria-hidden>·</span>
              <span>
                <span className="font-num text-[var(--text)]">{person?.karma ?? influence}</span>{' '}
                {t('profile.stat.influence')}
              </span>
            </div>

            {!isMe && (
              <div className="flex items-center gap-2">
                {/* Знак и подпись: одни знаки читались загадкой — «конверт» и
                    «плюс» без слов приходится разгадывать. */}
                <Link
                  href={`/messages/${userId}`}
                  className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-[14px] font-semibold transition-transform active:scale-[0.98]"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 9a2 2 0 0 1-2 2H6l-4 3.5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z" />
                    <path d="M18 9h2a2 2 0 0 1 2 2v10.5L18 18h-6a2 2 0 0 1-2-2v-1" />
                  </svg>
                  {t('profile.write')}
                </Link>
                <FollowButton
                  userId={userId}
                  initiallyFollowing={person?.isFollowing}
                  withLabel
                  className="flex-1"
                />
              </div>
            )}
          </div>
        </section>

        {/* Высота панели не опускается ниже экрана. Переключение вкладок иначе
            укорачивало страницу — «Репосты» пусты, документ становится на
            несколько экранов короче, и браузер подтягивает прокрутку к новому
            максимуму. Со стороны это выглядит так, будто нажатие на вкладку
            зачем-то забросило наверх. Держим панель не короче окна, и точка
            прокрутки остаётся там же, где была: меняется только то, что под
            вкладками.

            min-height, а не фиксированная высота: длинному списку она не
            мешает, а короткому не даёт утащить страницу за собой. */}        <section className="glass min-h-[100dvh] rounded-2xl px-4 pb-2">
          <div className="py-3">
            <SegmentedControl
              value={tab}
              onChange={setTab}
              options={[
                ['posts', `${t('profile.posts')} ${posts.length}`],
                ['comments', t('profile.comments')],
                ['reposts', t('profile.reposts')],
              ]}
            />
          </div>

          {/* Волосяная черта между записями — та же, что в ленте и в своём
              профиле. Довод «здесь всё равно один автор» не сработал: карточки
              идут без рамок, и без черты подпись под одним постом читалась как
              начало следующего. Отделяет не авторов, а записи. */}
          {tab === 'posts' && (
            <div className="feed-list feed-list-inset flex flex-col">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {!postsResult.loading && posts.length === 0 && (
                <p className="py-12 text-center text-[var(--text-muted)]">
                  {t('profile.emptyPostsOther')}
                </p>
              )}
            </div>
          )}

          {tab === 'comments' && (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {comments.map((comment) => (
                <article key={comment.id} className="flex flex-col gap-2 py-4">
                  {comment.post && (
                    <Link
                      href={`/posts/${comment.post.id}#comment-${comment.id}`}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-transform active:scale-[0.99]"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5c-1 0-2-.2-2.9-.6L4.5 20l1.2-4.4A7.5 7.5 0 1 1 20 11.5Z" />
                      </svg>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)]">
                        {comment.post.title}
                      </span>
                    </Link>
                  )}
                  <p className="text-[14.5px] leading-relaxed text-[var(--text)]">{comment.body}</p>
                  <div className="flex items-center gap-2">
                    <VoteBlock
                      id={comment.id}
                      score={comment.score}
                      myVote={comment.myVote}
                      kind="comment"
                      compact
                    />
                    <span className="text-[12.5px] text-[var(--text-muted)]">
                      {formatCompactAge(comment.created_at)}
                    </span>
                  </div>
                </article>
              ))}
              {!commentsResult.loading && comments.length === 0 && (
                <p className="py-12 text-center text-[var(--text-muted)]">
                  {t('profile.emptyCommentsOther')}
                </p>
              )}
            </div>
          )}

          {tab === 'reposts' && (
            <div className="feed-list feed-list-inset flex flex-col">
              {reposts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {!repostsResult.loading && reposts.length === 0 && (
                <p className="py-12 text-center text-[var(--text-muted)]">
                  {t('profile.emptyReposts')}
                </p>
              )}
            </div>
          )}
        </section>
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

      <PersonMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        userId={userId}
        username={username || '—'}
        url={typeof window === 'undefined' ? '' : `${window.location.origin}/u/${userId}`}
      />
    </div>
  );
}
