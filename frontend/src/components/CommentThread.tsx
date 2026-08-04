'use client';

import { useState, SubmitEvent } from 'react';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { formatCompactAge } from '@/lib/formatDate';
import { pluralizeReplies } from '@/lib/pluralize';
import Link from 'next/link';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';
import { VoteBlock } from '@/components/VoteBlock';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { Comment } from '@/lib/types';

function countDescendants(comment: Comment): number {
  return comment.replies.reduce((sum, reply) => sum + 1 + countDescendants(reply), 0);
}

/** Лежит ли искомый комментарий где-то в этой ветке. */
function contains(comment: Comment, id: string): boolean {
  return comment.replies.some((reply) => reply.id === id || contains(reply, id));
}

function truncateWords(text: string, wordCount = 8): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= wordCount) return text;
  return `${words.slice(0, wordCount).join(' ')}…`;
}

/**
 * Ветка комментариев. Раньше здесь жила вёрстка, оставшаяся до редизайна:
 * захардкоженная палитра Tailwind (bg-zinc, text-black), стрелки символами
 * «▲▼» и рамки в оттенках, которых нет в теме. Отсюда и вид «текст в ворде на
 * чёрном фоне» — экран просто не участвовал в общем оформлении.
 */
export function CommentThread({
  comment,
  postId,
  onAdded,
  isExpanded,
  onToggleExpand,
  depth = 0,
  highlightId,
}: {
  comment: Comment;
  postId: string;
  onAdded: () => void;
  isExpanded: (commentId: string) => boolean;
  onToggleExpand: (commentId: string) => void;
  /** Уровень вложенности: от него зависит сдвиг ответа вправо. */
  depth?: number;
  /** Комментарий, к которому пришли по ссылке, — подсвечивается на секунду. */
  highlightId?: string | null;
}) {
  const { session } = useSession();
  const { requestVerification } = usePhoneGate();

  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // Автор комментария может не иметь id, если бэкенд отдал только имя —
  // тогда ссылка никуда не ведёт, но разметка не ломается.
  const authorHref = comment.author.id ? `/u/${comment.author.id}` : '#';
  const highlighted = highlightId === comment.id;
  const hasReplies = comment.replies.length > 0;
  // Ветку с искомым комментарием держим раскрытой принудительно: свёрнутая
  // не рендерит ответы, и прокручивать было бы не к чему.
  const holdsTarget = Boolean(highlightId) && contains(comment, highlightId!);
  const collapsed = hasReplies && !isExpanded(comment.id) && !holdsTarget;
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
      if (isPhoneNotVerifiedError(err)) {
        setReplying(false);
        requestVerification();
        return;
      }
      setReplyError(err instanceof Error ? err.message : 'Не удалось отправить ответ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      id={`comment-${comment.id}`}
      className={`flex flex-col gap-2 rounded-xl ${highlighted ? 'comment-highlight' : ''}`}
    >
      <div className="flex gap-2.5">
        <Link href={authorHref} className="flex-none">
          <DefaultAvatar name={comment.author.username} size={30} />
        </Link>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2 text-[13px]">
            <Link
              href={authorHref}
              className="font-semibold text-[var(--text)] hover:underline"
            >
              {comment.author.username}
            </Link>
            <span className="text-[var(--text-muted)]">{formatCompactAge(comment.created_at)}</span>
            {hasReplies && (
              <button
                onClick={() => onToggleExpand(comment.id)}
                className="text-[12.5px] font-medium"
                style={{ color: 'var(--accent)' }}
              >
                {collapsed ? `${descendantCount} ${pluralizeReplies(descendantCount)}` : 'свернуть'}
              </button>
            )}
          </div>

          <p className="text-[14.5px] leading-relaxed text-[var(--text)]">
            {collapsed ? truncateWords(comment.body) : comment.body}
          </p>

          {!collapsed && (
            <div className="mt-0.5 flex items-center gap-2">
              <VoteBlock
                id={comment.id}
                score={comment.score}
                myVote={comment.myVote}
                kind="comment"
                compact
              />
              {session && (
                <button
                  onClick={() => setReplying((v) => !v)}
                  className="rounded-full px-2 py-1 text-[12.5px] font-medium text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  {replying ? 'Отмена' : 'Ответить'}
                </button>
              )}
            </div>
          )}

          {replying && (
            <form onSubmit={submitReply} className="mt-1 flex flex-col gap-2">
              <textarea
                // autoFocus поднимает клавиатуру сразу: без него человек жмёт
                // «Ответить», а потом ещё раз — по самому полю.
                autoFocus
                required
                rows={2}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ваш ответ…"
                className="resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
              />
              {replyError && (
                <p className="text-[12.5px]" style={{ color: 'var(--down)' }}>{replyError}</p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="self-start rounded-full px-4 py-1.5 text-[13px] font-medium disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                Отправить
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Ответы уходят правее, а слева их держит изогнутая линия принадлежности:
          она отходит от аватарки родителя и загибается к первому ответу. Прямая
          вертикальная черта такого родства не показывала — было непонятно,
          откуда ветка растёт. Глубже четвёртого уровня сдвиг не наращиваем,
          иначе на телефоне не остаётся ширины под текст. */}
      {!collapsed && hasReplies && (
        <div
          className="reply-branch flex flex-col gap-4"
          style={{ marginLeft: depth < 4 ? 15 : 0 }}
        >
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              postId={postId}
              onAdded={onAdded}
              isExpanded={isExpanded}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
              highlightId={highlightId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
