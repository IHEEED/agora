'use client';

import { useMe } from '@/lib/useMe';

/**
 * Объяснение вместо отказа.
 *
 * Забаненному закрыто писать, но не читать: выкинуть его из приложения целиком
 * было бы проще, но тогда он не увидит ни причины, ни срока — а именно они
 * отличают наказание от поломки. Без этой полоски человек упирается в отказ на
 * отправке и решает, что сломалось приложение.
 *
 * Ничего не рисует, пока бана нет, — можно ставить безусловно.
 */
export function BanNotice() {
  const { me } = useMe();

  if (!me?.banned) return null;

  // Срок пришёл строкой: вечный бан хранится как 'infinity' — настоящее
  // значение timestamptz, а не выдумка, и датой оно не разбирается.
  const until =
    me.banned_until && me.banned_until !== 'infinity'
      ? new Date(me.banned_until).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
      : null;
  const forever = until === null;

  return (
    <div
      className="flex flex-col gap-1 rounded-2xl px-4 py-3.5"
      style={{ background: 'var(--surface-2)' }}
    >
      <span className="text-[14px] font-medium" style={{ color: 'var(--down)' }}>
        {forever ? 'Аккаунт заблокирован' : `Писать нельзя до ${until}`}
      </span>
      <span className="text-[13px] leading-snug text-[var(--text-muted)]">
        {me.ban_reason
          ? `Причина: ${me.ban_reason.toLowerCase()}. Читать можно по-прежнему.`
          : 'Читать можно по-прежнему.'}
      </span>
    </div>
  );
}
