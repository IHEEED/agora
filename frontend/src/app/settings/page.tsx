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
import { RulesSheet, SupportSheet } from '@/components/AboutSheets';
import Link from 'next/link';
import { InvitesPanel } from '@/components/InvitesPanel';
import { useMe } from '@/lib/useMe';
import { SegmentedControl } from '@/components/SegmentedControl';
import { LOCALES, Locale, TranslationKey, applyLocale, useT } from '@/lib/i18n';
import { BackButton } from '@/components/BackButton';

/**
 * Разделы настроек.
 *
 * Сначала были одним свитком: шесть групп подряд, и чтобы дойти от оформления
 * до выхода, надо было проехать мимо уведомлений, приватности и содержимого.
 * Потом дорожкой вкладок наверху — лучше, но вкладки хороши, когда между ними
 * прыгают туда-сюда и сравнивают. В настройки заходят не так: заходят с одним
 * вопросом, находят ответ и уходят.
 *
 * Поэтому здесь то же, что в Telegram и в iOS: сначала список разделов
 * столбиком, нажал — открылся раздел на весь экран, назад — вернулся к списку.
 * Раздел получает экран целиком, а не полосу под шестью таблетками, и его
 * название стоит заголовком, а не подсвеченной кнопкой среди пяти других.
 *
 * Порядок — по частоте: оформление трогают чаще всего, «о приложении» почти
 * никогда.
 */
