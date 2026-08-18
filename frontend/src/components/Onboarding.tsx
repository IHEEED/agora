'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export const ONBOARDING_STORAGE_KEY = 'parafraz-onboarding-seen';

/**
 * Приветственные страницы — то, что человек видит один раз, войдя впервые.
 *
 * Объясняют они не кнопки, а устройство: чем клуб отличается от профиля,
 * почему у поста нет заголовка и что такое influence. Подписи к кнопкам
 * человек прочтёт и сам, а вот догадаться, что запись можно опубликовать «в
 * клуб», а не только «у себя», по одному виду ленты нельзя.
 *
 * Показываем после входа, а не до: до входа объяснять нечего, человек ещё не
 * решил, останется ли он. Отметку о просмотре держим на устройстве — таблицы
 * под неё в базе нет, а заводить её ради одного булева значения на человека
 * преждевременно.
 */
type Page = {
  key: string;
  title: string;
  body: string;
  art: React.ReactNode;
};

/**
 * Картинки рисуем здесь же, а не тянем файлами: это четыре простых схемы из
 * кругов и прямоугольников, и в SVG они перекрашиваются вместе с темой.
 * Растровая картинка на тёплой бумаге «Хроники» и на чёрном «Ателье» выглядела
 * бы двумя разными картинками, из которых одна — чужая.
 */
