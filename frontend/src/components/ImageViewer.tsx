'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/**
 * Изображение во весь экран, с листанием.
 *
 * Раньше картинку в записи нельзя было открыть вовсе: она жила в колонке ленты
 * шириной в телефон, и всё, что мельче лица крупным планом, приходилось
 * разглядывать как есть. Открывать её в новой вкладке — не выход: это уводит из
 * приложения и теряет место в ленте.
 *
 * Листание — жестом и стрелками. Счётчик показывается только когда листать
 * есть что: «1 / 1» сообщает ровно ничего.
 *
 * Закрывается тремя способами: по фону, свайпом вниз и Escape. Три, потому что
 * это тупик — из него обязано быть видно выход, каким бы способом человек его
 * ни искал.
 */
export function ImageViewer({
  images,
  index,
  onClose,
  onIndex,
}: {
  images: string[];
  /** Какая картинка открыта. Хранится снаружи: её задаёт нажатие в ленте. */
  index: number;
  onClose: () => void;
  onIndex: (next: number) => void;
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const open = index >= 0 && index < images.length;

  // Сдвиг пальцем: по горизонтали листает, по вертикали закрывает.
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const from = useRef<{ x: number; y: number } | null>(null);
  /**
   * Текущий сдвиг — ещё и в ref, не только в состоянии.
   *
   * Состояние нужно отрисовке, а решение «пролистали или вернулись» принимается
   * в момент отпускания и обязано опираться на настоящую величину. Обработчик
   * же видит то значение, что было на его рендере: React успевает применить
   * setDrag не всегда, и быстрый короткий взмах — когда движение и отпускание
   * попадают в один кадр — читался как нулевой сдвиг. Со стороны это ровно
   * «крупнее не листается».
   */
  const offset = useRef({ x: 0, y: 0 });
  // Какую ось человек выбрал первым движением. Без фиксации картинка ездила
  // по диагонали и не понимала, листают её или закрывают.
  const axis = useRef<'x' | 'y' | null>(null);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= images.length) return;
      onIndex(next);
    },
    [index, images.length, onIndex]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, go]);

  // Пока смотрят картинку, страница под ней не листается.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function onPointerDown(event: React.PointerEvent) {
    from.current = { x: event.clientX, y: event.clientY };
    axis.current = null;
    // Без захвата указатель, ушедший за пределы окна или на элемент выше,
    // перестаёт слать события — картинка застревает на полпути.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!from.current) return;
    const dx = event.clientX - from.current.x;
    const dy = event.clientY - from.current.y;
    if (!axis.current && Math.hypot(dx, dy) > 8) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (axis.current === 'x') offset.current = { x: dx, y: 0 };
    // Вверх не тянем: закрывать движением вверх некуда — там шапка.
    if (axis.current === 'y') offset.current = { x: 0, y: Math.max(0, dy) };
    setDrag(offset.current);
  }

  function onPointerUp() {
    if (!from.current) return;
    const { x, y } = offset.current;
    from.current = null;
    axis.current = null;
    offset.current = { x: 0, y: 0 };
    setDragging(false);
    setDrag({ x: 0, y: 0 });

    if (y > 110) return onClose();
    // Четверть ширины — столько нужно протащить, чтобы это было решением, а не
    // случайным смахиванием во время разглядывания.
    const threshold = window.innerWidth * 0.25;
    if (x < -threshold) return go(1);
    if (x > threshold) return go(-1);
  }

  if (!mounted || !open) return null;

  // Прозрачность фона падает по мере вытягивания вниз: картинка не просто
  // уезжает, а буквально забирает с собой затемнение.
  const dismissProgress = Math.min(1, drag.y / 220);

  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center"
      style={{
        background: `rgba(0, 0, 0, ${0.94 - dismissProgress * 0.5})`,
        // Жест целиком наш: и вбок, и вниз. touch-action по умолчанию отдаёт
        // горизонталь браузеру, и на телефоне палец просто ничего не двигал —
        // это и было «крупнее не листается». Выделение отключаем по той же
        // причине: мышью протаскивание по картинке начиналось как выделение.
        touchAction: 'none',
        userSelect: 'none',
        // Затемнение появляется само, а картинка приезжает из мелкого масштаба —
        // как будто её вынули из ленты, а не открыли отдельным экраном.
        animation: 'image-viewer-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(event) => {
        // Нажатие мимо картинки закрывает. Проверяем цель, а не координаты:
        // картинка внутри и сама остановит событие.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* Лента картинок целиком, сдвигаемая на индекс. Так соседние уже
          загружены, и листание не начинается с пустого кадра. */}
      <div
        className="flex h-full w-full items-center"
        style={{
          transform: `translate3d(calc(${-index * 100}% + ${drag.x}px), ${drag.y}px, 0) scale(${
            1 - dismissProgress * 0.12
          })`,
          transition: dragging
            ? 'none'
            : 'transform 260ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {images.map((src, position) => (
          <div
            key={`${src}-${position}`}
            className="flex h-full w-full flex-none items-center justify-center p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full select-none rounded-xl object-contain"
              style={{ boxShadow: '0 30px 90px -20px rgba(0, 0, 0, 0.8)' }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-3 flex h-11 w-11 items-center justify-center rounded-full text-white/90 transition-transform active:scale-90"
        style={{
          top: 'calc(12px + env(safe-area-inset-top))',
          background: 'rgba(255, 255, 255, 0.14)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {images.length > 1 && (
        <>
          <span
            className="font-num absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[13px] font-medium text-white/90"
            style={{
              top: 'calc(18px + env(safe-area-inset-top))',
              background: 'rgba(255, 255, 255, 0.14)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {index + 1} / {images.length}
          </span>

          {/* Точки внизу — то же, что счётчик, но на ощупь: видно, сколько
              осталось, не читая цифр. */}
          <div
            className="absolute left-1/2 flex -translate-x-1/2 gap-1.5"
            style={{ bottom: 'calc(20px + env(safe-area-inset-bottom))' }}
          >
            {images.map((src, position) => (
              <span
                key={`dot-${src}-${position}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: position === index ? 18 : 6,
                  background:
                    position === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
