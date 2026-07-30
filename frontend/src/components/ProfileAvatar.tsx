import { crunchyRingPath } from '@/lib/crunchyRing';

/** Аватар в рваном ореоле — тот же язык, что и у кружков сториз, но крупнее. */
export function ProfileAvatar({
  letter,
  size = 96,
  muted = false,
}: {
  letter: string;
  size?: number;
  muted?: boolean;
}) {
  const inset = size * 0.072;
  const path = crunchyRingPath(size, inset);
  const gradientId = `profile-ring-${size}${muted ? '-muted' : ''}`;

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <svg
        className="absolute inset-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={muted ? 'var(--border)' : '#5b3ad6'} />
            <stop offset="100%" stopColor={muted ? 'var(--border)' : '#a880ff'} />
          </linearGradient>
        </defs>
        <path
          d={path}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={size * 0.035}
          strokeLinejoin="miter"
        />
      </svg>
      <div
        className="absolute flex items-center justify-center rounded-full font-semibold"
        style={{
          inset: inset * 0.97,
          background: 'var(--surface-2)',
          color: muted ? 'var(--text-muted)' : 'var(--accent)',
          fontSize: size * 0.34,
        }}
      >
        {letter}
      </div>
    </div>
  );
}
