'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Post } from '@/lib/types';
import { useVote } from '@/lib/useVote';
import { formatRelativeDate } from '@/lib/formatDate';
import { RollingNumber } from '@/components/RollingNumber';
import { PollBlock } from '@/components/PollBlock';

const ARROW_PATH =
  'M12 4.5c.45 0 .87.2 1.15.55l5.9 7.2c.65.8.08 2-.96 2H15.2v4.3c0 .8-.65 1.45-1.45 1.45h-3.5c-.8 0-1.45-.65-1.45-1.45V14.25H5.91c-1.04 0-1.61-1.2-.96-2l5.9-7.2c.28-.35.7-.55 1.15-.55Z';

// Круговой салют: искры расходятся во все стороны из центра кнопки.
const SPARK_COUNT = 10;
const SPARK_RADIUS = 26;
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, index) => {
  const angle = (index / SPARK_COUNT) * Math.PI * 2;
  return {
    dx: `${(Math.cos(angle) * SPARK_RADIUS).toFixed(1)}px`,
    dy: `${(Math.sin(angle) * SPARK_RADIUS).toFixed(1)}px`,
  };
});

/**
 * В покое стрелка — только контур. Заливается лишь та, за которую отдан голос;
 * соседняя остаётся контурной и просто перекрашивается вместе со всем блоком.
 */
function VoteArrow({ direction, filled }: { direction: 'up' | 'down'; filled: boolean }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    >
      <path d={ARROW_PATH} transform={direction === 'down' ? 'rotate(180 12 12)' : undefined} />
    </svg>
  );
}

export function PostCard({ post, linkToDetail = true }: { post: Post; linkToDetail?: boolean }) {
  const { score, myVote, vote, error, message } = useVote(post.id, post.score, post.myVote);
  const [reposted, setReposted] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [animating, setAnimating] = useState<'up' | 'down' | null>(null);
  const [sparkKey, setSparkKey] = useState(0);
  const [repostSpin, setRepostSpin] = useState(0);
  const voteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (voteTimeout.current) clearTimeout(voteTimeout.current);
    };
  }, []);

  function handleVote(value: 1 | -1) {
    const direction = value === 1 ? 'up' : 'down';
    // Повторный клик по своей же стрелке снимает голос — такой откат
    // проходит без анимации, крутится только постановка реакции.
    const isSettingVote = myVote !== value;

    if (isSettingVote) {
      setAnimating(direction);
      if (direction === 'up') setSparkKey((k) => k + 1);
      if (voteTimeout.current) clearTimeout(voteTimeout.current);
      voteTimeout.current = setTimeout(() => setAnimating(null), 420);
    }

    vote(value);
  }

  function handleRepost() {
    setReposted((was) => {
      setRepostCount((count) => (was ? count - 1 : count + 1));
      return !was;
    });
    setRepostSpin((k) => k + 1);
  }

  async function handleShare() {
    const url = `${window.location.origin}/posts/${post.id}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareMessage('Ссылка скопирована');
        setTimeout(() => setShareMessage(null), 2000);
      }
    } catch {
      // пользователь отменил шеринг — ничего не делаем
    }
  }

  // Проголосовавший блок целиком окрашивается в цвет реакции.
  const voteTone =
    myVote === 1
      ? { color: 'var(--up)', background: 'var(--up-bg)', borderColor: 'var(--up)' }
      : myVote === -1
        ? { color: 'var(--down)', background: 'var(--down-bg)', borderColor: 'var(--down)' }
        : {};

  return (
    <article className="flex flex-col gap-2 py-5">
      <div className="flex items-center gap-2 text-[14px]">
        <span
          className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12px] font-semibold"
          style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
        >
          {post.author.username[0]?.toUpperCase()}
        </span>
        <span className="font-semibold text-[var(--text)]">{post.author.username}</span>
        <span className="text-[var(--text-muted)]">· {formatRelativeDate(post.created_at)}</span>
      </div>

      {linkToDetail ? (
        <h2 className="text-[16px] font-medium leading-snug text-[var(--text)]">{post.title}</h2>
      ) : (
        <h1 className="text-[16px] font-medium leading-snug text-[var(--text)]">{post.title}</h1>
      )}
      {post.body && <p className="text-[14.5px] leading-relaxed text-[var(--text-muted)]">{post.body}</p>}

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- источник картинок произвольный, next/image требует настройки доменов
        <img
          src={post.image_url}
          alt=""
          loading="lazy"
          className="w-full rounded-2xl border border-[var(--border)] object-cover"
          style={{ maxHeight: 340 }}
        />
      )}

      {post.pollOptions?.length > 0 && (
        <PollBlock postId={post.id} options={post.pollOptions} myVote={post.myPollVote} />
      )}

      {message && <p className="text-xs font-medium" style={{ color: 'var(--up)' }}>{message}</p>}
      {error && <p className="text-xs font-medium" style={{ color: 'var(--down)' }}>{error}</p>}
      {shareMessage && <p className="text-xs font-medium text-[var(--text-muted)]">{shareMessage}</p>}

      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="control-pill flex items-center rounded-full" style={voteTone}>
            <button
              onClick={() => handleVote(1)}
              aria-label="Голосовать за"
              aria-pressed={myVote === 1}
              className="vote-hit relative flex h-10 w-10 items-center justify-center rounded-full"
            >
              <span className="arrow-clip">
                <span className={animating === 'up' ? 'animate-vote-up' : undefined} style={{ display: 'block' }}>
                  <VoteArrow direction="up" filled={myVote === 1} />
                </span>
              </span>

              {sparkKey > 0 && (
                <span key={sparkKey} aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
                  {SPARKS.map((spark, index) => (
                    <span
                      key={index}
                      className="vote-spark"
                      style={{ '--dx': spark.dx, '--dy': spark.dy } as React.CSSProperties}
                    />
                  ))}
                </span>
              )}
            </button>

            {myVote !== -1 && (
              <RollingNumber value={score} className="min-w-[1.5em] justify-center font-num text-[15px]" />
            )}

            <button
              onClick={() => handleVote(-1)}
              aria-label="Голосовать против"
              aria-pressed={myVote === -1}
              className="vote-hit flex h-10 w-10 items-center justify-center rounded-full"
            >
              <span className="arrow-clip">
                <span className={animating === 'down' ? 'animate-vote-down' : undefined} style={{ display: 'block' }}>
                  <VoteArrow direction="down" filled={myVote === -1} />
                </span>
              </span>
            </button>
          </div>

          {linkToDetail && (
            <Link
              href={`/posts/${post.id}`}
              className="control-pill flex items-center gap-1.5 rounded-full px-3 py-2 hover:bg-[var(--surface-2)]"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5h16v11H8.5L4 20V5.5Z" />
              </svg>
              <span className="font-num text-[15px]">{post.commentCount}</span>
            </Link>
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
            onClick={handleShare}
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
    </article>
  );
}
