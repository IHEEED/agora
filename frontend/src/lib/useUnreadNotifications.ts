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

export function useUnreadNotifications(): number {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    function check() {
      apiFetch<{ count: number }>('/notifications/unread-count')
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
  }, []);

  return unread;
}
