'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScreenTitle } from '@/components/ScreenTitle';
import { VerifiedMark } from '@/components/VerifiedMark';
import { apiFetch } from '@/lib/api';
import { invalidate, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';
import { haptic } from '@/lib/haptics';

/**
 * Подтверждение личности.
 *
 * Сначала галочку выдавали только с карточки жалобы — то есть пока жалоб нет,
 * подтвердить нельзя было никого. Потом кнопка появилась в профиле человека, и
 * это лучше, но всё равно значит «сначала найди его в ленте». А подтверждают
 * обычно наоборот: тебе назвали ник, и надо проверить именно его.
 *
 * Отсюда экран: поле для ника, список уже подтверждённых и очередь заявок.
 * Заявки пока заглушка — механики подачи ещё нет, и рисовать пустой список без
 * объяснения значило бы обещать то, чего нет.
 */

type VerifiedUser = { id: string; username: string; verified_at: string };

function since(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} дн. назад`;
}

export default function VerificationPage() {
  const { me, loading: meLoading } = useMe();

  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const { data, loading } = useApiData<VerifiedUser[]>(
    me?.isModerator ? '/moderation/verified' : null
  );
  const verified = data ?? [];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = username.trim().replace(/^@/, '');
    if (!value || busy) return;

    setBusy(true);
    setResult(null);
    haptic();

    try {
      await apiFetch('/moderation/verify', {
        method: 'POST',
        body: JSON.stringify({ username: value, verified: true }),
      });
      setResult({ ok: true, text: `@${value} подтверждён` });
      setUsername('');
      invalidate('/moderation/verified');
      // Ник показан всюду вместе с галочкой — списки людей надо перечитать.
      invalidate('/users');
    } catch (error) {
      setResult({ ok: false, text: error instanceof Error ? error.message : 'Не получилось' });
    } finally {
      setBusy(false);
    }
  }

  async function revoke(user: VerifiedUser) {
    haptic();
    try {
      await apiFetch('/moderation/verify', {
        method: 'POST',
        body: JSON.stringify({ userId: user.id, verified: false }),
      });
      invalidate('/moderation/verified');
      invalidate('/users');
    } catch {
      // Молча: список перечитается сам, и человек увидит, что ничего не
      // изменилось. Ошибка поверх экрана здесь сказала бы то же самое, только
      // громче.
    }
  }

  if (meLoading) return null;

  if (!me?.isModerator) {
    // То же, что говорит сервер: раздела не существует. Объяснять «вам сюда
    // нельзя» значит подтверждать, что раздел есть.
    return (
      <div className="flex flex-1 flex-col items-center">
        <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-12">
          <ScreenTitle>Страница не найдена</ScreenTitle>
          <Link href="/" className="text-[14px] text-[var(--accent)]">
            На главную
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-5 px-4 pb-12">
        <ScreenTitle>Подтверждение личности</ScreenTitle>

        {/* ── Выдать по нику ───────────────────────────────────────────── */}
        <form onSubmit={submit} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                @
              </span>
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/[^a-zA-Z0-9._@-]/g, ''))}
                placeholder="ник"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="field-line w-full py-2.5 pl-8 pr-3 text-[15px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>
            <button
              type="submit"
              disabled={busy || !username.trim()}
              className="flex-none rounded-full px-4 py-2.5 text-[14px] font-medium disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              {busy ? 'Секунду…' : 'Подтвердить'}
            </button>
          </div>

          <p className="px-1 text-[12.5px] leading-snug text-[var(--text-muted)]">
            {/* Регистр и собачка не важны — так и говорим, иначе человек будет
                гадать, почему «@Vera» не нашлось, а «vera» нашлось. */}
            Регистр и знак «@» не важны. Галочка говорит только одно: человек —
            тот, за кого себя выдаёт.
          </p>

          {result && (
            <p
              className="px-1 text-[13px]"
              style={{ color: result.ok ? 'var(--up)' : 'var(--down)' }}
            >
              {result.text}
            </p>
          )}
        </form>

        {/* ── Заявки ───────────────────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h2 className="px-0.5 text-[14px] font-semibold text-[var(--text)]">Заявки</h2>

          {/* Заглушка, и подписана как заглушка.
              Подавать заявку человеку пока нечем — экрана нет ни в профиле, ни
              в настройках. Нарисовать здесь пустой список значило бы сказать
              «заявок нет», хотя правда другая: их некуда подать. */}
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{ background: 'var(--surface-2)' }}
          >
            <span
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 4.5h11l3 3V19.5H5z" />
                <path d="M9 11h6M9 14.5h4" />
              </svg>
            </span>
            <p className="text-[13.5px] leading-snug text-[var(--text-muted)]">
              Подавать заявки пока негде — экран подачи ещё не сделан. Здесь они
              появятся очередью, как жалобы.
            </p>
          </div>
        </section>

        {/* ── Уже подтверждённые ───────────────────────────────────────── */}
        <section className="flex flex-col gap-2">
          <h2 className="px-0.5 text-[14px] font-semibold text-[var(--text)]">
            Подтверждённые{verified.length > 0 ? ` · ${verified.length}` : ''}
          </h2>

          {loading && <p className="text-[13.5px] text-[var(--text-muted)]">Загрузка…</p>}

          {!loading && verified.length === 0 && (
            <p className="text-[13.5px] text-[var(--text-muted)]">
              Пока никого. Введите ник выше — человек появится в этом списке.
            </p>
          )}

          <div className="flex flex-col divide-y divide-[var(--border)]">
            {verified.map((user) => (
              <div key={user.id} className="flex items-center gap-2 py-2.5">
                <Link
                  href={`/u/${user.id}`}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-[15px] text-[var(--text)]"
                >
                  <span className="truncate">{user.username}</span>
                  <VerifiedMark verified={user.verified_at} size={14} />
                </Link>

                <span className="flex-none text-[12.5px] text-[var(--text-muted)]">
                  {since(user.verified_at)}
                </span>

                <button
                  type="button"
                  onClick={() => revoke(user)}
                  className="flex-none rounded-full px-3 py-1.5 text-[12.5px] font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--down)' }}
                >
                  Снять
                </button>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
