'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useScreenLeave } from '@/lib/useScreenLeave';
import { haptic } from '@/lib/haptics';
import { useSession } from '@/lib/useSession';
import { usePhoneGate } from '@/components/PhoneGateContext';
import {
  DEFAULT_STYLE,
  STYLES,
  StyleId,
  ThemePreference,
  applyStyle,
  applyTheme,
  readStyle,
  readThemePreference,
} from '@/lib/appearance';
import { ScreenTitle } from '@/components/ScreenTitle';
import Link from 'next/link';
import { InvitesPanel } from '@/components/InvitesPanel';
import { useMe } from '@/lib/useMe';
import { SegmentedControl } from '@/components/SegmentedControl';
import { LOCALES, Locale, TranslationKey, applyLocale, useT } from '@/lib/i18n';

/**
 * Разделы настроек.
 *
 * Раньше настройки были одним свитком: шесть групп подряд, и чтобы дойти от
 * оформления до выхода, надо было проехать мимо уведомлений, приватности и
 * содержимого. На телефоне это четыре экрана прокрутки — а человек приходит
 * сюда с одним конкретным вопросом и не хочет читать остальные пять.
 *
 * Теперь сначала выбирают раздел, потом видят его строки. Порядок — по
 * частоте: оформление трогают чаще всего, «о приложении» не трогают почти
 * никогда.
 */
const TABS = [
  ['appearance', 'settings.appearance'],
  ['account', 'settings.account'],
  ['notifications', 'settings.notifications'],
  ['privacy', 'settings.privacy'],
  ['content', 'settings.content'],
  ['about', 'settings.about'],
] as const satisfies ReadonlyArray<readonly [string, TranslationKey]>;

