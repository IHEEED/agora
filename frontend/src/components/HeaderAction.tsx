'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

/**
 * Правая кнопка шапки: обычно поиск, а в своём профиле — настройки.
 * Выход из аккаунта живёт здесь, потому что из тела профиля кнопку убрали.
 */
export function HeaderAction() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const buttonClass =
    'flex h-12 w-12 items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]';

  if (pathname !== '/profile') {
    return (
      <Link href="/search" aria-label="Поиск" className={buttonClass}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m20 20-4.3-4.3" />
        </svg>
      </Link>
    );
  }

  async function handleSignOut() {
    setOpen(false);
    // AppGate следит за сессией сам — как только она обнулится, экран входа
    // подставится автоматически, отдельный редирект не нужен.
    await supabase.auth.signOut();
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Настройки" aria-expanded={open} className={buttonClass}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3.2" />
          <path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-lg">
            <button
              onClick={handleSignOut}
              className="w-full px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: 'var(--down)' }}
            >
              Выйти из аккаунта
            </button>
          </div>
        </>
      )}
    </div>
  );
}
