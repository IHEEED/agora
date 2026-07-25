import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

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
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json();
}
