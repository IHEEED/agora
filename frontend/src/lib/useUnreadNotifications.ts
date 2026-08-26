'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from './api';

/**
 * Сколько уведомлений человек ещё не видел.
 *
 * Опросом, как и непрочитанные сообщения (см. MessagesButton): живого канала в
 * приложении нет, а держать соединение ради точки на колоколе — слишком дорогая
 * механика для того, что она даёт.
 *
 * Полминуты — та же цифра, что в роадмапе. Чаще незачем: уведомление не письмо,
 * секунда задержки в нём ничего не решает, а запрос уходит с каждого экрана,
 * потому что нижний бар виден везде.
 */
const POLL_MS = 30_000;

function useUnreadCount(path: string): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function check() {
      apiFetch<{ count: number }>(path)
        .then(({ count }) => {
          if (!cancelled) setUnread(count);
        })
        // Молча. Гость, оборванная сеть и невыполненная миграция выглядят
        // одинаково, и ни один из трёх случаев не стоит ошибки на экране: точка
        // просто не появится.
        .catch(() => {});
    }

    check();
    const timer = setInterval(check, POLL_MS);

    // Возврат к вкладке — повод спросить сразу, не дожидаясь очередного круга:
    // человек мог не открывать её час, и полминуты с устаревшим числом здесь
    // заметны сильнее, чем где-либо ещё.
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [path]);

  return unread;
}

/** Непрочитанные уведомления — точка на колоколе в шапке. */
export function useUnreadNotifications(): number {
  return useUnreadCount('/notifications/unread-count');
}

/**
 * Непрочитанные сообщения — точка на вкладке мессенджера.
 *
 * Отдельной механики не заводим: вопрос тот же, ответ той же формы, и два
 * разных опроса рядом означали бы два места, где чинить один и тот же сбой.
 */
export function useUnreadMessages(): number {
  return useUnreadCount('/messages/unread-count');
}
