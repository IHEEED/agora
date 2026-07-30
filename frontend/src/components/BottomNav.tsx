'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Каждая иконка — одна геометрия: в покое рисуется контуром, в активном
// состоянии та же фигура заливается. Вырезы (дверь, зрачок) держатся на evenodd.
type IconProps = { active: boolean };

function iconProps(active: boolean) {
  return {
    width: 31,
    height: 31,
    viewBox: '0 0 24 24',
    // Заливка всегда есть, меняется её прозрачность — так переход плавный,
    // в отличие от переключения fill: none → currentColor.
    fill: 'currentColor',
    fillOpacity: active ? 1 : 0,
    fillRule: 'evenodd' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { transition: 'fill-opacity 0.15s ease' },
  };
}

function HomeIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M12 3.4 2.9 11.4v7.9a1.4 1.4 0 0 0 1.4 1.4h15.4a1.4 1.4 0 0 0 1.4-1.4v-7.9Z" />
      <path d="M9.7 20.7v-6.1h4.6v6.1Z" />
    </svg>
  );
}

function CommunitiesIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M9 5.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
      <path d="M9 13.6c-3.1 0-5.7 2.4-6.1 5.6h12.2c-.4-3.2-3-5.6-6.1-5.6Z" />
      <path d="M16.6 7.4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
      <path d="M15.9 14.1c2.7.2 4.8 2.3 5.2 5.1h-3.4c-.2-1.9-.8-3.6-1.8-5.1Z" />
    </svg>
  );
}

function CreateIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5.5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function BellIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M12 3.3a5.4 5.4 0 0 0-5.4 5.4c0 4.2-1.5 5.8-2.1 6.7-.3.5 0 1.1.6 1.1h13.8c.6 0 .9-.6.6-1.1-.6-.9-2.1-2.5-2.1-6.7A5.4 5.4 0 0 0 12 3.3Z" />
      <path d="M9.8 19a2.2 2.2 0 0 0 4.4 0Z" />
    </svg>
  );
}

function ProfileIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M12 4.6a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
      <path d="M12 13.6c-4.2 0-7.5 2.8-7.5 6.4h15c0-3.6-3.3-6.4-7.5-6.4Z" />
    </svg>
  );
}

const TABS = [
  { href: '/', label: 'Главная', Icon: HomeIcon },
  { href: '/search', label: 'Сообщества', Icon: CommunitiesIcon },
  { href: '/notifications', label: 'Уведомления', Icon: BellIcon },
  { href: '/profile', label: 'Профиль', Icon: ProfileIcon },
];

// Порядок в баре: две вкладки, кнопка создания по центру, ещё две вкладки.
const SLOTS = [TABS[0], TABS[1], null, TABS[2], TABS[3]];

export function BottomNav() {
  const pathname = usePathname();
  const pillRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [blob, setBlob] = useState<{ x: number; width: number; height: number } | null>(null);

  const activeSlot = SLOTS.findIndex((slot) => slot !== null && slot.href === pathname);

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

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-3">
      <div
        ref={pillRef}
        className="liquid-glass pointer-events-auto relative flex w-full max-w-[420px] items-center justify-between rounded-full border px-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
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

        {SLOTS.map((slot, index) => {
          if (!slot) {
            return (
              <Link
                key="create"
                href="/"
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
