'use client';

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useSession } from '@/lib/useSession';
import { useApiData } from '@/lib/useApiData';
import { CommentWithPost, Post, UserProfile } from '@/lib/types';
import { PeopleSheet } from '@/components/PeopleSheet';
import { PostCard } from '@/components/PostCard';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { InfluenceInfo } from '@/components/InfluenceInfo';
import { SuggestedPeople } from '@/components/SuggestedPeople';
import { SegmentedControl } from '@/components/SegmentedControl';
import { useStickyTab } from '@/lib/useStickyTab';
import { DEFAULT_FIT, Fit } from '@/components/ImageFitter';
import { ImageAdjustDialog } from '@/components/ImageAdjustDialog';
import Link from 'next/link';
import {
  PROFILE_BIO_KEY,
  PROFILE_CHANGED_EVENT,
  PROFILE_AVATAR_KEY,
  PROFILE_AVATAR_FIT_KEY,
  PROFILE_COVER_FIT_KEY,
  PROFILE_COVER_KEY,
  PROFILE_USERNAME_KEY,
  PROFILE_NAME_KEY,
  ProfileEditSheet,
  readProfileField,
} from '@/components/ProfileEditSheet';
import { usePhoneGate } from '@/components/PhoneGateContext';
import { formatCompactAge } from '@/lib/formatDate';
import { VoteBlock } from '@/components/VoteBlock';
import { TranslationKey, useT } from '@/lib/i18n';

type Tab = 'posts' | 'comments' | 'reposts';

// Ни отображаемого имени, ни описания в таблице users пока нет — держим их
// здесь как образец, пока не появятся поля на бэкенде.
const DISPLAY_NAME = 'Бодрин Фёдор';
const BIO = 'иногда достаточно лишь пары фраз';

const TABS: ReadonlyArray<readonly [Tab, TranslationKey]> = [
  ['posts', 'profile.posts'],
  ['comments', 'profile.comments'],
  ['reposts', 'profile.reposts'],
];

/**
 * Счётчик людей — строкой, а не колонкой в общем ряду метрик.
 *
 * За ним стоит список, поэтому он выглядит нажимаемым и стоит рядом с таким
 * же вторым. Цифры про сам профиль ушли отдельной строкой ниже: они справка,
 * а не действие, и в одном ряду обманывали — половина ряда выглядела
 * нажимаемой, ничем таковой не будучи.
 */
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

