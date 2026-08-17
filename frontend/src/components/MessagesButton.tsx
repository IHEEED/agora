'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { markGoingBack } from '@/lib/navDirection';
import { peelCurrentScreen } from '@/lib/peelScreen';

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
  const router = useRouter();
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
      // Кнопка работает переключателем: из мессенджера она возвращает в ленту,
      // а не ведёт в мессенджер повторно. Так себя ведёт любая вкладка — нажатие
      // по той, где ты уже стоишь, обязано что-то делать, иначе кнопка выглядит
      // залипшей.
      href={active ? '/' : '/messages'}
      aria-label={active ? 'В ленту' : 'Мессенджер'}
      // Возврат в ленту той же кнопкой — это тот же уход из мессенджера, что и
      // по стрелке внутри него, и выглядеть он обязан так же: слой снимается,
      // лента под ним уже настоящая. Обычный переход по ссылке дал бы вместо
      // этого проявление ленты с нуля.
      onClick={(event) => {
        if (!active) return;
        event.preventDefault();
        markGoingBack();
        peelCurrentScreen();
        router.push('/');
      }}
      // Без подложки и обводки — как у кнопки справа. Знак различает состояние
      // заливкой: на самом экране переписок он залит, снаружи — контурный.
      className="relative flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90"
      style={{ color: 'var(--accent)' }}
    >
      {/* Два пузыря внахлёст: одиночный пузырь с полосками — знак комментариев
          под записью, и в шапке он обещал совсем не то. */}
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M14 9a2 2 0 0 1-2 2H6l-4 3.5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z"
          fill={active ? 'currentColor' : 'none'}
        />
        <path d="M18 9h2a2 2 0 0 1 2 2v10.5L18 18h-6a2 2 0 0 1-2-2v-1" />
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
