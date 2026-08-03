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
  WALLPAPERS,
  WallpaperId,
  applyAccent,
  applyTheme,
  applyWallpaper,
  readAccent,
  readThemePreference,
  readWallpaper,
} from '@/lib/appearance';
import { ScreenTitle } from '@/components/ScreenTitle';
import { LOCALES, Locale, TranslationKey, applyLocale, useT } from '@/lib/i18n';

const THEMES: ReadonlyArray<readonly [ThemePreference, TranslationKey]> = [
  ['light', 'settings.theme.light'],
  ['dark', 'settings.theme.dark'],
  ['system', 'settings.theme.system'],
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-2xl p-5">
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
  const { t, locale, setLocale } = useT();

  // До монтирования значения неизвестны — читаем их уже в браузере,
  // иначе серверный рендер разойдётся с localStorage.
  const [theme, setTheme] = useState<ThemePreference | null>(null);
  const [accent, setAccent] = useState<AccentId | null>(null);
  const [wallpaper, setWallpaper] = useState<WallpaperId | null>(null);

  function chooseLocale(next: Locale) {
    setLocale(next);
    applyLocale(next);
  }

  useEffect(() => {
    setTheme(readThemePreference());
    setAccent(readAccent());
    setWallpaper(readWallpaper());
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

  function chooseWallpaper(next: WallpaperId) {
    setWallpaper(next);
    applyWallpaper(next);
  }

  const phoneVerified = Boolean(session?.user.phone_confirmed_at);

  return (
    <div className="flex flex-1 flex-col items-center">
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
          <ScreenTitle>{t('settings.title')}</ScreenTitle>
        </div>

        <section className="glass rounded-2xl p-5">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {t('settings.appearance')}
          </h2>

          <div className="flex flex-col gap-2 pb-4">
            <span className="text-[15px] text-[var(--text)]">{t('settings.theme')}</span>
            <div className="flex gap-1 rounded-full border border-[var(--border)] p-1">
              {THEMES.map(([value, labelKey]) => (
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
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-[var(--border)] pt-4">
            <p className="mb-3 text-[15px] text-[var(--text)]">{t('settings.accent')}</p>
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

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="mb-3 text-[15px] text-[var(--text)]">{t('settings.wallpaper')}</p>
            <div className="grid grid-cols-4 gap-2.5">
              {WALLPAPERS.map((option) => {
                const selected = wallpaper === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => chooseWallpaper(option.id)}
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={selected}
                    className="wallpaper-swatch"
                    // Тот же атрибут, что и на <html>: набор оттенков образец
                    // берёт из общего правила, а не из второй копии палитры.
                    data-wallpaper={option.id}
                    style={{
                      boxShadow: selected
                        ? '0 0 0 2px var(--surface), 0 0 0 4px var(--accent)'
                        : '0 0 0 1px var(--border)',
                    }}
                  >
                    {option.id === 'none' && (
                      <span className="text-[12px] text-[var(--text-muted)]">
                        {t('settings.wallpaperOff')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <span className="text-[15px] text-[var(--text)]">{t('settings.language')}</span>
            <div className="flex gap-1 rounded-full border border-[var(--border)] p-1">
              {LOCALES.map((option) => (
                <button
                  key={option.id}
                  onClick={() => chooseLocale(option.id)}
                  className="flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors"
                  style={
                    locale === option.id
                      ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                      : { color: 'var(--text-muted)' }
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <Section title={t('settings.account')}>
          <Row label={t('settings.email')} hint={session?.user.email ?? ''} />
          <Row
            label={t('settings.phone')}
            hint={phoneVerified ? t('settings.phoneVerified') : t('settings.phoneNeeded')}
          >
            {phoneVerified ? (
              <span className="flex-none text-[13px] font-medium" style={{ color: 'var(--up)' }}>
                {t('settings.done')}
              </span>
            ) : (
              <button
                onClick={requestVerification}
                className="flex-none rounded-full bg-[var(--accent)] px-4 py-1.5 text-[13px] font-medium text-[var(--accent-contrast)]"
              >
                {t('settings.verify')}
              </button>
            )}
          </Row>
        </Section>

        <Section title={t('settings.notifications')}>
          <Row label={t('settings.notifyReplies')} hint={t('settings.notifyRepliesHint')}>
            <LocalToggle storageKey="parafraz-notify-replies" defaultOn />
          </Row>
          <Row label={t('settings.notifyMentions')} hint={t('settings.notifyMentionsHint')}>
            <LocalToggle storageKey="parafraz-notify-mentions" defaultOn />
          </Row>
          <Row label={t('settings.notifyVotes')} hint={t('settings.notifyVotesHint')}>
            <LocalToggle storageKey="parafraz-notify-votes" />
          </Row>
        </Section>

        <Section title={t('settings.privacy')}>
          <Row label={t('settings.privateProfile')} hint={t('settings.privateProfileHint')}>
            <LocalToggle storageKey="parafraz-private-profile" />
          </Row>
          <Row label={t('settings.showInfluence')} hint={t('settings.showInfluenceHint')}>
            <LocalToggle storageKey="parafraz-show-influence" defaultOn />
          </Row>
        </Section>

        <Section title={t('settings.content')}>
          <Row label={t('settings.nsfw')} hint={t('settings.nsfwHint')}>
            <LocalToggle storageKey="parafraz-nsfw" />
          </Row>
          <Row label={t('settings.autoplay')} hint={t('settings.autoplayHint')}>
            <LocalToggle storageKey="parafraz-autoplay" defaultOn />
          </Row>
        </Section>

        <Section title={t('settings.about')}>
          <Row label={t('settings.version')} hint={t('settings.versionHint')} />
          <Row label={t('settings.rules')} hint={t('common.soon')} />
          <Row label={t('settings.support')} hint={t('common.soon')} />
        </Section>

        <section className="glass rounded-2xl p-5">
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full rounded-full border border-[var(--border)] py-2.5 text-[15px] font-medium transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: 'var(--down)' }}
          >
            {t('settings.signOut')}
          </button>
        </section>

        <p className="px-3 pb-2 text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
          {t('settings.localOnly')}
        </p>
      </main>
    </div>
  );
}
