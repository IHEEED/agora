'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Сколько уезжает экран. Совпадает с --exit-ms в globals.css. */
const LEAVE_MS = 100;

/** Ширина полосы у левой кромки, с которой начинается жест. */
const EDGE_ZONE = 32;

/** Дальше какой доли ширины экрана отпускание закрывает, а не возвращает. */
const DISMISS_RATIO = 0.3;

/**
 * Уход с вложенного экрана: кнопкой назад и свайпом от левой кромки.
 *
 * Пост, чужой профиль, настройки и страница клуба въезжают справа налево — это
 * движение «вглубь». Обратно они просто исчезали: router.back() менял маршрут,
 * разметка пропадала в тот же кадр. Заметнее всего это там, где вход
 * анимирован: глаз ждёт симметричного движения и не получает его.
 *
 * Свайп добавлен всюду, где есть кнопка «назад». На телефоне жест от кромки —
 * основной способ вернуться, и экран, который на него не отвечает, читается
 * сломанным, даже если кнопка на месте.
 *
 * Жест ловим только у самой кромки: начнись он посреди экрана — и любое
 * горизонтальное движение по списку закрывало бы страницу.
 */
export function useScreenLeave() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const from = useRef<number | null>(null);

  const goBack = useCallback(() => {
    // Второе нажатие не должно запускать вторую навигацию: router.back()
    // дважды увёл бы на два экрана назад вместо одного.
    setLeaving((already) => {
      if (already) return already;
      window.setTimeout(() => router.back(), LEAVE_MS);
      return true;
    });
  }, [router]);

  function onPointerDown(event: React.PointerEvent) {
    // Мышь исключена намеренно: на настольном экране протаскивание от левого
    // края — это выделение текста, а не навигация.
    if (event.pointerType === 'mouse' || event.clientX > EDGE_ZONE || leaving) return;
    from.current = event.clientX;
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (from.current === null) return;
    setDragX(Math.max(0, event.clientX - from.current));
  }

  function onPointerUp() {
    if (from.current === null) return;
    const far = dragX > window.innerWidth * DISMISS_RATIO;
    from.current = null;
    setDragging(false);
    setDragX(0);
    if (far) goBack();
  }

  /** Обработчики жеста — на корневой узел экрана, вместе со style. */
  const swipeHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  const style: React.CSSProperties = {
    // В покое именно none, а не translateX(0): любой transform создаёт слой,
    // из которого дочерним элементам не подняться над размытием шторок.
    transform: leaving ? 'translateX(24px)' : dragX ? `translateX(${dragX}px)` : 'none',
    opacity: leaving ? 0 : 1,
    // Пока тянут пальцем — без перехода, иначе экран отстаёт от руки.
    transition: dragging
      ? 'none'
      : leaving
        ? 'transform var(--exit-ms) var(--exit-ease), opacity var(--exit-ms) var(--exit-ease)'
        : 'transform var(--enter-ms) var(--enter-ease)',
  };

  return { leaving, goBack, style, swipeHandlers };
}
