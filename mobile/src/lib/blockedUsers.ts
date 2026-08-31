import { useEffect, useSyncExternalStore } from 'react';
import { apiFetch } from './api';

/**
 * Чёрный список — на сервере, как в вебе (src/lib/blockedUsers.ts).
 *
 * Блокировка мешает собеседнику писать (проверяет бэкенд), переезжает вместе с
 * аккаунтом и рвёт подписку в обе стороны. Модуль — единственная точка, через
 * которую приложение спрашивает «а он заблокирован?».
 */

type BlockRow = { blocked_id: string };

let list: string[] = [];
let loaded = false;
let loading: Promise<void> | null = null;

const listeners = new Set<() => void>();
function notify() { listeners.forEach((l) => l()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function snapshot(): string[] { return list; }

function ensureLoaded(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loading) return loading;
  loading = apiFetch<BlockRow[]>('/blocks')
    .then((rows) => { list = rows.map((r) => r.blocked_id); loaded = true; notify(); })
    .catch(() => { loaded = true; })
    .finally(() => { loading = null; });
  return loading;
}

export function resetBlockedUsers() {
  list = [];
  loaded = false;
  loading = null;
  notify();
}

export function isBlocked(userId: string): boolean {
  return list.includes(userId);
}

/** Блокировка/снятие: список меняется сразу, отказ откатывается. */
export async function setBlocked(userId: string, blocked: boolean): Promise<void> {
  const before = list;
  list = blocked ? [...new Set([...list, userId])] : list.filter((id) => id !== userId);
  notify();
  try {
    await apiFetch(`/blocks/${userId}`, { method: blocked ? 'POST' : 'DELETE' });
  } catch (error) {
    list = before;
    notify();
    throw error;
  }
}

export function useBlockedUsers(): string[] {
  useEffect(() => { void ensureLoaded(); }, []);
  return useSyncExternalStore(subscribe, snapshot);
}

export function useIsBlocked(userId: string | undefined): boolean {
  const blocked = useBlockedUsers();
  return userId ? blocked.includes(userId) : false;
}
