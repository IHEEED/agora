import { useEffect, useState } from 'react';
import { apiFetch } from './api';

/** Кто я: роль, модератор и состояние бана (для плашки забанённому). */
export type Me = {
  id: string;
  username: string;
  role: 'user' | 'moderator' | 'admin';
  isModerator: boolean;
  banned?: boolean;
  banned_until?: string | null;
  ban_reason?: string | null;
};

// Кэш на модуль: /users/me одинаков для всех экранов, тянем один раз.
let cache: Me | null = null;
let inflight: Promise<Me | null> | null = null;

function load(): Promise<Me | null> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = apiFetch<Me>('/users/me')
      .then((m) => {
        cache = m;
        return m;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function useMe(): Me | null {
  const [me, setMe] = useState<Me | null>(cache);
  useEffect(() => {
    let alive = true;
    load().then((m) => {
      if (alive) setMe(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return me;
}

/** Показывать ли модераторские действия. Настоящая проверка — на сервере. */
export function useIsModerator(): boolean {
  return Boolean(useMe()?.isModerator);
}
