'use client';

import { useRef, useState } from 'react';

export type Fit = { zoom: number; x: number; y: number };

export const DEFAULT_FIT: Fit = { zoom: 1, x: 50, y: 50 };

/** Дальше этого не увеличиваем: за тройным масштабом видны пиксели исходника. */
const MAX_ZOOM = 3;

/**
 * Подгонка картинки в рамке: тянешь пальцем — картинка едет, сводишь два
 * пальца или крутишь колесо — меняется масштаб.
 *
 * Три ползунка «масштаб / влево-вправо / вверх-вниз» были неверным решением:
 * они занимали половину карточки и заставляли думать в координатах вместо
 * того, чтобы просто подвинуть изображение туда, куда надо.
 *
 * Положение держим в процентах background-position — так одно и то же значение
 * одинаково работает и в круглой аватарке, и в широкой обложке.
 *
 * Здесь было две поломки, и вместе они делали редактор неуправляемым.
 *
 * Первая: перевод сдвига в проценты делился на «запас хода» — долю картинки,
 * не влезшую в рамку. При масштабе 1 запаса нет вовсе, и чтобы не делить на
 * ноль, туда подставлялась одна тысячная. Сдвиг на один пиксель превращался в
 * скачок на сотню процентов: картинка мгновенно улетала в угол и залипала там.
 *
 * Вторая: увеличить на телефоне было нечем. Масштаб менялся только колесом
 * мыши, то есть на телефоне оставался единицей — ровно тем значением, при
 * котором первая поломка и срабатывала. Отсюда «работает ужасно»: любое
 * прикосновение швыряло картинку.
 *
 * Теперь при масштабе 1 картинка ровно заполняет рамку, двигать её некуда — и
 * жест ничего не делает, вместо того чтобы делать невозможное. А увеличивают
 * сведением двух пальцев.
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

  /**
   * Все прижатые указатели, по одному на палец.
   *
   * Раньше держали один. Второй палец при этом продолжал слать события, они
   * шли вперемешку с первым, и картинка дёргалась между двумя точками.
   */
  const points = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ x: number; y: number; fit: Fit } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function positions(): { x: number; y: number }[] {
    return [...points.current.values()];
  }

  function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function onPointerDown(e: React.PointerEvent) {
    // Захват на самом кадре, а не на e.target: поверх картинки лежат подписи и
    // кнопки, и жест, начатый на них, уходил захватом в чужой элемент.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const all = positions();
    if (all.length === 2) {
      // Второй палец — это уже не перенос, а масштаб. Перенос прекращаем, иначе
      // картинка поедет от движения обеих рук сразу.
      drag.current = null;
      pinch.current = { distance: distanceBetween(all[0], all[1]), zoom: fit.zoom };
    } else {
      drag.current = { x: e.clientX, y: e.clientY, fit };
    }

    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!points.current.has(e.pointerId)) return;
    points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const box = boxRef.current;
    if (!box) return;

    const all = positions();

    // ── Масштаб двумя пальцами ────────────────────────────────────────────
    if (all.length >= 2 && pinch.current) {
      const started = pinch.current;
      const now = distanceBetween(all[0], all[1]);
      if (started.distance > 0) {
        const next = Math.min(MAX_ZOOM, Math.max(1, (started.zoom * now) / started.distance));
        onChange({ ...fit, zoom: next });
      }
      return;
    }

    // ── Перенос одним ─────────────────────────────────────────────────────
    const start = drag.current;
    if (!start) return;

    // Сколько картинки не влезло в рамку. При масштабе 1 — нисколько, и двигать
    // нечего: раньше здесь стояла тысячная доля «чтобы не делить на ноль», и
    // именно она швыряла картинку в угол от малейшего касания.
    const room = start.fit.zoom - 1;
    if (room <= 0) return;

    const dx = ((e.clientX - start.x) / box.clientWidth / room) * -100;
    const dy = ((e.clientY - start.y) / box.clientHeight / room) * -100;

    onChange({
      zoom: start.fit.zoom,
      x: Math.min(100, Math.max(0, start.fit.x + dx)),
      y: Math.min(100, Math.max(0, start.fit.y + dy)),
    });
  }

  function endPointer(e: React.PointerEvent) {
    points.current.delete(e.pointerId);

    if (points.current.size < 2) pinch.current = null;

    if (points.current.size === 1) {
      // Один палец отпустили, второй остался — продолжаем как перенос, считая
      // от его текущего места. Без этого картинка прыгала на разницу между
      // пальцами в момент отпускания.
      const [remaining] = positions();
      drag.current = { x: remaining.x, y: remaining.y, fit };
    }

    if (points.current.size === 0) {
      drag.current = null;
      setDragging(false);
    }
  }

  function onWheel(e: React.WheelEvent) {
    const next = Math.min(MAX_ZOOM, Math.max(1, fit.zoom - e.deltaY * 0.002));
    onChange({ ...fit, zoom: next });
  }

  return (
    <div
      ref={boxRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onLostPointerCapture={endPointer}
      onWheel={onWheel}
      className={className}
      style={{
        ...style,
        backgroundImage: `url(${src})`,
        backgroundSize: `${fit.zoom * 100}%`,
        backgroundPosition: `${fit.x}% ${fit.y}%`,
        backgroundRepeat: 'no-repeat',
        // Курсор говорит правду: пока не увеличено, двигать нечего.
        cursor: fit.zoom <= 1 ? 'default' : dragging ? 'grabbing' : 'grab',
        // Собственный скролл и масштаб страницы не должны перехватывать жест.
        touchAction: 'none',
      }}
    >
      {children}
    </div>
  );
}