function Art({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 200 130"
      className="w-full"
      style={{ maxHeight: 170 }}
      fill="none"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const PAGES: Page[] = [
  {
    key: 'downvote',
    title: 'Здесь можно не согласиться',
    body:
      'У каждой записи две стрелки, а не одно сердце. Несогласие — тоже ответ: ' +
      'спорную запись не заминусуют молча, её придут обсудить.',
    art: (
      <Art>
        <rect x="30" y="30" width="140" height="70" rx="14" fill="var(--surface-2)" />
        {/* Две стрелки навстречу друг другу: та самая пара, которой нет в
            лентах с одним сердцем. */}
        <path d="M74 74V50" stroke="var(--up)" strokeWidth="3.2" strokeLinecap="round" />
        <path
          d="m66 58 8-8 8 8"
          stroke="var(--up)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M126 50v24" stroke="var(--down)" strokeWidth="3.2" strokeLinecap="round" />
        <path
          d="m118 66 8 8 8-8"
          stroke="var(--down)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M100 42v40" stroke="var(--text)" strokeOpacity="0.12" strokeWidth="2" />
      </Art>
    ),
  },
  {
    key: 'clubs',
    title: 'Клубы — это про темы',
    body:
      'Запись можно оставить у себя, а можно отправить в клуб — туда, где о ней уже говорят. ' +
      'Вступать никуда не нужно: писать можно в любой клуб, который это разрешает.',
    art: (
      <Art>
        <circle cx="100" cy="30" r="13" fill="var(--accent)" opacity="0.85" />
        <path d="M100 45v18" stroke="var(--text)" strokeOpacity="0.3" strokeWidth="2.5" />
        <path
          d="M100 63H44v14M100 63h56v14M100 63v14"
          stroke="var(--text)"
          strokeOpacity="0.3"
          strokeWidth="2.5"
        />
        <rect x="24" y="80" width="40" height="26" rx="9" fill="var(--surface-2)" />
        <rect x="80" y="80" width="40" height="26" rx="9" fill="var(--surface-2)" />
        <rect x="136" y="80" width="40" height="26" rx="9" fill="var(--surface-2)" />
        <rect x="34" y="91" width="20" height="5" rx="2.5" fill="var(--text)" opacity="0.35" />
        <rect x="90" y="91" width="20" height="5" rx="2.5" fill="var(--text)" opacity="0.35" />
        <rect x="146" y="91" width="20" height="5" rx="2.5" fill="var(--text)" opacity="0.35" />
      </Art>
    ),
  },
  {
    key: 'chain',
    title: 'Мысли не хватило поста',
    body:
      'Свою запись можно продолжить — она уйдёт «вслед» за предыдущей и встанет под ней, ' +
      'а не отдельным постом в ленте. Одна мысль остаётся одной, даже если ей нужно три захода.',
    art: (
      <Art>
        {/* Одна запись и два продолжения под ней, связанные линией. */}
        <rect x="34" y="14" width="132" height="26" rx="9" fill="var(--surface-2)" />
        <rect x="46" y="24" width="76" height="5" rx="2.5" fill="var(--text)" opacity="0.45" />
        <path
          d="M40 46v14a6 6 0 0 0 6 6h6M40 46v40a6 6 0 0 0 6 6h6"
          stroke="var(--accent)"
          strokeOpacity="0.5"
          strokeWidth="2"
          fill="none"
        />
        <rect x="58" y="54" width="108" height="24" rx="8" fill="var(--surface-2)" />
        <rect x="68" y="63" width="58" height="5" rx="2.5" fill="var(--text)" opacity="0.3" />
        <rect x="58" y="80" width="108" height="24" rx="8" fill="var(--surface-2)" />
        <rect x="68" y="89" width="44" height="5" rx="2.5" fill="var(--text)" opacity="0.3" />
      </Art>
    ),
  },
  {
    key: 'influence',
    title: 'Influence вместо лайков',
    body:
      'За запись голосуют «за» и «против», а разница копится в influence — счётчик в вашем профиле. ' +
      'Он показывает не популярность, а то, насколько написанное пригодилось другим.',
    art: (
      <Art>
        <path d="M100 22v34" stroke="var(--up)" strokeWidth="3.5" strokeLinecap="round" />
        <path
          d="m88 34 12-12 12 12"
          stroke="var(--up)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="40" y="68" width="120" height="38" rx="12" fill="var(--surface-2)" />
        <rect x="56" y="80" width="44" height="7" rx="3.5" fill="var(--accent)" opacity="0.8" />
        <rect x="56" y="93" width="70" height="5" rx="2.5" fill="var(--text)" opacity="0.25" />
      </Art>
    ),
  },
  {
    key: 'style',
    title: 'Соберите под себя',
    body:
      'В настройках пять готовых оформлений — от тёплой бумаги до монохрома. ' +
      'Меняется всё целиком и сразу: фон, цвета, шрифт заголовков. Подбирать ' +
      'по частям ничего не нужно.',
    art: (
      <Art>
        <rect x="18" y="34" width="52" height="62" rx="12" fill="#faf7f2" />
        <circle cx="44" cy="76" r="9" fill="#bf5b38" />
        <rect x="74" y="34" width="52" height="62" rx="12" fill="#12151c" />
        <circle cx="100" cy="76" r="9" fill="#86a8ff" />
        <rect x="130" y="34" width="52" height="62" rx="12" fill="#f5f7f1" />
        <circle cx="156" cy="76" r="9" fill="#4a6b3a" />
        <rect x="30" y="48" width="28" height="5" rx="2.5" fill="#211e19" opacity="0.45" />
        <rect x="86" y="48" width="28" height="5" rx="2.5" fill="#eaeef5" opacity="0.55" />
        <rect x="142" y="48" width="28" height="5" rx="2.5" fill="#191d15" opacity="0.45" />
      </Art>
    ),
  },
];

export function Onboarding() {
  const [page, setPage] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [done, setDone] = useState(false);

  // Читаем отметку снимком, а не setState в эффекте: у сервера и браузера
  // снимки разные по построению, поэтому разметка не расходится.
  const seen = useSyncExternalStore(
    () => () => {},
    () => window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1',
    // На сервере считаем, что видел: иначе приветствие мигало бы на секунду
    // у всех, кто его давно закрыл.
    () => true
  );

  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const open = mounted && !seen && !done;

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  function finish() {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    setLeaving(true);
    // Ждём анимацию ухода, иначе приветствие пропадает в тот же кадр.
    // Заодно даём приложению под ним знать, что сейчас оно откроется: класс на
    // <html> запускает .app-reveal, и лента не просто оказывается на экране, а
    // выходит из-под уходящего приветствия.
    document.documentElement.classList.add('app-revealing');
    window.setTimeout(() => {
      setDone(true);
      // Класс снимаем после того, как анимация отыграла: он одноразовый и не
      // должен влиять на последующие переходы.
      window.setTimeout(() => {
        document.documentElement.classList.remove('app-revealing');
      }, 700);
    }, 260);
  }

  function next() {
    if (page < PAGES.length - 1) setPage((n) => n + 1);
    else finish();
  }

  if (!open) return null;

  const current = PAGES[page];
  const last = page === PAGES.length - 1;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Знакомство с PARAFRAZ"
      className="fixed inset-0 z-[90] flex flex-col items-center justify-between px-6"
      style={{
        background: 'var(--bg)',
        opacity: leaving ? 0 : 1,
        // Приветствие уходит вверх и наружу, как поднятая крышка, — под ним
        // видно приложение, которое в это же время встаёт на место. Дольше
        // обычного ухода: это единственный переход, который человек видит один
        // раз в жизни, и торопиться ему некуда.
        transform: leaving ? 'scale(1.06) translateY(-2%)' : 'none',
        transition: 'opacity 260ms ease, transform 320ms var(--exit-ease)',
        paddingTop: 'calc(48px + env(safe-area-inset-top))',
        paddingBottom: 'calc(28px + env(safe-area-inset-bottom))',
      }}
    >
      {/* Пропустить — всегда на виду. Приветствие, из которого нельзя выйти,
          читается не как рассказ, а как условие входа. */}
      <div className="flex w-full max-w-md justify-end">
        <button
          type="button"
          onClick={finish}
          className="rounded-full px-3 py-1.5 text-[13.5px] font-medium text-[var(--text-muted)] transition-colors active:bg-[var(--surface-2)]"
        >
          Пропустить
        </button>
      </div>

      {/* Страница целиком перерисовывается по key: React считает её новым
          узлом, и анимация появления проигрывается на каждом развороте. */}
      <div key={current.key} className="page-enter flex w-full max-w-md flex-col items-center gap-7">
        {current.art}

        <div className="flex flex-col gap-3 text-center">
          <h2 className="display-type text-[26px] leading-tight text-[var(--text)]">
            {current.title}
          </h2>
          <p className="text-[15px] leading-relaxed text-[var(--text-muted)]">{current.body}</p>
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-5">
        {/* Точки — и указатель места, и переход: по ним нажимают, когда хотят
            вернуться на разворот назад. */}
        <div className="flex items-center gap-2">
          {PAGES.map((item, index) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPage(index)}
              aria-label={`Страница ${index + 1}`}
              aria-current={index === page}
              className="h-2 rounded-full transition-all"
              style={{
                width: index === page ? 20 : 8,
                background: index === page ? 'var(--accent)' : 'var(--border)',
                transitionDuration: '0.3s',
                transitionTimingFunction: 'var(--enter-ease)',
              }}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={next}
          className="w-full rounded-full py-3.5 text-[15px] font-semibold transition-transform active:scale-[0.98]"
          style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
        >
          {last ? 'Начать' : 'Дальше'}
        </button>
      </div>
    </div>,
    document.body
  );
}
