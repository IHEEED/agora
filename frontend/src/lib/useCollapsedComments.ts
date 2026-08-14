import { useState } from 'react';

/**
 * Какие ветки ответов человек свернул на этом посте.
 *
 * Хранится обратное к прошлому: раньше запоминалось, что человек *раскрыл*, и
 * ветка по умолчанию показывала пару ответов, а остальные прятала. Получалось
 * три состояния на одну кнопку — «часть видна», «всё видно», «свёрнуто», — и
 * предсказать, что она сделает, было нельзя. Теперь состояний два: ветка
 * открыта, пока её не свернули.
 */
function storageKey(postId: string): string {
  return `collapsed-comments:${postId}`;
}

function readCollapsed(postId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const raw = window.localStorage.getItem(storageKey(postId));
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

export function useCollapsedComments(postId: string) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed(postId));

  function toggle(commentId: string) {
    // Записываем storage снаружи апдейтера: React прогоняет апдейтеры дважды
    // в разработке, и запись внутри уходила бы в localStorage два раза.
    const next = new Set(collapsed);
    if (next.has(commentId)) {
      next.delete(commentId);
    } else {
      next.add(commentId);
    }
    window.localStorage.setItem(storageKey(postId), JSON.stringify([...next]));
    setCollapsed(next);
  }

  function isCollapsed(commentId: string): boolean {
    return collapsed.has(commentId);
  }

  return { isCollapsed, toggle };
}
