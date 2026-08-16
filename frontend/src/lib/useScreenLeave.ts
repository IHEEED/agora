'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

/** Сколько уезжает экран. Совпадает с --exit-ms в globals.css. */
const LEAVE_MS = 180;

/**
 * Уход с вложенного экрана назад — движением, а не подменой кадра.
 *
 * Пост, чужой профиль и переписка въезжают справа (см. .page-push): вложенный
 * экран приходит «вглубь». Обратно они до сих пор просто исчезали: router.back()
 * меняет маршрут, разметка пропадает в тот же кадр, и вместо ухода получался
 * рывок. Заметнее всего это было как раз там, где вход анимирован, — глаз ждёт
 * симметричного движения и не получает его.
 *
 * Здесь экран сначала уезжает вправо, туда же, откуда приехал, и только потом
 * уводится навигация.
 *
 * Хук общий: те же три экрана делали бы это одинаково, а разошлись бы на
 * первой правке. У переписки собственная копия — там уход совмещён со свайпом
 * от кромки, и одним флагом это не выражается.
 */
export function useScreenLeave() {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  const goBack = useCallback(() => {
    // Второе нажатие по кнопке «Назад» не должно запускать вторую анимацию:
    // навигация уже назначена, и повторный router.back() увёл бы на два
    // экрана вместо одного.
    setLeaving((already) => {
      if (already) return already;
      window.setTimeout(() => router.back(), LEAVE_MS);
      return true;
    });
  }, [router]);

  /** Стиль для корневого узла экрана. */
  const style: React.CSSProperties = {
    transform: leaving ? 'translateX(24px)' : 'none',
    opacity: leaving ? 0 : 1,
    // Только на уходе: пока экран на месте, переход не нужен, а на входе
    // работает анимация .page-push из globals.css.
    transition: leaving
      ? 'transform var(--exit-ms) var(--exit-ease), opacity var(--exit-ms) var(--exit-ease)'
      : undefined,
  };

  return { leaving, goBack, style };
}
