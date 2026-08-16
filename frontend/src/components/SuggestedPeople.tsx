'use client';

import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { UserSummary } from '@/lib/types';
import { AvatarFollow } from '@/components/AvatarFollow';

/** Ширина карточки в ленте и зазор между карточками — на них же считается сдвиг. */
const CARD_WIDTH = 148;
const CARD_GAP = 8;

/** Сколько едет уходящая карточка. Совпадает с transition в разметке. */
const DISMISS_MS = 220;

/**
 * Рекомендации людей: горизонтальная лента карточек или вертикальный список.
 *
 * Заголовка и кнопки «Скрыть рекомендации» здесь больше нет.
 *
 * Кнопка закрывала блок целиком, и закрытие выглядело рваным по устройству, а
 * не по числам: схлопывалась строка из карточек, каждая из которых несла свою
 * тень и своё скругление, а вместе с ней ехала вверх вся лента под ней.
 * Браузеру приходилось на каждом кадре пересобирать раскладку всей страницы —
 * отсюда и рывки, которые не лечились подбором длительности.
 *
 * Убрать блок можно и так: карточки закрываются по одной, и когда уходит
 * последняя, блока не остаётся. Это и честнее — «скрыть навсегда» с
 * запоминанием на устройстве было решением, которое человек принимал одним
 * случайным нажатием и не мог отменить.
 */
export function SuggestedPeople({
  className,
  layout = 'row',
}: {
  className?: string;
  layout?: 'row' | 'list';
}) {
  const [people, setPeople] = useState<UserSummary[]>([]);
  // Кого сейчас убирают: карточка ещё в разметке, но уже схлопывается.
  const [hiding, setHiding] = useState<string[]>([]);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch<UserSummary[]>('/users/suggestions')
      .then((list) => {
        if (!cancelled) setPeople(list);
      })
      // Молча: таблицы подписок может ещё не быть (миграция 004), и падать
      // из-за необязательного блока лента не должна.
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Убрать одного человека из подсказок.
   *
   * Уходящая карточка гаснет на месте, а те, что правее, отъезжают на её
   * ширину — и то и другое через transform.
   *
   * Прошлые две попытки анимировали саму ширину карточки: 148 → 0. Выглядело
   * это рвано, и подбор длительности не помогал, потому что причина не в
   * числах. Ширина — свойство раскладки: браузер на каждом кадре заново
   * считает положение всех соседей, ширину прокручиваемой ленты и её
   * scrollLeft, а тень и скругление карточки перерисовывает заново. Шестьдесят
   * раз в секунду этого не успеть.
   *
   * transform же не трогает раскладку вовсе — его считает видеокарта поверх
   * готовой картинки. Место карточка при этом занимать не перестаёт, поэтому
   * из массива её убираем после анимации, разом со сбросом сдвигов: к тому
   * моменту соседи уже стоят там, куда их привёл transform, и подмена в кадре
   * не видна.
   */
  function dismissPerson(id: string) {
    setHiding((prev) => [...prev, id]);
    timers.current.push(
      setTimeout(() => {
        setPeople((prev) => prev.filter((person) => person.id !== id));
        setHiding((prev) => prev.filter((hidden) => hidden !== id));
      }, DISMISS_MS)
    );
  }

  if (people.length === 0) return null;

  if (layout === 'list') {
    return (
      <section className={className}>
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {people.map((person) => (
            <div key={person.id} className="flex items-center gap-3 py-3">
              <AvatarFollow
                userId={person.id}
                username={person.username}
                initiallyFollowing={person.isFollowing}
                size={46}
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium text-[var(--text)]">
                  {person.username}
                </span>
                <span className="text-[12.5px] text-[var(--text-muted)]">
                  <span className="font-num">{person.karma}</span> influence
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    // Горизонтальная лента: рекомендации не должны отжимать посты вниз
    // на пол-экрана, поэтому в высоту они занимают одну карточку.
    <section className={className}>
      <div
        className="no-scrollbar -mx-4 flex overflow-x-auto px-4 py-1"
        style={{ gap: CARD_GAP }}
      >
        {people.map((person, index) => {
          const going = hiding.includes(person.id);
          // На сколько карточек левее меня уже уезжают: каждая из них
          // освобождает свою ширину вместе с зазором.
          const shift = people
            .slice(0, index)
            .filter((other) => hiding.includes(other.id)).length;

          return (
            <div
              key={person.id}
              className="flex-none"
              style={{
                width: CARD_WIDTH,
                // Уходящая сжимается и гаснет на месте, остальные едут влево.
                // Оба свойства — transform и opacity — считаются на видеокарте
                // и не заставляют браузер пересобирать раскладку ленты.
                transform: `translateX(${-shift * (CARD_WIDTH + CARD_GAP)}px)${
                  going ? ' scale(0.86)' : ''
                }`,
                opacity: going ? 0 : 1,
                // Прозрачность уходит быстрее сдвига: карточка успевает
                // исчезнуть раньше, чем соседи доедут до её места.
                transition: `transform ${DISMISS_MS}ms var(--exit-ease), opacity 140ms linear`,
                // Гасну — не перехватываю нажатия, пока еду.
                pointerEvents: going ? 'none' : undefined,
              }}
            >
              {/* Карточка ужалась до лица, имени и счёта: кнопка подписки
                  переехала значком на саму аватарку и больше не занимает
                  строку наравне с именем. */}
              <div
                className="glass relative flex flex-col items-center gap-2 rounded-2xl p-3 text-center"
                style={{ width: CARD_WIDTH }}
              >
                <button
                  type="button"
                  onClick={() => dismissPerson(person.id)}
                  aria-label={`Убрать ${person.username}`}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[var(--text-muted)] transition-transform active:scale-90"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>

                <AvatarFollow
                  userId={person.id}
                  username={person.username}
                  initiallyFollowing={person.isFollowing}
                  size={60}
                />
                <span className="w-full truncate text-[13.5px] font-medium text-[var(--text)]">
                  {person.username}
                </span>
                <span className="text-[11.5px] text-[var(--text-muted)]">
                  <span className="font-num">{person.karma}</span> influence
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
