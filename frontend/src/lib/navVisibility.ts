'use client';

import { useEffect, useState } from 'react';

/**
 * Нижний бар прячется не только по маршруту: поисковая строка внутри страницы
 * тоже должна убирать его вниз, освобождая место клавиатуре. Пробрасывать
 * состояние через контекст ради одного флага дороже, чем событие на window.
 */
const NAV_HIDDEN_EVENT = 'parafraz-nav-hidden';

export function setNavHidden(hidden: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(NAV_HIDDEN_EVENT, { detail: hidden }));
}

export function useNavHiddenRequest() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onChange = (event: Event) => setHidden((event as CustomEvent<boolean>).detail);
    window.addEventListener(NAV_HIDDEN_EVENT, onChange);
    return () => window.removeEventListener(NAV_HIDDEN_EVENT, onChange);
  }, []);

  return [hidden, setHidden] as const;
}
