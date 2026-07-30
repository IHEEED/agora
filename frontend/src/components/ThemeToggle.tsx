'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'parafraz-theme';

type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(initial);
  }, []);

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  // До гидратации тема неизвестна — держим место, чтобы шапка не дёргалась.
  if (!theme) return <span className="block h-7 w-[52px]" aria-hidden />;

  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      className="relative flex h-7 w-[52px] items-center rounded-full border transition-colors"
      style={{
        borderColor: isDark ? 'var(--accent)' : 'var(--border)',
        background: isDark ? 'var(--accent-soft)' : 'var(--surface-2)',
      }}
    >
      <span
        className="absolute flex h-[22px] w-[22px] items-center justify-center rounded-full transition-transform duration-300"
        style={{
          transform: `translateX(${isDark ? 26 : 2}px)`,
          background: isDark ? 'var(--accent)' : 'var(--surface)',
          color: isDark ? 'var(--accent-contrast)' : 'var(--text-muted)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      >
        {isDark ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.5 14.7A8.5 8.5 0 1 1 9.3 3.5a7 7 0 0 0 11.2 11.2Z" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6" />
          </svg>
        )}
      </span>
    </button>
  );
}
