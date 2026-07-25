'use client';

import Link from 'next/link';
import { Post } from '@/lib/types';
import { useVote } from '@/lib/useVote';
import { formatRelativeDate } from '@/lib/formatDate';
import { pluralizeComments } from '@/lib/pluralize';

export function PostCard({ post, linkToDetail = true }: { post: Post; linkToDetail?: boolean }) {
  const { score, myVote, vote, error, message } = useVote(post.id, post.score, post.myVote);

  return (
    <div className="flex gap-3 rounded-lg border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => vote(1)}
          aria-label="Голосовать за"
          className={`text-lg hover:text-orange-500 ${myVote === 1 ? 'text-orange-500' : 'text-zinc-500'}`}
        >
          ▲
        </button>
        <span className="text-sm font-medium text-black dark:text-zinc-50">{score}</span>
        <button
          onClick={() => vote(-1)}
          aria-label="Голосовать против"
          className={`text-lg hover:text-blue-500 ${myVote === -1 ? 'text-blue-500' : 'text-zinc-500'}`}
        >
          ▼
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {linkToDetail ? (
          <h2 className="font-medium text-black dark:text-zinc-50">{post.title}</h2>
        ) : (
          <h1 className="font-medium text-black dark:text-zinc-50">{post.title}</h1>
        )}
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {post.author.username} · 👁 {post.views} · {formatRelativeDate(post.created_at)}
        </span>
        {post.body && <p className="text-sm text-zinc-600 dark:text-zinc-400">{post.body}</p>}
        {message && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{message}</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        {linkToDetail && (
          <Link
            href={`/posts/${post.id}`}
            className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-400 dark:hover:bg-[#1a1a1a]"
          >
            💬 {post.commentCount} {pluralizeComments(post.commentCount)}
          </Link>
        )}
      </div>
    </div>
  );
}
