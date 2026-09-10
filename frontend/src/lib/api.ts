import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

/**
 * Токен держим в памяти и обновляем по событию, а не спрашиваем перед каждым
 * запросом. getSession() — асинхронный вызов с обращением к хранилищу, и он
 * стоял отдельным шагом перед любым обращением к API: на экране с тремя
 * запросами это три лишних ожидания подряд ещё до того, как ушёл первый байт.
 */
let cachedToken: string | null = null;
let tokenReady: Promise<void> | null = null;

function ensureToken(): Promise<void> {
  if (tokenReady) return tokenReady;

  tokenReady = supabase.auth.getSession().then(({ data }) => {
    cachedToken = data.session?.access_token ?? null;
  });

  // Дальше за актуальностью следит сам Supabase: событие приходит и при входе,
  // и при выходе, и при автоматическом обновлении протухшего токена.
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedToken = session?.access_token ?? null;
  });

  return tokenReady;
}

/**
 * Коды отказов, которые сервер отдаёт машине, а не человеку.
 *
 * Остальные ошибки сервер пишет словами сам. Эти — нет: по некоторым кодам
 * интерфейс принимает решения (PHONE_NOT_VERIFIED открывает подтверждение,
 * MESSAGE_BLOCKED гасит поле ввода), и перевод на сервере отнял бы у него эту
 * возможность. Переводим здесь — и только те, что никто не разбирает: иначе
 * экран показал бы «USER_BANNED» там, где ждали фразу.
 */
function humanError(body: { error?: string; bannedUntil?: string | null }): string | undefined {
  switch (body.error) {
    case 'USER_BANNED': {
      const until = body.bannedUntil ? new Date(body.bannedUntil) : null;
      // Бессрочный бан хранится далёкой датой. Писать «до 9999 года» — издевка.
      return until && until.getFullYear() < 2100
        ? `Вы не можете писать до ${until.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
        : 'Вы не можете писать';
    }
    case 'RATE_LIMITED':
      return 'Слишком часто. Подождите немного и попробуйте снова';
    // Не называем, кто кого заблокировал: отказ один на оба направления.
    case 'BLOCKED':
      return 'Это действие недоступно';
    default:
      return body.error;
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  await ensureToken();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (cachedToken) {
    headers.set('Authorization', `Bearer ${cachedToken}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(humanError(body) || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
