'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { invalidate, useApiData } from '@/lib/useApiData';

type Mod = { id: string; username: string; role: 'moderator' | 'admin'; verified_at: string | null };

/**
 * Управление модераторами — выдать/забрать роль по нику, без правок в БД.
 * Доступно только админам (сервер проверяет роль). Админов список показывает,
 * но снять их отсюда нельзя — это делается на уровне базы.
 */
export function ModeratorsPanel({ meId }: { meId?: string }) {
  const { data, loading } = useApiData<Mod[]>('/moderation/moderators');
  const mods = data ?? [];
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function grant() {
    const name = username.trim().replace(/^@/, '');
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/moderation/moderators', { method: 'POST', body: JSON.stringify({ username: name }) });
      setUsername('');
      invalidate('/moderation/moderators');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вышло выдать модерацию');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await apiFetch(`/moderation/moderators/${id}`, { method: 'DELETE' });
      invalidate('/moderation/moderators');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вышло забрать модерацию');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Выдать по нику. */}
      <div className="flex items-center gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && grant()}
          placeholder="ник"
          className="field-line flex-1 py-2.5 px-2 text-[15px] text-[var(--text)] outline-none"
        />
        <button
          type="button"
          disabled={busy || !username.trim()}
          onClick={grant}
          className="rounded-full bg-[var(--accent)] px-4 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)] disabled:opacity-40"
        >
          Выдать
        </button>
      </div>

      {error && <p className="text-[13px]" style={{ color: 'var(--down)' }}>{error}</p>}
      {loading && <p className="text-[14px] text-[var(--text-muted)]">Загрузка…</p>}

      <div className="flex flex-col divide-y divide-[var(--border)]">
        {mods.map((mod) => (
          <div key={mod.id} className="flex items-center gap-3 py-3">
            <Link href={`/u/${mod.id}`} className="flex-1 truncate font-medium text-[var(--text)]">
              {mod.username}
            </Link>
            <span className="rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
              {mod.role === 'admin' ? 'админ' : 'модератор'}
            </span>
            {mod.role === 'moderator' && mod.id !== meId ? (
              <button
                type="button"
                onClick={() => revoke(mod.id)}
                className="rounded-full px-3 py-1.5 text-[13px] font-medium"
                style={{ background: 'color-mix(in srgb, var(--down) 14%, transparent)', color: 'var(--down)' }}
              >
                Убрать
              </button>
            ) : (
              <span className="w-[62px]" />
            )}
          </div>
        ))}
        {!loading && mods.length === 0 && (
          <p className="py-6 text-center text-[14px] text-[var(--text-muted)]">Пока только вы.</p>
        )}
      </div>
    </div>
  );
}
