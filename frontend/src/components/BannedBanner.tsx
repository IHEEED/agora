'use client';

import Link from 'next/link';
import { useMe } from '@/lib/useMe';
import { SUPPORT_USER_ID } from '@/lib/support';

/** Текст с датой окончания бана; вечный ('infinity') — без даты. */
function banText(until: string | null): string {
  if (!until || until.startsWith('infinity')) return 'Вы забанены и пока не можете писать.';
  const date = new Date(until);
  if (Number.isNaN(date.getTime())) return 'Вы забанены и пока не можете писать.';
  return `Вы не можете писать до ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
}

/**
 * Плашка забанённому — на своей ленте. О бане человек раньше узнавал, только
 * упёршись в отказ при попытке написать; теперь видит сразу, до какого числа и
 * куда идти оспаривать.
 */
export function BannedBanner() {
  const { me } = useMe();
  if (!me?.banned) return null;

  return (
    <div
      className="flex flex-col gap-1.5 rounded-2xl px-4 py-3"
      style={{
        background: 'color-mix(in srgb, var(--down) 12%, transparent)',
        border: '1px solid color-mix(in srgb, var(--down) 28%, transparent)',
      }}
    >
      <p className="text-[14px] font-semibold" style={{ color: 'var(--down)' }}>
        {banText(me.banned_until)}
      </p>
      {me.ban_reason && (
        <p className="text-[13px] text-[var(--text-muted)]">Причина: {me.ban_reason}</p>
      )}
      <Link
        href={`/messages/${SUPPORT_USER_ID}`}
        className="text-[13px] font-medium"
        style={{ color: 'var(--accent)' }}
      >
        Считаете бан ошибкой? Написать в поддержку →
      </Link>
    </div>
  );
}
