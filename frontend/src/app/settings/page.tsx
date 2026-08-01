'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { usePhoneGate } from '@/components/PhoneGateContext';
import {
  ACCENTS,
  AccentId,
  ThemePreference,
  applyAccent,
  applyTheme,
  readAccent,
  readThemePreference,
} from '@/lib/appearance';

const THEMES: ReadonlyArray<readonly [ThemePreference, string]> = [
  ['light', 'Светлая'],
  ['dark', 'Тёмная'],
  ['system', 'Системная'],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-[var(--surface)] p-5">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        {title}
      </h2>
      <div className="flex flex-col divide-y divide-[var(--border)]">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="flex min-w-0 flex-col">
        <span className="text-[15px] text-[var(--text)]">{label}</span>
        {hint && <span className="text-[12.5px] leading-snug text-[var(--text-muted)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** Переключатель, состояние которого хранится только на этом устройстве. */
function LocalToggle({ storageKey, defaultOn = false }: { storageKey: string; defaultOn?: boolean }) {
  const [on, setOn] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    setOn(stored === null ? defaultOn : stored === '1');
  }, [storageKey, defaultOn]);

  function toggle() {
    const next = !on;
    setOn(next);
    window.localStorage.setItem(storageKey, next ? '1' : '0');
  }

  if (on === null) return <span className="h-7 w-[52px] flex-none" />;

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={on}
      className="relative h-7 w-[52px] flex-none rounded-full border transition-colors"
      style={{
        borderColor: on ? 'var(--accent)' : 'var(--border)',
        background: on ? 'var(--accent-soft)' : 'var(--surface-2)',
      }}
    >
      {/* Оба сдвига держим в одном transform: inline-стиль перебивает класс
          целиком, поэтому -translate-y-1/2 из className сюда не доедет. */}
      <span
        className="absolute left-0 top-1/2 h-[22px] w-[22px] rounded-full transition-transform duration-300"
        style={{
          transform: `translate(${on ? 27 : 2}px, -50%)`,
          background: on ? 'var(--accent)' : 'var(--surface)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { session } = useSession();
  const router = useRouter();
  const { requestVerification } = usePhoneGate();

  // До монтирования значения неизвестны — читаем их уже в браузере,
  // иначе серверный рендер разойдётся с localStorage.
  const [theme, setTheme] = useState<ThemePreference | null>(null);
  const [accent, setAccent] = useState<AccentId | null>(null);

  useEffect(() => {
    setTheme(readThemePreference());
    setAccent(readAccent());
  }, []);

  // При «системной» теме следим за настройкой ОС и переключаемся вместе с ней.
  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyTheme('system');
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [theme]);

  function chooseTheme(next: ThemePreference) {
    setTheme(next);
    applyTheme(next);
  }

  function chooseAccent(next: AccentId) {
    setAccent(next);
    applyAccent(next);
  }

  const phoneVerified = Boolean(session?.user.phone_confirmed_at);

  return (
    <div className="flex flex-1 flex-col items-center" style={{ background: 'var(--sunken)' }}>
      <main className="below-header flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-6">
        <div className="flex items-center gap-3 px-2 py-1">
          <button
            onClick={() => router.back()}
            aria-label="Назад"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text)] transition-colors hover:bg-[var(--surface)]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <h1 className="text-2xl font-semibold text-[var(--text)]">Настройки</h1>
        </div>

        <section className="rounded-2xl bg-[var(--surface)] p-5">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Оформление
          </h2>

          <div className="flex flex-col gap-2 pb-4">
            <span className="text-[15px] text-[var(--text)]">Тема</span>
            <div className="flex gap-1 rounded-full border border-[var(--border)] p-1">
              {THEMES.map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => chooseTheme(value)}
                  className="flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors"
                  style={
                    theme === value
                      ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-4">
            <p className="mb-3 text-[15px] text-[var(--text)]">Акцентный цвет</p>
            <div className="flex flex-wrap gap-3">
              {ACCENTS.map((option) => {
                const selected = accent === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => chooseAccent(option.id)}
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={selected}
                    className="flex h-10 w-10 items-center justify-center rounded-full transition-transform hover:scale-105"
                    style={{
                      background: option.swatch,
                      // Обводка отбивает кружок от фона и заодно показывает выбор.
                      boxShadow: selected
                        ? '0 0 0 2px var(--surface), 0 0 0 4px var(--accent)'
                        : '0 0 0 1px var(--border)',
                    }}
                  >
                    {selected && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <Section title="Аккаунт">
          <Row label="Почта" hint={session?.user.email ?? ''} />
          <Row
            label="Телефон"
            hint={phoneVerified ? 'Подтверждён' : 'Нужен, чтобы писать посты и комментарии'}
          >
            {phoneVerified ? (
              <span className="flex-none text-[13px] font-medium" style={{ color: 'var(--up)' }}>
                Готово
              </span>
            ) : (
              <button
                onClick={requestVerification}
                className="flex-none rounded-full bg-[var(--accent)] px-4 py-1.5 text-[13px] font-medium text-[var(--accent-contrast)]"
              >
                Подтвердить
              </button>
            )}
          </Row>
        </Section>

        <Section title="Уведомления">
          <Row label="Ответы на мои посты" hint="Когда кто-то комментирует вашу запись">
            <LocalToggle storageKey="parafraz-notify-replies" defaultOn />
          </Row>
          <Row label="Упоминания" hint="Когда вас отмечают через @">
            <LocalToggle storageKey="parafraz-notify-mentions" defaultOn />
          </Row>
          <Row label="Реакции" hint="Когда за вашу запись голосуют">
            <LocalToggle storageKey="parafraz-notify-votes" />
          </Row>
        </Section>

        <Section title="Приватность">
          <Row label="Закрытый профиль" hint="Записи видны только подписчикам">
            <LocalToggle storageKey="parafraz-private-profile" />
          </Row>
          <Row label="Показывать influence-очки" hint="Другие видят ваш счёт в профиле">
            <LocalToggle storageKey="parafraz-show-influence" defaultOn />
          </Row>
        </Section>

        <Section title="Контент">
          <Row label="Материалы 18+" hint="Показывать записи с пометкой для взрослых">
            <LocalToggle storageKey="parafraz-nsfw" />
          </Row>
          <Row label="Автовоспроизведение" hint="Видео запускается само при прокрутке">
            <LocalToggle storageKey="parafraz-autoplay" defaultOn />
          </Row>
        </Section>

        <Section title="О приложении">
          <Row label="Версия" hint="PARAFRAZ, сборка для разработки" />
          <Row label="Правила сообщества" hint="Скоро" />
          <Row label="Поддержка" hint="Скоро" />
        </Section>

        <section className="rounded-2xl bg-[var(--surface)] p-5">
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full rounded-full border border-[var(--border)] py-2.5 text-[15px] font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--down)' }}
          >
            Выйти из аккаунта
          </button>
        </section>

        <p className="px-3 pb-2 text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
          Переключатели уведомлений, приватности и контента пока сохраняются
          только на этом устройстве — серверной части у них ещё нет.
        </p>
      </main>
    </div>
  );
}
