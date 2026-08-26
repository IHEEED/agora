'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { VerifiedMark } from '@/components/VerifiedMark';
import { formatCompactAge } from '@/lib/formatDate';
import { MessageThread } from '@/lib/types';
import { holdBackdrop } from '@/lib/screenBackdrop';
import { haptic } from '@/lib/haptics';
import { VelocityTracker, committed } from '@/lib/gestureVelocity';
import { useDragSpring } from '@/lib/useDragSpring';
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
  const from = useRef<{ x: number; y: number } | null>(null);
  const own = useRef(false);
  const holdTimer = useRef<number | null>(null);
  const speed = useRef(new VelocityTracker());
  const hintRef = useRef<HTMLSpanElement | null>(null);
  /** Скорость, унесённая у перехваченной пружины. */
  const carried = useRef(0);

  /**
   * Сдвиг строки живёт в стиле узла, а не в состоянии React.
   *
   * Раньше каждое движение пальца вызывало setState: полная отрисовка строки на
   * каждое событие указателя, а браузер шлёт их чаще, чем кадры. Здесь за весь
   * жест не происходит ни одной отрисовки — и отпускание идёт пружиной, то есть
   * его можно схватить на полпути и повести обратно (см. lib/useDragSpring).
   */
  // Подписи считаем при отрисовке и держим в ref: кадровый цикл не должен
  // звать переводчик, а состояние закрепления меняется редко.
  const labels = {
    right: t(thread.pinned ? 'thread.unpin' : 'thread.pin'),
    left: t(thread.muted ? 'thread.unmute' : 'thread.mute'),
  };

  const { bind: bindRow, set: setDrag, release: releaseDrag, grab: grabDrag, read: readDrag } =
    useDragSpring<HTMLAnchorElement>((node, value) => {
      node.style.transform = value ? `translateX(${value}px)` : '';
      const hint = hintRef.current;
      if (!hint) return;
      // Подсказка проявляется по мере натяжения и живёт с той стороны, в которую
      // тянут. Пишем её здесь же: два узла, меняющихся вместе, обязаны меняться
      // в одном кадре.
      const strength = Math.min(1, Math.abs(value) / TRIGGER);
      hint.style.opacity = String(strength);
      hint.style.left = value > 0 ? '0' : 'auto';
      hint.style.right = value > 0 ? 'auto' : '0';
      hint.textContent = value > 0 ? labels.right : labels.left;
    });

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
    speed.current.reset();
    // Схватили — снимаем пружину, забирая её скорость. Если строка ехала
    // назад, палец подхватывает её на ходу, а не с нуля.
    carried.current = grabDrag();

    const target = event.currentTarget as HTMLElement;
    holdTimer.current = window.setTimeout(() => {
      // Удержание засчитано — отклик и меню. Свайп при этом отменяем: два
      // способа управления, сработавшие разом, дали бы меню поверх уехавшей
      // строки.
      haptic('open');
      from.current = null;
      releaseDrag(0);
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
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    // Вязкость и упор: строка отдаёт всё меньше на каждый пиксель пальца.
    speed.current.add(event.clientX);
    const pulled = Math.min(MAX, Math.sqrt(Math.abs(moved)) * 11);
    const next = moved > 0 ? pulled : -pulled;
    if (Math.abs(next) >= TRIGGER && Math.abs(readDrag()) < TRIGGER) haptic();
    setDrag(next);
  }

  function up() {
    cancelHold();
    const settled = readDrag();
    const velocity = speed.current.get() || carried.current;
    from.current = null;
    own.current = false;
    // Возвращаем пружиной, унося скорость пальца: между «вёл» и «поехало само»
    // не должно быть видимого шва.
    releaseDrag(0, velocity);

    // Далеко утащили или быстро бросили — см. lib/gestureVelocity. Короткий
    // резкий флик до порога не доезжает, хотя это самое решительное движение,
    // на какое способен палец.
    if (!committed(settled, velocity, TRIGGER)) return;
    // Одно действие на сторону, а не две кнопки под пальцем: выбирать между
    // ними пришлось бы глазами, а тогда свайп теряет единственное преимущество
    // перед меню — скорость.
    if (settled > 0) onPin();
    else onMute();
  }

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Подсказка в освобождённом поле. Стоит в разметке всегда и прозрачна в
          покое: её текст и сторону пишет тот же кадровый цикл, что двигает
          строку (см. useDragSpring выше). Появляться и исчезать через React
          она не может — это отрисовка на каждое движение пальца. */}
      <span
        ref={hintRef}
        aria-hidden
        className="absolute inset-y-0 flex items-center px-4 text-[12.5px] font-medium"
        style={{ opacity: 0, right: 0, color: 'var(--text-muted)' }}
      />

      <Link
        href={`/messages/${thread.user.id}`}
        ref={bindRow}
        onClick={(event) => {
          // Уехавшая строка не открывает переписку: палец только что выбирал
          // действие, и открытие поверх него читалось бы промахом.
          if (Math.abs(readDrag()) > 4) {
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
          // Ни transform, ни transition здесь нет: и то и другое пишет пружина
          // напрямую в узел. Переход тут был бы прямо вреден — он владел бы
          // свойством и не давал перехватить движение на полпути.
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
              <VerifiedMark verified={thread.user.verified_at} size={16} />
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
