'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, SubmitEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { useApiData } from '@/lib/useApiData';
import { Message, UserProfile } from '@/lib/types';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { BottomSheet } from '@/components/BottomSheet';
import { setNavHidden } from '@/lib/navVisibility';

/** Как часто перечитываем переписку, пока она открыта. */
const POLL_MS = 4000;

/** Быстрые реакции. Тот же короткий набор, что в мессенджерах. */
const QUICK_REACTIONS = ['❤️', '👍', '🔥', '😂', '😮', '😢'];

/** Разделитель по дням — чтобы не гадать, когда именно это было сказано. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return 'Сегодня';

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Переписка с одним человеком.
 *
 * Устроена как в мессенджерах: пузыри с хвостиком у последнего в цепочке,
 * подряд идущие реплики одного человека прижаты друг к другу, у своих —
 * галочки о доставке и прочтении, по нажатию на пузырь открывается меню
 * с реакциями, правкой и удалением.
 *
 * Новые письма забираем опросом раз в несколько секунд: живого канала в
 * приложении нет, а сокет ради одной страницы тянет за собой инфраструктуру,
 * которой больше нигде не пользуются.
 */
export default function ChatPage() {
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Какое сообщение открыто в меню и какое сейчас правим.
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);

  const person = useApiData<UserProfile>(`/users/${userId}`).data;
  const me = session?.user.id;

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    apiFetch<Message[]>(`/messages/${userId}`)
      .then(setMessages)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить'));
  }, [userId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Входящие считаются прочитанными фактом открытия переписки — так же, как
  // в любом мессенджере.
  useEffect(() => {
    apiFetch(`/messages/${userId}/read`, { method: 'POST' }).catch(() => undefined);
  }, [userId, messages.length]);

  // Бар уезжает вниз: на этом экране его место занимает строка ввода.
  useEffect(() => {
    setNavHidden(true);
    return () => setNavHidden(false);
  }, []);

  // Переписку открываем на последнем письме — прокручивать снизу вверх
  // никто не станет.
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function send(e: SubmitEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);
    try {
      if (editing) {
        const updated = await apiFetch<Message>(`/messages/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ body: text }),
        });
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        setEditing(null);
      } else {
        const created = await apiFetch<Message>('/messages', {
          method: 'POST',
          body: JSON.stringify({ recipient_id: userId, body: text }),
        });
        setMessages((prev) => [...prev, created]);
      }
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  }

  async function react(message: Message, emoji: string) {
    setMenuFor(null);
    // Показываем сразу, не дожидаясь сети: действие безобидное, а ждать
    // полсекунды ради смайлика незачем.
    const mine = message.reactions?.find((r) => r.userId === me);
    const next = (message.reactions ?? []).filter((r) => r.userId !== me);
    if (mine?.emoji !== emoji && me) next.push({ emoji, userId: me });
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions: next } : m)));

    try {
      await apiFetch(`/messages/${message.id}/reaction`, {
        method: 'PUT',
        body: JSON.stringify({ emoji }),
      });
    } catch {
      load();
    }
  }

  async function remove(message: Message) {
    setMenuFor(null);
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
    try {
      await apiFetch(`/messages/${message.id}`, { method: 'DELETE' });
    } catch {
      load();
    }
  }

  function startEditing(message: Message) {
    setMenuFor(null);
    setEditing(message);
    setBody(message.body);
    // Фокус через кадр: шторка ещё закрывается и забирает его себе.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  // Дату ставим перед первым письмом дня, а подряд идущие реплики одного
  // человека склеиваем: хвостик рисуется только у последней в цепочке.
  const rows = messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const day = dayLabel(message.created_at);
    return {
      message,
      day,
      showDay: index === 0 || day !== dayLabel(previous.created_at),
      groupStart: !previous || previous.sender_id !== message.sender_id,
      groupEnd: !next || next.sender_id !== message.sender_id || day !== dayLabel(next.created_at),
    };
  });

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-1 flex-col px-2.5 pb-28">
        <div className="mb-2 flex items-center gap-2 px-1">
          <button
            onClick={() => router.back()}
            aria-label="Назад"
            className="-ml-1 flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--text)] transition-transform active:scale-90"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <Link href={`/u/${userId}`} className="flex min-w-0 flex-1 items-center gap-2.5">
            <DefaultAvatar name={person?.username ?? '?'} size={38} />
            <span className="min-w-0 truncate text-[16px] font-semibold text-[var(--text)]">
              {person?.username ?? '…'}
            </span>
          </Link>
        </div>

        {/* Ни карточки, ни стекла: в переписке фон — это фон, а не лист бумаги
            во весь экран. Белый прямоугольник под пузырями только отбирал у них
            контраст. */}
        <section className="flex flex-1 flex-col gap-0.5 px-1 py-2">
          {messages.length === 0 && (
            <p className="py-12 text-center text-[14.5px] leading-relaxed text-[var(--text-muted)]">
              Здесь пока пусто.
              <br />
              Напишите первое сообщение.
            </p>
          )}

          {rows.map(({ message, day, showDay, groupStart, groupEnd }) => {
            const mine = message.sender_id === me;
            const reactions = message.reactions ?? [];

            return (
              <div key={message.id} className="flex flex-col">
                {showDay && (
                  <span
                    className="my-3 self-center rounded-full px-3 py-1 text-[11.5px] font-medium"
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                  >
                    {day}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => setMenuFor(message)}
                  className="chat-bubble max-w-[80%] px-3.5 py-2 text-left"
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    background: mine ? 'var(--accent)' : 'var(--surface-2)',
                    color: mine ? 'var(--accent-contrast)' : 'var(--text)',
                    marginTop: groupStart ? 6 : 0,
                    // Хвостик — у последнего пузыря цепочки: у всех подряд он
                    // превращал столбик реплик в частокол.
                    borderTopRightRadius: mine && !groupStart ? 8 : 18,
                    borderBottomRightRadius: mine && !groupEnd ? 8 : mine ? 6 : 18,
                    borderTopLeftRadius: !mine && !groupStart ? 8 : 18,
                    borderBottomLeftRadius: !mine && !groupEnd ? 8 : !mine ? 6 : 18,
                  }}
                >
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                    {message.body}
                  </p>

                  <span
                    className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px]"
                    style={{ opacity: 0.7 }}
                  >
                    {message.edited_at && <span>изменено</span>}
                    <span className="font-num">{timeLabel(message.created_at)}</span>
                    {/* Галочки только у своих: чужие сообщения о своём
                        прочтении собеседнику ничего не говорят. */}
                    {mine && (
                      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M1 6.2 4 9.2 9.6 2.2" />
                        {message.read_at && <path d="M6.4 9.2 12 2.2" />}
                      </svg>
                    )}
                  </span>
                </button>

                {reactions.length > 0 && (
                  <span
                    className="-mt-1.5 flex w-fit items-center gap-1 rounded-full px-2 py-0.5"
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {reactions.map((reaction) => (
                      <span key={reaction.userId} className="emoji text-[13px]">
                        {reaction.emoji}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
          <div ref={bottomRef} />
        </section>

        {error && (
          <p className="px-2 pt-2 text-[13px]" style={{ color: 'var(--down)' }}>
            {error}
          </p>
        )}
      </main>

      {/* Строка ввода прижата к кромке — там же, где обычно стоит бар. */}
      <form
        onSubmit={send}
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center px-3 md:pl-20"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      >
        {/* Полоска правки — как в мессенджерах: видно, что именно правишь,
            и видно, чем это отменить. */}
        <div
          className="grid w-full max-w-2xl"
          style={{
            gridTemplateRows: editing ? '1fr' : '0fr',
            opacity: editing ? 1 : 0,
            transition:
              'grid-template-rows 0.26s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
          }}
        >
          <div className="overflow-hidden">
            <div
              className="mb-1.5 flex items-center gap-2 rounded-2xl px-3 py-2"
              style={{ background: 'var(--surface-2)' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
              </svg>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)]">
                {editing?.body}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setBody('');
                }}
                aria-label="Отменить правку"
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[var(--text-muted)] transition-transform active:scale-90"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <div className="glass flex w-full max-w-2xl items-center gap-2 rounded-full py-1 pl-4 pr-1.5">
          <input
            ref={inputRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Сообщение"
            enterKeyHint="send"
            className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[15px] text-[var(--text)] outline-none"
          />
          {/* Кнопка отправки вырастает, когда есть что отправлять: пустая
              строка не предлагает нажать. */}
          <button
            type="submit"
            disabled={!body.trim() || sending}
            aria-label={editing ? 'Сохранить' : 'Отправить'}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              transform: body.trim() ? 'scale(1)' : 'scale(0.7)',
              opacity: body.trim() ? 1 : 0.35,
              transition:
                'transform 0.24s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
            }}
          >
            {editing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M12 6l6 6-6 6" />
              </svg>
            )}
          </button>
        </div>
      </form>

      <BottomSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title="Сообщение"
        height="auto"
      >
        <div
          className="flex flex-col gap-1 py-1"
          style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center justify-between gap-1 pb-2">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => menuFor && react(menuFor, emoji)}
                className="emoji flex h-11 w-11 items-center justify-center rounded-full text-[24px] transition-transform active:scale-90"
                style={{
                  background:
                    menuFor?.reactions?.find((r) => r.userId === me)?.emoji === emoji
                      ? 'var(--accent-soft)'
                      : 'transparent',
                }}
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              if (menuFor) navigator.clipboard?.writeText(menuFor.body).catch(() => undefined);
              setMenuFor(null);
            }}
            className="flex items-center gap-3 rounded-xl px-1 py-3.5 text-left text-[15px] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
            </svg>
            Скопировать текст
          </button>

          {menuFor?.sender_id === me && (
            <button
              type="button"
              onClick={() => menuFor && startEditing(menuFor)}
              className="flex items-center gap-3 rounded-xl px-1 py-3.5 text-left text-[15px] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                <path d="m14.5 7.5 2 2" />
              </svg>
              Редактировать
            </button>
          )}

          {menuFor?.sender_id === me && (
            <button
              type="button"
              onClick={() => menuFor && remove(menuFor)}
              className="flex items-center gap-3 rounded-xl px-1 py-3.5 text-left text-[15px] transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--down)' }}
            >
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                <path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2h9.4L17.5 7" />
                <path d="M10.5 11v5M13.5 11v5" />
              </svg>
              Удалить
            </button>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
