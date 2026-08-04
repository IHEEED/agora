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
      // max-w с truncate: длинный ник забирает ширину первым, и кнопка ужимается
      // до многоточия вместо того, чтобы выдавливать имя на вторую строку.
      className={`min-w-0 max-w-[40%] flex-none truncate rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${className}`}
      style={
        following
          ? { background: 'var(--surface-2)', color: 'var(--text-muted)' }
          : { background: 'var(--accent)', color: 'var(--accent-contrast)' }
      }
    >
      {following ? t('suggest.unfollow') : t('suggest.follow')}
    </button>
  );
}