export default function ProfilePage() {
  const { session, loading: sessionLoading } = useSession();
  const { requestVerification } = usePhoneGate();
  const { t } = useT();
  // Вкладка переживает уход на страницу поста и возврат назад — иначе из
  // «Комментов» человек возвращался в «Посты», и казалось, что вернуло не туда.
  const [tab, setTab] = useStickyTab<Tab>('profile', 'posts');
  const [editing, setEditing] = useState(false);
  // Какой список людей открыт. Одна шторка на оба счётчика: содержимое у них
  // одинаковое, разница только в адресе запроса.
  const [peopleTab, setPeopleTab] = useState<'followers' | 'following' | null>(null);

  // Обложка — пока только на устройстве: поля под неё в базе нет, бакета тоже.
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const [adjustingCover, setAdjustingCover] = useState(false);
  const storedCover = useSyncExternalStore(
    () => () => {},
    () => window.localStorage.getItem(PROFILE_COVER_KEY),
    () => null
  );
  const coverImage = cover ?? storedCover;

  // Кадрирование обложки. Держим одной строкой в localStorage, чтобы не плодить
  // три ключа под то, что всегда меняется вместе.
  const [coverFit, setCoverFit] = useState<Fit>(() => {
    if (typeof window === 'undefined') return DEFAULT_FIT;
    try {
      return { ...DEFAULT_FIT, ...JSON.parse(window.localStorage.getItem(PROFILE_COVER_FIT_KEY) ?? '{}') };
    } catch {
      return DEFAULT_FIT;
    }
  });

  function saveCoverFit(next: Fit) {
    setCoverFit(next);
    window.localStorage.setItem(PROFILE_COVER_FIT_KEY, JSON.stringify(next));
  }

  function pickCover(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // data-URL, а не objectURL: последний живёт только до перезагрузки, и
    // обложка «сбрасывалась» именно поэтому. Бакета под неё пока нет.
    // Свежий файл уходит в окно подгонки: полоса 168px — не то место, где
    // удобно ловить кадр пальцем.
    const reader = new FileReader();
    reader.onload = () => {
      setPendingCover(String(reader.result));
      setAdjustingCover(true);
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  // Значения профиля живут на устройстве, пока в базе нет полей под них.
  // Подписываемся на событие сохранения через useSyncExternalStore: у сервера
  // и браузера разные снимки, поэтому разметка не расходится при гидратации.
  const displayName = useSyncExternalStore(
    (notify) => {
      window.addEventListener(PROFILE_CHANGED_EVENT, notify);
      return () => window.removeEventListener(PROFILE_CHANGED_EVENT, notify);
    },
    () => readProfileField(PROFILE_NAME_KEY, DISPLAY_NAME),
    () => DISPLAY_NAME
  );
  const bio = useSyncExternalStore(
    (notify) => {
      window.addEventListener(PROFILE_CHANGED_EVENT, notify);
      return () => window.removeEventListener(PROFILE_CHANGED_EVENT, notify);
    },
    () => readProfileField(PROFILE_BIO_KEY, BIO),
    () => BIO
  );
  const savedAvatar = useSyncExternalStore(
    (notify) => {
      window.addEventListener(PROFILE_CHANGED_EVENT, notify);
      return () => window.removeEventListener(PROFILE_CHANGED_EVENT, notify);
    },
    () => readProfileField(PROFILE_AVATAR_KEY),
    () => ''
  );
  const savedAvatarFitRaw = useSyncExternalStore(
    (notify) => {
      window.addEventListener(PROFILE_CHANGED_EVENT, notify);
      return () => window.removeEventListener(PROFILE_CHANGED_EVENT, notify);
    },
    () => readProfileField(PROFILE_AVATAR_FIT_KEY, '{}'),
    () => '{}'
  );

  const savedAvatarFit = useMemo<Fit>(() => {
    try {
      return { ...DEFAULT_FIT, ...JSON.parse(savedAvatarFitRaw) };
    } catch {
      return DEFAULT_FIT;
    }
  }, [savedAvatarFitRaw]);
  const savedHandle = useSyncExternalStore(
    (notify) => {
      window.addEventListener(PROFILE_CHANGED_EVENT, notify);
      return () => window.removeEventListener(PROFILE_CHANGED_EVENT, notify);
    },
    () => readProfileField(PROFILE_USERNAME_KEY),
    () => ''
  );

  const userId = session?.user.id;

  // Из общего кеша: возврат в профиль рисует его мгновенно, свежие данные
  // подтягиваются фоном.
  const postsResult = useApiData<Post[]>(userId ? `/posts/user/${userId}?sort=new` : null);
  const commentsResult = useApiData<CommentWithPost[]>(userId ? `/comments/user/${userId}` : null);

  const repostsResult = useApiData<Post[]>(userId ? `/posts/reposts/${userId}` : null);
  // Счётчики подписок приходят отдельным запросом: считать их на клиенте
  // пришлось бы, вытянув оба списка целиком.
  const profileResult = useApiData<UserProfile>(userId ? `/users/${userId}` : null);

  const posts = useMemo(() => postsResult.data ?? [], [postsResult.data]);
  const comments = useMemo(() => commentsResult.data ?? [], [commentsResult.data]);
  const reposts = useMemo(() => repostsResult.data ?? [], [repostsResult.data]);
  const loading = postsResult.loading || commentsResult.loading;
  const error = postsResult.error ?? commentsResult.error;

  const influence = useMemo(() => posts.reduce((sum, post) => sum + post.score, 0), [posts]);

  // Репостов на бэкенде пока нет — счётчик держим нулевым, а не выдуманным.
  const counts: Record<Tab, number> = {
    posts: posts.length,
    comments: comments.length,
    reposts: reposts.length,
  };

  // AppGate уже гарантировал сессию раньше, чем эта страница смонтировалась —
  // отдельный экран «войдите» здесь не нужен, разве что на миг до первого рендера.
  if (sessionLoading || !session) {
    return <div className="min-h-screen" />;
  }

  // Юзернейм выводим из почты: отдельного поля под него в профиле ещё нет.
  // Юзернейм выводим из почты, но сохранённый в настройках имеет приоритет.
  const emailHandle = (session?.user.email ?? '').split('@')[0];
  const handle = savedHandle || emailHandle;
  const phoneVerified = Boolean(session.user.phone_confirmed_at);

  return (
    <div className="flex flex-1 flex-col items-center">
      {/* Отступ меньше общего .below-header: обложка тут вместо контента,
          и лишний воздух над ней смотрелся провалом. */}
      <main className="flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-3 pt-3">
        {/* Блок 1 — обложка, аватар и цифры. Обложка занимает только верхнюю
            полосу, поэтому текст и метрики лежат на белом и остаются читаемыми. */}
        {/* Обрезки нет намеренно: иначе подсказка про influence-очки упиралась
            бы в нижнюю кромку карточки. Скругление несут сами половины. */}
        {/* Без overflow-hidden: он срезал всплывающую подсказку про influence.
            Скругление обложки несёт она сама (rounded-t-2xl).
            relative z-20 — тоже ради подсказки: обе карточки несут backdrop-filter,
            то есть свой контекст наложения, и соседняя снизу перекрывала бы
            выпадающий блок просто потому, что идёт следом в разметке. */}
        <section className="glass relative z-20 rounded-2xl">
          {/* Обложка выше прежнего и без нижней границы: она растворяется
              маской в карточку, поэтому «половин» больше нет. Отрицательный
              отступ снизу подтягивает данные в зону растворения. */}
          {/* Пока своего фона нет, обложка сама предлагает его поставить.
              Поля под картинку в таблице users ещё не существует, поэтому
              кнопка ведёт в никуда — но место под неё уже занято и видно. */}
          {/* Скрытый file input с accept="image/*": нажатие открывает системную
              галерею сразу, без промежуточного экрана. */}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={pickCover}
            className="hidden"
          />
          {/* Обложку двигают пальцем прямо в кадре, а не ползунками: три
              ползунка занимали половину карточки и заставляли думать в
              координатах вместо простого «подвинуть, куда надо». */}
          {coverImage ? (
            <div
              className="profile-cover -mb-9 flex h-[168px] w-full items-start justify-end rounded-t-2xl p-3"
              style={{
                backgroundImage: `url(${coverImage})`,
                backgroundSize: `${coverFit.zoom * 100}%`,
                backgroundPosition: `${coverFit.x}% ${coverFit.y}%`,
                backgroundRepeat: 'no-repeat',
              }}
            >
              {/* Поставленная обложка остаётся чистой: кнопки поверх неё
                  закрывали ровно то, ради чего её и ставили. Заменить и
                  подогнать можно из «Редактировать профиль». */}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="profile-cover -mb-9 flex h-[168px] w-full items-start justify-end rounded-t-2xl p-3"
            >
              <span
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium backdrop-blur-md"
                style={{
                  background: 'color-mix(in srgb, #000000 32%, transparent)',
                  color: '#ffffff',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 6v12M6 12h12" />
                </svg>
                {t('profile.addCover')}
              </span>
            </button>
          )}


          {/* Высота не фиксирована: имя и описание бывают в несколько строк,
              при жёстких 140px они вылезали за нижнюю кромку карточки. */}
          <div className="flex flex-col gap-3 px-4 pb-5 sm:px-5">
            {/* Аватар приподнят на обложку и остаётся выше вуали шапки. */}
            <div className="-mt-12 flex items-end gap-3 sm:gap-5">
              <div
                className="relative z-10 flex-none rounded-full"
                style={{ background: 'var(--surface)', padding: 3 }}
              >
                <ProfileAvatar
                  name={handle}
                  size={88}
                  photo={savedAvatar || null}
                  photoFit={savedAvatarFit}
                />
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <h1 className="text-[17px] font-semibold leading-tight text-[var(--text)]">{displayName}</h1>
              <span className="text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
                @{handle}
              </span>
              {bio && <p className="mt-1 text-[14px] leading-snug text-[var(--text)]">{bio}</p>}
            </div>

            {/* Люди отдельно от цифр: за подписчиками ходят, а посты и
                influence — справка о профиле, по ней не нажимают. */}
            <div className="flex items-center gap-4">
              <PeopleStat
                value={profileResult.data?.followers ?? 0}
                label={t('profile.stat.followers')}
                onClick={() => setPeopleTab('followers')}
              />
              <PeopleStat
                value={profileResult.data?.following ?? 0}
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
              <span className="flex items-center gap-1">
                <span className="font-num text-[var(--text)]">{influence}</span>{' '}
                {t('profile.stat.influence')}
                <InfluenceInfo />
              </span>
            </div>

            <button
              onClick={() => setEditing(true)}
              className="w-full rounded-full border py-2 text-[14px] font-medium transition-colors"
              style={{ borderColor: 'var(--glass-border)', color: 'var(--text)' }}
            >
              {t('profile.edit')}
            </button>
          </div>
        </section>

        <SuggestedPeople className="px-1.5" />

        {/* Блок 2 — что вы написали */}
        <section className="glass rounded-2xl px-4 pb-2">
          {/* Тот же переключатель, что и в чужом профиле. Здесь стояли свои
              вкладки с полупрозрачной каплей и чертой под ними — те же три
              раздела, но нарисованные иначе, и переход между своим и чужим
              профилем выглядел переходом между двумя приложениями. */}
          <div className="py-3">
            <SegmentedControl
              value={tab}
              onChange={setTab}
              // Счётчик — только у выбранной вкладки. Со счётчиками у всех трёх
              // подписи («Комменты 18») переставали помещаться в колонку
              // профиля и обрезались многоточием, а число — самое полезное в
              // них — пропадало первым. Число нужно про то, что сейчас
              // смотришь; про остальные две его видно, когда на них перейдёшь.
              options={TABS.map(
                ([value, labelKey]) =>
                  [value, value === tab ? `${t(labelKey)} ${counts[value]}` : t(labelKey)] as const
              )}
            />
          </div>

          {loading && <p className="py-6 text-[var(--text-muted)]">{t('common.loading')}</p>}
          {error && <p className="py-6" style={{ color: 'var(--down)' }}>{error}</p>}

          {/* pt-4: посты жались прямо к линии под вкладками и читались её
              продолжением, а не отдельным списком. */}
          {!loading && !error && tab === 'posts' && (
            <div className="flex flex-col pt-2">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {posts.length === 0 &&
                (phoneVerified ? (
                  <p className="py-10 text-center text-[var(--text-muted)]">
                    {t('profile.emptyPosts')}
                  </p>
                ) : (
                  // Пока телефон не подтверждён, писать всё равно нельзя —
                  // поэтому на месте пустого состояния зовём это сделать.
                  <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                    <p className="text-[14.5px] leading-relaxed text-[var(--text-muted)]">
                      {t('profile.verifyPrompt')}
                    </p>
                    <button
                      onClick={requestVerification}
                      className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90"
                    >
                      {t('profile.verifyAction')}
                    </button>
                  </div>
                ))}
            </div>
          )}

          {!loading && !error && tab === 'comments' && (
            /* Волосяная черта между репликами. Без неё цитата поста, текст
               ответа и счётчик шли сплошным столбцом, и где кончается один
               комментарий, а где начинается следующий, приходилось угадывать
               по отступам — в списке из двух десятков реплик это не работает. */
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {comments.map((comment) => (
                <article key={comment.id} className="flex flex-col gap-2 py-4">
                  {/* Под каким постом оставлен комментарий — видно прямо здесь,
                      строкой-цитатой. Ссылка ведёт к самому комментарию, а не
                      просто на пост: якорь в адресе подсвечивает нужную ветку. */}
                  {comment.post && (
                    <Link
                      href={`/posts/${comment.post.id}#comment-${comment.id}`}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                      style={{ background: 'var(--surface-2)' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                        <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5c-1 0-2-.2-2.9-.6L4.5 20l1.2-4.4A7.5 7.5 0 1 1 20 11.5Z" />
                      </svg>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)]">
                        {comment.post.title}
                      </span>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                        <path d="m9 6 6 6-6 6" />
                      </svg>
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
                    <span className="text-[12px] text-[var(--text-muted)]">
                      {formatCompactAge(comment.created_at)}
                    </span>
                  </div>
                </article>
              ))}
              {comments.length === 0 && (
                <p className="py-10 text-center text-[var(--text-muted)]">
                  {t('profile.emptyComments')}
                </p>
              )}
            </div>
          )}

          {!loading && !error && tab === 'reposts' && (
            <div className="flex flex-col pt-2">
              {reposts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {reposts.length === 0 && (
                <p className="py-10 text-center text-[var(--text-muted)]">
                  {t('profile.emptyReposts')}
                </p>
              )}
            </div>
          )}
        </section>
      </main>

      <ImageAdjustDialog
        open={adjustingCover}
        src={pendingCover}
        shape="cover"
        initialFit={coverFit}
        onCancel={() => setAdjustingCover(false)}
        onApply={(fit) => {
          if (pendingCover) {
            window.localStorage.setItem(PROFILE_COVER_KEY, pendingCover);
            setCover(pendingCover);
          }
          saveCoverFit(fit);
          setAdjustingCover(false);
        }}
      />

      <ProfileEditSheet
        open={editing}
        onClose={() => setEditing(false)}
        defaultName={DISPLAY_NAME}
        defaultBio={BIO}
        defaultUsername={emailHandle}
      />

      <PeopleSheet
        open={peopleTab !== null}
        onClose={() => setPeopleTab(null)}
        title={peopleTab === 'following' ? t('people.following') : t('people.followers')}
        endpoint={userId && peopleTab ? `/users/${userId}/${peopleTab}` : null}
        emptyText={
          peopleTab === 'following' ? t('people.emptyFollowing') : t('people.emptyFollowers')
        }
      />
    </div>
  );
}
