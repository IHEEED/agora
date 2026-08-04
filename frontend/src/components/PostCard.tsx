'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Post } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { CommentSheet } from '@/components/CommentSheet';
import { ShareSheet } from '@/components/ShareSheet';
import { FollowButton } from '@/components/FollowButton';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { formatCompactAge } from '@/lib/formatDate';
import { RollingNumber } from '@/components/RollingNumber';
import { VoteBlock } from '@/components/VoteBlock';
import { PollBlock } from '@/components/PollBlock';

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


  return (
    // Ни рамки, ни фона: пост отделяется от соседа полоской, которую рисует
    // список. Горизонтальных полей тоже нет — текст идёт во всю ширину колонки.
    <article className="flex flex-col gap-2 py-4">
      <div className="relative flex items-center gap-2 text-[14px]">
        <DefaultAvatar name={post.author.username} size={30} />

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          {/* Ник ведёт в профиль автора — самый ожидаемый жест в любой ленте. */}
          <Link
            href={post.author.id ? `/u/${post.author.id}` : '#'}
            className="font-semibold text-[var(--text)] hover:underline"
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

        {canFollow && post.author.id && (
          <FollowButton userId={post.author.id} className="text-[12.5px]" />
        )}
      </div>

      {/* Заголовок и текст одним потоком, одним кеглем и одной яркостью:
          деление на «крупное тёмное» и «мелкое тусклое» навязывало структуру,
          которой в мыслях обычно нет. Нужен заголовок — человек сам отобьёт
          первую строку переносом. whitespace-pre-line эти переносы сохраняет. */}
      <div className="relative flex flex-col gap-1.5 text-[15px] leading-relaxed text-[var(--text)]">
        <p className="whitespace-pre-line">{post.title}</p>
        {post.body && <p className="whitespace-pre-line">{post.body}</p>}
      </div>

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

      <div className="relative mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <VoteBlock id={post.id} score={post.score} myVote={post.myVote} />

          {linkToDetail && (
            // Комментарии открываются шторкой поверх ленты, а не отдельной
            // страницей: так не теряется место, до которого дочитали.
            <button
              onClick={() => setCommentsOpen(true)}
              aria-label="Комментарии"
              aria-expanded={commentsOpen}
              className="control-pill flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-[var(--surface-2)]"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5h16v11H8.5L4 20V5.5Z" />
              </svg>
              <span className="font-num text-[15px]">{commentCount}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRepost}
            aria-label="Репост"
            aria-pressed={reposted}
            className="control-pill flex items-center gap-1.5 rounded-full px-3 py-2"
            style={
              reposted
                ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--accent-soft)' }
                : {}
            }
          >
            <span key={repostSpin} className={repostSpin > 0 ? 'animate-repost' : undefined} style={{ display: 'inline-flex' }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
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
    </article>
  );
}
