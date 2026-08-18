'use client';

import { useSyncExternalStore } from 'react';

/**
 * Нижний бар прячется не только по маршруту: поисковая строка внутри страницы
 * и экран переписки тоже убирают его вниз, освобождая место клавиатуре и полю
 * ввода. Пробрасывать состояние через контекст ради одного флага дороже, чем
 * событие на window.
 *
 * Значение при этом хранится в модуле, а не живёт только в событии. Иначе при
 * прямом заходе по ссылке бар оставался на месте: страница просит спрятать его
 * в своём эффекте, а эффект бара подписывается на событие позже — сообщение
 * уходило в пустоту, и бар накрывал строку ввода.
 */
const NAV_HIDDEN_EVENT = 'parafraz-nav-hidden';

let hiddenNow = false;

export function setNavHidden(hidden: boolean) {
  hiddenNow = hidden;
  window.dispatchEvent(new CustomEvent<boolean>(NAV_HIDDEN_EVENT, { detail: hidden }));
}

/**
 * Чтение через useSyncExternalStore, а не через подписку с собственным
 * состоянием: React сам перечитывает снимок сразу после подписки. Именно
 * этого не хватало при прямом заходе по ссылке — экран просил спрятать бар
 * раньше, чем бар успевал подписаться, и просьба пропадала.
 */
export function useNavHiddenRequest(): boolean {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener(NAV_HIDDEN_EVENT, notify);
      return () => window.removeEventListener(NAV_HIDDEN_EVENT, notify);
    },
    () => hiddenNow,
    () => false
  );
}
