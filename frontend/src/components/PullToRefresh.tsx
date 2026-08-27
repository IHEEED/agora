'use client';

import { useRef } from 'react';
import { spring, type SpringHandle } from '@/lib/spring';
import { VelocityTracker } from '@/lib/gestureVelocity';
import { haptic } from '@/lib/haptics';

/**
 * Потянуть вниз — обновить.
 *
 * Жеста не было вовсе. Обновить ленту можно было только уйдя с экрана и
 * вернувшись, и человек, который тянет страницу вниз (а тянет её каждый, это
 * первое, что делают руки), получал в ответ ничего.
 *
 * Индикатор — сам знак приложения. Отдельный кружок-спиннер здесь был бы третьей
 * вещью в шапке, где и так двое; знак же всё равно стоит по центру, всё равно
 * умеет моргать, и его моргание уже означает «идёт обновление». Остаётся
 * дотянуть до него жест.
 *
 * Сопротивление растёт: чем дальше тянут, тем меньше страница идёт за пальцем.
 * Жёсткий упор читается как «зависло», нарастающее — как «тянуть можно, но
 * дальше ничего нет». Формула из образцов Apple (см. lib/gestureVelocity).
 */

/** Дальше этого отпускание запускает обновление. */
const TRIGGER = 68;

/** Дальше этого страница не идёт: за упором тянуть нечего. */
const MAX = 110;

export function PullToRefresh({
  onRefresh,
  children,
}: {
  /** Что перечитать. Должен вернуть обещание — по нему и снимаем натяжение. */
  onRefresh: () => Promise<unknown> | void;
  children: React.ReactNode;
}) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const from = useRef<number | null>(null);
  const shift = useRef(0);
  const handle = useRef<SpringHandle | null>(null);
  const speed = useRef(new VelocityTracker());
  const armed = useRef(false);
  const busy = useRef(false);

  function apply(value: number) {
    shift.current = value;
    const node = nodeRef.current;
    if (node) node.style.transform = value ? `translateY(${value}px)` : '';
  }

  function down(event: React.PointerEvent) {
    // Жест начинается только у самого верха. Иначе он спорил бы с обычной
    // прокруткой: человек листает ленту вверх, доходит до начала и внезапно
    // обнаруживает, что вместо остановки началось обновление.
    if (busy.current || window.scrollY > 2 || event.pointerType === 'mouse') return;
    from.current = event.clientY;
    armed.current = false;
    speed.current.reset();
    handle.current?.stop();
    handle.current = null;
  }

  function move(event: React.PointerEvent) {
    const start = from.current;
    if (start === null) return;

    const moved = event.clientY - start;
    // Тянут вверх — это обычная прокрутка, отдаём её браузеру и выходим.
    if (moved <= 0) {
      if (shift.current === 0) from.current = null;
      return;
    }

    speed.current.add(event.clientY);

    // Вязкость: корень от пройденного, а не сам путь.
    const pulled = Math.min(MAX, Math.sqrt(moved) * 9);
    apply(pulled);

    // Порог перейден — короткий отклик, как у переключателя. Один раз: держать
    // палец за порогом и получать дрожь непрерывно — ощущение сломанного.
    if (pulled >= TRIGGER && !armed.current) {
      armed.current = true;
      haptic();
    }
  }

  async function up() {
    if (from.current === null) return;
    const pulled = shift.current;
    from.current = null;

    if (pulled < TRIGGER) {
      handle.current = spring({ from: pulled, to: 0, onUpdate: apply });
      return;
    }

    /**
     * Держим натяжение, пока идёт запрос.
     *
     * Убрать его сразу и обновлять «в фоне» было бы честно по времени и
     * неверно по ощущению: человек отпустил и увидел, что ничего не произошло.
     * Страница остаётся оттянутой ровно до ответа — и это же время моргает
     * знак, которому натяжение и открыло место.
     */
    busy.current = true;
    handle.current = spring({ from: pulled, to: TRIGGER, onUpdate: apply });

    try {
      await onRefresh();
    } finally {
      busy.current = false;
      handle.current?.stop();
      handle.current = spring({ from: shift.current, to: 0, onUpdate: apply });
    }
  }

  return (
    <div
      ref={nodeRef}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={() => void up()}
      onPointerCancel={() => void up()}
      // Вертикаль нужна и нам, и прокрутке. Забирать её целиком нельзя — лента
      // перестанет листаться, — поэтому touch-action не трогаем вовсе: пока
      // страница наверху, браузеру всё равно некуда её прокручивать, и события
      // достаются нам.
      className="flex flex-1 flex-col"
    >
      {children}
    </div>
  );
}
