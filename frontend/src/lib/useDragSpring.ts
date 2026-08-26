'use client';

import { useCallback, useEffect, useRef } from 'react';
import { spring, type SpringHandle } from './spring';

/**
 * Жест, который тянут пальцем, а отпускают в пружину.
 *
 * Две вещи, обе важные.
 *
 * ── Первая: React не участвует в кадрах ─────────────────────────────────────
 *
 * Раньше каждое движение пальца вызывало setState, то есть полную отрисовку
 * поддерева на каждое событие указателя. На строке переписки это десяток узлов,
 * на переписке — все видимые пузыри. Браузер шлёт pointermove чаще, чем кадры,
 * и на слабом телефоне отрисовка не успевала за пальцем — жест «отставал».
 *
 * Здесь значение пишется прямо в стиль узла, минуя React. Отрисовка за время
 * жеста не происходит ни разу.
 *
 * ── Вторая: отпускание можно перехватить ────────────────────────────────────
 *
 * release() запускает пружину (см. lib/spring), а не CSS-переход. Пока она едет,
 * новый grab() снимает её, забирая текущие положение и скорость, — и следующее
 * движение продолжается с того места и с той же скоростью, без скачка.
 *
 * Это и есть «прервать и развернуть на полпути»: схватить уезжающий назад
 * элемент и повести обратно, не дожидаясь, пока он доедет.
 */
export function useDragSpring<T extends HTMLElement>(
  /** Как показать значение. Зовут из кадрового цикла — только transform и opacity. */
  write: (node: T, value: number) => void,
  initial = 0
) {
  const ref = useRef<T | null>(null);
  const handle = useRef<SpringHandle | null>(null);
  const value = useRef(initial);
  const writeRef = useRef(write);
  // Синхронизируем эффектом, а не присваиванием в теле: запись в ref во время
  // отрисовки — это побочное действие в чистой функции, и React справедливо на
  // него ругается. Кадровый цикл читает writeRef, а не write, поэтому опоздание
  // на один кадр после смены замыкания ничего не значит.
  useEffect(() => {
    writeRef.current = write;
  });

  const apply = useCallback((next: number) => {
    value.current = next;
    if (ref.current) writeRef.current(ref.current, next);
  }, []);

  /** Снять пружину, забрав её состояние. Звать в начале жеста. */
  const grab = useCallback(() => {
    const running = handle.current;
    if (!running) return 0;
    const carried = running.velocity();
    running.stop();
    handle.current = null;
    // Отдаём скорость наружу: тот, кто перехватил, передаст её обратно в
    // release, и разрыва в движении не будет.
    return carried;
  }, []);

  /** Поставить значение немедленно — палец ведёт, следовать надо точно. */
  const set = useCallback(
    (next: number) => {
      if (handle.current) {
        handle.current.stop();
        handle.current = null;
      }
      apply(next);
    },
    [apply]
  );

  /** Отпустить: доехать до цели пружиной, унося скорость пальца. */
  const release = useCallback(
    (to: number, velocity = 0, options?: { response?: number; damping?: number }) => {
      handle.current?.stop();
      handle.current = spring({
        from: value.current,
        to,
        velocity,
        // Отскок только там, где его попросили: возврат на место после
        // несостоявшегося жеста обязан быть спокойным.
        damping: options?.damping ?? 1,
        response: options?.response ?? 0.35,
        onUpdate: apply,
        onDone: () => {
          handle.current = null;
        },
      });
    },
    [apply]
  );

  // Узел мог смениться (список перерисовался) — значение восстанавливаем.
  const attach = useCallback(
    (node: T | null) => {
      ref.current = node;
      if (node) writeRef.current(node, value.current);
    },
    []
  );

  useEffect(() => () => handle.current?.stop(), []);

  // Имена нарочно не ref и не current. Компилятор React разбирает код по
  // именам: свойство ref он принимает за настоящий ref-объект, а вызов
  // .current() — за чтение ref во время отрисовки, и запрещает оба. Здесь ни
  // того ни другого нет — это функция-приёмник узла и обычный геттер.
  const read = useCallback(() => value.current, []);

  return { bind: attach, set, release, grab, read };
}
