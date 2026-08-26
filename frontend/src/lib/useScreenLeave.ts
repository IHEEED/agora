'use client';

import { useCallback, useLayoutEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { markGoingBack } from '@/lib/navDirection';
import { foldScreenTo, peelScreen, unfoldFrom } from '@/lib/peelScreen';
import { findFoldTarget, takeFoldOrigin } from '@/lib/foldOrigin';
import { useDragSpring } from '@/lib/useDragSpring';
import { VelocityTracker, committed } from '@/lib/gestureVelocity';

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
  const from = useRef<number | null>(null);
  /** Узел экрана — с него снимается копия. Ставится на корень через ref. */
  const screenRef = useRef<HTMLDivElement>(null);
  const speed = useRef(new VelocityTracker());

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

  /**
   * Сдвиг экрана живёт в стиле узла, а не в состоянии.
   *
   * Было двумя состояниями (dragX и dragging) и CSS-переходом на отпускании.
   * Переход владеет свойством до конца своей длительности: схватить
   * возвращающийся экран и снова потянуть было нельзя — сначала доедет. А
   * setState на каждое движение указателя перерисовывал весь экран целиком,
   * то есть самое тяжёлое поддерево в приложении, десятки раз за жест.
   */
  const {
    bind: bindScreen,
    set: setShift,
    release: releaseShift,
    grab: grabShift,
    read: readShift,
  } = useDragSpring<HTMLDivElement>((node, value) => {
    // В покое именно пусто, а не translateX(0): любой transform создаёт слой,
    // из которого дочерним элементам не подняться над размытием шторок.
    node.style.transform = value ? `translateX(${value}px)` : '';
  });

  /** Скорость, унесённая у перехваченной пружины. */
  const carried = useRef(0);

  function onPointerDown(event: React.PointerEvent) {
    // Мышь тоже тянет.
    //
    // Раньше она была исключена: считалось, что протаскивание от левого края на
    // настольном экране — это выделение текста. На кромке в тридцать два
    // пикселя выделять нечего (там поле колонки), а жест человек ищет один и
    // тот же независимо от того, палец у него или курсор. Отказ работал ровно
    // как «свайпов нигде нет».
    if (event.clientX > EDGE_ZONE || going.current) return;
    from.current = event.clientX;
    // Перехватываем указатель: без этого курсор, ушедший за пределы узла,
    // перестаёт слать события, и экран замирает на полпути.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    // Схватили — снимаем пружину, забирая её скорость: возвращающийся экран
    // подхватывается на ходу, а не с нуля.
    carried.current = grabShift();
    speed.current.reset();
  }

  function onPointerMove(event: React.PointerEvent) {
    if (from.current === null) return;
    speed.current.add(event.clientX);
    setShift(Math.max(0, event.clientX - from.current));
  }

  function onPointerUp() {
    if (from.current === null) return;
    const shift = readShift();
    const velocity = speed.current.get() || carried.current;
    from.current = null;

    // Далеко утащили или быстро бросили. Раньше решало только расстояние, и
    // короткий резкий флик от кромки — самое естественное «назад» на телефоне —
    // не срабатывал вовсе (см. lib/gestureVelocity).
    if (committed(shift, velocity, window.innerWidth * DISMISS_RATIO)) {
      // Слой подхватывает ровно тот сдвиг, на котором отпустили, и продолжает
      // движение с него. Обнули мы сдвиг — экран прыгнул бы назад.
      goBack(shift);
      return;
    }

    // Не дотянули — возвращаем пружиной, унося скорость пальца: между «вёл» и
    // «поехало само» не должно быть видимого шва.
    releaseShift(0, velocity);
  }

  /**
   * Один приёмник узла на двоих.
   *
   * Пружина пишет в узел transform, а снятие слоя снимает с него копию — значит
   * ссылку на один и тот же элемент должны получить оба. Раздавать её двумя
   * разными способами (ref-объект в разметке и bind у пружины) нельзя: React
   * принимает только одно значение атрибута ref.
   */
  const attachScreen = useCallback(
    (node: HTMLDivElement | null) => {
      screenRef.current = node;
      bindScreen(node);
    },
    [bindScreen]
  );

  /** Обработчики жеста — на корневой узел экрана, вместе со style и ref. */
  const swipeHandlers = {
    // Узел нужен обоим: пружина в него пишет, снятие слоя с него снимает копию.
    // Приёмник поэтому один, а раскладывает он в два места.
    ref: attachScreen,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
  };

  const style: React.CSSProperties = {
    // Ни transform, ни transition: и то и другое пишет пружина прямо в узел.
    // Переход здесь был бы прямо вреден — он владел бы свойством и не давал
    // перехватить движение на полпути.
    // Вертикальную прокрутку браузер обрабатывает сам, горизонтальную забираем
    // себе. Без этого на телефоне жест от кромки уходил в системный «назад»
    // или в прокрутку, и экран за пальцем не шёл.
    touchAction: 'pan-y',
  };

  return { goBack: onBack, style, swipeHandlers };
}
