'use client';

import { useEffect, useRef } from 'react';
import { crunchyRingPath } from '@/lib/crunchyRing';

const RING_SIZE = 86;
const RING_PATH = crunchyRingPath(RING_SIZE);

function StoryRing({ letter }: { letter: string }) {
  return (
    <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg
        className="absolute inset-0"
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-hidden
      >
        <defs>
          <linearGradient id="crunchy-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5b3ad6" />
            <stop offset="100%" stopColor="#a880ff" />
          </linearGradient>
        </defs>
        <path
          d={RING_PATH}
          fill="none"
          stroke="url(#crunchy-ring)"
          strokeWidth="3"
          strokeLinejoin="miter"
        />
      </svg>
      <div
        className="absolute inset-[6px] flex items-center justify-center rounded-full text-xl font-semibold"
        style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
      >
        {letter}
      </div>
    </div>
  );
}

export function StoriesBar({
  usernames,
  currentUserLetter,
}: {
  usernames: string[];
  currentUserLetter?: string;
}) {
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
    <div
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      style={{ touchAction: 'pan-x', cursor: 'grab', overscrollBehaviorX: 'contain' }}
    >
      {currentUserLetter && (
        <div className="flex flex-col items-center gap-1.5" style={{ flex: '0 0 27%' }}>
          <div className="relative">
            <div
              className="flex h-[86px] w-[86px] items-center justify-center rounded-full border-2 border-dashed text-xl font-semibold"
              style={{ borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--accent)' }}
            >
              {currentUserLetter}
            </div>
            <span
              className="absolute bottom-0.5 right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2"
              style={{ background: 'var(--accent)', borderColor: 'var(--bg)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
          </div>
          <span className="w-full truncate text-center text-[11px] text-[var(--text-muted)]">
            Ваша история
          </span>
        </div>
      )}

      {usernames.map((username) => (
        <div key={username} className="flex flex-col items-center gap-1.5" style={{ flex: '0 0 27%' }}>
          <StoryRing letter={username[0]?.toUpperCase() ?? '?'} />
          <span className="w-full truncate text-center text-[11px] text-[var(--text-muted)]">
            {username}
          </span>
        </div>
      ))}
    </div>
  );
}
