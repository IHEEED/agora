'use client';

import { useState } from 'react';

/**
 * Вкладка, которая переживает уход с экрана и обратно.
 *
 * Из вкладки «Комменты» в профиле человек уходит на страницу поста и жмёт
 * «назад». Маршрут возвращается верно — на профиль, — но React монтирует его
 * заново, и вкладка сбрасывается на «Посты». Со стороны это выглядит так,
 * будто вернуло не туда, куда просили: человек стоял в комментариях, а
 * оказался в записях.
 *
 * Держим выбор в sessionStorage, а не в адресе. В адресе он был бы честнее, но
 * тогда каждое переключение вкладки добавляло бы запись в историю, и «назад»
 * пришлось бы нажимать столько раз, сколько вкладок ты потрогал. sessionStorage
 * живёт ровно столько, сколько открыта закладка браузера, — как раз нужный
 * срок для «где я был».
 */
export function useStickyTab<T extends string>(key: string, fallback: T) {
  const [tab, setTab] = useState<T>(() => {
    // Читаем в инициализаторе, а не в эффекте: вкладка нужна первому же
    // кадру, иначе виден проблеск не той.
    if (typeof window === 'undefined') return fallback;
    const stored = window.sessionStorage.getItem(`tab:${key}`);
    return (stored as T | null) ?? fallback;
  });

  function choose(next: T) {
    setTab(next);
    window.sessionStorage.setItem(`tab:${key}`, next);
  }

  return [tab, choose] as const;
}
