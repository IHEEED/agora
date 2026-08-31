'use client';

import { useEffect, useState, SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Wordmark } from '@/components/Wordmark';

/**
 * Новый пароль по ссылке из письма.
 *
 * Куда ведёт `resetPasswordForEmail` (см. AuthScreen). Supabase кладёт в адрес
 * одноразовый ключ восстановления и, разобрав его, открывает временную сессию —
 * ту, в которой разрешено ровно одно: сменить себе пароль.
 *
 * Отсюда устройство экрана. Ждать события `PASSWORD_RECOVERY` приходится
 * потому, что разбор адреса у Supabase асинхронный: если спросить сессию сразу
 * на монтировании, её ещё нет, и экран честно скажет «ссылка не годится» о
 * вполне годной ссылке. Событие приходит один раз и означает «ключ принят,
 * можно спрашивать пароль».
 *
 * Отдельный маршрут, а не режим внутри AuthScreen: сюда попадают из почты, то
 * есть с чужого экрана и часто из другого браузера. Такому входу нужен свой
 * адрес, на который можно сослаться, а не состояние внутри чужой формы.
 */
export default function ResetPage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  /**
   * Прячем шапку и бар.
   *
   * Здесь не из чего выходить и некуда переключаться: экран открыт по ссылке из
   * письма, часто в чужом браузере, где ни ленты, ни переписок ещё нет. Кнопки,
   * ведущие туда, куда человек не может попасть, — это не навигация, а
   * приглашение упереться.
   */
  useEffect(() => {
    document.documentElement.setAttribute('data-bare', '');
    return () => document.documentElement.removeAttribute('data-bare');
  }, []);

  useEffect(() => {
    // Сессия могла установиться до того, как мы подписались: событие
    // одноразовое, и опоздавший слушатель его не увидит. Поэтому сначала
    // спрашиваем прямо, а подписка остаётся на случай, когда мы успели раньше.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') setReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);

    if (password !== again) {
      // Проверяем до обращения к серверу: опечатка в повторе — не повод ждать
      // ответа сети, чтобы узнать о ней.
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setDone(true);
    // Сессия после смены уже настоящая — заходить заново не нужно. Пауза, чтобы
    // человек успел прочитать, что получилось, а не увидел мигание.
    window.setTimeout(() => router.replace('/'), 1400);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center gap-7 bg-[var(--bg)] px-6 pb-12 pt-[12vh]">
      <h1>
        <Wordmark size={46} />
      </h1>

      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: 'var(--surface)', boxShadow: 'var(--glass-shadow)' }}
      >
        <h2 className="mb-5 text-center text-[15px] font-semibold text-[var(--text)]">
          Новый пароль
        </h2>

        {done ? (
          <p className="text-[14px] leading-relaxed text-[var(--text)]">
            Готово. Пароль сменён, вы уже вошли.
          </p>
        ) : !ready ? (
          /* Ссылка одноразовая и живёт час. Второй раз по ней не зайти, и
             сказать об этом надо прямо, а не оставить человека перед пустой
             формой, которая молча не работает. */
          <p className="text-[14px] leading-relaxed text-[var(--text-muted)]">
            Проверяем ссылку… Если ничего не происходит — она уже использована
            или устарела. Запросите новую на экране входа.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="new-password" className="text-[13px] text-[var(--text-muted)]">
                Пароль
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="rounded-xl px-3 py-2.5 text-[15px] outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="again" className="text-[13px] text-[var(--text-muted)]">
                Ещё раз
              </label>
              <input
                id="again"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={again}
                onChange={(event) => setAgain(event.target.value)}
                className="rounded-xl px-3 py-2.5 text-[15px] outline-none"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              />
            </div>

            {error && (
              <p className="text-[13px] leading-snug" style={{ color: 'var(--down)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 rounded-full bg-[var(--accent)] py-2.5 text-[15px] font-medium text-[var(--accent-contrast)] transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Секунду…' : 'Сменить пароль'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