const SECTIONS = [
  ['appearance', 'settings.appearance', 'M12 3a9 9 0 1 0 0 18c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1a1.5 1.5 0 0 1 1.11-2.5H16a5 5 0 0 0 5-5c0-4.42-4.03-8-9-8Z M7.5 10.5h.01 M10.5 7.5h.01 M14.5 7.5h.01 M17 10.5h.01'],
  ['account', 'settings.account', 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0'],
  // Модерация стоит рядом с аккаунтом, а не внутри него: это не настройка
  // своей учётной записи, а отдельная работа над чужими. Строку видят только
  // модераторы — см. GROUPS ниже и проверку по isModerator при отрисовке.
  ['moderation', 'settings.moderation', 'M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6l-8-3Z M9 12l2 2 4-4'],
  ['notifications', 'settings.notifications', 'M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8 M13.7 21a2 2 0 0 1-3.4 0'],
  ['privacy', 'settings.privacy', 'M12 3 4 6v6c0 5 3.4 8.4 8 9.5 4.6-1.1 8-4.5 8-9.5V6l-8-3Z'],
  ['content', 'settings.content', 'M4 6h16 M4 12h16 M4 18h10'],
  // Язык — свой раздел, а не строка внутри оформления. Оформление про то, как
  // приложение выглядит; язык — про то, на чём оно говорит. Соседство было
  // случайным: и то и другое «настройки вида», но выбирают их по разным
  // поводам и с разной частотой.
  ['language', 'settings.language', 'M4 6h11 M9 3v3 M12.5 18 16 9l3.5 9 M13.6 15.6h4.8 M11 6c0 5-3 8-7 9'],
  ['about', 'settings.about', 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z M12 11v5 M12 8h.01'],
] as const satisfies ReadonlyArray<readonly [string, TranslationKey, string]>;

type SectionId = (typeof SECTIONS)[number][0];

/**
 * Островки в списке разделов.
 *
 * Одним свитком шесть строк читаются перечнем без начала и конца. Разбитые на
 * группы, они начинают отвечать на разные вопросы: первая — «кто я здесь»,
 * вторая — «как приложение себя ведёт», третья — про само приложение.
 *
 * Пустое место между группами и есть разделитель: линия внутри списка ещё
 * одна деталь на экране, а промежуток не рисует ничего и читается сразу.
 */
/**
 * Цвет значка у раздела.
 *
 * В списке из шести одинаковых строк глаз ищет нужную по первому слову, то
 * есть читает все шесть. Цвет опознаётся раньше слова: «синий сверху» находят
 * не читая, и со второго захода человек уже не читает вовсе.
 *
 * Значения — из палитры темы, а не зашитые числа. В «Хронике» и «Полночи»
 * палитры разные, и жёстко заданный синий выпал бы из обеих; здесь же цвета
 * поедут вместе с оформлением.
 */
/**
 * Цвет плитки у раздела.
 *
 * Из отдельной палитры (--tint-*), а не из темы, и это принципиально: в iOS и
 * Telegram цвет плитки — метка места. Синий квадратик значит «аккаунт», и его
 * находят боковым зрением, не читая подписи. Меняйся он вместе с оформлением,
 * метка перестала бы работать.
 *
 * Раньше цвета брались из палитры: --accent доставался сразу двум разделам
 * (различать их было нечем), --up и --down — разделам, к голосам отношения не
 * имеющим, а «о приложении» получал --text-muted, то есть серый на сером. В
 * тёмной теме это читалось как «значки забыли покрасить».
 *
 * Соседние по списку не должны совпадать: цвет различает строки, а два
 * одинаковых квадрата подряд не различают ничего.
 */
const SECTION_TINT: Record<SectionId, string> = {
  account: 'var(--tint-green)',
  privacy: 'var(--tint-blue)',
  // Красный — единственное место, где он уместен: работа над чужими границами.
  moderation: 'var(--tint-pink)',
  notifications: 'var(--tint-red)',
  content: 'var(--tint-orange)',
  language: 'var(--tint-teal)',
  appearance: 'var(--tint-purple)',
  // Серый — тоже решение, а не отсутствие решения: «о приложении» открывают
  // реже всего, и выделяться ему незачем.
  about: 'var(--tint-gray)',
};

/**
 * Островки в списке разделов.
 *
 * Первая группа — про человека и его границы: чем он входит, кого пускает,
 * и (если он модератор) чужие границы тоже. Вторая — про поведение приложения:
 * когда оно шумит, что показывает, как выглядит. Третья — про само приложение.
 *
 * Порядок внутри группы задаётся здесь, а не порядком в SECTIONS: это два
 * разных вопроса, и связывать их значило бы менять раскладку экрана каждый
 * раз, когда в список добавляют раздел.
 */
const GROUPS: ReadonlyArray<ReadonlyArray<SectionId>> = [
  ['account', 'privacy', 'moderation'],
  ['notifications', 'content', 'appearance', 'language'],
  ['about'],
];

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
  /** Открытый раздел; null — список разделов. */
  const [section, setSection] = useState<SectionId | null>(null);
  const [rules, setRules] = useState(false);
  const [support, setSupport] = useState(false);
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
          <BackButton onClick={() => {
              // Одна стрелка на два уровня: из раздела она возвращает к списку,
              // из списка выводит из настроек. Заводить вторую кнопку «к
              // разделам» значило бы объяснять человеку разницу между двумя
              // стрелками, стоящими в одном углу.
              if (section) {
                haptic();
                setSection(null);
                return;
              }
              goBack();
            }} />
          {/* Заголовок называет то, что на экране. В разделе это его имя, а не
              слово «Настройки»: иначе шесть разных экранов подписаны одинаково,
              и по заголовку не понять, где ты. */}
          <ScreenTitle>
            {section
              ? t(SECTIONS.find(([id]) => id === section)![1])
              : t('settings.title')}
          </ScreenTitle>
        </div>

        {/* Список разделов. Показан, пока раздел не выбран.
            Строки той же группой, что и всё остальное в настройках (ios-group):
            раздел — такая же строка списка, как «Почта» или «Уведомления»,
            только ведёт не к значению, а вглубь. Галочка справа говорит об этом
            без слов. */}
        {!section && (
          <div className="settings-slide-back flex flex-col gap-5">
            {GROUPS.map((group, groupIndex) => (
            <div key={groupIndex} className="ios-group">
            {group
              .map((wanted) => SECTIONS.find(([id]) => id === wanted))
              .filter((entry) => entry !== undefined)
              .map(([id, labelKey, path]) => {
              // Модерация — не всем. Проверка настоящая на сервере, здесь
              // только «не показывать того, чего человек всё равно не откроет».
              if (id === 'moderation' && !me?.isModerator) return null;
              return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  haptic();
                  setSection(id);
                  // Раздел открывается сверху, а не с той высоты, на которой
                  // остался список: экран новый, и начинаться он обязан с
                  // начала.
                  window.scrollTo({ top: 0 });
                }}
                className="ios-row flex w-full items-center gap-3 text-left transition-colors active:bg-[var(--surface-2)]"
              >
                <span
                  // Заливка цветом и белый знак поверх — как в Telegram. Бледная
                  // подложка одного акцента на все шесть строк не различала их
                  // вовсе: цвет был, а толку от него не было.
                  className="flex h-[29px] w-[29px] flex-none items-center justify-center rounded-[8px]"
                  style={{ background: SECTION_TINT[id], color: '#fff' }}
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    {path.split(' M').map((piece, index) => (
                      <path key={index} d={index === 0 ? piece : `M${piece}`} />
                    ))}
                  </svg>
                </span>
                <span className="flex-1 text-[16px] text-[var(--text)]">{t(labelKey)}</span>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </button>
              );
            })}
            </div>
            ))}
          </div>
        )}

        {/* Раздел въезжает справа, как новый экран, а не подменяет содержимое
            на месте. Ключ по разделу перезапускает движение на каждом входе:
            без него React считает контейнер тем же самым и второй раздел
            открывается беззвучно — как будто список просто перерисовался. */}
        {section && (
          <div key={section} className="settings-slide-in flex flex-col gap-2.5">
          {section === 'appearance' && (
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


          </section>
          )}

          {section === 'account' && (
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
          </Section>

          )}

          {section === 'moderation' && me?.isModerator && (
          <Section>
            {/* Сам разбор живёт на отдельном экране, а не здесь: это рабочее
                место с очередью и решениями, а настройки — место, где двигают
                переключатели. Здесь только дверь. */}
            <Row label="Разбор жалоб" hint="Очередь и баны">
              <Link
                href="/moderation"
                className="flex-none rounded-full px-4 py-1.5 text-[13px] font-medium"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                Открыть
              </Link>
            </Row>
            {/* Подтверждение — отдельной строкой, а не внутри разбора жалоб.
                Это разная работа: жалобы приходят сами и требуют решения, а
                галочку выдают по чьей-то просьбе, зная ник заранее. */}
            <Row label="Подтверждение личности" hint="Галочки и заявки">
              <Link
                href="/moderation/verification"
                className="flex-none rounded-full px-4 py-1.5 text-[13px] font-medium"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                Открыть
              </Link>
            </Row>
          </Section>
          )}

          {section === 'language' && (
          <Section>
            {/* Строки, а не дорожка из трёх таблеток. Языков может стать
                больше, и таблетки при этом сожмутся до нечитаемых; строка со
                значком выбора растёт вниз и остаётся собой. Так же это
                устроено в iOS. */}
            {LOCALES.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => chooseLocale(option.id)}
                className="ios-row flex w-full items-center gap-3 text-left transition-colors active:bg-[var(--surface-2)]"
              >
                <span className="flex-1 text-[16px] text-[var(--text)]">{option.label}</span>
                {locale === option.id && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                    <path d="M4 12.5 9 17.5 20 6.5" />
                  </svg>
                )}
              </button>
            ))}
          </Section>
          )}

          {section === 'notifications' && (
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

          {section === 'privacy' && (
          <Section>
            <Row label={t('settings.privateProfile')} hint={t('settings.privateProfileHint')}>
              <LocalToggle storageKey="parafraz-private-profile" />
            </Row>
            <Row label={t('settings.showInfluence')} hint={t('settings.showInfluenceHint')}>
              <LocalToggle storageKey="parafraz-show-influence" defaultOn />
            </Row>
          </Section>

          )}

          {section === 'content' && (
          <Section>
            <Row label={t('settings.nsfw')} hint={t('settings.nsfwHint')}>
              <LocalToggle storageKey="parafraz-nsfw" />
            </Row>
            <Row label={t('settings.autoplay')} hint={t('settings.autoplayHint')}>
              <LocalToggle storageKey="parafraz-autoplay" defaultOn />
            </Row>
          </Section>

          )}

          {section === 'about' && (
          <Section>
            <Row label={t('settings.version')} hint={t('settings.versionHint')} />
            {/* Обе строки стояли с подписью «Скоро» — то есть приложение
                признавалось, что правил у него нет, а спросить не у кого. Для
                закрытой сети по приглашениям это хуже, чем кажется: человек
                пришёл по чьему-то коду, и первое, что он хочет понять, — куда
                попал и что здесь принято. */}
            <button
              type="button"
              onClick={() => {
                haptic();
                setRules(true);
              }}
              className="ios-row flex w-full items-center gap-3 text-left transition-colors active:bg-[var(--surface-2)]"
            >
              <span className="flex-1 text-[16px] text-[var(--text)]">{t('settings.rules')}</span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                haptic();
                setSupport(true);
              }}
              className="ios-row flex w-full items-center gap-3 text-left transition-colors active:bg-[var(--surface-2)]"
            >
              <span className="flex-1 text-[16px] text-[var(--text)]">{t('settings.support')}</span>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                <path d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </Section>
          )}

          {/* Выход стоит в «аккаунте», а не под всеми разделами.
              Общий низ у настроек кончился вместе с общим свитком, и красная
              кнопка, висящая под уведомлениями или под содержимым, читалась бы
              как их итог. Выход — действие над учётной записью, и жить ему там,
              где всё остальное про неё. */}
          {section === 'account' && (
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

          <RulesSheet open={rules} onClose={() => setRules(false)} />
        <SupportSheet open={support} onClose={() => setSupport(false)} />

        {/* Оговорка про местное хранение — там, где рассказывают о приложении.
              Под каждым разделом она была бы шестикратным повтором. */}
          {section === 'about' && (
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
          </div>
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
  const { t } = useT();
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
                  ? t('egg.found')
                  : t('egg.almost')}
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
                {found ? t('egg.enough') : t('egg.take')}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
