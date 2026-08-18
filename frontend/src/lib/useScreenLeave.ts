'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { markGoingBack } from '@/lib/navDirection';
import { foldScreenTo, peelScreen, unfoldFrom } from '@/lib/peelScreen';
import { findFoldTarget, takeFoldOrigin } from '@/lib/foldOrigin';

/** Ширина полосы у левой кромки, с которой начинается жест. */
const EDGE_ZONE = 32;

/** Дальше какой доли ширины экрана отпускание закрывает, а не возвращает. */
const DISMISS_RATIO = 0.3;

/**
 * Уход с вложенного экрана: кнопкой назад и свайпом от левой кромки.
 *
 * Экран не гаснет и не уезжает сам по себе — с него снимают слой. Маршрут
 * меняется в тот же кадр, в который нажали, поэтому под уходящим экраном сразу
 * настоящая лента; уезжает его снимок (см. peelScreen).
 *
 * Прежде было наоборот: экран сначала отыгрывал уход, и только потом менялся
 * маршрут. Лента при этом появлялась после — то самое «сначала пустой экран, а
 * потом уже лента», от которого всё выглядело дешевле, чем есть.
 *
 * Жест ловим только у самой кромки: начнись он посреди экрана — и любое
 * горизонтальное движение по списку закрывало бы страницу.
 *
 * @param fold  Селектор кнопки, из которой экран открыли. Задан — экран
 *              разворачивается из неё и складывается обратно (так открываются
 *              поиск, мессенджер и настройки: у них есть своя кнопка в шапке, и
 *              связь «нажал вот это — выросло вот это» стоит показать). Не задан
 *              — экран уезжает вправо, как вложенный.
 */
export function useScreenLeave(fold?: string) {
  const router = useRouter();
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const from = useRef<number | null>(null);
  /** Узел экрана — с него снимается копия. Ставится на корень через ref. */
  const screenRef = useRef<HTMLDivElement>(null);

  // Разворот из кнопки. Точку запомнила сама кнопка в момент нажатия
  // (см. foldOrigin): мерить её отсюда поздно — глиф в шапке к этому кадру
  // уже превращается в крестик, и рамка читается не той.
  useLayoutEffect(() => {
    if (!fold) return;
    unfoldFrom(screenRef.current, takeFoldOrigin());
  }, [fold]);

  /**
   * Уже уходим. Отдельный ref, а не проверка внутри setState.
   *
   * Раньше защита от повторного нажатия жила в апдейтере setLeaving, и там же
   * ставился таймер на router.back(). React прогоняет апдейтеры дважды
   * (StrictMode в разработке) — таймеров заводилось два, router.back()
   * срабатывал дважды, и экран уходил на две записи истории назад вместо
   * одной. Отсюда и весь набор жалоб «выход кидает не туда»: из настроек в
   * уведомления, из клуба в профиль, из чужого профиля в клубы. Возврат был
   * верным, только выполнялся дважды.
   *
   * Побочному действию в апдейтере вообще не место: апдейтер обязан быть
   * чистой функцией от предыдущего состояния.
   */
  const going = useRef(false);

  const goBack = useCallback(
    (fromX = 0) => {
      if (going.current) return;
      going.current = true;
      // Помечаем направление: экран, на который вернёмся, уже был показан, и
      // проигрывать ему анимацию появления незачем (см. PageTransition).
      markGoingBack();
      // Снимок снимаем до смены маршрута — после неё узла уже нет.
      //
      // Утащили пальцем — уезжаем вбок, куда тащили: направление задал жест, и
      // складываться после него в кнопку было бы спором с рукой. Нажали кнопку
      // — складываемся в неё.
      if (fold && !fromX) {
        foldScreenTo(screenRef.current, findFoldTarget(fold));
      } else {
        peelScreen(screenRef.current, fromX);
      }
      router.back();
    },
    [router, fold]
  );

  /** Для onClick: обработчик события получил бы событие вместо сдвига. */
  const onBack = useCallback(() => goBack(0), [goBack]);

  function onPointerDown(event: React.PointerEvent) {
    // Мышь исключена намеренно: на настольном экране протаскивание от левого
    // края — это выделение текста, а не навигация.
    if (event.pointerType === 'mouse' || event.clientX > EDGE_ZONE || going.current) return;
    from.current = event.clientX;
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (from.current === null) return;
    setDragX(Math.max(0, event.clientX - from.current));
  }

  function onPointerUp() {
    if (from.current === null) return;
    const far = dragX > window.innerWidth * DISMISS_RATIO;
    from.current = null;
    setDragging(false);
    // Слой подхватывает ровно тот сдвиг, на котором отпустили, и продолжает
    // движение с него. Сбрось мы dragX до нуля — экран прыгнул бы назад.
    if (far) goBack(dragX);
    setDragX(0);
  }

  /** Обработчики жеста — на корневой узел экрана, вместе со style и ref. */
  const swipeHandlers = {
    ref: screenRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  const style: React.CSSProperties = {
    // В покое именно none, а не translateX(0): любой transform создаёт слой,
    // из которого дочерним элементам не подняться над размытием шторок.
    transform: dragX ? `translateX(${dragX}px)` : 'none',
    // Пока тянут пальцем — без перехода, иначе экран отстаёт от руки.
    transition: dragging ? 'none' : 'transform var(--enter-ms) var(--enter-ease)',
  };

  return { goBack: onBack, style, swipeHandlers };
}
