'use client';

import { invalidate, useApiData } from './useApiData';

export type Me = {
  id: string;
  username: string;
  karma: number;
  role: 'user' | 'moderator' | 'admin';
  banned: boolean;
  banned_until: string | null;
  ban_reason: string | null;
  invites_left: number;
  isModerator: boolean;
  created_at: string;
};

/**
 * Кто я такой: роль, бан, запас приглашений.
 *
 * Отдельный хук, а не разбросанные запросы, потому что ответ нужен сразу
 * нескольким экранам — шапке (показывать ли раздел модерации), настройкам
 * (приглашения) и полю ввода (не забанен ли). useApiData кеширует по адресу,
 * так что все они делят один запрос.
 *
 * Гость получает undefined, а не ошибку на экран: /users/me отвечает 401 без
 * токена, и это нормальное состояние, а не сбой.
 */
export function useMe() {
  const { data, loading } = useApiData<Me>('/users/me');
  return { me: data, loading };
}

/** Перечитать себя — после выдачи приглашения запас изменился. */
export function refreshMe() {
  invalidate('/users/me');
}

/** Показывать ли раздел модерации. Настоящая проверка — на сервере. */
export function useIsModerator(): boolean {
  const { me } = useMe();
  return Boolean(me?.isModerator);
}
