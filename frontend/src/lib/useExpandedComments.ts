import { useState } from 'react';

function storageKey(postId: string): string {
  return `expanded-comments:${postId}`;
}

function readExpanded(postId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const raw = window.localStorage.getItem(storageKey(postId));
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

export function useExpandedComments(postId: string) {
  const [expanded, setExpanded] = useState<Set<string>>(() => readExpanded(postId));

  function toggle(commentId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      window.localStorage.setItem(storageKey(postId), JSON.stringify(Array.from(next)));
      return next;
    });
  }

  function isExpanded(commentId: string): boolean {
    return expanded.has(commentId);
  }

  return { isExpanded, toggle };
}
