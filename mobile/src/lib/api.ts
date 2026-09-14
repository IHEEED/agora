import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

/**
 * Коды отказов, которые сервер отдаёт машине, а не человеку.
 *
 * Остальные ошибки сервер уже пишет словами — их показываем как есть. А эти
 * приходят кодом (по ним веб принимает решения), и без подмены пользователь
 * увидел бы «USER_BANNED» вместо фразы. Тексты — те же, что на вебе (api.ts),
 * чтобы обе платформы говорили одинаково.
 */
function humanError(body: { error?: string; bannedUntil?: string | null }): string | undefined {
  switch (body.error) {
    case 'USER_BANNED': {
      const until = body.bannedUntil ? new Date(body.bannedUntil) : null;
      // Бессрочный бан хранится далёкой датой. Писать «до 9999 года» — издёвка.
      return until && until.getFullYear() < 2100
        ? `Вы не можете писать до ${until.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`
        : 'Вы не можете писать';
    }
    case 'RATE_LIMITED':
      return 'Слишком часто. Подождите немного и попробуйте снова';
    // Не называем, кто кого заблокировал: отказ один на оба направления.
    case 'BLOCKED':
    case 'MESSAGE_BLOCKED':
      return 'Это действие недоступно';
    case 'PHONE_NOT_VERIFIED':
      return 'Сначала подтвердите номер телефона';
    default:
      return body.error;
  }
}

export async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(humanError(body) || 'Не удалось выполнить запрос, попробуйте ещё раз');
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
