'use client';

import { useSyncExternalStore } from 'react';

/**
 * Чёрный список — на устройстве, а не в базе.
 *
 * Настоящая блокировка обязана жить на сервере: она должна мешать человеку
 * писать вам, а не только прятать написанное от ваших глаз. Таблицы под неё
 * пока нет, и рисовать кнопку, которая делает вид, что собеседник больше вас
 * не достанет, было бы враньём.
 *
 * Поэтому здесь ровно то, что клиент может выполнить честно: записи
 * заблокированного не показываются в ленте и в поиске, его переписка уходит
 * из мессенджера. Так это и подписано в интерфейсе — «на этом устройстве».
 * Когда появится серверная часть, список переедет туда, а этот модуль
 * останется точкой, через которую всё приложение спрашивает «а он
 * заблокирован?».
 */
const STORAGE_KEY = 'parafraz-blocked';
const CHANGED_EVENT = 'parafraz-blocked-changed';

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    // Испорченная запись не повод ронять ленту: считаем, что список пуст.
    return [];
  }
}

/**
 * Снимок для useSyncExternalStore обязан быть стабильным по ссылке: новый
 * массив на каждый вызов заставил бы React считать состояние изменившимся и
 * перерисовывать подписчиков бесконечно. Поэтому держим последний разобранный
 * список и отдаём его же, пока строка в хранилище не поменялась.
 */
let cachedRaw: string | null = null;
let cachedList: string[] = [];

function snapshot(): string[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = read();
  }
  return cachedList;
}

const EMPTY: string[] = [];

function subscribe(notify: () => void) {
  window.addEventListener(CHANGED_EVENT, notify);
  // storage срабатывает, когда список поменяли в другой вкладке.
  window.addEventListener('storage', notify);
  return () => {
    window.removeEventListener(CHANGED_EVENT, notify);
    window.removeEventListener('storage', notify);
  };
}

export function isBlocked(userId: string): boolean {
  return snapshot().includes(userId);
}

export function setBlocked(userId: string, blocked: boolean) {
  const next = blocked
    ? [...new Set([...snapshot(), userId])]
    : snapshot().filter((id) => id !== userId);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** Список заблокированных. Пустой на сервере — там localStorage нет. */
export function useBlockedUsers(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Заблокирован ли конкретный человек. */
export function useIsBlocked(userId: string | undefined): boolean {
  const blocked = useBlockedUsers();
  return userId ? blocked.includes(userId) : false;
}
