'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CREATE_HREF, CreateIcon, MOBILE_SLOTS } from '@/components/navTabs';

export function BottomNav() {
  const pathname = usePathname();
  const pillRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [blob, setBlob] = useState<{ x: number; width: number; height: number } | null>(null);

  const activeSlot = MOBILE_SLOTS.findIndex((slot) => slot !== null && slot.href === pathname);

  useLayoutEffect(() => {
    function measure() {
      const element = activeSlot >= 0 ? slotRefs.current[activeSlot] : null;
      const pill = pillRef.current;
      if (!element || !pill) {
        setBlob(null);
        return;
      }
      // Капля занимает слот целиком по ширине и почти всю высоту панели,
      // оставляя лишь узкий зазор до её краёв.
      setBlob({
        x: element.offsetLeft,
        width: element.offsetWidth,
        height: pill.clientHeight - 10,
      });
    }

    measure();

    // Слоты тянутся вместе с шириной экрана — пересчитываем каплю на ресайз.
    const observer = new ResizeObserver(measure);
    if (pillRef.current) observer.observe(pillRef.current);
    return () => observer.disconnect();
  }, [activeSlot]);

  // На экране поиска бар уезжает вниз, освобождая место клавиатуре.
  const hidden = pathname === '/search';

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-3 md:hidden"
      style={{
        transform: hidden ? 'translateY(140%)' : 'none',
        opacity: hidden ? 0 : 1,
        transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.24s ease',
      }}
      aria-hidden={hidden}
    >
      <div
        ref={pillRef}
        className="liquid-glass relative flex w-full max-w-[420px] items-center justify-between rounded-full border px-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
        style={{ pointerEvents: hidden ? 'none' : 'auto' }}
      >
        {blob && (
          <span
            aria-hidden
            className="nav-blob"
            style={{
              transform: `translate(${blob.x}px, -50%)`,
              width: blob.width,
              height: blob.height,
            }}
          />
        )}

        {MOBILE_SLOTS.map((slot, index) => {
          if (!slot) {
            return (
              <Link
                key="create"
                href={CREATE_HREF}
                aria-label="Создать"
                ref={(node) => {
                  slotRefs.current[index] = node;
                }}
                className="relative flex h-14 flex-1 items-center justify-center"
                style={{ color: 'var(--text)' }}
              >
                <CreateIcon />
              </Link>
            );
          }

          const active = pathname === slot.href;
          return (
            <Link
              key={slot.href}
              href={slot.href}
              aria-label={slot.label}
              aria-current={active ? 'page' : undefined}
              ref={(node) => {
                slotRefs.current[index] = node;
              }}
              className="relative flex h-14 flex-1 items-center justify-center"
              style={{
                color: active ? 'var(--nav-active)' : 'var(--text-muted)',
                transition: 'color 0.15s ease',
              }}
            >
              <slot.Icon active={active} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
