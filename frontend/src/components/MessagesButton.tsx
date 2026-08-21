'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { markGoingBack } from '@/lib/navDirection';
import { foldCurrentScreen } from '@/lib/peelScreen';
import { setFoldOrigin } from '@/lib/foldOrigin';
import { useT } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';

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
export function MessagesButton({
  variant = 'header',
}: {
  /** Где стоит кнопка: в шапке (только знак) или в боковой панели (с подписью). */
  variant?: 'header' | 'sidebar';
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
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

  // Два облика одной кнопки. В шапке — только знак: место там на счёт, и знак
  // всегда на виду. В боковой панели — знак с подписью в ряд с остальными
  // разделами, потому что панель уезжает к левому краю, вне поля зрения, и
  // разгадывать её знаки заново на каждом заходе никто не должен.
  const sidebar = variant === 'sidebar';

  return (
    <Link
      // Кнопка работает переключателем: из мессенджера она возвращает в ленту,
      // а не ведёт в мессенджер повторно. Так себя ведёт любая вкладка — нажатие
      // по той, где ты уже стоишь, обязано что-то делать, иначе кнопка выглядит
      // залипшей.
      href={active ? '/' : '/messages'}
      aria-label={active ? t('action.toFeed') : t('messenger.title')}
      // Кнопка — точка роста экрана. Наружу мессенджер складывается в неё же,
      // а не проявляется лентой с нуля: одно движение в две стороны связывает
      // раздел с тем, чем его открыли.
      data-messages-button
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        haptic();
        if (!active) {
          // Запоминаем рамку до перехода: экран мессенджера прочитает её на
          // монтировании и развернётся отсюда (см. foldOrigin).
          setFoldOrigin(rect);
          return;
        }
        event.preventDefault();
        markGoingBack();
        foldCurrentScreen(rect);
        router.push('/');
      }}
      // Без подложки и обводки — как у кнопки справа. Знак различает состояние
      // заливкой: на самом экране переписок он залит, снаружи — контурный.
      className={
        sidebar
          ? 'relative flex w-[76px] flex-col items-center gap-1 rounded-2xl py-2 transition-colors'
          : // md:invisible, а не md:hidden. На широком экране мессенджер живёт в
            // боковой панели, и в шапке он лишний — но hidden выкидывает его из
            // потока, а шапка держит вывеску по центру через justify-between:
            // без левого элемента кнопка настроек уезжала к левому краю.
            // Невидимый элемент места не занимает на глаз и не нажимается,
            // а разметку держит.
            'relative flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 md:invisible'
      }
      style={{
        color: sidebar && !active ? 'var(--text-muted)' : 'var(--accent)',
        background: sidebar && active ? 'var(--accent-soft)' : undefined,
      }}
    >
      {/* Два пузыря внахлёст: одиночный пузырь с полосками — знак комментариев
          под записью, и в шапке он обещал совсем не то. */}
      <svg width={sidebar ? 24 : 23} height={sidebar ? 24 : 23} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M14 9a2 2 0 0 1-2 2H6l-4 3.5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z"
          fill={active ? 'currentColor' : 'none'}
        />
        <path d="M18 9h2a2 2 0 0 1 2 2v10.5L18 18h-6a2 2 0 0 1-2-2v-1" />
      </svg>

      {sidebar && (
        <span className="text-center text-[9.5px] font-medium leading-none">{t('messenger.title')}</span>
      )}

      {unread > 0 && (
        <span
          aria-hidden
          // Значок наезжает на знак, а не висит рядом.
          //
          // Отставленный на пару пикселей, он читался отдельным предметом
          // где-то возле кнопки — непонятно, к чему относится. Наползая на
          // угол знака, он становится его частью: так метки ставят и в iOS, и в
          // Telegram, и вопрос «чей это счётчик» не возникает.
          className={`font-num absolute flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
            sidebar ? 'right-4 top-1' : 'right-0 top-0.5'
          }`}
          style={{
            background: 'var(--down)',
            color: '#ffffff',
            // Обводка цветом фона: без неё значок сливается с линиями знака под
            // ним, и цифра теряет край.
            boxShadow: '0 0 0 2px var(--bg)',
          }}
        >
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
