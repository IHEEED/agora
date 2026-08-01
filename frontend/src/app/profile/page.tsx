'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/useSession';
import { apiFetch } from '@/lib/api';
import { CommentWithPost, Post } from '@/lib/types';
import { PostCard } from '@/components/PostCard';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { InfluenceInfo } from '@/components/InfluenceInfo';
import { usePhoneGate } from '@/components/PhoneGateContext';
import { formatRelativeDate } from '@/lib/formatDate';

type Tab = 'posts' | 'comments' | 'reposts';

// Ни отображаемого имени, ни описания в таблице users пока нет — держим их
// здесь как образец, пока не появятся поля на бэкенде.
const DISPLAY_NAME = 'Кирилл';
const BIO = 'иногда достаточно лишь пары фраз';

const TABS: ReadonlyArray<readonly [Tab, string]> = [
  ['posts', 'Посты'],
  ['comments', 'Комментарии'],
  ['reposts', 'Репосты'],
];

function Stat({ value, label, info }: { value: number; label: string; info?: React.ReactNode }) {
  return (
    // min-w-0 обязателен: без него длинная подпись распирает флекс-строку
    // и цифры выезжают за край карточки.
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
      <span className="font-num text-[19px] font-semibold leading-none text-[var(--text)]">
        {value}
      </span>
      <span className="flex max-w-full items-center gap-1 text-[11.5px] leading-tight text-[var(--text-muted)]">
        <span className="truncate">{label}</span>
        {info}
      </span>
    </div>
  );
}

