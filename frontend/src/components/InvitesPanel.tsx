'use client';

import { useState } from 'react';
import { refreshMe } from '@/lib/useMe';
import { apiFetch } from '@/lib/api';
import { invalidate, useApiData } from '@/lib/useApiData';

/**
 * Приглашения в настройках.
 *
 * Запас списывается при выдаче кода, а не при переходе по нему: иначе один код
 * можно разослать сотне людей, и запас не тронется, пока первый не дойдёт.
 * Отсюда и главное правило экрана — код создают, когда собираются позвать
 * конкретного человека, а не «про запас».
 */

type Invite = {
  code: string;
  expires_at: string;
  /** Кто пришёл по этому коду. Многоразовый — значит их может быть сколько угодно. */
  uses: { user_id: string; used_at: string; user: { id: string; username: string } | null }[];
};

function origin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

export function InvitesPanel() {
  const { data, loading } = useApiData<{ invitesLeft: number | null; invites: Invite[] }>(
    '/invites/mine'
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const invites = data?.invites ?? [];

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/invites', { method: 'POST' });
      invalidate('/invites');
      // Запас показан и в других местах — перечитываем себя, иначе там
      // останется прежнее число.
      refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось');
    } finally {
      setBusy(false);
    }
  }

  /** Копируем ссылку, а не код: по ней поле на экране входа уже заполнено. */
  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(`${origin()}/?code=${code}`);
      setCopied(code);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="ios-row justify-between">
        {/* Тот же цветной квадратик, что у строк настроек: панель живёт среди
            них островком и не должна выглядеть вставкой из другого экрана. */}
        <span
          aria-hidden
          className="flex h-[29px] w-[29px] flex-none items-center justify-center rounded-[8px]"
          // Розовый из той же палитры, что и остальные плитки настроек. Акцент
          // темы здесь не годился: он совпадал с «оформлением», а в тёмной теме
          // приглушался до неразличимого.
          style={{ background: 'var(--tint-pink)', color: '#fff' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="9" r="3.5" />
            <path d="M3.5 19c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" />
            <path d="M18 8v6M15 11h6" />
          </svg>
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] text-[var(--text)]">Приглашения</span>
          <span className="text-[12.5px] leading-snug text-[var(--text-muted)]">
            {/* Запаса больше нет, и говорить о нём нечего. Вместо счётчика —
                то единственное, что человеку про код важно: одним кодом можно
                привести сколько угодно людей. */}
            Один код — сколько угодно людей
          </span>
        </div>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="flex-none rounded-full bg-[var(--accent)] px-4 py-1.5 text-[13px] font-medium text-[var(--accent-contrast)] disabled:opacity-40"
        >
          {busy ? 'Секунду…' : 'Создать код'}
        </button>
      </div>

      {error && (
        <p className="px-1 text-[13px]" style={{ color: 'var(--down)' }}>
          {error}
        </p>
      )}

      {loading && <p className="px-1 text-[13px] text-[var(--text-muted)]">Загрузка…</p>}

      {invites.map((invite) => {
        // Использованность кода больше не состояние: по нему приходят и
        // приходят, пока не кончится срок. Гасим только истёкшие.
        const expired = new Date(invite.expires_at).getTime() < Date.now();
        const came = invite.uses ?? [];

        return (
          <div key={invite.code} className="ios-row justify-between">
            <div className="flex min-w-0 flex-col">
              <span
                className="font-mono text-[15px] tracking-[0.18em] text-[var(--text)]"
                style={{ opacity: expired ? 0.45 : 1 }}
              >
                {invite.code}
              </span>
              <span className="text-[12.5px] leading-snug text-[var(--text-muted)]">
                {expired
                  ? 'Срок истёк'
                  : came.length === 0
                    ? 'По нему ещё никто не пришёл'
                    : came.length === 1
                      ? `Пришёл ${came[0].user?.username ?? 'кто-то'}`
                      : // Перечислять всех незачем: важно число, а не список.
                        // Кто именно — видно в подписчиках.
                        `Пришли ${came.length}`}
              </span>
            </div>

            {!expired && (
              <button
                type="button"
                onClick={() => copy(invite.code)}
                className="flex-none rounded-full px-4 py-1.5 text-[13px] font-medium"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                {copied === invite.code ? 'Скопировано' : 'Ссылка'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
