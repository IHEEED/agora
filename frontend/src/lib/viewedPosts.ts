const STORAGE_KEY = 'viewed-posts';

function readViewed(): Set<string> {
  if (typeof window === 'undefined') return new Set();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

// возвращает true, если это первый просмотр этого поста в этом браузере
// (и в этом случае сразу помечает его просмотренным)
export function markPostViewed(postId: string): boolean {
  const viewed = readViewed();
  if (viewed.has(postId)) return false;

  viewed.add(postId);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(viewed)));
  return true;
}
