'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, SubmitEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { useApiData } from '@/lib/useApiData';
import { Message, UserProfile } from '@/lib/types';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { setNavHidden } from '@/lib/navVisibility';

/** Как часто перечитываем переписку, пока она открыта. */
const POLL_MS = 4000;

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

  const person = useApiData<UserProfile>(`/users/${userId}`).data;
  const me = session?.user.id;

  const bottomRef = useRef<HTMLDivElement>(null);

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
      const created = await apiFetch<Message>('/messages', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: userId, body: text }),
      });
      setMessages((prev) => [...prev, created]);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  }

  // Дату ставим перед первым письмом дня. Считаем список заранее, а не
  // накапливаем переменную по ходу разметки: переменная, которую правят внутри
  // map, живёт дольше рендера и на следующем проходе врёт.
  const dated = messages.map((message, index) => ({
    message,
    day: dayLabel(message.created_at),
    showDay:
      index === 0 || dayLabel(message.created_at) !== dayLabel(messages[index - 1].created_at),
  }));

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-1 flex-col px-2.5 pb-28">
        <div className="mb-2 flex items-center gap-2 px-1">
          <button
            onClick={() => router.back()}
            aria-label="Назад"
            className="-ml-1 flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
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

        <section className="glass flex flex-1 flex-col gap-2 rounded-2xl px-3 py-4">
          {messages.length === 0 && (
            <p className="py-12 text-center text-[14.5px] leading-relaxed text-[var(--text-muted)]">
              Здесь пока пусто.
              <br />
              Напишите первое сообщение.
            </p>
          )}

          {dated.map(({ message, day, showDay }) => {
            const mine = message.sender_id === me;

            return (
              <div key={message.id} className="flex flex-col">
                {showDay && (
                  <span className="my-2 self-center text-[11.5px] text-[var(--text-muted)]">
                    {day}
                  </span>
                )}
                {/* Свои письма справа и акцентом, чужие слева и стеклом —
                    привычная раскладка, по ней читают, не вчитываясь. */}
                <div
                  className="max-w-[78%] rounded-2xl px-3.5 py-2"
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    background: mine ? 'var(--accent)' : 'var(--surface-2)',
                    color: mine ? 'var(--accent-contrast)' : 'var(--text)',
                    borderBottomRightRadius: mine ? 6 : undefined,
                    borderBottomLeftRadius: mine ? undefined : 6,
                  }}
                >
                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                    {message.body}
                  </p>
                  <span
                    className="font-num mt-0.5 block text-right text-[10.5px]"
                    style={{ opacity: 0.65 }}
                  >
                    {timeLabel(message.created_at)}
                  </span>
                </div>
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
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 md:pl-20"
        style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}
      >
        <div className="glass flex w-full max-w-2xl items-center gap-2 rounded-full py-1 pl-4 pr-1.5">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Сообщение"
            enterKeyHint="send"
            className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[15px] text-[var(--text)] outline-none"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            aria-label="Отправить"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full transition-opacity disabled:opacity-30"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h13M12 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
