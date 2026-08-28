'use client';

import { useRouter } from 'next/navigation';
import { ScreenTitle } from '@/components/ScreenTitle';

/**
 * Крупный заголовок экрана с кружком-стрелкой «назад» слева.
 *
 * Разделы, открытые из настроек (модерация, подтверждение личности,
 * статистика), — отдельные маршруты, и выйти из них было нечем: шапка на них
 * показывает не крестик, а лупу. Кружок с той же стрелкой, что и в настройках,
 * возвращает на шаг назад — по нему и уходят.
 */
export function BackTitle({ children }: { children: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.back()}
        aria-label="Назад"
        className="glass flex h-11 w-11 flex-none items-center justify-center rounded-full text-[var(--text)] transition-transform active:scale-95"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <ScreenTitle>{children}</ScreenTitle>
    </div>
  );
}
