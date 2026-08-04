'use client';

import { useRef, useState } from 'react';

export type Fit = { zoom: number; x: number; y: number };

export const DEFAULT_FIT: Fit = { zoom: 1, x: 50, y: 50 };

/**
 * Подгонка картинки в рамке: тянешь пальцем — картинка едет, крутишь колесо
 * или сводишь пальцы — меняется масштаб.
 *
 * Три ползунка «масштаб / влево-вправо / вверх-вниз» были неверным решением:
 * они занимали половину карточки и заставляли думать в координатах вместо
 * того, чтобы просто подвинуть изображение туда, куда надо.
 *
 * Положение держим в процентах background-position — так одно и то же
 * значение одинаково работает и в круглой аватарке, и в широкой обложке.
 */
export function ImageFitter({
  src,
  fit,
  onChange,
  className,
  style,
  children,
}: {
  src: string;
  fit: Fit;
  onChange: (fit: Fit) => void;
  className?: string;
  style?: React.CSSProperties;
  /** Подписи и кнопки поверх картинки. */
  children?: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; fit: Fit } | null>(null);
  const [dragging, setDragging] = useState(false);

  function onPointerDown(e: React.PointerEvent) {
    // Захватываем указатель: иначе палец, уехавший за границы кадра, теряется
    // и картинка «прилипает» на полпути.
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fit };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const start = drag.current;
    const box = boxRef.current;
    if (!start || !box) return;

    // Переводим сдвиг в пикселях в проценты позиции фона. Чем сильнее
    // увеличено, тем меньше «запас» хода — отсюда деление на (zoom - 1).
    const room = Math.max(start.fit.zoom - 1, 0.001);
    const dx = ((e.clientX - start.x) / box.clientWidth / room) * -100;
    const dy = ((e.clientY - start.y) / box.clientHeight / room) * -100;

    onChange({
      zoom: start.fit.zoom,
      x: Math.min(100, Math.max(0, start.fit.x + dx)),
      y: Math.min(100, Math.max(0, start.fit.y + dy)),
    });
  }

  function endDrag() {
    drag.current = null;
    setDragging(false);
  }

  function onWheel(e: React.WheelEvent) {
    const next = Math.min(3, Math.max(1, fit.zoom - e.deltaY * 0.002));
    onChange({ ...fit, zoom: next });
  }

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onWheel={onWheel}
      className={className}
      style={{
        ...style,
        backgroundImage: `url(${src})`,
        backgroundSize: `${fit.zoom * 100}%`,
        backgroundPosition: `${fit.x}% ${fit.y}%`,
        backgroundRepeat: 'no-repeat',
        cursor: dragging ? 'grabbing' : 'grab',
        // Собственный скролл страницы не должен перехватывать жест.
        touchAction: 'none',
      }}
    >
      {children}
    </div>
  );
}
