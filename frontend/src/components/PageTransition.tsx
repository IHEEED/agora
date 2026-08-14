'use client';

import { usePathname } from 'next/navigation';

/**
 * Смена экранов в духе Instagram: быстрый кроссфейд с едва заметным подъёмом.
 * Ключ по маршруту заставляет обёртку перемонтироваться, поэтому анимация
 * проигрывается на каждом переходе.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Пост, чужой профиль и переписка — вложенные экраны, а не соседние вкладки:
  // они въезжают справа налево, как в системной навигации, и тем же движением
  // уходят обратно. Остальные экраны просто проявляются.
  const isDetail =
    pathname.startsWith('/posts/') ||
    pathname.startsWith('/u/') ||
    /^\/messages\/.+/.test(pathname);

  return (
    <div
      key={pathname}
      className={`${isDetail ? 'page-push' : 'page-enter'} flex flex-1 flex-col`}
    >
      {children}
    </div>
  );
}
