'use client';

import { useState } from 'react';
import { useApiData } from '@/lib/useApiData';
import { haptic } from '@/lib/haptics';

/**
 * Приглашение: один код и навсегда.
 *
 * Прежде кодов было несколько: каждый создавался кнопкой, жил месяц и годился
 * ровно на одного человека. Три решения, и все три оказались лишними.
 *
 * Одноразовость делала из приглашения дефицит, которого ничто не охраняло:
 * закрытость держится не количеством кодов, а тем, что случайный человек кода
 * не найдёт вовсе. Срок требовал обслуживания — помнить, что твоё приглашение
 * протухло, и заводить новое. А кнопка «создать код» просила решения там, где
 * решать нечего: код нужен всегда один и тот же.
 *
 * Осталась одна строка, которую отдают тому, кого зовут.
 *
 * Списка приведённых здесь тоже больше нет. Знать, кто кого позвал, никому не
 * нужно, а превратить это в иерархию — «я привёл десятерых» — очень легко.
 * Связь в базе остаётся, ею пользуется модерация; наружу она не выходит.
 */
function origin(): string {
  return typeof window === 'undefined' ? '' : window.location.origin;
}

export function InvitesPanel() {
  const { data, loading } = useApiData<{ code: string }>('/invites/mine');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const code = data?.code ?? null;

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(`${origin()}/?code=${code}`);
      haptic();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Буфер недоступен (небезопасное соединение, отказ в разрешении). Код
      // виден на экране и переписывается руками — ронять из-за этого экран
      // незачем, достаточно сказать.
      setError('Не удалось скопировать — код можно переписать вручную');
    }
  }

  return (
    <div className="ios-row justify-between">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          // Розовый из общей палитры плиток настроек: акцент темы совпадал с
          // «оформлением», а в тёмной теме приглушался до неразличимого.
          className="flex h-[29px] w-[29px] flex-none items-center justify-center rounded-[8px]"
          style={{ background: 'var(--tint-pink)', color: '#fff' }}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="9" r="3.5" />
            <path d="M3.5 19c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" />
            <path d="M18 8v6M15 11h6" />
          </svg>
        </span>

        <div className="flex min-w-0 flex-col">
          <span className="font-mono text-[15px] tracking-[0.18em] text-[var(--text)]">
            {loading ? '••••••' : (code ?? '—')}
          </span>
          <span className="text-[12.5px] leading-snug text-[var(--text-muted)]">
            {error ?? 'Ваш код. Один на всех, кого позовёте'}
          </span>
        </div>
      </div>

      {code && (
        <button
          type="button"
          onClick={() => void copy()}
          className="flex-none rounded-full px-4 py-1.5 text-[13px] font-medium"
          style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
        >
          {copied ? 'Скопировано' : 'Ссылка'}
        </button>
      )}
    </div>
  );
}
