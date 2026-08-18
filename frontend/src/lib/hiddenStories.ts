'use client';

import { useSyncExternalStore } from 'react';

/**
 * Чьи истории человек не хочет видеть — на устройстве, а не в базе.
 *
 * Скрыть истории — не то же самое, что отписаться или заблокировать. Записи
 * автора по-прежнему нужны, разговор с ним продолжается; лишним оказался ровно
 * ряд кружков наверху ленты. Это настройка своего экрана, а не отношение к
 * человеку, и сообщать о ней серверу — и тем более ему самому — не за что.
 *
 * Когда истории обзаведутся собственными настройками на сервере, список
 * переедет туда, а модуль останется точкой, через которую приложение
 * спрашивает «а его истории показывать?».
 */
const STORAGE_KEY = 'parafraz-hidden-stories';
const CHANGED_EVENT = 'parafraz-hidden-stories-changed';

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

export function areHidden(userId: string): boolean {
  return snapshot().includes(userId);
}

export function setStoriesHidden(userId: string, hidden: boolean) {
  const next = hidden
    ? [...new Set([...snapshot(), userId])]
    : snapshot().filter((id) => id !== userId);

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** Чьи истории скрыты. Пустой на сервере — там localStorage нет. */
export function useHiddenStorytellers(): string[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}

/** Скрыты ли истории конкретного автора. */
export function useAreStoriesHidden(userId: string | undefined): boolean {
  const hidden = useHiddenStorytellers();
  return userId ? hidden.includes(userId) : false;
}
