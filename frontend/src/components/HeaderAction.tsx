'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Правая часть шапки. Поиск доступен везде, шестерня — только в своём профиле:
 * это его инструмент, а не глобальный.
 */
export function HeaderAction() {
  const pathname = usePathname();
  const showSettings = pathname === '/profile';

  // Обойма в тон палитры: мягкая подложка акцента вместо голой иконки.
  const buttonClass =
    'flex h-11 w-11 items-center justify-center rounded-full border transition-colors';
  const buttonStyle = {
    background: 'var(--accent-soft)',
    borderColor: 'var(--border)',
    color: 'var(--accent)',
  };

  return (
    <div className="flex items-center gap-2">
      <Link href="/search" aria-label="Поиск" className={buttonClass} style={buttonStyle}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.3-4.3" />
        </svg>
      </Link>

      {showSettings && (
        <Link href="/settings" aria-label="Настройки" className={buttonClass} style={buttonStyle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
          </svg>
        </Link>
      )}
    </div>
  );
}
