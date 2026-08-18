'use client';

import { useEffect, useState } from 'react';

/** Сколько держится указание на найденный комментарий. */
const SPOTLIGHT_MS = 1600;

/**
 * Указание на комментарий, к которому пришли по ссылке из профиля.
 *
 * Возвращает идентификатор, который живёт полторы секунды и гаснет. Это не
 * только про внешний вид: пока цель задана, ветка с ней держится раскрытой
 * принудительно (см. holdsTarget в CommentThread) — иначе прокручивать было
 * бы не к чему. А раз цель бралась прямо из адресной строки, она не пропадала
 * никогда, и кнопка «Свернуть» в этой ветке не работала вовсе: сворачиваешь —
 * ветка раскрывается обратно тем же кадром.
 *
 * Снимая цель после того, как она отыграла, чиним оба симптома разом.
 *
 * Хук общий на два экрана. Комментарии открываются и шторкой поверх ленты, и
 * отдельной страницей поста, куда ведёт ссылка из профиля; логика у них одна,
 * и разъехаться на первой же правке ей здесь незачем.
 */
export function useCommentSpotlight(target: string | null | undefined, ready: boolean) {
  const [spotlight, setSpotlight] = useState<string | null>(target ?? null);

  // Сброс при смене цели — прямо в рендере, а не эффектом: это тот случай
  // «состояние зависит от пропса», для которого React рекомендует такой приём.
  // Эффект дал бы лишний кадр со старым значением.
  const [lastTarget, setLastTarget] = useState(target);
  if (lastTarget !== target) {
    setLastTarget(target);
    setSpotlight(target ?? null);
  }

  useEffect(() => {
    if (!spotlight || !ready) return;

    // Прокручиваем в следующем кадре: до отрисовки узла в разметке нет.
    const frame = requestAnimationFrame(() => {
      document
        .getElementById(`comment-${spotlight}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    // Полторы секунды: прокрутка занимает около полусекунды, и ещё секунда
    // остаётся на то, чтобы глаз нашёл несглаженное пятно.
    const timer = window.setTimeout(() => setSpotlight(null), SPOTLIGHT_MS);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [spotlight, ready]);

  return spotlight;
}
