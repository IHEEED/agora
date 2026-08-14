'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { apiFetch } from '@/lib/api';
import { UserSummary } from '@/lib/types';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { FollowButton } from '@/components/FollowButton';
import { useT } from '@/lib/i18n';

/** Сколько длится сворачивание. Должно совпадать с transition в разметке. */
const COLLAPSE_MS = 320;

/**
 * Рекомендации людей: горизонтальная лента карточек или вертикальный список.
 *
 * Закрытие запоминается на устройстве, а не в базе: рекомендации — вещь
 * необязательная, и городить ради них серверное состояние преждевременно.
 * Ключ у каждого места свой, чтобы закрытая в ленте строка не убирала
 * такую же в профиле.
 */
export function SuggestedPeople({
  storageKey,
  title,
  className,
  layout = 'row',
  dismissible = true,
}: {
  storageKey: string;
  title?: string;
  className?: string;
  layout?: 'row' | 'list';
  /**
   * Можно ли закрыть блок крестиком. На экране уведомлений — нельзя: закрытые
   * однажды рекомендации оставляли вкладку пустой навсегда, и она выглядела
   * сломанной, хотя всё работало.
   */
  dismissible?: boolean;
}) {
  const { t } = useT();
  const [people, setPeople] = useState<UserSummary[]>([]);

  // Два шага при закрытии: сначала блок сворачивается, и только потом исчезает
  // из разметки. Одним setState это не сделать — узел пропал бы мгновенно.
  const [collapsing, setCollapsing] = useState(false);
  const [gone, setGone] = useState(false);
  const collapseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Читаем localStorage через снимок, а не через setState в эффекте: у сервера
  // и браузера разные снимки, поэтому расхождения разметки не возникает.
  const stored = useSyncExternalStore(
    () => () => {},
    () => window.localStorage.getItem(storageKey) === '1',
    () => true
  );
  const storedDismissed = dismissible && stored;

  useEffect(() => {
    return () => {
      if (collapseTimeout.current) clearTimeout(collapseTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (storedDismissed) return;

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
  }, [storedDismissed]);

  function close() {
    window.localStorage.setItem(storageKey, '1');
    setCollapsing(true);
    collapseTimeout.current = setTimeout(() => setGone(true), COLLAPSE_MS);
  }

  if (storedDismissed || gone || people.length === 0) return null;

  // Общая кнопка вместо своей копии: она умеет и подписку, и отписку.
  // Раньше здесь стояла кнопка, которая после нажатия просто блокировалась —
  // передумать было нельзя.
  function followButton(person: UserSummary, wide: boolean) {
    return (
      <FollowButton
        userId={person.id}
        initiallyFollowing={person.isFollowing}
        className={wide ? 'w-full max-w-none' : ''}
      />
    );
  }

  return (
    <section
      className={className}
      style={{
        // Схлопываем по высоте и прозрачности разом — блок «уезжает», а не
        // выдёргивается, и соседний контент подтягивается плавно.
        maxHeight: collapsing ? 0 : 520,
        opacity: collapsing ? 0 : 1,
        overflow: 'hidden',
        transition: `max-height ${COLLAPSE_MS}ms cubic-bezier(0.32, 0.72, 0, 1), opacity ${COLLAPSE_MS - 120}ms ease`,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
        <h2 className="text-[14px] font-semibold text-[var(--text)]">
          {title ?? t('suggest.title')}
        </h2>
        {dismissible && (
          <button
            onClick={close}
            aria-label={t('suggest.hide')}
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>

      {layout === 'row' ? (
        // Горизонтальная лента: рекомендации не должны отжимать посты вниз
        // на пол-экрана, поэтому в высоту они занимают одну карточку.
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {people.map((person) => (
            <div
              key={person.id}
              className="glass flex w-[148px] flex-none flex-col items-center gap-2 rounded-2xl p-3 text-center"
            >
              <DefaultAvatar name={person.username} size={56} />
              <span className="w-full truncate text-[13.5px] font-medium text-[var(--text)]">
                {person.username}
              </span>
              <span className="text-[11.5px] text-[var(--text-muted)]">
                <span className="font-num">{person.karma}</span> influence
              </span>
              {followButton(person, true)}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {people.map((person) => (
            <div key={person.id} className="flex items-center gap-3 py-3">
              <DefaultAvatar name={person.username} size={44} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium text-[var(--text)]">
                  {person.username}
                </span>
                <span className="text-[12.5px] text-[var(--text-muted)]">
                  <span className="font-num">{person.karma}</span> influence
                </span>
              </div>
              {followButton(person, false)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
