import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Сессия — одна на приложение, а не по копии на каждый экран.
 *
 * Прежде хук держал сессию в своём состоянии и запрашивал её в эффекте. Хук
 * зовут почти все экраны, а PageTransition перемонтирует дерево на каждом
 * переходе — значит, каждый переход начинался одинаково: session = null,
 * loading = true. Экранам этого хватало, чтобы отрисоваться пустыми: запросы
 * данных зависят от userId и при null просто не уходят. Сессия приезжала
 * следующим кадром, запросы отрабатывали из кеша мгновенно — и человек видел
 * не загрузку, а подмену: пустой профиль на кадр, потом настоящий.
 *
 * Это и есть та самая «рваность» открытия профиля, ленты и переписки. Дело не
 * в скорости запросов: данные лежали в кеше и были готовы сразу — просто их не
 * у кого было спросить, пока хук заново выяснял, кто вошёл.
 *
 * Теперь ответ живёт в модуле. Первый вызов запускает запрос, все последующие
 * читают готовое значение синхронно — переход рисует экран сразу с данными.
 */
type Snapshot = { session: Session | null; loading: boolean };

let snapshot: Snapshot = { session: null, loading: true };
let started = false;
const listeners = new Set<() => void>();

/** Ссылка обязана меняться только вместе со значением: useSyncExternalStore
 *  сравнивает снимки по ссылке и на новом объекте каждый раз ушёл бы в цикл. */
function publish(session: Session | null) {
  snapshot = { session, loading: false };
  for (const listener of listeners) listener();
}

function start() {
  if (started) return;
  started = true;

  supabase.auth.getSession().then(({ data }) => publish(data.session));
  // Подписку не снимаем: она одна на всё приложение и живёт столько же.
  supabase.auth.onAuthStateChange((_event, next) => publish(next));
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return snapshot;
}

// На сервере сессии нет и быть не может — отдельный неизменный снимок,
// чтобы разметка при гидратации совпала.
const SERVER: Snapshot = { session: null, loading: true };
function getServerSnapshot() {
  return SERVER;
}

export function useSession() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
