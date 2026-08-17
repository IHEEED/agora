'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { consumeGoingBack } from '@/lib/navDirection';

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

  // Откуда пришли и в какую сторону. Правим прямо в рендере, а не эффектом:
  // значение нужно тому же кадру, в котором меняется маршрут, — эффект опоздал
  // бы ровно на ту анимацию, которую мы и решаем, проигрывать ли.
  const [previous, setPrevious] = useState(pathname);
  const [silent, setSilent] = useState(false);
  if (previous !== pathname) {
    // Возврат назад или закрытие шторки — экран уже был показан. Анимировать
    // его появление значит выдавать возврат за переход: человек ждёт свою
    // ленту, а получает представление. Именно это читалось как «медленное
    // появление» и «долгое прогружение».
    setSilent(consumeGoingBack() || isOverlay(previous));
    setPrevious(pathname);
  }

  const isDetail =
    pathname.startsWith('/posts/') ||
    pathname.startsWith('/u/') ||
    pathname.startsWith('/c/') ||
    pathname.startsWith('/messages/');

  // Экраны, которые разворачиваются из своей кнопки в шапке, анимируют себя
  // сами (см. unfoldFrom). Общий переход им не только не нужен, но и мешает:
  // page-push начинается с translateX(100%), и экран в момент замера точки
  // роста стоит за правой кромкой — разворот получался из места, которого на
  // экране нет. Отсюда и «мессенджер разворачивается непонятно откуда».
  const foldsItself =
    pathname === '/search' || pathname === '/settings' || pathname === '/messages';

  const animation = silent || foldsItself ? '' : isDetail ? 'page-push' : 'page-enter';

  return (
    // data-screen — метка для тех, кто уводит с экрана снаружи него: кнопка
    // мессенджера в шапке снимает с него слой ровно так же, как своя кнопка
    // «назад» внутри (см. peelCurrentScreen).
    <div key={pathname} data-screen className={`${animation} flex flex-1 flex-col`}>
      {children}
    </div>
  );
}
