'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Post } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { invalidate } from '@/lib/useApiData';
import { CommentSheet } from '@/components/CommentSheet';
import { ShareSheet } from '@/components/ShareSheet';
import { AvatarFollow } from '@/components/AvatarFollow';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { formatCompactAge } from '@/lib/formatDate';
import { RollingNumber } from '@/components/RollingNumber';
import { VoteBlock } from '@/components/VoteBlock';
import { PollBlock } from '@/components/PollBlock';
import { PostMenuSheet } from '@/components/PostMenuSheet';
import { useSession } from '@/lib/useSession';

export function PostCard({
  post,
  linkToDetail = true,
  /** Автор, на которого можно подписаться прямо из ленты. */
  canFollow = false,
}: {
  post: Post;
  linkToDetail?: boolean;
  canFollow?: boolean;
}) {
  const [reposted, setReposted] = useState(Boolean(post.myRepost));
  const [repostCount, setRepostCount] = useState(post.repostCount ?? 0);
  const [repostSpin, setRepostSpin] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Счётчик живёт локально: отправленный из шторки комментарий должен
  // сразу отразиться на кнопке, не дожидаясь перезагрузки ленты.
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Удалённая запись убирается из ленты сразу: ждать перезагрузки списка,
  // глядя на то, что уже удалил, — странно.
  const [removed, setRemoved] = useState(false);
  const { session } = useSession();

  async function remove() {
    setRemoved(true);
    try {
      await apiFetch(`/posts/${post.id}`, { method: 'DELETE' });
      invalidate('/posts');
    } catch {
      setRemoved(false);
    }
  }

  async function handleRepost() {
    // Считаем от текущего значения, а не изнутри апдейтера setReposted:
    // React прогоняет апдейтеры дважды (StrictMode в разработке), и вложенный
    // setRepostCount срабатывал два раза — счётчик прыгал через один.
    const next = !reposted;
    setReposted(next);
    setRepostCount((count) => (next ? count + 1 : count - 1));
    setRepostSpin((k) => k + 1);

    try {
      await apiFetch(`/posts/${post.id}/repost`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      // Не прошло — возвращаем как было, иначе счётчик врёт до перезагрузки.
      setReposted(!next);
      setRepostCount((count) => (next ? count - 1 : count + 1));
    }
  }


  if (removed) return null;

  const isMine = Boolean(post.author.id) && post.author.id === session?.user.id;
  const hasChain = (post.chain?.length ?? 0) > 0;

  return (
    // Ни рамки, ни фона: пост отделяется от соседа полоской, которую рисует
    // список. Горизонтальных полей тоже нет — текст идёт во всю ширину колонки.
    <article className="flex flex-col gap-2 py-4">
      <div className="relative flex items-center gap-2.5 text-[14px]">
        {/* Подписка значком на аватарке, а не отдельной кнопкой у правого края.
            Там она стояла между ником и тремя точками и на длинных никах
            зажималась в щель; здесь она пришита к тому, на кого подписываются.
            Аватарка ради этого подросла с 30 до 38: на тридцати значок был бы
            мельче пальца. */}
        {canFollow && post.author.id ? (
          <AvatarFollow
            userId={post.author.id}
            username={post.author.username}
            initiallyFollowing={post.author.isFollowing}
            size={38}
          />
        ) : (
          <DefaultAvatar name={post.author.username} size={38} />
        )}

        {/* min-w-0 на контейнере и truncate на нике: без первого флекс не даёт
            элементу сжаться ниже содержимого, и длинный ник выдавливал кнопку
            подписки за край вместо того, чтобы обрезаться. */}
        <div className="flex min-w-0 flex-1 items-center gap-x-1.5 overflow-hidden">
          {/* Ник ведёт в профиль автора — самый ожидаемый жест в любой ленте. */}
          <Link
            href={post.author.id ? `/u/${post.author.id}` : '#'}
            className="min-w-0 truncate font-semibold text-[var(--text)] hover:underline"
          >
            {post.author.username}
          </Link>

          {/* Возраст сразу за ником, а не у правого края: там он читался
              отдельной колонкой и отрывался от того, к чему относится. */}
          <span className="text-[13px] text-[var(--text-muted)]">
            {formatCompactAge(post.created_at)}
          </span>

          {/* Пост от имени сообщества: стрелка и название акцентом. Без флага
              подпись остаётся обычной, хотя сообщество у записи есть всегда. */}
          {post.post_as_community && post.community && (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
              <Link
                href={`/c/${post.community.id}`}
                className="truncate font-semibold hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {post.community.name}
              </Link>
            </>
          )}

        </div>

        {/* Три точки — общее место для всего, что делают с чужой записью и
            что не заслуживает своей кнопки в строке действий. */}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Ещё"
          className="-mr-2 flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--control)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
      </div>

      {/* Первая строка — газетной антиквой, остальное — обычным текстом.
          Раньше и то и другое шло одним кеглем и одной гарнитурой: решение
          было в том, чтобы не навязывать структуру, которой в мыслях нет. Но
          гарнитура структуры и не навязывает — она задаёт голос. Антиква
          отделяет мысль от её изложения тем же способом, каким это делает
          газетная полоса, и не заставляет писать заголовок: у записи в одну
          строку просто вся строка набрана крупно.

          Кегль при этом почти не растёт — работает контраст форм, а не
          размера, иначе лента снова распалась бы на «крупное» и «мелкое». */}
      <div className="relative flex flex-col gap-1.5 text-[var(--text)]">
        <p className="display-type whitespace-pre-line text-[16px] leading-snug">
          {post.title}
        </p>
        {post.body && (
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{post.body}</p>
        )}
      </div>

      {hasChain && <ChainTail chain={post.chain!} total={post.chain!.length + 1} />}

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- источник картинок произвольный, next/image требует настройки доменов
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="relative w-full rounded-2xl border border-[var(--border)] object-cover"
          style={{ maxHeight: 340 }}
        />
      )}

      {post.pollOptions?.length > 0 && (
        <PollBlock postId={post.id} options={post.pollOptions} myVote={post.myPollVote} />
      )}

      {/* Две группы, а не пять кнопок в ряд. Слева то, что относится к самой
          записи — голос и обсуждение; справа то, что уносит её дальше — репост
          и «поделиться». Внутри группы кнопки стоят вплотную, между группами
          пусто: так видно, что это два разных действия, а не пять равных. */}
      <div className="relative mt-1 flex items-center justify-between">
        <div className="-ml-1 flex items-center">
          <VoteBlock id={post.id} score={post.score} myVote={post.myVote} />

          {linkToDetail && (
            // Комментарии открываются шторкой поверх ленты, а не отдельной
            // страницей: так не теряется место, до которого дочитали.
            <button
              onClick={() => setCommentsOpen(true)}
              aria-label="Комментарии"
              aria-expanded={commentsOpen}
              className="flex items-center gap-1.5 rounded-full px-2 py-2"
              style={{ color: 'var(--control)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5c-1 0-2-.2-2.9-.6L4.5 20l1.2-4.4A7.5 7.5 0 1 1 20 11.5Z" />
              </svg>
              <span className="font-num text-[15px]">{commentCount}</span>
            </button>
          )}
        </div>

        <div className="-mr-1 flex items-center">
          <button
            onClick={handleRepost}
            aria-label="Репост"
            aria-pressed={reposted}
            className="flex items-center gap-1.5 rounded-full px-2 py-2"
            // Только цвет иконки, без заливки и обводки — как у стрелок.
            style={{ color: reposted ? 'var(--repost)' : 'var(--control)' }}
          >
            <span key={repostSpin} className={repostSpin > 0 ? 'animate-repost' : undefined} style={{ display: 'inline-flex' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 7h9a3 3 0 0 1 3 3v2" />
                <path d="m12 5-3 2 3 2" />
                <path d="M18 17H9a3 3 0 0 1-3-3v-2" />
                <path d="m12 19 3-2-3-2" />
              </svg>
            </span>
            <RollingNumber value={repostCount} className="font-num text-[15px]" />
          </button>

          <button
            onClick={() => setShareOpen(true)}
            aria-label="Поделиться"
            className="flex h-9 w-9 items-center justify-center transition-colors hover:text-[var(--text)]"
            style={{ color: 'var(--control)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
              <path d="M16 6l-4-4-4 4" />
              <path d="M12 2v14" />
            </svg>
          </button>
        </div>
      </div>

      {linkToDetail && (
        <CommentSheet
          postId={post.id}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          onCountChange={setCommentCount}
        />
      )}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={typeof window === 'undefined' ? '' : `${window.location.origin}/posts/${post.id}`}
        text={post.title}
      />

      <PostMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        url={typeof window === 'undefined' ? '' : `${window.location.origin}/posts/${post.id}`}
        isMine={isMine}
        onDelete={remove}
        // Продолжить можно только своё и только то, у чего продолжения ещё нет:
        // цепочка — одна мысль одного человека, и ветвиться ей нечем.
        continueHref={
          isMine && !hasChain ? `/create?after=${post.id}` : undefined
        }
      />
    </article>
  );
}

/**
 * Продолжения записи — то, что написано вслед за ней.
 *
 * Рисуются внутри начала цепочки, а не отдельными постами в ленте: это одна
 * мысль, разложенная на несколько заходов, и раскидывать её куски между чужими
 * записями значит её потерять. Слева — линия принадлежности, та же, что у
 * ветки ответов в комментариях: она показывает, что записи связаны, не занимая
 * места подписью у каждой.
 */
function ChainTail({ chain, total }: { chain: Post[]; total: number }) {
  return (
    <div className="mt-1 flex flex-col gap-3 pl-[19px]" style={{ position: 'relative' }}>
      {/* Ствол на всю высоту хвоста. Волосяной и приглушённый — служебная
          разметка не должна перебивать текст, который она размечает. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: -4,
          bottom: 8,
          width: 1.5,
          borderRadius: 999,
          background: 'color-mix(in srgb, var(--border) 75%, transparent)',
        }}
      />

      {chain.map((part, index) => (
        <div key={part.id} className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-[var(--text-muted)]">
            Вслед · <span className="font-num">{index + 2}</span> из{' '}
            <span className="font-num">{total}</span>
          </span>
          <p className="display-type whitespace-pre-line text-[15px] leading-snug text-[var(--text)]">
            {part.title}
          </p>
          {part.body && (
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--text)]">
              {part.body}
            </p>
          )}
          {part.image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- источник произвольный, next/image требует настройки доменов
            <img
              src={part.image_url}
              alt=""
              loading="lazy"
              className="w-full rounded-xl border border-[var(--border)] object-cover"
              style={{ maxHeight: 260 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
