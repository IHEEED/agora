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
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
