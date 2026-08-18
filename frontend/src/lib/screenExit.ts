'use client';

import { useEffect } from 'react';

/**
 * Просьба закрыть экран — крестиком в шапке или кнопкой «назад» внутри.
 *
 * Экраны, которые выглядят шторкой (написание поста) или должны погаснуть
 * перед уходом (поиск), не могут просто дать router.back(): маршрут меняется,
 * разметка исчезает в тот же кадр, и уход выглядит рывком. Такой экран
 * подписывается на это событие, гасит себя сам и уводит навигацию, когда
 * анимация отыграла.
 *
 * Событие с cancelable: если подписчик его перехватил, шапка ничего не делает;
 * если подписчиков нет — уходит назад сама, как раньше.
 */
const SCREEN_EXIT_EVENT = 'parafraz-screen-exit';

export function requestScreenExit(fallback: () => void) {
  const handled = !window.dispatchEvent(new CustomEvent(SCREEN_EXIT_EVENT, { cancelable: true }));
  if (!handled) fallback();
}

export function useScreenExit(handler: () => void) {
  useEffect(() => {
    function onExit(event: Event) {
      event.preventDefault();
      handler();
    }

    window.addEventListener(SCREEN_EXIT_EVENT, onExit);
    return () => window.removeEventListener(SCREEN_EXIT_EVENT, onExit);
  }, [handler]);
}