type TabId = (typeof TABS)[number][0];

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
function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section>
      {/* Заголовок необязателен.
          С появлением вкладок раздел уже назван таблеткой над ним, и подпись
          «Аккаунт» под вкладкой «Аккаунт» — то же слово дважды подряд, в двух
          сантиметрах друг от друга. Заголовок остаётся там, где на одной
          вкладке лежит больше одной группы и их надо различать. */}
      {title && <h2 className="ios-group-title">{title}</h2>}
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
  // Настройки разворачиваются из шестерни в шапке и складываются обратно в неё.
  // Та же кнопка их и открыла — движение связывает одно с другим, и не нужно
  // догадываться, откуда экран взялся и куда денется.
  const { goBack, style: leaveStyle, swipeHandlers } = useScreenLeave('[data-header-action]');
  const { t, locale, setLocale } = useT();

  // До монтирования значения неизвестны — читаем их уже в браузере,
  // иначе серверный рендер разойдётся с localStorage.
  const [theme, setTheme] = useState<ThemePreference | null>(null);
  const [style, setStyle] = useState<StyleId | null>(null);
  const [tab, setTab] = useState<TabId>('appearance');
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


  const phoneVerified = Boolean(session?.user.phone_confirmed_at);
  const { me } = useMe();

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

        {/* Дорожка разделов.
            Прокручивается вбок, а не переносится на две строки: шесть названий
            в две строки — это уже не переключатель, а вторая шапка, и она
            отжимает содержимое вниз ровно там, где на него смотрят. Края
            подрезаны на всю ширину экрана (-mx-2.5), чтобы крайние вкладки
            уезжали под край, а не упирались в поле: обрезанное слово — самый
            понятный намёк, что вбок есть ещё. */}
        <div // scroll-px-2.5 — то же поле, что и px-2.5, но для scrollIntoView:
          // без него подтянутая вкладка встаёт впритык к краю экрана.
          className="no-scrollbar -mx-2.5 flex gap-1.5 overflow-x-auto scroll-px-2.5 px-2.5 pb-1">
          {TABS.map(([id, labelKey]) => {
            const on = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={(event) => {
                  haptic();
                  setTab(id);
                  // Подтянуть выбранную вкладку в поле зрения.
                  //
                  // Крайние таблетки нарочно подрезаны краем — так видно, что
                  // вбок есть ещё. Но нажатая наполовину видимая вкладка так
                  // наполовину видимой и оставалась: раздел сменился, а какой
                  // именно выбран — не разглядеть, потому что заливка ушла за
                  // край. 'nearest' двигает дорожку ровно настолько, чтобы
                  // таблетка поместилась целиком, и не трогает уже видимые.
                  event.currentTarget.scrollIntoView({
                    behavior: 'smooth',
                    inline: 'nearest',
                    block: 'nearest',
                  });
                }}
                aria-pressed={on}
                className="flex-none whitespace-nowrap rounded-full px-3.5 py-2 text-[13.5px] font-medium transition-colors"
                style={
                  on
                    ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                    : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                }
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>

        {tab === 'appearance' && (
        <section className="glass rounded-2xl p-5">

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
        )}

        {tab === 'account' && (
        <Section>
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
          <InvitesPanel />
          {me?.isModerator && (
            /* Единственный вход в раздел модерации: в общей навигации его нет,
               потому что модераторов единицы, а вкладку видели бы все. */
            <Row label="Модерация" hint="Очередь жалоб">
              <Link
                href="/moderation"
                className="flex-none rounded-full px-4 py-1.5 text-[13px] font-medium"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                Открыть
              </Link>
            </Row>
          )}
        </Section>

        )}

        {tab === 'notifications' && (
        <Section>
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

        )}

        {tab === 'privacy' && (
        <Section>
          <Row label={t('settings.privateProfile')} hint={t('settings.privateProfileHint')}>
            <LocalToggle storageKey="parafraz-private-profile" />
          </Row>
          <Row label={t('settings.showInfluence')} hint={t('settings.showInfluenceHint')}>
            <LocalToggle storageKey="parafraz-show-influence" defaultOn />
          </Row>
        </Section>

        )}

        {tab === 'content' && (
        <Section>
          <Row label={t('settings.nsfw')} hint={t('settings.nsfwHint')}>
            <LocalToggle storageKey="parafraz-nsfw" />
          </Row>
          <Row label={t('settings.autoplay')} hint={t('settings.autoplayHint')}>
            <LocalToggle storageKey="parafraz-autoplay" defaultOn />
          </Row>
        </Section>

        )}

        {tab === 'about' && (
        <Section>
          <Row label={t('settings.version')} hint={t('settings.versionHint')} />
          <Row label={t('settings.rules')} hint={t('common.soon')} />
          <Row label={t('settings.support')} hint={t('common.soon')} />
        </Section>
        )}

        {/* Выход стоит в «аккаунте», а не под всеми разделами.
            Общий низ у настроек кончился вместе с общим свитком, и красная
            кнопка, висящая под уведомлениями или под содержимым, читалась бы
            как их итог. Выход — действие над учётной записью, и жить ему там,
            где всё остальное про неё. */}
        {tab === 'account' && (
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
        )}

        {/* Оговорка про местное хранение — там, где рассказывают о приложении.
            Под каждым разделом она была бы шестикратным повтором. */}
        {tab === 'about' && (
          <>
            <p className="px-3 pb-2 text-center text-[12px] leading-relaxed text-[var(--text-muted)]">
              {t('settings.localOnly')}
            </p>

            {/* Дальше — пустота и то, что в ней спрятано. Пролистав настройки до
                конца, человек обычно останавливается; кто пролистает дальше,
                найдёт шестое оформление, которого нет в списке.

                Раздел для неё — «о приложении»: последняя вкладка, и та, куда
                заходят реже всего. Дно теперь ближе, чем в общем свитке, но
                пасхалку держало не расстояние, а три отказа подряд, и они на
                месте. */}
            <GlamEasterEgg current={style} onFound={chooseStyle} />
          </>
        )}
      </main>
    </div>
  );
}

/**
 * Пасхалка: «Гламур».
 *
 * Спрятана не за секретным жестом, а за упрямством. Настройки кончаются, дальше
 * полтора экрана пустоты — и на этом страница действительно заканчивается: дно
 * настоящее, в него упираешься. Упрёшься второй раз — по-прежнему дно. И только
 * на третий приложение уступает и пропускает дальше, к кнопке.
 *
 * Смысл именно в отказе. Пасхалка, до которой достаточно долистать, — это не
 * находка, а просто далеко расположенный пункт: его находят случайно и ничего
 * при этом не чувствуют. Дверь, которая не поддалась дважды, превращает
 * третью попытку в решение, и найденное за ней принадлежит нашедшему.
 *
 * Три — потому что два читаются как заминка прокрутки, а на четвёртом человек
 * уже уходит, решив, что там и правда ничего нет.
 */

/** Сколько раз надо упереться в дно, прежде чем оно уступит. */
const GLAM_BUMPS = 3;

/**
 * Одно непрерывное движение — один упор.
 *
 * Колесо шлёт десятки событий подряд, палец — сотни; без паузы «три упора»
 * набирались бы за один рывок, и никакого сопротивления человек бы не заметил.
 */
const REARM_MS = 380;

function GlamEasterEgg({
  current,
  onFound,
}: {
  current: StyleId | null;
  onFound: (style: StyleId) => void;
}) {
  const [nearness, setNearness] = useState(0);
  const [bumps, setBumps] = useState(0);
  // Отдача: блок коротко подаётся вверх, как будто в него ткнулись. Без неё
  // упор в дно ничем не отличается от обычного конца страницы.
  const [recoil, setRecoil] = useState(0);
  const anchor = useRef<HTMLDivElement>(null);

  const unlocked = bumps >= GLAM_BUMPS;

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

  // Считаем упоры в дно. Пока не набрали — кнопки в разметке нет вовсе, то есть
  // дно честное: не «прокрутка запрещена», а «страница кончилась».
  useEffect(() => {
    if (unlocked) return;

    let armed = true;
    let rearm: number | undefined;
    let touchFrom: number | null = null;

    function atBottom() {
      const doc = document.documentElement;
      return window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
    }

    function push(down: number) {
      if (down <= 0 || !armed || !atBottom()) return;
      armed = false;
      window.clearTimeout(rearm);
      rearm = window.setTimeout(() => {
        armed = true;
      }, REARM_MS);

      setBumps((count) => count + 1);
      setRecoil((key) => key + 1);
      haptic('tap');
    }

    const onWheel = (event: WheelEvent) => push(event.deltaY);
    const onTouchStart = (event: TouchEvent) => {
      touchFrom = event.touches[0]?.clientY ?? null;
    };
    const onTouchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY;
      if (touchFrom === null || y === undefined) return;
      push(touchFrom - y);
    };
    const onTouchEnd = () => {
      touchFrom = null;
      armed = true;
      window.clearTimeout(rearm);
    };

    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.clearTimeout(rearm);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [unlocked]);

  // Дно уступило — сообщаем об этом ощутимо, а не только картинкой.
  useEffect(() => {
    if (unlocked) haptic('unlock');
  }, [unlocked]);

  const found = current === 'glam';

  return (
    <>
      {/* Полтора экрана намеренной пустоты. */}
      <div style={{ height: '58vh' }} aria-hidden />

      {/* Отдача на упор: блок подаётся вверх и возвращается. key перезапускает
          анимацию на каждом толчке — без него второй упор проходил бы молча. */}
      <div
        key={recoil}
        className={recoil > 0 && !unlocked ? 'glam-recoil' : undefined}
        aria-hidden={!unlocked}
      >
        <div ref={anchor} className="flex flex-col items-center gap-3 pb-16 text-center">
          <div
            style={{
              opacity: nearness,
              transform: `translateY(${(1 - nearness) * 14}px)`,
              transition: 'opacity 0.2s ease, transform 0.2s var(--enter-ease)',
            }}
          >
            {/* До третьего упора здесь нет ни слова.
                Надпись «здесь ничего нет» — это указатель на то, что что-то
                есть: пустое место молчит, а подпись под ним рассказывает. Тайна,
                о которой сообщили, перестаёт быть тайной, и находка достаётся
                не тому, кто её искал, а тому, кто прочитал объявление. */}
            {(found || unlocked) && (
              <p className="mb-3 text-[13px] leading-relaxed text-[var(--text-muted)]">
                {found
                  ? 'Гламур включён. Обратно — любым оформлением выше.'
                  : 'Ну хорошо. Здесь всё-таки кое-что есть.'}
              </p>
            )}

            {/* Кнопки до третьего упора нет в разметке — потому дно и настоящее.
                Спрятать её прозрачностью было бы враньём: страница осталась бы
                той же длины, и человек упирался бы не в дно, а в невидимое. */}
            {unlocked && (
              <button
                type="button"
                onClick={() => {
                  haptic();
                  onFound(found ? DEFAULT_STYLE : 'glam');
                }}
                className="glam-appear rounded-full px-5 py-2.5 text-[14px] font-semibold transition-transform active:scale-95"
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
            )}
          </div>
        </div>
      </div>
    </>
  );
}
