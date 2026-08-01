'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CREATE_HREF, CreateIcon, TABS } from '@/components/navTabs';

/**
 * Замена нижнего бара на широких экранах — вертикальная панель слева,
 * как в Reddit/Discord. Мобильный BottomNav при этом никуда не девается,
 * оба компонента смонтированы всегда и переключаются через md:hidden/hidden md:flex.
 */
export function DesktopSidebar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center gap-2 border-r border-[var(--border)] bg-[var(--bg)] py-6 md:flex">
      <Link
        href={CREATE_HREF}
        aria-label="Создать"
        className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
      >
        <CreateIcon size={24} />
      </Link>

      <div className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className="flex h-12 w-12 items-center justify-center rounded-full transition-colors"
              style={{
                color: active ? 'var(--nav-active)' : 'var(--text-muted)',
                background: active ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <tab.Icon active={active} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
