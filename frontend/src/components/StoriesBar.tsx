'use client';

import { useEffect, useRef, useState } from 'react';
import { SegmentRing } from '@/components/SegmentRing';
import { Story, StoryViewer } from '@/components/StoryViewer';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { useT } from '@/lib/i18n';

/* Было 86 — кружки занимали верхнюю треть экрана и отжимали ленту, ради
   которой человек сюда и пришёл. 66 достаточно, чтобы узнать лицо, и в ряд
   помещается на одну историю больше. */
const RING_SIZE = 66;

function StoryRing({
  name,
  segments,
  viewed = false,
}: {
  name: string;
  segments: number;
  viewed?: boolean;
}) {
  return (
    <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <SegmentRing size={RING_SIZE} segments={segments} viewed={viewed} strokeWidth={2.8} gap={5.5} />
      <div className="absolute inset-[5px] overflow-hidden rounded-full">
        <DefaultAvatar name={name} size={RING_SIZE - 10} />
      </div>
    </div>
  );
}

export function StoriesBar({
  stories,
  currentUserLetter,
}: {
  stories: Story[];
  currentUserLetter?: string;
}) {
  const { t } = useT();
  // Какая история открыта. −1 — закрыто; индексом, а не флагом, потому что из
  // одной истории просмотр уходит в следующую, и «какая именно» — это состояние.
  const [open, setOpen] = useState(-1);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, lastX: 0, velocity: 0 });
  const inertia = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (inertia.current) cancelAnimationFrame(inertia.current);
    };
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    // Тач и перо скроллят нативно с собственной инерцией — берём только мышь.
    if (e.pointerType !== 'mouse' || !trackRef.current) return;
    if (inertia.current) cancelAnimationFrame(inertia.current);
    drag.current = {
      active: true,
      startX: e.clientX,
      startScroll: trackRef.current.scrollLeft,
      lastX: e.clientX,
      velocity: 0,
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current.active || !trackRef.current) return;
    drag.current.velocity = e.clientX - drag.current.lastX;
    drag.current.lastX = e.clientX;
    trackRef.current.scrollLeft = drag.current.startScroll - (e.clientX - drag.current.startX);
  }

  function endDrag() {
    if (!drag.current.active) return;
    drag.current.active = false;

    // Плавное затухание вместо резкой остановки на месте отпускания.
    let velocity = drag.current.velocity;
    const step = () => {
      const track = trackRef.current;
      if (!track || Math.abs(velocity) < 0.4) return;
      track.scrollLeft -= velocity;
      velocity *= 0.94;
      inertia.current = requestAnimationFrame(step);
    };
    inertia.current = requestAnimationFrame(step);
  }

  return (
    <>
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className="no-scrollbar -mx-4 flex overflow-x-auto px-4 pb-1"
      // Зазор числом, а не классом gap-1.5. Ячейка ровно по ширине кружка, и
      // при равном зазоре расстояния между кружками одинаковы по всей строке.
      // Прежде первая ячейка была шире остальных: у «своей истории» кружок нёс
      // рамку в два пикселя, та добавлялась к ширине — и первый промежуток
      // выходил на четыре пикселя больше следующих. Заметно это ровно настолько,
      // насколько неровный ряд вообще бросается в глаза.
      //
      // Ячейкам нужен min-w-0. Флексовый элемент по умолчанию не сжимается
      // меньше своего содержимого, и длинный ник растягивал ячейку, вместо того
      // чтобы обрезаться многоточием: заданные 66 пикселей при этом ничего не
      // держали, а ряд разъезжался ровно на тех именах, ради которых
      // многоточие и ставилось.
      style={{
        gap: 3,
        touchAction: 'pan-x',
        cursor: 'grab',
        overscrollBehaviorX: 'contain',
      }}
    >
      {currentUserLetter && (
        <div className="min-w-0 flex flex-col items-center gap-1.5" style={{ flex: `0 0 ${RING_SIZE}px` }}>
          <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
            {/* Пунктир вместо дуг: своей истории ещё нет, показывать нечего —
                и кружок читается как «место под неё», а не как непросмотренное. */}
            <div
              // box-border обязателен: рамка обязана лечь внутрь заданной
              // ширины, иначе ячейка вырастает на её толщину и ряд разъезжается.
              className="box-border flex items-center justify-center overflow-hidden rounded-full border-2 border-dashed"
              style={{ width: RING_SIZE, height: RING_SIZE, borderColor: 'var(--border)' }}
            >
              <DefaultAvatar name={currentUserLetter} size={RING_SIZE - 8} />
            </div>
            <span
              className="absolute bottom-0 right-0 flex h-[22px] w-[22px] items-center justify-center rounded-full"
              style={{
                background: 'var(--accent)',
                color: 'var(--accent-contrast)',
                boxShadow: '0 0 0 2px var(--bg)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </div>
          {/* Ник обрезается многоточием, а не жмётся: ячейка равна кружку, и
              длинное имя иначе раздвигало бы ряд. */}
          <span className="w-full truncate text-center text-[10.5px] text-[var(--text-muted)]">
            {t('feed.yourStory')}
          </span>
        </div>
      )}

      {stories.map((story, position) => (
        <button
          key={story.username}
          type="button"
          onClick={() => setOpen(position)}
          className="min-w-0 flex flex-col items-center gap-1.5 transition-transform active:scale-95"
          style={{ flex: `0 0 ${RING_SIZE}px` }}
        >
          {/* Дуг столько, сколько кадров в истории, — не хеш от имени, как было.
              Хеш давал стабильное, но лживое число: кружок обещал четыре
              истории, внутри оказывалась одна. */}
          <StoryRing name={story.username} segments={story.posts.length} />
          {/* Ник обрезается многоточием, а не жмётся: ячейка равна кружку, и
              длинное имя иначе раздвигало бы ряд. */}
          <span className="w-full truncate text-center text-[10.5px] text-[var(--text-muted)]">
            {story.username}
          </span>
        </button>
      ))}
    </div>

    <StoryViewer
      stories={stories}
      index={open}
      onIndex={setOpen}
      onClose={() => setOpen(-1)}
    />
    </>
  );
}
