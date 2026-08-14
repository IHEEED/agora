'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';

/** Как часто спрашиваем про непрочитанные. */
const POLL_MS = 25000;

/**
 * Вход в переписки — слева в шапке, зеркально кнопке действия справа.
 *
 * В нижний бар мессенджер не пошёл: там пять слотов, и шестой пришлось бы
 * отнимать у чего-то из уже привычного. В шапке место как раз пустовало.
 *
 * Непрочитанные спрашиваем опросом: живого канала в приложении пока нет,
 * а держать соединение ради точки на кнопке — слишком дорогая механика.
 */
export function MessagesButton() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function check() {
      apiFetch<{ count: number }>('/messages/unread-count')
        .then(({ count }) => {
          if (!cancelled) setUnread(count);
        })
        // Молча: таблицы может ещё не быть (миграция 007), и точка на кнопке
        // не тот повод, чтобы ронять шапку на каждом экране.
        .catch(() => undefined);
    }

    check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
    // Переход на другой экран — хороший момент перепроверить: из переписки
    // человек возвращается уже с нулём.
  }, [pathname]);

  const active = pathname.startsWith('/messages');

  return (
    <Link
      href="/messages"
      aria-label="Сообщения"
      className="relative flex h-11 w-11 items-center justify-center rounded-full border transition-colors"
      style={{
        background: active ? 'var(--accent)' : 'var(--accent-soft)',
        borderColor: 'var(--glass-border)',
        color: active ? 'var(--accent-contrast)' : 'var(--accent)',
      }}
    >
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H9l-5 3Z" />
        <path d="M8.5 9.5h7M8.5 13.5h4.5" />
      </svg>

      {unread > 0 && (
        <span
          aria-hidden
          className="font-num absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-semibold"
          style={{ background: 'var(--down)', color: '#ffffff' }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
