'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useScreenLeave } from '@/lib/useScreenLeave';
import { useSession } from '@/lib/useSession';
import { usePhoneGate } from '@/components/PhoneGateContext';
import {
  CHAT_WALLS,
  ChatWallId,
  DEFAULT_STYLE,
  STYLES,
  StyleId,
  ThemePreference,
  applyChatWall,
  applyStyle,
  applyTheme,
  readChatWall,
  readStyle,
  readThemePreference,
} from '@/lib/appearance';
import { ScreenTitle } from '@/components/ScreenTitle';
import { SegmentedControl } from '@/components/SegmentedControl';
import { LOCALES, Locale, TranslationKey, applyLocale, useT } from '@/lib/i18n';

const THEMES: ReadonlyArray<readonly [ThemePreference, TranslationKey]> = [
  ['light', 'settings.theme.light'],
  ['dark', 'settings.theme.dark'],
  ['system', 'settings.theme.system'],
];

/**
 * Группа строк по образцу настроек iOS.
 *
 * Раньше это была карточка с заголовком внутри, полями в пять единиц со всех
 * сторон и разделителями во всю ширину. Так строят списки на Android, и в
 * приложении, которое целится в айфон, это было заметнее всего: заголовок
 * читался первой строкой списка, а разделители рубили карточку на равные
 * плитки вместо того, чтобы связывать строки в одно.
 *
 * Здесь заголовок стоит НАД группой, поля отдала каждая строка по
 * отдельности, а разделитель начинается от текста и не доходит до правого
 * края — см. .ios-group в globals.css.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="ios-group-title">{title}</h2>
      <div className="ios-group">{children}</div>
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
    <div className="ios-row justify-between">
      <div className="flex min-w-0 flex-col">
        <span className="text-[15px] text-[var(--text)]">{label}</span>
        {hint && <span className="text-[12.5px] leading-snug text-[var(--text-muted)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Образец стиля — маленький макет экрана, а не кружок с цветом.
 *
 * Кружок показывал ровно одну из одиннадцати красок набора, и выбирать по нему
 * было нечего: фиолетовый кружок ничего не сообщал ни о фоне, ни о шрифте, ни
 * о том, как всё это уживается вместе. Здесь же видно готовую страницу в
 * миниатюре: подложка, карточка на ней, заголовок своей гарнитурой и кнопка
 * акцентом.
 */
