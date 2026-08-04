'use client';

import { usePathname } from 'next/navigation';

/**
 * Смена экранов в духе Instagram: быстрый кроссфейд с едва заметным подъёмом.
 * Ключ по маршруту заставляет обёртку перемонтироваться, поэтому анимация
 * проигрывается на каждом переходе.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Пост — вложенный экран, а не соседняя вкладка: он въезжает справа налево,
  // как в системной навигации. Остальные экраны просто проявляются.
  const isDetail = pathname.startsWith('/posts/') || pathname.startsWith('/u/');

  return (
    <div
      key={pathname}
      className={`${isDetail ? 'page-push' : 'page-enter'} flex flex-1 flex-col`}
    >
      {children}
    </div>
  );
}
