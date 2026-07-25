'use client';

import { useState, SubmitEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { useVote } from '@/lib/useVote';
import { formatRelativeDate } from '@/lib/formatDate';
import { pluralizeReplies } from '@/lib/pluralize';
import { Comment } from '@/lib/types';

function countDescendants(comment: Comment): number {
  return comment.replies.reduce((sum, reply) => sum + 1 + countDescendants(reply), 0);
}

function truncateWords(text: string, wordCount = 8): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= wordCount) return text;
  return `${words.slice(0, wordCount).join(' ')}…`;
}

function VoteArrows({
  score,
  myVote,
  onVote,
}: {
  score: number;
  myVote: 1 | -1 | null;
  onVote: (value: 1 | -1) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onVote(1)}
        aria-label="Голосовать за"
        className={`text-xs leading-none hover:text-orange-500 ${myVote === 1 ? 'text-orange-500' : 'text-zinc-400'}`}
      >
        ▲
      </button>
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{score}</span>
      <button
        onClick={() => onVote(-1)}
        aria-label="Голосовать против"
        className={`text-xs leading-none hover:text-blue-500 ${myVote === -1 ? 'text-blue-500' : 'text-zinc-400'}`}
      >
        ▼
      </button>
    </div>
  );
}

export function CommentThread({
  comment,
  postId,
  onAdded,
  isExpanded,
  onToggleExpand,
}: {
  comment: Comment;
  postId: string;
  onAdded: () => void;
  isExpanded: (commentId: string) => boolean;
  onToggleExpand: (commentId: string) => void;
}) {
  const { session } = useSession();
  const { score, myVote, vote, error: voteError, message } = useVote(comment.id, comment.score, comment.myVote, 'comment');

  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const hasReplies = comment.replies.length > 0;
  const collapsed = hasReplies && !isExpanded(comment.id);
  const descendantCount = hasReplies ? countDescendants(comment) : 0;

  async function submitReply(e: SubmitEvent) {
    e.preventDefault();
    setReplyError(null);
    setSubmitting(true);

    try {
      await apiFetch('/comments', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, parent_comment_id: comment.id, body }),
      });
      setBody('');
      setReplying(false);
      onAdded();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Не удалось отправить ответ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 border-l border-black/[.08] pl-4 dark:border-white/[.145]">
      {collapsed ? (
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <VoteArrows score={score} myVote={myVote} onVote={vote} />
            <button
              onClick={() => onToggleExpand(comment.id)}
              aria-label="Развернуть ветку"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              [+] {descendantCount} {pluralizeReplies(descendantCount)}
            </button>
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{comment.author.username}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatRelativeDate(comment.created_at)}</span>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{truncateWords(comment.body)}</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex flex-col items-center gap-0.5 pt-0.5">
            <VoteArrows score={score} myVote={myVote} onVote={vote} />
          </div>

          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              {hasReplies && (
                <button
                  onClick={() => onToggleExpand(comment.id)}
                  aria-label="Свернуть ветку"
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  [–]
                </button>
              )}
              <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{comment.author.username}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatRelativeDate(comment.created_at)}</span>
            </div>

            <p className="text-sm text-black dark:text-zinc-50">{comment.body}</p>

            {message && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{message}</p>}
            {voteError && <p className="text-xs text-red-600 dark:text-red-400">{voteError}</p>}

            {session && (
              <button
                onClick={() => setReplying((v) => !v)}
                className="self-start text-xs font-medium text-zinc-500 hover:underline"
              >
                {replying ? 'Отмена' : 'Ответить'}
              </button>
            )}

            {replying && (
              <form onSubmit={submitReply} className="flex flex-col gap-2">
                <textarea
                  required
                  rows={2}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Ваш ответ…"
                  className="rounded-md border border-black/[.08] px-2 py-1 text-sm text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
                />
                {replyError && <p className="text-xs text-red-600 dark:text-red-400">{replyError}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="self-start rounded-full bg-foreground px-4 py-1 text-xs font-medium text-background disabled:opacity-50 dark:hover:bg-[#ccc]"
                >
                  Отправить
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {!collapsed && hasReplies && (
        <div className="mt-1 flex flex-col gap-3">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              postId={postId}
              onAdded={onAdded}
              isExpanded={isExpanded}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}
