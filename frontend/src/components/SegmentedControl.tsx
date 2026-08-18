'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Переключатель из нескольких вариантов с едущей каплей.
 *
 * Капля — отдельный слой под подписями, а не фон активной кнопки: у фона нечему
 * ехать, он просто загорается на новом месте, и переключение читается как
 * подмена картинки. Геометрию приходится измерять — варианты бывают разной
 * ширины, заранее её не посчитать.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (next: T) => void;
  className?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [blob, setBlob] = useState<{ x: number; width: number } | null>(null);

  const activeIndex = options.findIndex(([option]) => option === value);

  useLayoutEffect(() => {
    function measure() {
      const element = itemRefs.current[activeIndex];
      if (!element) return;
      const next = { x: element.offsetLeft, width: element.offsetWidth };
      // Сравниваем со старым значением: без этого каждый замер даёт новый
      // объект, тот вызывает перерисовку, та — новый замер, и так по кругу.
      setBlob((prev) => (prev && prev.x === next.x && prev.width === next.width ? prev : next));
    }

    measure();
    const observer = new ResizeObserver(measure);
    if (trackRef.current) observer.observe(trackRef.current);
    return () => observer.disconnect();
    // Массив вариантов приходит новым на каждой отрисовке — держимся за его
    // длину, иначе эффект пересобирается впустую при любом чужом изменении.
  }, [activeIndex, options.length]);

  return (
    // Дорожка — заливка, а не обведённая таблетка. Рамка вокруг переключателя
    // повторяла форму капли внутри него: два одинаковых овала, вложенных друг
    // в друга, из которых работает только внутренний. Утопленная подложка
    // показывает границы дорожки не хуже и не спорит с каплей.
    <div
      ref={trackRef}
      className={`relative flex min-w-0 gap-1 overflow-hidden rounded-full p-1 ${className}`}
      style={{ background: 'var(--surface-2)' }}
    >
      {blob && (
        <span
          aria-hidden
          className="absolute rounded-full"
          style={{
            top: 4,
            bottom: 4,
            left: 0,
            width: blob.width,
            // Трансформация, а не смена left: браузер считает её на видеокарте,
            // и переезд идёт ровно даже на слабом телефоне.
            transform: `translateX(${blob.x}px)`,
            background: 'var(--accent)',
            transition:
              'transform 0.34s cubic-bezier(0.32, 0.72, 0, 1), width 0.34s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        />
      )}

      {options.map(([option, label], index) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={option === value}
          ref={(node) => {
            itemRefs.current[index] = node;
          }}
          // min-w-0 и truncate вместо whitespace-nowrap. Неразрывная подпись
          // задаёт кнопке минимальную ширину по своему содержимому, flex-1 её
          // уменьшить не может — и три вкладки со счётчиками («Репосты 12»)
          // переставали помещаться в узкую колонку профиля, выпирая за
          // карточку. Теперь лишнее обрезается многоточием.
          // flex-auto, а не flex-1. Разница в базе: flex-1 задаёт её нулевой и
          // делит дорожку поровну, поэтому длинная подпись обрезалась даже
          // тогда, когда соседние короткие оставляли ей место. flex-auto
          // берёт базой ширину самой подписи и растягивает остаток —
          // «Комменты» получает своё, «Посты» не занимают лишнего.
          className="relative z-10 min-w-0 flex-auto truncate rounded-full px-2.5 py-1.5 text-center text-[13px] font-medium transition-colors"
          style={{
            color: option === value ? 'var(--accent-contrast)' : 'var(--text-muted)',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
