'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { apiFetch } from './api';

/**
 * Кеш ответов между переходами по экранам.
 *
 * Раньше каждый экран запрашивал данные заново в useEffect: возврат в ленту
 * означал пустой экран со «Загрузка…», хотя те же посты были получены минуту
 * назад. Это и читалось как медленные переходы — сама навигация быстрая, ждали
 * именно сеть.
 *
 * Стратегия stale-while-revalidate: если ответ уже есть, он отдаётся сразу и
 * экран рисуется мгновенно, а свежий запрос уходит фоном и молча обновляет
 * данные. Спиннер показывается только когда показать вообще нечего.
 */
const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();
/** Идущие запросы: два экрана с одним ключом не должны бить в сеть дважды. */
const inFlight = new Map<string, Promise<unknown>>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

function subscribe(key: string, listener: () => void) {
  const set = listeners.get(key) ?? new Set();
  set.add(listener);
  listeners.set(key, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(key);
  };
}

/** Сбросить кеш — после публикации поста лента обязана перечитаться. */
export function invalidate(prefix: string) {
  [...cache.keys()].forEach((key) => {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      notify(key);
    }
  });
}

/**
 * Кто следит за идущими запросами.
 *
 * Нужно знаку в шапке: пока лента перечитывается, он моргает. Отдельного
 * «обновляется» состояния заводить не за чем — оно уже есть, просто лежит
 * внутри и никому не видно.
 */
const fetchWatchers = new Set<() => void>();

function notifyFetching() {
  fetchWatchers.forEach((watcher) => watcher());
}

/** Идёт ли сейчас запрос по адресу, начинающемуся с этого. */
export function isFetching(prefix: string): boolean {
  for (const path of inFlight.keys()) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

export function subscribeFetching(watcher: () => void) {
  fetchWatchers.add(watcher);
  return () => {
    fetchWatchers.delete(watcher);
  };
}

export function load<T>(path: string): Promise<T> {
  const existing = inFlight.get(path);
  if (existing) return existing as Promise<T>;

  const request = apiFetch<T>(path)
    .then((data) => {
      cache.set(path, data);
      notify(path);
      return data;
    })
    .finally(() => {
      inFlight.delete(path);
      notifyFetching();
    });

  inFlight.set(path, request);
  notifyFetching();
  return request;
}

export function useApiData<T>(path: string | null) {
  const [error, setError] = useState<string | null>(null);
  const errorPath = useRef<string | null>(null);

  const data = useSyncExternalStore(
    useCallback((listener) => (path ? subscribe(path, listener) : () => {}), [path]),
    useCallback(() => (path ? (cache.get(path) as T | undefined) : undefined), [path]),
    () => undefined
  );

  useEffect(() => {
    if (!path) return;

    let cancelled = false;
    // Ошибку помним по адресу: смена пути должна давать чистый лист.
    if (errorPath.current !== path) {
      errorPath.current = path;
      setError(null);
    }

    load<T>(path).catch((err: unknown) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Не удалось загрузить');
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  /**
   * Поправить кеш у себя, не дожидаясь сервера.
   *
   * Для действий, результат которых человек обязан увидеть в тот же кадр, —
   * закрепить переписку, убрать её из списка. Ждать ответа означало бы держать
   * экран неподвижным после жеста, который выглядел завершённым.
   *
   * Пишем в тот же кеш, из которого читает useSyncExternalStore, и будим
   * подписчиков: если тот же адрес открыт на другом экране, он увидит правку
   * тем же кадром. Следующая загрузка приведёт всё в согласие с сервером — то
   * есть неудачная правка живёт до ближайшего обновления и не дольше.
   */
  const mutate = useCallback(
    (update: (prev: T | undefined) => T) => {
      if (!path) return;
      cache.set(path, update(cache.get(path) as T | undefined));
      notify(path);
    },
    [path]
  );

  return {
    data,
    error,
    mutate,
    /** Спиннер уместен, только когда показать нечего. */
    loading: path !== null && data === undefined && error === null,
  };
}
