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

/** Лежит ли искомый комментарий где-то в этой ветке. */
function contains(comment: Comment, id: string): boolean {
  return comment.replies.some((reply) => reply.id === id || contains(reply, id));
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
  isCollapsed,
  onToggleCollapse,
  depth = 0,
  highlightId,
}: {
  comment: Comment;
  postId: string;
  onAdded: () => void;
  isCollapsed: (commentId: string) => boolean;
  onToggleCollapse: (commentId: string) => void;
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

  // Ветка открыта, пока её не свернули. Прошлая схема показывала часть ответов
  // и прятала остальные — на одну кнопку приходилось три состояния, и было
  // непонятно, что она сделает: «Свернуть» убирала не всё, «Ещё» открывала не
  // с начала. Теперь состояний два, и оба видно по подписи.
  const collapsed = hasReplies && isCollapsed(comment.id) && !holdsTarget;
  const replyCount = comment.replies.length;

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
      // holdsTarget здесь не только про раскрытие ветки: пока действует
      // указание, все комментарии, кроме искомого, приглушаются, а
      // прозрачность наследуется по дереву — не пометив ветку, мы приглушили
      // бы вместе с ней и саму цель. Отмечать предков в CSS через :has()
      // не вышло: Lightning CSS выбрасывает такое правило из сборки целиком.
      className={`flex flex-col gap-2 ${
        highlighted ? 'comment-highlight' : holdsTarget ? 'comment-holds-target' : ''
      }`}
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
          </div>

          <p className="text-[13.5px] leading-relaxed text-[var(--text)]">{comment.body}</p>

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
      {hasReplies && (
        <div
          className="reply-branch flex flex-col gap-4"
          style={{ marginLeft: depth < 4 ? 15 : 0 }}
        >
          {/* Ветка схлопывается по высоте, а не выдёргивается из разметки:
              grid-rows от 1fr к 0fr — единственный способ анимировать высоту
              содержимого, размер которого заранее неизвестен. Ответы при этом
              остаются в разметке, поэтому схлопывать есть что. */}
          <div
            className="grid"
            style={{
              gridTemplateRows: collapsed ? '0fr' : '1fr',
              opacity: collapsed ? 0 : 1,
              transition:
                'grid-template-rows 0.34s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.24s ease',
            }}
          >
            <div className="overflow-hidden">
              <div className="flex flex-col gap-4">
                {comment.replies.map((reply) => (
                  <CommentThread
                    key={reply.id}
                    comment={reply}
                    postId={postId}
                    onAdded={onAdded}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={onToggleCollapse}
                    depth={depth + 1}
                    highlightId={highlightId}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Подписи лежат друг на друге в одной клетке грида и меняются
              перекрёстным затуханием: смена текста в один кадр дёргала
              ширину кнопки. */}
          <button
            onClick={() => onToggleCollapse(comment.id)}
            className="grid self-start rounded-lg text-[13px] font-medium transition-transform active:scale-95"
            style={{ color: 'var(--accent)' }}
          >
            {[
              {
                key: 'more',
                show: collapsed,
                text: `Показать ${replyCount} ${pluralizeReplies(replyCount)}`,
              },
              { key: 'less', show: !collapsed, text: 'Свернуть' },
            ].map((label) => (
              <span
                key={label.key}
                aria-hidden={!label.show}
                className="col-start-1 row-start-1 whitespace-nowrap text-left"
                style={{
                  opacity: label.show ? 1 : 0,
                  transform: label.show ? 'none' : 'translateY(-3px)',
                  pointerEvents: label.show ? 'auto' : 'none',
                  transition: 'opacity 0.22s ease, transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)',
                }}
              >
                {label.text}
              </span>
            ))}
          </button>
        </div>
      )}
    </div>
  );
}
