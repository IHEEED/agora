'use client';

import { useState, SubmitEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { Wordmark } from '@/components/Wordmark';

/**
 * Полноэкранный гейт: без сессии пользователь не видит ничего от приложения,
 * кроме этого экрана.
 *
 * Регистрации здесь нет намеренно — вход в PARAFRAZ по приглашению. Аккаунт
 * заводит тот, кто выдал инвайт, а человек просто входит уже готовой парой
 * почта/пароль. Телефон подтверждается позже, отдельным шагом, когда человек
 * впервые пробует написать пост или комментарий (см. PhoneVerifyModal).
 */
export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  return (
    // Фон плоский — цвет темы и ничего больше.
    //
    // Здесь жили четыре огромных цветных пятна, медленно перетекающих друг в
    // друга. Задумывались они как обещание: вход сразу показывает, какого
    // цвета приложение внутри. На деле обещали они не то — за градиентом
    // ожидаешь чего-то нарядного, а внутри спокойный текстовый интерфейс, и
    // первое, что делает приложение, — обманывает.
    //
    // Была и цена. Каждое пятно — 78vmax с размытием в 64 пикселя, и все
    // четыре двигались непрерывно. На iPhone это четыре слоя размером с экран,
    // растеризуемых с блюром, на первом же экране, который человек видит, —
    // ещё до того, как что-то загрузилось.
    //
    // Прижато к верху, а не по центру: на телефоне клавиатура забирает нижнюю
    // половину экрана, и отцентрованная форма уезжала бы под неё.
    <div className="flex min-h-[100dvh] flex-col items-center gap-7 bg-[var(--bg)] px-6 pb-12 pt-[12vh]">
      {/* Тем же знаком, что и в шапке приложения. */}
      <h1>
        <Wordmark size={46} />
      </h1>

      {/* Карточка без обводки: на плоском фоне рамка вокруг неё только дробила
          бы экран. */}
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--surface)', boxShadow: 'var(--glass-shadow)' }}
      >
        <h2 className="mb-5 text-center text-[15px] font-semibold text-[var(--text)]">Вход</h2>

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
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[15px] text-[var(--text)]"
            />
          </div>

          {error && <p className="text-[13px]" style={{ color: 'var(--down)' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-full bg-[var(--accent)] py-2.5 text-[15px] font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Секунду…' : 'Войти'}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
          PARAFRAZ — по приглашению. Аккаунт заводит тот, кто позвал; открытой
          регистрации нет.
        </p>
      </div>
    </div>
  );
}
