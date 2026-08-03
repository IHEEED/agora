'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

/**
 * Подписка на человека. Состояние показываем сразу, не дожидаясь сети:
 * действие безобидное, и ждать ответа ради смены надписи незачем. Если запрос
 * не прошёл — возвращаем как было.
 */
export function FollowButton({
  userId,
  initiallyFollowing = false,
  className = '',
}: {
  userId: string;
  initiallyFollowing?: boolean;
  className?: string;
}) {
  const { t } = useT();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      await apiFetch(`/users/${userId}/follow`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      className={`flex-none rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${className}`}
      style={
        following
          ? { background: 'var(--surface-2)', color: 'var(--text-muted)' }
          : { background: 'var(--accent)', color: 'var(--accent-contrast)' }
      }
    >
      {following ? t('suggest.following') : t('suggest.follow')}
    </button>
  );
}
