'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/** Ниже этого сдвига отпускание закрывает шторку, выше — возвращает на место. */
const DISMISS_AFTER_PX = 120;

/**
 * Шторка, выезжающая снизу: затемнение с закрытием по нажатию, полоска-ухватка
 * с протяжкой вниз, Escape и блокировка прокрутки под ней.
 *
 * Общая для комментариев и нового поста — оба экрана должны вести себя
 * одинаково, иначе один и тот же жест работает по-разному через раз.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  height = '70vh',
  children,
  footer,
  layer = 0,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Сколько экрана занимает шторка. Сверху всегда остаётся полоса ленты. */
  height?: string;
  children: React.ReactNode;
  /** Прижатый к низу блок: строка ввода, кнопки отправки. */
  footer?: React.ReactNode;
  /**
   * Этаж над обычными шторками. Подтверждение телефона вызывается изнутри
   * комментариев и обязано лечь поверх них — при одинаковом z-index порядок
   * решала разметка, и модалка уходила под ту шторку, которая её открыла.
   */
  layer?: number;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef(0);

  // document.body на сервере не существует — портал ставим только на клиенте.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  function onPointerDown(e: React.PointerEvent) {
    dragStart.current = e.clientY;
    setDrag(0);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (drag === null) return;
    // Тянуть можно только вниз: вверх шторка уже упирается в свой потолок.
    setDrag(Math.max(0, e.clientY - dragStart.current));
  }

  function onPointerUp() {
    if (drag === null) return;
    if (drag > DISMISS_AFTER_PX) onClose();
    setDrag(null);
  }

  // Портал в body обязателен: карточки и панели несут backdrop-filter, а он
  // делает элемент containing block для position: fixed. Без портала шторка
  // привязалась бы к своему предку, а не к экрану.
  if (!mounted) return null;

  return createPortal(
    <>
      <div
        onClick={onClose}
        aria-hidden
        className="fixed inset-0"
        style={{
          zIndex: 60 + layer * 10,
          background: 'var(--sheet-scrim)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          // Затемнение уходит быстрее, чем приходит: возвращаясь к ленте,
          // человек хочет увидеть её, а не смотреть, как расходится вуаль.
          transition: open ? 'opacity 0.26s ease' : 'opacity var(--exit-ms) var(--exit-ease)',
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        // Скругление задаёт сам .bottom-sheet через --radius-sheet: у стиля
        // оформления должно быть право менять его вместе с остальным, а зашитая
        // здесь цифра это право отбирала.
        className="bottom-sheet fixed inset-x-0 bottom-0 mx-auto flex max-w-2xl flex-col"
        style={{
          zIndex: 61 + layer * 10,
          height,
          transform: open ? `translateY(${drag ?? 0}px)` : 'translateY(100%)',
          // visibility обязательна. Закрытая шторка стоит вплотную под нижней
          // кромкой экрана, а её тень светит вверх — и попадает обратно в кадр.
          // Одна такая незаметна, но карточка поста держит свою шторку каждая:
          // в ленте их десяток, тени складываются и дают чёрное пятно внизу.
          // Скрытый элемент не рисует ничего, включая тень.
          visibility: open ? 'visible' : 'hidden',
          // Выезд длинный и с торможением — за ним следят; уход короткий и с
          // разгоном — он уже решён. Пока тянут пальцем, перехода нет вовсе,
          // иначе шторка отстаёт от руки.
          transition:
            drag !== null
              ? 'none'
              : open
                ? 'transform 0.36s var(--enter-ease), visibility 0.36s'
                : 'transform var(--exit-ms) var(--exit-ease), visibility var(--exit-ms)',
        }}
      >
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="flex flex-none cursor-grab touch-none flex-col items-center gap-3 pb-2 pt-2.5"
        >
          <span className="h-1 w-9 rounded-full" style={{ background: 'var(--control-border)' }} />
          <span className="text-[15px] font-semibold text-[var(--text)]">{title}</span>
        </div>

        {/* Ни линий, ни цветных полос. Растворяем сам контент маской: у верхней
            и нижней кромки он уходит в прозрачность. Полоса поверх содержимого
            неизбежно даёт видимый край там, где начинается её собственный
            градиент, — маска же ничего не рисует, поэтому краю взяться неоткуда. */}
        <div className="sheet-scroll flex-1 overflow-y-auto overscroll-contain px-4">
          {children}
        </div>

        {footer && (
          <div
            className="flex flex-none flex-col gap-2 px-3 pt-2"
            style={{
              // Не упираем в кромку экрана и оставляем запас под домашний
              // индикатор на телефонах без кнопки.
              paddingBottom: 'calc(26px + env(safe-area-inset-bottom))',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>,
    document.body
  );
}
