'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Экраны, которые выглядят не страницей, а шторкой поверх приложения.
 *
 * Уходя с такого экрана, человек не переходит куда-то — он закрывает окно, и
 * то, что было под ним, обязано просто оказаться на месте. Прежде лента после
 * закрытия «Куда опубликовать?» проявлялась с нуля вместе со всеми остальными
 * экранами: анимация была одна на все переходы и не различала «пришёл сюда» и
 * «закрыл то, что было сверху».
 *
 * Отсюда и ощущение медленного возврата — оно не про длительность, а про то,
 * что возврата и не должно быть видно.
 */
const OVERLAY_ROUTES = ['/create', '/search'];

function isOverlay(path: string): boolean {
  return OVERLAY_ROUTES.some((route) => path === route || path.startsWith(`${route}/`));
}

/**
 * Смена экранов.
 *
 * Вложенные экраны — пост, чужой профиль, переписка — въезжают справа налево,
 * как в системной навигации: это движение «вглубь». Остальные проявляются.
 * Возврат из-под шторки не анимируется вовсе.
 *
 * Ключ по маршруту заставляет обёртку перемонтироваться, поэтому анимация
 * проигрывается на каждом переходе.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Откуда пришли. Правим прямо в рендере, а не эффектом: значение нужно тому
  // же кадру, в котором меняется маршрут, — эффект опоздал бы ровно на ту
  // анимацию, которую мы и решаем, проигрывать ли.
  const [previous, setPrevious] = useState(pathname);
  const [cameFromOverlay, setCameFromOverlay] = useState(false);
  if (previous !== pathname) {
    setCameFromOverlay(isOverlay(previous));
    setPrevious(pathname);
  }

  const isDetail =
    pathname.startsWith('/posts/') ||
    pathname.startsWith('/u/') ||
    /^\/messages\/.+/.test(pathname);

  // Закрыли шторку — экран под ней уже был на месте, показывать его «приезд»
  // означало бы соврать про то, что произошло.
  const animation = cameFromOverlay && !isDetail ? '' : isDetail ? 'page-push' : 'page-enter';

  return (
    <div key={pathname} className={`${animation} flex flex-1 flex-col`}>
      {children}
    </div>
  );
}