function StylePreview({
  swatch,
  serif,
  selected,
}: {
  swatch: readonly [string, string, string];
  serif: boolean;
  selected: boolean;
}) {
  const [bg, surface, accent] = swatch;

  return (
    <span
      className="flex h-[86px] w-full flex-col justify-end gap-1.5 overflow-hidden rounded-xl p-2.5 transition-transform"
      style={{
        background: bg,
        transform: selected ? 'scale(1)' : 'scale(0.985)',
        // Кромка образца рисуется его же поверхностью: обводить плашку, которая
        // и так показывает свой фон, значило бы добавить чужую линию в макет.
        boxShadow: selected
          ? `0 0 0 2px var(--surface), 0 0 0 4px ${accent}`
          : '0 0 0 1px color-mix(in srgb, currentColor 12%, transparent)',
      }}
    >
      {/* Строка заголовка — своей гарнитурой: у половины стилей это антиква,
          и по образцу это должно быть видно. */}
      <span
        aria-hidden
        className="text-[13px] leading-none"
        style={{
          fontFamily: serif ? 'var(--font-display), Georgia, serif' : 'var(--font-body), sans-serif',
          fontWeight: serif ? 500 : 700,
          letterSpacing: serif ? '0' : '-0.03em',
          color: accent,
        }}
      >
        Aa
      </span>

      {/* Карточка с двумя строками текста и акцентной кнопкой. */}
      <span
        aria-hidden
        className="flex items-center gap-1.5 rounded-md p-1.5"
        style={{ background: surface }}
      >
        <span className="flex flex-1 flex-col gap-1">
          <span
            className="block h-[3px] w-full rounded-full"
            style={{ background: accent, opacity: 0.55 }}
          />
          <span
            className="block h-[3px] w-2/3 rounded-full"
            style={{ background: accent, opacity: 0.25 }}
          />
        </span>
        <span
          className="block h-3.5 w-3.5 flex-none rounded-full"
          style={{ background: accent }}
        />
      </span>
    </span>
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
  const { requestVerification } = usePhoneGate();
  const { goBack, style: leaveStyle, swipeHandlers } = useScreenLeave();
  const { t, locale, setLocale } = useT();

  // До монтирования значения неизвестны — читаем их уже в браузере,
  // иначе серверный рендер разойдётся с localStorage.
  const [theme, setTheme] = useState<ThemePreference | null>(null);
  const [style, setStyle] = useState<StyleId | null>(null);
  const [chatWall, setChatWall] = useState<ChatWallId | null>(null);
  // Образцы рисуются в той теме, что сейчас на экране, — иначе тёмный стиль
  // предлагался бы светлой плашкой и наоборот. «Системную» для этого
  // приходится разрешить в конкретное значение.
  const [darkNow, setDarkNow] = useState(false);

  function chooseLocale(next: Locale) {
    setLocale(next);
    applyLocale(next);
  }

  useEffect(() => {
    setTheme(readThemePreference());
    setStyle(readStyle());
    setChatWall(readChatWall());
  }, []);

  // При «системной» теме следим за настройкой ОС и переключаемся вместе с ней.
  // Заодно это единственное место, где известно, светло сейчас или темно, —
  // отсюда и значение для образцов.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => {
      setDarkNow(theme === 'dark' || (theme !== 'light' && media.matches));
      if (theme === 'system') applyTheme('system');
    };
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, [theme]);

  function chooseTheme(next: ThemePreference) {
    setTheme(next);
    applyTheme(next);
  }

  function chooseStyle(next: StyleId) {
    setStyle(next);
    applyStyle(next);
  }

  function chooseChatWall(next: ChatWallId) {
    setChatWall(next);
    applyChatWall(next);
  }

  const phoneVerified = Boolean(session?.user.phone_confirmed_at);

  return (
    <div className="flex flex-1 flex-col items-center" style={leaveStyle} {...swipeHandlers}>
      <main className="below-header flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-6">
        <div className="flex items-center gap-3 px-2 py-1">
          {/* Кружок с подложкой, а не голая стрелка: без фона она читалась
              украшением рядом с заголовком, и на неё просто не жали. */}
          <button
            onClick={goBack}
            aria-label="Назад"
            className="glass flex h-11 w-11 flex-none items-center justify-center rounded-full text-[var(--text)] transition-transform active:scale-95"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
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
            {/* До первого чтения localStorage тема неизвестна — пока капля
                стоит на «системной», а не прыгает с придуманного значения. */}
            <SegmentedControl
              value={theme ?? 'system'}
              onChange={chooseTheme}
              options={THEMES.map(([value, labelKey]) => [value, t(labelKey)] as const)}
            />
          </div>

          {/* Стиль вместо прежней пары «акцент + обои». Двадцать кружков и семь
              плиток давали три сотни сочетаний, из которых никто не подбирал ни
              одного; здесь пять готовых наборов, и каждый показан целиком. */}
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-[15px] text-[var(--text)]">{t('settings.style')}</p>
            <p className="mb-3 text-[12.5px] leading-snug text-[var(--text-muted)]">
              {t('settings.styleHint')}
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {STYLES.map((option) => {
                const selected = style === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => chooseStyle(option.id)}
                    aria-label={option.label}
                    aria-pressed={selected}
                    className="flex flex-col gap-1.5 text-left transition-transform active:scale-[0.97]"
                  >
                    <StylePreview
                      swatch={darkNow ? option.swatchDark : option.swatch}
                      serif={option.serif}
                      selected={selected}
                    />
                    <span className="flex flex-col px-0.5">
                      <span
                        className="text-[13.5px] font-medium"
                        style={{ color: selected ? 'var(--accent)' : 'var(--text)' }}
                      >
                        {option.label}
                      </span>
                      <span className="text-[11.5px] leading-snug text-[var(--text-muted)]">
                        {option.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Обои переписки живут здесь, а не в самом чате: это настройка, а не
              действие, и менять её посреди разговора незачем. */}
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="text-[15px] text-[var(--text)]">{t('settings.chatWall')}</p>
            <p className="mb-3 text-[12.5px] leading-snug text-[var(--text-muted)]">
              {t('settings.chatWallHint')}
            </p>
            <div className="grid grid-cols-4 gap-2.5">
              {CHAT_WALLS.map((option) => {
                const selected = chatWall === option.id;
                return (
                  <button
                    key={option.id}
                    onClick={() => chooseChatWall(option.id)}
                    title={option.label}
                    aria-label={option.label}
                    aria-pressed={selected}
                    className="chat-wall-swatch flex items-center justify-center transition-transform active:scale-95"
                    // Тот же атрибут, что и на <html>: оттенки образец берёт из
                    // общего правила, а не из второй копии палитры.
                    data-chat-wall={option.id}
                    style={{
                      boxShadow: selected
                        ? '0 0 0 2px var(--surface), 0 0 0 4px var(--accent)'
                        : 'none',
                    }}
                  >
                    {option.id === 'none' && (
                      <span className="text-[11px] text-[var(--text-muted)]">
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
            {/* Та же дорожка-заливка, что у SegmentedControl выше: обведённая
                таблетка рядом с необведённой выглядела бы недоделкой. */}
            <div
              className="flex gap-1 rounded-full p-1"
              style={{ background: 'var(--surface-2)' }}
            >
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
          {/* Заливка, а не одна рамка: обведённая строка на стеклянной карточке
              читалась подписью, и понять, что это кнопка, можно было только
              нажав. */}
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full rounded-full py-3 text-[15px] font-semibold transition-transform active:scale-[0.98]"
            style={{
              background: 'color-mix(in srgb, var(--down) 14%, transparent)',
              color: 'var(--down)',
            }}
          >
            {t('settings.signOut')}
          </button>
        </section>

        <p className="px-3 pb-2 text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
          {t('settings.localOnly')}
        </p>

        {/* Дальше — пустота и то, что в ней спрятано. Пролистав настройки до
            конца, человек обычно останавливается; кто пролистает дальше,
            найдёт шестое оформление, которого нет в списке. */}
        <GlamEasterEgg current={style} onFound={chooseStyle} />
      </main>
    </div>
  );
}

/**
 * Пасхалка: «Гламур».
 *
 * Спрятана не за секретным жестом, а за простым любопытством — надо всего лишь
 * не остановиться там, где кончились настройки. Полтора экрана пустоты сами по
 * себе сообщение: человек, докрутивший до дна, понимает, что дно тут
 * нарочное.
 *
 * Проявляется по мере приближения — так видно, что впереди что-то есть, и
 * находка не выглядит случайным сбоем.
 */
function GlamEasterEgg({
  current,
  onFound,
}: {
  current: StyleId | null;
  onFound: (style: StyleId) => void;
}) {
  const [nearness, setNearness] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onScroll() {
      const node = anchor.current;
      if (!node) return;
      // Насколько верх карточки поднялся над нижней кромкой экрана: ноль —
      // ещё за экраном, единица — целиком видна.
      const { top } = node.getBoundingClientRect();
      const progress = (window.innerHeight - top) / 160;
      setNearness(Math.max(0, Math.min(1, progress)));
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const found = current === 'glam';

  return (
    <>
      {/* Полтора экрана намеренной пустоты. */}
      <div style={{ height: '58vh' }} aria-hidden />

      <div ref={anchor} className="flex flex-col items-center gap-3 pb-16 text-center">
        <div
          style={{
            opacity: nearness,
            transform: `translateY(${(1 - nearness) * 14}px)`,
            transition: 'opacity 0.2s ease, transform 0.2s var(--enter-ease)',
          }}
        >
          <p className="mb-3 text-[13px] leading-relaxed text-[var(--text-muted)]">
            {found
              ? 'Гламур включён. Обратно — любым оформлением выше.'
              : 'Здесь ничего нет. Почти.'}
          </p>
          <button
            type="button"
            onClick={() => onFound(found ? DEFAULT_STYLE : 'glam')}
            className="rounded-full px-5 py-2.5 text-[14px] font-semibold transition-transform active:scale-95"
            style={{
              // Розовый — свой, а не из палитры: кнопка обещает именно этот
              // цвет, и на любом текущем оформлении обещание одно и то же.
              background: found ? 'var(--surface-2)' : '#e0338c',
              color: found ? 'var(--text)' : '#ffffff',
              boxShadow: found ? 'none' : '0 10px 30px -12px #e0338c',
            }}
          >
            {found ? 'Хватит' : 'Гламур'}
          </button>
        </div>
      </div>
    </>
  );
}