export default function ProfilePage() {
  const { session, loading: sessionLoading } = useSession();
  const { requestVerification } = usePhoneGate();
  const [tab, setTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<CommentWithPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tabsRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [tabBlob, setTabBlob] = useState<{ x: number; width: number; height: number } | null>(null);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      apiFetch<Post[]>(`/posts/user/${userId}?sort=new`),
      apiFetch<CommentWithPost[]>(`/comments/user/${userId}`),
    ])
      .then(([userPosts, userComments]) => {
        setPosts(userPosts);
        setComments(userComments);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  const influence = useMemo(() => posts.reduce((sum, post) => sum + post.score, 0), [posts]);

  // Репостов на бэкенде пока нет — счётчик держим нулевым, а не выдуманным.
  const counts: Record<Tab, number> = {
    posts: posts.length,
    comments: comments.length,
    reposts: 0,
  };

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
    // Ширина вкладок зависит от подписей со счётчиками — пересчитываем и при их смене.
  }, [activeTabIndex, counts.posts, counts.comments, counts.reposts]);

  // AppGate уже гарантировал сессию раньше, чем эта страница смонтировалась —
  // отдельный экран «войдите» здесь не нужен, разве что на миг до первого рендера.
  if (sessionLoading || !session) {
    return <div className="min-h-screen" style={{ background: 'var(--sunken)' }} />;
  }

  // Юзернейм выводим из почты: отдельного поля под него в профиле ещё нет.
  const handle = (session?.user.email ?? '').split('@')[0];
  const phoneVerified = Boolean(session.user.phone_confirmed_at);

  return (
    <div className="flex flex-1 flex-col items-center" style={{ background: 'var(--sunken)' }}>
      {/* Отступ меньше общего .below-header: обложка тут вместо контента,
          и лишний воздух над ней смотрелся провалом. */}
      <main className="flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-3 pt-3">
        {/* Блок 1 — обложка, аватар и цифры. Обложка занимает только верхнюю
            полосу, поэтому текст и метрики лежат на белом и остаются читаемыми. */}
        {/* Обрезки нет намеренно: иначе подсказка про influence-очки упиралась
            бы в нижнюю кромку карточки. Скругление несут сами половины. */}
        <section className="rounded-2xl bg-[var(--surface)]">
          {/* Обложка и белая часть равной высоты — граница ровно посередине. */}
          <div className="profile-cover h-[130px] rounded-t-2xl" />

          {/* Высота не фиксирована: имя и описание бывают в несколько строк,
              при жёстких 140px они вылезали за нижнюю кромку карточки. */}
          <div className="flex flex-col gap-3 px-4 pb-5 sm:px-5">
            {/* Аватар приподнят на обложку и остаётся выше вуали шапки. */}
            <div className="-mt-12 flex items-end gap-3 sm:gap-5">
              <div
                className="relative z-10 flex-none rounded-full"
                style={{ background: 'var(--surface)', padding: 3 }}
              >
                <ProfileAvatar letter={handle[0]?.toUpperCase() ?? '?'} size={88} />
              </div>
              <div className="flex min-w-0 flex-1 items-start gap-1 pb-1">
                <Stat value={posts.length} label="постов" />
                <Stat value={0} label="подписчиков" />
                <Stat value={influence} label="influence" info={<InfluenceInfo />} />
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              <h1 className="text-[17px] font-semibold leading-tight text-[var(--text)]">{DISPLAY_NAME}</h1>
              <span className="text-[13px] text-[var(--text-muted)]">@{handle}</span>
              <p className="mt-1 text-[14px] leading-snug text-[var(--text)]">{BIO}</p>
            </div>
          </div>
        </section>

        {/* Блок 2 — что вы написали */}
        <section className="rounded-2xl bg-[var(--surface)] px-4 pb-2">
          {/* Вкладки собраны к центру: у крайней («Репосты») капля упиралась
              в край карточки и вылезала за скругление. */}
          <div
            ref={tabsRef}
            className="relative flex justify-center gap-1 border-b border-[var(--border)] py-2"
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

            {TABS.map(([value, label], index) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                className="relative z-10 whitespace-nowrap rounded-full px-3 py-2 text-[13.5px] font-medium transition-colors"
                style={{ color: tab === value ? 'var(--accent)' : 'var(--text-muted)' }}
              >
                {label} <span className="font-num">{counts[value]}</span>
              </button>
            ))}
          </div>

          {loading && <p className="py-6 text-[var(--text-muted)]">Загрузка…</p>}
          {error && <p className="py-6" style={{ color: 'var(--down)' }}>{error}</p>}

          {!loading && !error && tab === 'posts' && (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {posts.length === 0 &&
                (phoneVerified ? (
                  <p className="py-10 text-center text-[var(--text-muted)]">
                    Вы пока ничего не опубликовали.
                  </p>
                ) : (
                  // Пока телефон не подтверждён, писать всё равно нельзя —
                  // поэтому на месте пустого состояния зовём это сделать.
                  <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                    <p className="text-[14.5px] leading-relaxed text-[var(--text-muted)]">
                      Чтобы публиковать посты и комментарии, подтвердите номер телефона.
                    </p>
                    <button
                      onClick={requestVerification}
                      className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90"
                    >
                      Подтвердить телефон
                    </button>
                  </div>
                ))}
            </div>
          )}

          {!loading && !error && tab === 'comments' && (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {comments.map((comment) => (
                <article key={comment.id} className="flex flex-col gap-1.5 py-4">
                  {comment.post && (
                    <Link
                      href={`/posts/${comment.post.id}`}
                      className="text-[13px] font-medium hover:underline"
                      style={{ color: 'var(--accent)' }}
                    >
                      {comment.post.title}
                    </Link>
                  )}
                  <p className="text-[14.5px] leading-relaxed text-[var(--text)]">{comment.body}</p>
                  <span className="text-[12px] text-[var(--text-muted)]">
                    {formatRelativeDate(comment.created_at)} · <span className="font-num">{comment.score}</span> голосов
                  </span>
                </article>
              ))}
              {comments.length === 0 && (
                <p className="py-10 text-center text-[var(--text-muted)]">
                  Вы пока не оставляли комментариев.
                </p>
              )}
            </div>
          )}

          {!loading && !error && tab === 'reposts' && (
            <p className="py-10 text-center text-[var(--text-muted)]">
              Репостов пока нет.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
