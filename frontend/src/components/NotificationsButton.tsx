'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { markGoingBack } from '@/lib/navDirection';
import { foldCurrentScreen } from '@/lib/peelScreen';
import { setFoldOrigin } from '@/lib/foldOrigin';
import { useT } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { useUnreadNotifications } from '@/lib/useUnreadNotifications';

/**
 * Колокол в шапке — там, где раньше стоял вход в переписки.
 *
 * Разделы поменялись местами намеренно. Переписки открывают в разы чаще: это
 * разговор, к которому возвращаются весь день. Уведомления смотрят, когда
 * загорелась точка, — и не возвращаются, пока не загорится снова. Частому место
 * под большим пальцем, в нижнем баре; редкому — в шапке, где оно не занимает
 * один из пяти слотов.
 */
export function NotificationsButton({
  variant = 'header',
}: {
  /** Где стоит кнопка: в шапке (только знак) или в боковой панели (с подписью). */
  variant?: 'header' | 'sidebar';
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useT();
  const unread = useUnreadNotifications();

  const active = pathname.startsWith('/notifications');

  /**
   * Откуда пришли в уведомления.
   *
   * Запоминаем при входе, чтобы при выходе вернуть туда же. Кнопка уводила в
   * ленту всегда: зашёл из клуба — вышел в ленту, зашёл из профиля — вышел в
   * ленту. Раздел, который отбирает у человека место, где он был, — это не
   * возврат, а перенос, и после него приходится искать дорогу обратно руками.
   *
   * Ленту оставляем запасным вариантом: на уведомления приходят и по ссылке
   * извне, и тогда возвращать некуда — прошлого экрана в этом окне не было.
   */
  const cameFrom = useRef<string | null>(null);
  if (!active) cameFrom.current = pathname;
  const sidebar = variant === 'sidebar';

  return (
    <Link
      // Кнопка работает переключателем: с экрана уведомлений она возвращает
      // туда, откуда на него пришли, а не ведёт в него повторно. Нажатие по
      // разделу, где ты уже стоишь, обязано что-то делать, иначе кнопка
      // выглядит залипшей.
      href={active ? (cameFrom.current ?? '/') : '/notifications'}
      aria-label={active ? t('action.toFeed') : t('nav.notifications')}
      // Кнопка — точка роста экрана: наружу раздел складывается в неё же.
      data-notifications-button
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        haptic();
        if (!active) {
          setFoldOrigin(rect);
          return;
        }
        event.preventDefault();
        markGoingBack();
        foldCurrentScreen(rect);
        router.push(cameFrom.current ?? '/');
      }}
      className={
        sidebar
          ? 'relative flex w-[76px] flex-col items-center gap-1 rounded-2xl py-2 transition-colors'
          : // md:invisible, а не md:hidden: на широком экране раздел живёт в
            // боковой панели, но шапка держит вывеску по центру через
            // justify-between — без левого элемента кнопка справа уехала бы.
            'relative flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90 md:invisible'
      }
      style={{
        color: sidebar && !active ? 'var(--text-muted)' : 'var(--accent)',
        background: sidebar && active ? 'var(--accent-soft)' : undefined,
      }}
    >
      {/* На самом экране уведомлений колокол превращается в стрелку назад:
          кнопка отсюда и так возвращает в ленту, а стрелка прямо говорит об
          этом. В боковой панели остаётся колоколом — там это пункт навигации. */}
      {active && !sidebar ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      ) : (
        <svg width={sidebar ? 24 : 23} height={sidebar ? 24 : 23} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5"
            fill={active ? 'currentColor' : 'none'}
          />
          <path d="M13.7 20a2 2 0 0 1-3.4 0" />
        </svg>
      )}

      {sidebar && (
        <span className="text-center text-[9.5px] font-medium leading-none">
          {t('nav.notifications')}
        </span>
      )}

      {unread > 0 && (
        <span
          aria-hidden
          // Точка, а не число. У переписок счёт важен — «сколько человек ждут
          // ответа» меняет решение, отвечать сейчас или потом. У уведомлений
          // нет: там всё равно надо зайти и посмотреть, а двузначное число
          // рядом с колоколом только тревожит.
          className={`absolute h-[9px] w-[9px] rounded-full ${
            sidebar ? 'right-5 top-2' : 'right-2 top-2.5'
          }`}
          style={{
            background: 'var(--down)',
            // Обводка цветом фона: без неё точка сливается с линиями знака.
            boxShadow: '0 0 0 2px var(--bg)',
          }}
        />
      )}
    </Link>
  );
}
