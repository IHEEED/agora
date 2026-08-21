'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch } from './api';
import { invalidate } from './useApiData';

/**
 * Чёрный список — на сервере.
 *
 * Раньше он жил в localStorage, и это была честная заглушка: без таблицы клиент
 * мог только прятать чужие записи от собственных глаз. Заблокированный не знал,
 * что заблокирован, продолжал писать, а на другом устройстве список пустовал.
 * Теперь блокировка мешает писать (это проверяет бэкенд), переезжает вместе с
 * аккаунтом и рвёт подписку в обе стороны.
 *
 * Модуль остался тем же, чем был, — единственной точкой, через которую всё
 * приложение спрашивает «а он заблокирован?». Поменялось только нутро, четыре
 * места вызова не тронуты.
 */

/** Ответ /blocks: строка на каждого заблокированного. */
type BlockRow = { blocked_id: string; blocked?: { id: string; username: string } | null };

let list: string[] = [];
let loaded = false;
let loading: Promise<void> | null = null;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Снимок обязан быть стабильным по ссылке: новый массив на каждый вызов
 * заставил бы React считать состояние изменившимся и перерисовывать
 * подписчиков бесконечно. Поэтому list меняется только целиком и только там,
 * где он действительно поменялся.
 */
function snapshot(): string[] {
  return list;
}

const EMPTY: string[] = [];

/** Загрузка один раз за сессию. Дальше список ведут блокировки и снятия. */
function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loading) return loading;

  loading = apiFetch<BlockRow[]>('/blocks')
    .then((rows) => {
      list = rows.map((row) => row.blocked_id);
      loaded = true;
      notify();
    })
    .catch(() => {
      // Гость и просто неудачный запрос выглядят одинаково: список пуст.
      // Считать всех заблокированными из-за оборванной сети было бы хуже, чем
      // показать лишнее.
      loaded = true;
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

/** Сбросить после входа и выхода: список принадлежит аккаунту, а не браузеру. */
export function resetBlockedUsers() {
  list = [];
  loaded = false;
  loading = null;
  notify();
}

export function isBlocked(userId: string): boolean {
  return list.includes(userId);
}

/**
 * Блокировка и снятие.
 *
 * Список меняется до ответа сервера, а не после: человек нажал «заблокировать»
 * и должен увидеть результат сразу, а не через круг до Франкфурта. Если сервер
 * откажет — возвращаем как было и пробрасываем ошибку тому, кто вызвал.
 */
export async function setBlocked(userId: string, blocked: boolean): Promise<void> {
  const before = list;

  list = blocked ? [...new Set([...list, userId])] : list.filter((id) => id !== userId);
  notify();

  try {
    await apiFetch(`/blocks/${userId}`, { method: blocked ? 'POST' : 'DELETE' });
    // Лента, переписки и рекомендации отбираются на сервере с учётом блокировок,
    // и в кеше лежат прежние ответы: без сброса заблокированный останется на
    // экране до следующего обновления страницы.
    invalidate('/posts');
    invalidate('/messages');
    invalidate('/users');
  } catch (error) {
    list = before;
    notify();
    throw error;
  }
}

/** Список заблокированных. Пустой на сервере — там запрашивать некому. */
export function useBlockedUsers(): string[] {
  useEffect(() => {
    void ensureLoaded();
  }, []);

  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Заблокирован ли конкретный человек. */
export function useIsBlocked(userId: string | undefined): boolean {
  const blocked = useBlockedUsers();
  return userId ? blocked.includes(userId) : false;
}
