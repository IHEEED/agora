'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, SubmitEvent } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { useApiData } from '@/lib/useApiData';
import { Message, UserProfile, UserSummary } from '@/lib/types';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { MessageActions } from '@/components/MessageActions';
import { BottomSheet } from '@/components/BottomSheet';
import { PersonMenuSheet } from '@/components/PersonMenuSheet';
import { setNavHidden } from '@/lib/navVisibility';

/** Как часто перечитываем переписку, пока она открыта.
    Раньше был 4000 — при плохой сети задержка на запросе могла совпасть
    с exit-анимацией и дать lag. Теперь реже, но и при плохой сети одна
    зависшая очередь не заблокирует экран. */
const POLL_MS = 6000;

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
  // Какое сообщение открыто в меню, где оно лежит на экране и что сейчас правим.
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  // Кому отвечаем. Ссылка на сообщение, а не копия текста: оригинал могут
  // поправить, и цитата обязана поправиться вместе с ним.
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  // Режим выбора: пока он включён, нажатие по пузырю не открывает меню, а
  // отмечает сообщение. Так же ведут себя списки в почте и мессенджерах.
  const [selected, setSelected] = useState<string[] | null>(null);
  // Что пересылаем. Список получателей открывается шторкой.
  const [forwarding, setForwarding] = useState<Message[] | null>(null);
  // Меню собеседника: жалоба, блокировка, очистка переписки.
  const [personMenu, setPersonMenu] = useState(false);

  const person = useApiData<UserProfile>(`/users/${userId}`).data;
  // Кому можно переслать. Запрос уходит только когда шторку открыли.
  const people = useApiData<UserSummary[]>(forwarding ? '/users' : null);
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

  /**
   * Выход свайпом от левого края — тем же жестом, что и в системной навигации.
   * Экран едет за пальцем, и если утащить его дальше трети ширины, переписка
   * закрывается; иначе возвращается на место.
   *
   * Жест ловим только у самой кромки: начнись он посреди экрана — и любое
   * горизонтальное движение по списку сообщений закрывало бы чат.
   */
  /**
   * Удержание пузыря открывает меню действий. Полсекунды — привычный порог:
   * короче, и меню выскакивает при обычном касании во время прокрутки.
   * Любое движение пальцем отменяет удержание по той же причине.
   */
  const HOLD_MS = 480;
  const holdTimer = useRef<number | undefined>(undefined);

  function openMenu(message: Message, rect: DOMRect) {
    setMenuAnchor(rect);
    setMenuFor(message);
  }

  function holdStart(event: React.PointerEvent<HTMLButtonElement>, message: Message) {
    const rect = event.currentTarget.getBoundingClientRect();
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => openMenu(message, rect), HOLD_MS);
  }

  function holdCancel() {
    window.clearTimeout(holdTimer.current);
  }

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const EDGE_ZONE = 28;
  const dragFrom = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  // Отдельный флаг вместо чтения ref в разметке: ref для отрисовки не годится,
  // React о его изменении не знает.
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const leave = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => router.back(), 260);
  }, [router]);

  function onPointerDown(event: React.PointerEvent) {
    if (event.clientX > EDGE_ZONE || leaving) return;
    dragFrom.current = event.clientX;
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (dragFrom.current === null) return;
    setDragX(Math.max(0, event.clientX - dragFrom.current));
  }

  function onPointerUp() {
    if (dragFrom.current === null) return;
    const far = dragX > window.innerWidth / 3;
    dragFrom.current = null;
    setDragging(false);
    setDragX(0);
    if (far) leave();
  }

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
          body: JSON.stringify({
            recipient_id: userId,
            body: text,
            reply_to_id: replyTo?.id ?? null,
          }),
        });
        // Цитату дорисовываем на месте: сервер вернул само сообщение, а
        // оригинал у нас уже есть — перечитывать переписку ради него незачем.
        setMessages((prev) => [
          ...prev,
          replyTo
            ? {
                ...created,
                replyTo: { id: replyTo.id, body: replyTo.body, mine: replyTo.sender_id === me },
              }
            : created,
        ]);
        setReplyTo(null);
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

  function startReply(message: Message) {
    setMenuFor(null);
    setReplyTo(message);
    setEditing(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /** Закрепить или снять закрепление. Общее на переписку, не личное. */
  async function togglePin(message: Message) {
    setMenuFor(null);
    const pinned = !message.pinned_at;
    const stamp = pinned ? new Date().toISOString() : null;
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, pinned_at: stamp } : m))
    );

    try {
      await apiFetch(`/messages/${message.id}/pin`, {
        method: 'PUT',
        body: JSON.stringify({ pinned }),
      });
    } catch {
      load();
    }
  }

  /** Включить режим выбора, сразу отметив то сообщение, с которого начали. */
  function startSelecting(message: Message) {
    setMenuFor(null);
    setSelected([message.id]);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      if (!prev) return prev;
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  /** Разослать выбранное другому человеку. Копией, а не ссылкой: переписки
      независимы, и удаление оригинала не должно стирать пересланное. */
  async function forwardTo(recipientId: string) {
    const list = forwarding ?? [];
    setForwarding(null);
    setSelected(null);
    try {
      // По очереди, а не разом: сервер принимает по одному сообщению, а
      // порядок пересланного должен совпасть с порядком в переписке.
      for (const message of list) {
        await apiFetch('/messages', {
          method: 'POST',
          body: JSON.stringify({ recipient_id: recipientId, body: message.body }),
        });
      }
      // Переслал самому себе — пусть увидит их сразу.
      if (recipientId === userId) load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось переслать');
    }
  }

  /** Очистить переписку: сервер удалит только наши письма, чужие останутся. */
  async function clearChat() {
    try {
      await apiFetch(`/messages/thread/${userId}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((m) => m.sender_id !== me));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось очистить переписку');
    }
  }

  async function removeSelected() {
    const ids = selected ?? [];
    setSelected(null);
    setMessages((prev) => prev.filter((m) => !ids.includes(m.id)));
    try {
      await Promise.all(
        ids.map((id) => apiFetch(`/messages/${id}`, { method: 'DELETE' }))
      );
    } catch {
      load();
    }
  }

  // Закреплённые — в порядке закрепления: последнее закреплённое показывается
  // в полоске под шапкой, остальные считаются счётчиком рядом.
  const pinned = messages
    .filter((message) => message.pinned_at)
    .sort((a, b) => String(a.pinned_at).localeCompare(String(b.pinned_at)));

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
    <div
      className="flex flex-1 flex-col items-center"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        // Уезжает вправо — тем же движением, каким пришёл слева.
        // В покое transform именно none, а не translateX(0): любой transform
        // создаёт слой, из которого дочернему пузырю не подняться над
        // размытием меню — сообщение оставалось замыленным вместе с фоном.
        transform: leaving ? 'translateX(100%)' : dragX ? `translateX(${dragX}px)` : 'none',
        opacity: leaving ? 0 : 1,
        // Пока тянут пальцем — без перехода, иначе экран отстаёт от руки.
        // Уход резкий и короткий: решение уже принято, тянуть его незачем.
        transition: dragging
          ? 'none'
          : leaving
            ? 'transform var(--exit-ms) var(--exit-ease), opacity var(--exit-ms) var(--exit-ease)'
            : 'transform 0.3s var(--enter-ease), opacity 0.24s ease',
      }}
    >
      {/* Обои: фон одного этого экрана. Absolute, а не fixed, — у страницы при
          свайпе появляется transform, и fixed привязался бы к ней в середине
          жеста, дав скачок. */}
      <div className="chat-wallpaper" aria-hidden />

      <main className="below-header relative flex w-full max-w-2xl flex-1 flex-col px-2.5 pb-28">
        {/* Шапка переписки в двух видах. Пока ничего не выбрано — собеседник и
            выход; как только включён режим выбора, она превращается в панель
            действий над отмеченным. Так же ведут себя списки в почте: панель
            занимает место заголовка, а не появляется третьей полосой. */}
        {selected ? (
          <div className="mb-2 flex items-center gap-1 px-1">
            <button
              onClick={() => setSelected(null)}
              aria-label="Отменить выбор"
              className="-ml-1 flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--text)] transition-transform active:scale-90"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <span className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--text)]">
              <span className="font-num">{selected.length}</span>
            </span>

            <button
              onClick={() =>
                setForwarding(messages.filter((m) => selected.includes(m.id)))
              }
              disabled={selected.length === 0}
              aria-label="Переслать"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-30"
              style={{ color: 'var(--accent)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 5.5 20 12l-7 6.5V15c-4 0-7 1.2-9 4 .6-4.8 3.6-8.4 9-9Z" />
              </svg>
            </button>
            <button
              onClick={removeSelected}
              disabled={
                selected.length === 0 ||
                // Удалять можно только свои: сервер всё равно откажет, и
                // предлагать заведомо провальное действие нечестно.
                messages.some((m) => selected.includes(m.id) && m.sender_id !== me)
              }
              aria-label="Удалить"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-30"
              style={{ color: 'var(--down)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2h9.4L17.5 7" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="mb-2 flex items-center gap-2 px-1">
            <button
              onClick={leave}
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

            <button
              onClick={() => setPersonMenu(true)}
              aria-label="Действия"
              className="-mr-1 flex h-10 w-10 flex-none items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--control)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          </div>
        )}

        {/* Закреплённое — полоской под шапкой, как в мессенджерах: оно должно
            быть на виду, не занимая места в самой переписке. */}
        {pinned.length > 0 && !selected && (
          <button
            type="button"
            onClick={() => {
              document
                .getElementById(`msg-${pinned[pinned.length - 1].id}`)
                ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="mb-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors active:bg-[var(--surface-2)]"
            style={{ background: 'var(--surface-2)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
              <path d="M9 4h6l-1 6 4 3v2H6v-2l4-3Z" />
              <path d="M12 15v5" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)]">
              {pinned[pinned.length - 1].body}
            </span>
            {pinned.length > 1 && (
              <span className="font-num flex-none text-[12px] text-[var(--text-muted)]">
                {pinned.length}
              </span>
            )}
          </button>
        )}

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
                  id={`msg-${message.id}`}
                  onPointerDown={(event) => {
                    // В режиме выбора удержание не нужно: нажатие и так что-то
                    // делает, а меню поверх выбора — два способа управления
                    // одним и тем же.
                    if (!selected) holdStart(event, message);
                  }}
                  onPointerUp={holdCancel}
                  onPointerLeave={holdCancel}
                  onPointerMove={holdCancel}
                  onClick={() => selected && toggleSelected(message.id)}
                  onContextMenu={(event) => {
                    // Правая кнопка — то же самое удержание, только на настольном
                    // экране, где держать нечем.
                    event.preventDefault();
                    if (!selected) openMenu(message, event.currentTarget.getBoundingClientRect());
                  }}
                  className="chat-bubble max-w-[80%] px-3.5 py-2 text-left"
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    // Открытое сообщение остаётся поверх размытия — меню
                    // относится к нему, и оно должно читаться.
                    zIndex: menuFor?.id === message.id ? 72 : undefined,
                    position: menuFor?.id === message.id ? 'relative' : undefined,
                    background: mine ? 'var(--accent)' : 'var(--surface-2)',
                    color: mine ? 'var(--accent-contrast)' : 'var(--text)',
                    marginTop: groupStart ? 6 : 0,
                    // Отмеченное обводится акцентом снаружи, а не заливается:
                    // заливка спорила бы с собственным цветом пузыря.
                    boxShadow: selected?.includes(message.id)
                      ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)'
                      : undefined,
                    // Хвостик — у последнего пузыря цепочки: у всех подряд он
                    // превращал столбик реплик в частокол.
                    borderTopRightRadius: mine && !groupStart ? 8 : 18,
                    borderBottomRightRadius: mine && !groupEnd ? 8 : mine ? 6 : 18,
                    borderTopLeftRadius: !mine && !groupStart ? 8 : 18,
                    borderBottomLeftRadius: !mine && !groupEnd ? 8 : !mine ? 6 : 18,
                  }}
                >
                  {/* Цитата над ответом. Полоска слева и приглушённый текст —
                      она подпись к реплике, а не сама реплика. */}
                  {message.replyTo && (
                    <span
                      className="mb-1 flex flex-col gap-0.5 rounded-md py-0.5 pl-2 pr-1"
                      style={{
                        borderLeft: '2px solid currentColor',
                        background: mine
                          ? 'color-mix(in srgb, var(--accent-contrast) 14%, transparent)'
                          : 'color-mix(in srgb, var(--text) 7%, transparent)',
                      }}
                    >
                      <span className="text-[11.5px] font-semibold" style={{ opacity: 0.85 }}>
                        {message.replyTo.mine ? 'Вы' : (person?.username ?? '…')}
                      </span>
                      <span className="line-clamp-2 text-[12.5px]" style={{ opacity: 0.75 }}>
                        {message.replyTo.body}
                      </span>
                    </span>
                  )}

                  <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                    {message.body}
                  </p>

                  <span
                    className="mt-0.5 flex items-center justify-end gap-1 text-[10.5px]"
                    style={{ opacity: 0.7 }}
                  >
                    {message.pinned_at && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Закреплено">
                        <path d="M9 4h6l-1 6 4 3v2H6v-2l4-3Z" />
                        <path d="M12 15v5" />
                      </svg>
                    )}
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
        {/* Полоска над строкой ввода — одна на правку и на ответ: и то и другое
            отвечает на вопрос «что сейчас происходит с этим полем», и две
            полосы подряд означали бы, что можно править и отвечать разом. */}
        <div
          className="grid w-full max-w-2xl"
          style={{
            gridTemplateRows: editing || replyTo ? '1fr' : '0fr',
            opacity: editing || replyTo ? 1 : 0,
            transition:
              'grid-template-rows 0.26s var(--enter-ease), opacity 0.2s ease',
          }}
        >
          <div className="overflow-hidden">
            <div
              className="mb-1.5 flex items-center gap-2 rounded-2xl px-3 py-2"
              style={{ background: 'var(--surface-2)' }}
            >
              {editing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  <path d="M11 5.5 4 12l7 6.5V15c4 0 7 1.2 9 4-.6-4.8-3.6-8.4-9-9Z" />
                </svg>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11.5px] font-semibold" style={{ color: 'var(--accent)' }}>
                  {editing ? 'Правка' : `Ответ ${person?.username ?? ''}`.trim()}
                </span>
                <span className="min-w-0 truncate text-[13px] text-[var(--text-muted)]">
                  {(editing ?? replyTo)?.body}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setReplyTo(null);
                  if (editing) setBody('');
                }}
                aria-label={editing ? 'Отменить правку' : 'Отменить ответ'}
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

      <MessageActions
        open={menuFor !== null}
        anchor={menuAnchor}
        reactions={QUICK_REACTIONS}
        activeReaction={menuFor?.reactions?.find((r) => r.userId === me)?.emoji}
        onReact={(emoji) => menuFor && react(menuFor, emoji)}
        onClose={() => setMenuFor(null)}
        actions={[
          {
            key: 'reply',
            label: 'Ответить',
            icon: <path d="M11 5.5 4 12l7 6.5V15c4 0 7 1.2 9 4-.6-4.8-3.6-8.4-9-9Z" />,
            onSelect: () => menuFor && startReply(menuFor),
          },
          {
            key: 'forward',
            label: 'Переслать',
            icon: <path d="M13 5.5 20 12l-7 6.5V15c-4 0-7 1.2-9 4 .6-4.8 3.6-8.4 9-9Z" />,
            onSelect: () => {
              if (menuFor) setForwarding([menuFor]);
              setMenuFor(null);
            },
          },
          {
            key: 'pin',
            label: menuFor?.pinned_at ? 'Открепить' : 'Закрепить',
            icon: (
              <>
                <path d="M9 4h6l-1 6 4 3v2H6v-2l4-3Z" />
                <path d="M12 15v5" />
              </>
            ),
            onSelect: () => menuFor && togglePin(menuFor),
          },
          {
            key: 'select',
            label: 'Выбрать',
            icon: (
              <>
                <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
                <path d="m8 12 3 3 5-6" />
              </>
            ),
            onSelect: () => menuFor && startSelecting(menuFor),
          },
          {
            key: 'copy',
            label: 'Скопировать',
            icon: (
              <>
                <rect x="9" y="9" width="11" height="11" rx="2.5" />
                <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
              </>
            ),
            onSelect: () => {
              if (menuFor) navigator.clipboard?.writeText(menuFor.body).catch(() => undefined);
              setMenuFor(null);
            },
          },
          ...(menuFor?.sender_id === me
            ? [
                {
                  key: 'edit',
                  label: 'Редактировать',
                  icon: (
                    <>
                      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                      <path d="m14.5 7.5 2 2" />
                    </>
                  ),
                  onSelect: () => menuFor && startEditing(menuFor),
                },
                {
                  key: 'delete',
                  label: 'Удалить',
                  danger: true,
                  icon: (
                    <>
                      <path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2h9.4L17.5 7" />
                      <path d="M10.5 11v5M13.5 11v5" />
                    </>
                  ),
                  onSelect: () => menuFor && remove(menuFor),
                },
              ]
            : []),
        ]}
      />

      {/* Кому переслать. Список тянем только когда шторку открыли: он нужен
          раз в сотню открытий переписки. */}
      <BottomSheet
        open={forwarding !== null}
        onClose={() => setForwarding(null)}
        title={
          forwarding && forwarding.length > 1
            ? `Переслать ${forwarding.length}`
            : 'Переслать'
        }
      >
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {(people.data ?? []).map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => forwardTo(person.id)}
              className="flex items-center gap-3 py-3 text-left transition-colors active:bg-[var(--surface-2)]"
            >
              <DefaultAvatar name={person.username} size={44} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--text)]">
                {person.username}
              </span>
            </button>
          ))}
          {people.loading && <p className="py-6 text-[var(--text-muted)]">Загрузка…</p>}
        </div>
      </BottomSheet>

      <PersonMenuSheet
        open={personMenu}
        onClose={() => setPersonMenu(false)}
        userId={userId}
        username={person?.username ?? '—'}
        url={typeof window === 'undefined' ? '' : `${window.location.origin}/u/${userId}`}
        onClearChat={clearChat}
      />
    </div>
  );
}
