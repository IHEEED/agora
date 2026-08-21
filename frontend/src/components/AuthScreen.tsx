'use client';

import { useState, SubmitEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { Wordmark } from '@/components/Wordmark';
import { PixelWall } from '@/components/PixelWall';

/**
 * Полноэкранный гейт: без сессии пользователь не видит ничего от приложения,
 * кроме этого экрана.
 *
 * Вход в PARAFRAZ по-прежнему по приглашению, но раньше это означало, что
 * аккаунт заводят руками в панели Supabase и передают человеку пароль. Теперь у
 * каждого свой запас кодов, и пришедший заводит себя сам — закрытость осталась,
 * а передача паролей ушла.
 *
 * Телефон подтверждается позже, отдельным шагом, когда человек впервые пробует
 * написать пост или комментарий (см. PhoneVerifyModal).
 */

/** Код можно прислать ссылкой вида /?code=ABCD2345 — тогда поле уже заполнено. */
function codeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get('code')?.toUpperCase() ?? '';
}

const FIELD =
  'rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2.5 text-[15px] text-[var(--text)]';

export function AuthScreen() {
  // Код в ссылке означает, что человека позвали: открываем сразу регистрацию,
  // а не вход, в который ему нечего вводить.
  const [initialCode] = useState(codeFromUrl);
  const [mode, setMode] = useState<'signin' | 'signup'>(initialCode ? 'signup' : 'signin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [code, setCode] = useState(initialCode);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function switchTo(next: 'signin' | 'signup') {
    setMode(next);
    setError(null);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'signup') {
        // Сервер создаёт учётную запись и помечает код использованным. Сессию
        // он не открывает: входим тем же обычным способом, что и все остальные,
        // теми же данными, которые человек только что ввёл. Отдельной ветки
        // хранения сессии так не появляется.
        await apiFetch('/invites/register', {
          method: 'POST',
          body: JSON.stringify({ code: code.trim().toUpperCase(), email, password, username }),
        });
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw new Error(signInError.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось, попробуйте ещё раз');
    } finally {
      setLoading(false);
    }
  }

  const signup = mode === 'signup';

  return (
    // relative + isolate: пиксельный фон лежит внутри этого экрана и не должен
    // ни вылезать за него, ни всплывать над карточкой формы.
    // Прижато к верху, а не по центру: на телефоне клавиатура забирает нижнюю
    // половину экрана, и отцентрованная форма уезжала бы под неё.
    <div className="relative isolate flex min-h-[100dvh] flex-col items-center gap-7 overflow-hidden bg-[var(--bg)] px-6 pb-12 pt-[12vh]">
      <PixelWall />

      {/* Тем же знаком, что и в шапке приложения. Пиксельный шрифт ушёл
          вместе с пиксельным фоном: он был к месту, пока фон был из тех же
          букв, а на перетекающем градиенте читался чужой деталью. */}
      <h1 className="relative z-10">
        <Wordmark size={46} />
      </h1>

      {/* Карточка без обводки и на плотной подложке: сквозь полупрозрачную
          сквозили пятна фона, а рамка вокруг них дробила экран. */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--surface)', boxShadow: 'var(--glass-shadow)' }}
      >
        <h2 className="mb-5 text-center text-[15px] font-semibold text-[var(--text)]">
          {signup ? 'По приглашению' : 'Вход'}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {signup && (
            <div className="flex flex-col gap-1">
              <label htmlFor="code" className="text-[13px] text-[var(--text-muted)]">
                Код приглашения
              </label>
              <input
                id="code"
                required
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={code}
                // Код набирают с чужого экрана: приводим к верхнему регистру
                // сами, вместо того чтобы отвергать «abcd2345» как неизвестный.
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className={`${FIELD} font-mono tracking-[0.18em]`}
              />
            </div>
          )}

          {signup && (
            <div className="flex flex-col gap-1">
              <label htmlFor="username" className="text-[13px] text-[var(--text-muted)]">
                Имя
              </label>
              <input
                id="username"
                required
                minLength={3}
                maxLength={24}
                pattern="[a-zA-Z0-9._\-]+"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={FIELD}
              />
              <p className="text-[12px] text-[var(--text-muted)]">
                3–24 латинских буквы, цифры, точка, дефис, подчёркивание
              </p>
            </div>
          )}

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
              className={FIELD}
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
              // При регистрации порог выше и совпадает с серверным: узнать про
              // восемь знаков после круга до сервера — обидно на ровном месте.
              minLength={signup ? 8 : 6}
              autoComplete={signup ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={FIELD}
            />
          </div>

          {error && <p className="text-[13px]" style={{ color: 'var(--down)' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-full bg-[var(--accent)] py-2.5 text-[15px] font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Секунду…' : signup ? 'Завести аккаунт' : 'Войти'}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
          {signup ? (
            <>
              Уже есть аккаунт?{' '}
              <button
                type="button"
                onClick={() => switchTo('signin')}
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Войти
              </button>
            </>
          ) : (
            <>
              PARAFRAZ — по приглашению. Есть код?{' '}
              <button
                type="button"
                onClick={() => switchTo('signup')}
                className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Завести аккаунт
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
