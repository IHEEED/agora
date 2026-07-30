'use client';

import { usePathname } from 'next/navigation';

/**
 * Смена экранов в духе Instagram: быстрый кроссфейд с едва заметным подъёмом.
 * Ключ по маршруту заставляет обёртку перемонтироваться, поэтому анимация
 * проигрывается на каждом переходе.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-enter flex flex-1 flex-col">
      {children}
    </div>
  );
}
