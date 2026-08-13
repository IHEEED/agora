'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

/**
 * Подписка на человека — знаком, а не надписью.
 *
 * «Подписаться» и «Отписаться» — слова разной длины, из-за чего кнопка меняла
 * ширину при нажатии и толкала соседей. Плюс и минус занимают одно место,
 * поэтому переход выходит плавным: одна палочка гаснет и поворачивается,
 * вторая остаётся.
 *
 * Состояние показываем сразу, не дожидаясь сети: действие безобидное. Если
 * запрос не прошёл — возвращаем как было.
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
      aria-label={following ? t('suggest.unfollow') : t('suggest.follow')}
      aria-pressed={following}
      className={`flex h-8 w-8 flex-none items-center justify-center rounded-full ${className}`}
      style={{
        background: following ? 'var(--surface-2)' : 'var(--accent)',
        color: following ? 'var(--text-muted)' : 'var(--accent-contrast)',
        transition: 'background-color 0.24s ease, color 0.24s ease',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        {/* Горизонталь общая для обоих знаков и не двигается. */}
        <path d="M5 12h14" />
        {/* Вертикаль — то, что отличает плюс от минуса: она поворачивается
            на 90° и гаснет, превращая один знак в другой без подмены иконки. */}
        <path
          d="M12 5v14"
          style={{
            transformOrigin: 'center',
            transform: following ? 'rotate(90deg)' : 'none',
            opacity: following ? 0 : 1,
            transition:
              'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
          }}
        />
      </svg>
    </button>
  );
}
