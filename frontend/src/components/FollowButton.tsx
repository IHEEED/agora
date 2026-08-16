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
  withLabel = false,
  corner = false,
  cornerSize = 24,
  className = '',
}: {
  userId: string;
  initiallyFollowing?: boolean;
  /** Со словом рядом со знаком — там, где кнопка стоит одна и должна читаться. */
  withLabel?: boolean;
  /**
   * Значком в углу аватарки, как в Threads. Отдельной строкой под карточкой
   * кнопка занимала место наравне с именем человека и читалась равной ему по
   * важности; в углу аватарки она пришита к тому, на кого подписываются, и
   * карточка сокращается до имени и лица.
   *
   * Ставить только внутрь родителя с position: relative — см. AvatarFollow.
   */
  corner?: boolean;
  /** Диаметр значка. Считается от размера аватарки, а не задаётся на глаз. */
  cornerSize?: number;
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

  const glyph = corner ? Math.round(cornerSize * 0.62) : 18;

  return (
    <button
      onClick={toggle}
      aria-label={following ? t('suggest.unfollow') : t('suggest.follow')}
      aria-pressed={following}
      className={`flex items-center justify-center rounded-full transition-transform active:scale-95 ${
        withLabel ? 'gap-2 py-2.5 text-[14px] font-semibold' : 'flex-none'
      } ${corner ? 'absolute bottom-0 right-0' : withLabel ? '' : 'h-8 w-8'} ${className}`}
      style={{
        ...(corner ? { width: cornerSize, height: cornerSize } : null),
        background: following ? 'var(--surface-2)' : 'var(--accent)',
        color: following ? 'var(--text-muted)' : 'var(--accent-contrast)',
        // Кольцо цветом страницы вырезает значок из аватарки. Без него кружок
        // сливается с лицом под ним, и непонятно, где кончается одно и
        // начинается другое.
        boxShadow: corner ? '0 0 0 2px var(--bg)' : undefined,
        transition: 'background-color 0.24s ease, color 0.24s ease, transform 0.18s ease',
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
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

      {/* Подписи лежат в одной клетке грида и меняются затуханием: «Подписаться»
          и «Вы подписаны» разной длины, и подмена текста дёргала бы ширину. */}
      {withLabel && (
        <span className="grid">
          {[
            { key: 'follow', show: !following, text: t('suggest.follow') },
            { key: 'unfollow', show: following, text: t('suggest.following') },
          ].map((label) => (
            <span
              key={label.key}
              aria-hidden={!label.show}
              className="col-start-1 row-start-1 whitespace-nowrap"
              style={{
                opacity: label.show ? 1 : 0,
                transition: 'opacity 0.2s ease',
              }}
            >
              {label.text}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
