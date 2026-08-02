'use client';

import { useState, SubmitEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { PixelWall } from '@/components/PixelWall';

type Mode = 'signin' | 'signup';

/**
 * Полноэкранный гейт: без сессии пользователь не видит ничего от приложения,
 * кроме этого экрана. Регистрация — по email; телефон подтверждается позже,
 * отдельным шагом, только когда человек впервые пробует написать пост
 * или комментарий (см. PhoneVerifyModal).
 */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);

    if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) return setError(error.message);
      if (!data.session) {
        setNotice('Проверьте почту — мы отправили письмо для подтверждения аккаунта.');
      }
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    // relative + isolate: пиксельный фон лежит внутри этого экрана и не должен
    // ни вылезать за него, ни всплывать над карточкой формы.
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center gap-10 overflow-hidden bg-[var(--bg)] px-6 py-12">
      <PixelWall />

      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        {/* Пиксельный логотип — тот же рваный ореол, что у аватаров в ленте. */}
        <div className="relative flex h-20 w-20 items-center justify-center">
          <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
            <defs>
              <linearGradient id="auth-logo-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#5b3ad6" />
                <stop offset="100%" stopColor="#a880ff" />
              </linearGradient>
            </defs>
            <path
              d="M40 4 L52 8 L64 6 L70 17 L78 24 L74 36 L78 48 L68 56 L64 68 L52 66 L40 76 L28 66 L16 68 L12 56 L2 48 L6 36 L2 24 L10 17 L16 6 L28 8 Z"
              fill="none"
              stroke="url(#auth-logo-ring)"
              strokeWidth="3"
              strokeLinejoin="miter"
            />
          </svg>
          <span className="font-pixel absolute text-[26px] font-bold text-[var(--accent)]">P</span>
        </div>

        <h1 className="font-pixel text-[34px] text-[var(--text)]">PARAFRAZ</h1>
        <p className="max-w-xs text-[15px] leading-relaxed text-[var(--text-muted)]">
          Место, где хорошие мысли всплывают наверх сами
        </p>
      </div>

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-5 flex gap-1 rounded-full border border-[var(--border)] p-1">
          {(
            [
              ['signup', 'Регистрация'],
              ['signin', 'Вход'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => {
                setMode(value);
                setError(null);
                setNotice(null);
              }}
              className="flex-1 rounded-full py-2 text-[14px] font-medium transition-colors"
              style={
                mode === value
                  ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                  : { color: 'var(--text-muted)' }
              }
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-[13px] text-[var(--text-muted)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[15px] text-[var(--text)]"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-[13px] text-[var(--text-muted)]">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[15px] text-[var(--text)]"
            />
          </div>

          {error && <p className="text-[13px]" style={{ color: 'var(--down)' }}>{error}</p>}
          {notice && <p className="text-[13px]" style={{ color: 'var(--up)' }}>{notice}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-full bg-[var(--accent)] py-2.5 text-[15px] font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Секунду…' : mode === 'signup' ? 'Создать аккаунт' : 'Войти'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="mt-4 text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
            Чтобы писать посты и комментарии, дополнительно понадобится
            подтвердить номер телефона — это можно сделать сразу после входа.
          </p>
        )}
      </div>
    </div>
  );
}
