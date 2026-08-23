'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { formatCompactAge } from '@/lib/formatDate';
import { MessageThread } from '@/lib/types';
import { holdBackdrop } from '@/lib/screenBackdrop';
import { haptic } from '@/lib/haptics';
import { ThoughtCloud } from '@/components/ThoughtCloud';
import { useT } from '@/lib/i18n';

/**
 * Строка переписки со свайпами и удержанием.
 *
 * Три способа добраться до действий, и это не расточительство. Свайп — самый
 * быстрый, но о нём надо знать; удержание находят сами, но оно медленнее;
 * нажатие открывает переписку. В мессенджерах устроено ровно так, и человек
 * приходит сюда уже с этой привычкой.
 *
 * Стороны разведены по цене ошибки. Вправо — безобидное: закрепить; промахнулся
 * — повторный свайп вернёт как было. Влево — приглушить: тоже обратимо, но уже
 * про то, что перестанет звать. Удаление свайпом не делается вовсе: жест,
 * стирающий переписку, обязан быть неудобным, и живёт он в меню, за
 * подтверждением.
 *
 * Кнопки не выезжают плитками из-под строки — подсказка проявляется в поле,
 * которое строка освобождает. Плитки пришлось бы держать под каждой строкой
 * всегда, то есть вдвое больше узлов на весь список ради того, что видно раз в
 * неделю.
 */

/** Насколько далеко надо утащить, чтобы действие считалось выбранным. */
const TRIGGER = 68;

/** Дальше строка не едет: упор говорит, что тянуть больше некуда. */
const MAX = 128;

/** Сколько держать палец, чтобы открылось меню. */
const HOLD_MS = 450;

export function ThreadRow({
  thread,
  note,
  onPin,
  onMute,
  onMenu,
}: {
  thread: MessageThread;
  /** Мысль собеседника на сутки. Нет — облачка не будет. */
  note?: string | null;
  onPin: () => void;
  onMute: () => void;
  onMenu: (rect: DOMRect) => void;
}) {
  const { t } = useT();
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const from = useRef<{ x: number; y: number } | null>(null);
  const own = useRef(false);
  const holdTimer = useRef<number | null>(null);

  function cancelHold() {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  function down(event: React.PointerEvent) {
    if (event.pointerType === 'mouse') return;
    from.current = { x: event.clientX, y: event.clientY };
    own.current = false;

    const target = event.currentTarget as HTMLElement;
    holdTimer.current = window.setTimeout(() => {
      // Удержание засчитано — отклик и меню. Свайп при этом отменяем: два
      // способа управления, сработавшие разом, дали бы меню поверх уехавшей
      // строки.
      haptic('open');
      from.current = null;
      setDx(0);
      onMenu(target.getBoundingClientRect());
    }, HOLD_MS);
  }

  function move(event: React.PointerEvent) {
    const start = from.current;
    if (!start) return;

    const moved = event.clientX - start.x;
    const vertical = event.clientY - start.y;

    if (!own.current) {
      // Пока не решили, чей жест, не мешаем прокрутке. Вертикали приоритет:
      // пролистывание переписок должно оставаться пролистыванием, даже если
      // палец идёт наискось.
      if (Math.abs(vertical) > Math.abs(moved) || Math.abs(moved) < 12) {
        if (Math.abs(vertical) > 12) {
          cancelHold();
          from.current = null;
        }
        return;
      }
      cancelHold();
      own.current = true;
      setDragging(true);
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    // Вязкость и упор: строка отдаёт всё меньше на каждый пиксель пальца.
    const pulled = Math.min(MAX, Math.sqrt(Math.abs(moved)) * 11);
    const next = moved > 0 ? pulled : -pulled;
    if (Math.abs(next) >= TRIGGER && Math.abs(dx) < TRIGGER) haptic();
    setDx(next);
  }

  function up() {
    cancelHold();
    const settled = dx;
    from.current = null;
    own.current = false;
    setDragging(false);
    setDx(0);

    if (Math.abs(settled) < TRIGGER) return;
    // Одно действие на сторону, а не две кнопки под пальцем: выбирать между
    // ними пришлось бы глазами, а тогда свайп теряет единственное преимущество
    // перед меню — скорость.
    if (settled > 0) onPin();
    else onMute();
  }

  const right = dx > 0;
  const strength = Math.min(1, Math.abs(dx) / TRIGGER);

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Подсказка в освобождённом поле. Проявляется по мере натяжения, то есть
          видна ровно в момент выбора. */}
      {dx !== 0 && (
        <span
          aria-hidden
          className="absolute inset-y-0 flex items-center px-4 text-[12.5px] font-medium"
          style={{
            [right ? 'left' : 'right']: 0,
            opacity: strength,
            color: right ? 'var(--accent)' : 'var(--text-muted)',
          }}
        >
          {right
            ? t(thread.pinned ? 'thread.unpin' : 'thread.pin')
            : t(thread.muted ? 'thread.unmute' : 'thread.mute')}
        </span>
      )}

      <Link
        href={`/messages/${thread.user.id}`}
        onClick={(event) => {
          // Уехавшая строка не открывает переписку: палец только что выбирал
          // действие, и открытие поверх него читалось бы промахом.
          if (Math.abs(dx) > 4) {
            event.preventDefault();
            return;
          }
          holdBackdrop();
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onContextMenu={(event) => {
          // Правая кнопка — то же меню там, где держать нечем.
          event.preventDefault();
          onMenu(event.currentTarget.getBoundingClientRect());
        }}
        className="relative flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors active:bg-[var(--surface-2)]"
        style={{
          // Своя заливка обязательна: под строкой лежит подсказка, и без фона
          // она просвечивала бы сквозь текст переписки.
          background: 'var(--bg)',
          transform: dx ? `translateX(${dx}px)` : undefined,
          transition: dragging ? 'none' : 'transform 240ms var(--enter-ease)',
          touchAction: 'pan-y',
        }}
      >
        {/* Аватарка в своей коробке: облачко висит над ней абсолютом, и
            точкой отсчёта должно быть лицо, а не вся строка. */}
        <span className="relative flex-none">
          <DefaultAvatar name={thread.user.username} size={48} src={thread.user.avatar_url} />
          <ThoughtCloud text={note} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--text)]">
              {thread.user.username}
            </span>
            {thread.muted && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" className="flex-none self-center">
                <path d="M11 5 6 9H3v6h3l5 4V5Z" />
                <path d="m16 9 5 6M21 9l-5 6" />
              </svg>
            )}
            {thread.pinned && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--text-muted)" className="flex-none self-center">
                <path d="M9 4h6l-1 6 4 3v2H6v-2l4-3Z" />
              </svg>
            )}
            <span className="flex-none text-[12px] text-[var(--text-muted)]">
              {formatCompactAge(thread.lastMessage.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p
              className="min-w-0 flex-1 truncate text-[13.5px]"
              style={{ color: thread.unread > 0 ? 'var(--text)' : 'var(--text-muted)' }}
            >
              {/* Своё письмо помечаем, иначе непонятно, чья это реплика
                  и ждут ли ответа от тебя. */}
              {thread.lastMessage.mine && 'Вы: '}
              {thread.lastMessage.body}
            </p>
            {thread.unread > 0 && (
              <span
                className="font-num flex h-5 min-w-5 flex-none items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                style={{
                  // У приглушённой переписки счётчик серый: письма есть, но
                  // звать ими не просили.
                  background: thread.muted ? 'var(--control)' : 'var(--accent)',
                  color: thread.muted ? 'var(--bg)' : 'var(--accent-contrast)',
                }}
              >
                {thread.unread}
              </span>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
