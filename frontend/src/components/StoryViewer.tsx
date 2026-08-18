'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { formatCompactAge } from '@/lib/formatDate';
import { StoryGroup, StoryItem } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** Сколько держится один кадр, если его не пролистали. */
const FRAME_MS = 5000;

/** Как часто двигаем полоску. Шестьдесят кадров тут не нужны — хватает тридцати. */
const TICK_MS = 32;

/**
 * Кадр истории.
 *
 * Не просто картинка. Картинка есть не у каждой записи, а у той, что есть, она
 * лежит фоном под текстом — сама по себе фотография ничего не рассказывает, а
 * история должна что-то сказать за пять секунд. Поэтому главное в кадре —
 * заголовок газетной антиквой, крупно; ниже начало текста. Фон, когда снимка
 * нет, — градиент из акцента: не пустота и не серая плита.
 */
function Frame({ item }: { item: StoryItem }) {
  return (
    <div className="relative flex h-full w-full flex-col justify-end overflow-hidden">
      {item.images[0] ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- источник произвольный */}
          <img
            src={item.images[0]}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Затемнение снизу: текст поверх фотографии читается только так, и
              градиент лучше плашки — он не режет кадр пополам. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 38%, rgba(0,0,0,0.05) 70%)',
            }}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg,
              color-mix(in srgb, var(--accent) 82%, #000000),
              color-mix(in srgb, var(--accent) 34%, #000000) 58%,
              #0b0a09)`,
          }}
        />
      )}

      <div className="relative flex flex-col gap-3 p-6 pb-16">
        <h2
          className="display-type text-[27px] leading-[1.12] text-white"
          style={{ textShadow: '0 2px 24px rgba(0,0,0,0.5)' }}
        >
          {item.title ?? item.body}
        </h2>
        {item.title && item.body && (
          <p className="line-clamp-4 text-[14.5px] leading-relaxed text-white/80">{item.body}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Просмотр историй: кадры, полоски прогресса, переход нажатием по краям.
 *
 * Устроено как в Instagram и Telegram, потому что этот язык уже выучен: полоски
 * сверху говорят, сколько осталось; нажатие справа — вперёд, слева — назад;
 * удержание останавливает время. Придумывать здесь своё значило бы заставить
 * человека учиться заново ради того же самого.
 */
export function StoryViewer({
  stories,
  index,
  origin,
  onIndex,
  onClose,
}: {
  stories: StoryGroup[];
  /** Какая история открыта. −1 — закрыто. */
  index: number;
  /** Кружок, по которому нажали, — из него история и вырастает. */
  origin?: DOMRect | null;
  onIndex: (next: number) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const open = index >= 0 && index < stories.length;
  const story = open ? stories[index] : null;

  /**
   * Закрытие — обратный ход разворота: история складывается в тот же кружок.
   *
   * Уходила она до сих пор мгновенно: onClose снимал разметку в тот же кадр, и
   * полноэкранный кадр просто пропадал. Открытие при этом было длинным и
   * подробным — несимметрично настолько, что закрытие читалось сбоем.
   *
   * Анимируем живую панель и только потом сообщаем наверх: пока идёт уход,
   * история ещё смонтирована, и складываться есть чему.
   */
  const closing = useRef(false);
  const closeSmoothly = useCallback(() => {
    const panel = panelRef.current;
    if (closing.current) return;
    if (!panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose();
      return;
    }
    closing.current = true;

    const to = origin;
    const box = panel.getBoundingClientRect();
    // Некуда складываться (пришли не из кружка) — просто гаснем на месте.
    const frames: Keyframe[] = to
      ? [
          { transform: 'none', borderRadius: '0px', opacity: 1 },
          {
            transform: `translate(${to.left + to.width / 2 - (box.left + box.width / 2)}px, ${
              to.top + to.height / 2 - (box.top + box.height / 2)
            }px) scale(${Math.max(to.width / box.width, to.height / box.height)})`,
            borderRadius: '50%',
            opacity: 0.2,
          },
        ]
      : [
          { transform: 'none', opacity: 1 },
          { transform: 'scale(0.92)', opacity: 0 },
        ];

    const animation = panel.animate(frames, {
      duration: 260,
      easing: 'cubic-bezier(0.4, 0, 1, 1)',
      fill: 'forwards',
    });
    animation.onfinish = () => {
      closing.current = false;
      onClose();
    };
  }, [origin, onClose]);

  const [frame, setFrame] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  /**
   * С какой доли кадра продолжать отсчёт.
   *
   * Удержание останавливает время, а останавливается оно снятием таймера — то
   * есть эффект пересобирается, и локальный счётчик в нём начинается заново.
   * Без этого значения полоска после отпускания прыгала бы к началу кадра.
   */
  const [resumeFrom, setResumeFrom] = useState(0);

  // Новая история — с первого кадра. Правим в рендере, а не эффектом: иначе
  // между сменой истории и сбросом кадра проходит лишняя отрисовка, в которой
  // видно чужой кадр.
  const [lastIndex, setLastIndex] = useState(index);
  if (lastIndex !== index) {
    setLastIndex(index);
    setFrame(0);
    setProgress(0);
    setResumeFrom(0);
  }

  const total = story?.items.length ?? 0;

  /** Вперёд: следующий кадр, а кончились — следующая история. */
  const next = useCallback(() => {
    if (!story) return;
    if (frame + 1 < total) {
      setFrame(frame + 1);
      setProgress(0);
      setResumeFrom(0);
      return;
    }
    if (index + 1 < stories.length) {
      onIndex(index + 1);
      return;
    }
    closeSmoothly();
  }, [story, frame, total, index, stories.length, onIndex, onClose]);

  const back = useCallback(() => {
    if (frame > 0) {
      setFrame(frame - 1);
      setProgress(0);
      setResumeFrom(0);
      return;
    }
    if (index > 0) onIndex(index - 1);
  }, [frame, index, onIndex]);

  // Время кадра. Полоска едет сама, и когда доезжает — листаем.
  //
  // Счётчик локальный, а не в состоянии: листать надо в тот момент, когда он
  // дошёл до единицы, и знать это должен тот же код, что его двигает. Отдельный
  // эффект «progress дошёл — листаем» был бы вызовом setState прямо в теле
  // эффекта, то есть лишним каскадом отрисовок на каждый тик.
  useEffect(() => {
    if (!open || held) return;
    let value = resumeFrom;
    const timer = window.setInterval(() => {
      value += TICK_MS / FRAME_MS;
      if (value >= 1) {
        window.clearInterval(timer);
        next();
        return;
      }
      setProgress(value);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [open, held, frame, index, resumeFrom, next]);

  // Отмечаем кадр просмотренным. Кружок гаснет у того, кто посмотрел, и
  // остаётся ярким у остальных — ради этого в базе пара (история, зритель), а
  // не счётчик. Ошибку глушим: непоставленная отметка стоит дешевле, чем
  // сообщение об ошибке поверх истории.
  const shown = story?.items[Math.min(frame, Math.max(0, total - 1))]?.id;
  useEffect(() => {
    if (!open || !shown) return;
    apiFetch(`/stories/${shown}/seen`, { method: 'POST' }).catch(() => undefined);
  }, [open, shown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSmoothly();
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, next, back]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /**
   * История вырастает из своего кружка, как в Telegram.
   *
   * Не «появляется затемнение и в нём кадр», а именно вырастает: кружок в ленте
   * и полноэкранная история — одно и то же, просто в двух размерах, и движение
   * между ними обязано это показать. Иначе человек теряет, откуда он пришёл, и
   * закрытие каждый раз оказывается неожиданностью.
   *
   * Считаем масштаб от кружка к панели и запускаем обратный путь: из маленького
   * в натуральную величину. Скругление едет вместе с масштабом — круг
   * распрямляется в прямоугольник экрана.
   */
  const panelRef = useRef<HTMLDivElement>(null);

  // Зависимости — открытость и сама рамка. Рамку ставит нажатие по кружку и
  // больше её никто не трогает, поэтому переход к следующей истории внутри
  // просмотра эффект не перезапускает: разворот положен один, на открытие.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const from = origin;
    if (!open || !panel || !from) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const to = panel.getBoundingClientRect();
    if (!to.width || !to.height) return;

    const scale = Math.max(from.width / to.width, from.height / to.height);
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);

    panel.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scale(${scale})`,
          borderRadius: '50%',
          opacity: 0.35,
        },
        { transform: 'none', borderRadius: '0px', opacity: 1 },
      ],
      { duration: 320, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
  }, [open, origin]);

  // Свайп вниз закрывает — так же, как в просмотрщике картинок.
  const from = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  if (!mounted || !story) return null;

  const item = story.items[Math.min(frame, total - 1)];
  const dismiss = Math.min(1, dragY / 220);

  return createPortal(
    <div
      className="fixed inset-0 z-[96] flex items-center justify-center"
      style={{
        background: `rgba(6, 5, 4, ${0.96 - dismiss * 0.5})`,
        animation: 'image-viewer-in 180ms ease',
      }}
      onPointerDown={(event) => {
        from.current = event.clientY;
        // Палец на экране — время стоит. Запоминаем, докуда дошли: таймер
        // снимается вместе с эффектом, и продолжать он будет с этого места.
        setResumeFrom(progress);
        setHeld(true);
      }}
      onPointerMove={(event) => {
        if (from.current === null) return;
        setDragY(Math.max(0, event.clientY - from.current));
      }}
      onPointerUp={(event) => {
        const start = from.current;
        from.current = null;
        setHeld(false);
        const moved = dragY;
        setDragY(0);
        if (start === null) return;
        if (moved > 110) return closeSmoothly();
        // Не потащили — значит нажали. Правая треть вперёд, левая назад:
        // палец чаще всего справа, поэтому вперёд отдана большая доля.
        if (moved < 8) {
          const x = event.clientX;
          if (x < window.innerWidth * 0.28) back();
          else next();
        }
      }}
      onPointerCancel={() => {
        from.current = null;
        setHeld(false);
        setDragY(0);
      }}
    >
      <div
        ref={panelRef}
        className="relative w-full overflow-hidden bg-black sm:max-w-[420px] sm:rounded-3xl"
        style={{
          height: '100%',
          maxHeight: '100vh',
          transform: `translateY(${dragY}px) scale(${1 - dismiss * 0.1})`,
          // Пока палец на экране — без перехода, иначе кадр отстаёт от руки.
          // Читаем held, а не ref: значение ref в отрисовке недоступно, да и
          // менять её оно не заставляет.
          transition: held ? 'none' : 'transform 240ms cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <Frame item={item} />

        {/* Полоски по числу кадров. Пройденные залиты целиком, текущая едет,
            будущие приглушены — состояние читается одним взглядом. */}
        <div
          className="absolute inset-x-3 flex gap-1"
          style={{ top: 'calc(10px + env(safe-area-inset-top))' }}
        >
          {story.items.map((item, position) => (
            <span
              key={item.id}
              className="h-[2.5px] flex-1 overflow-hidden rounded-full"
              style={{ background: 'rgba(255,255,255,0.28)' }}
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width:
                    position < frame ? '100%' : position === frame ? `${progress * 100}%` : '0%',
                  background: 'rgba(255,255,255,0.95)',
                  transition: position === frame ? `width ${TICK_MS}ms linear` : 'none',
                }}
              />
            </span>
          ))}
        </div>

        <div
          className="absolute inset-x-3 flex items-center gap-2.5"
          style={{ top: 'calc(22px + env(safe-area-inset-top))' }}
        >
          <DefaultAvatar name={story.author.username} size={30} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
            {story.author.username}
          </span>
          <span className="text-[12.5px] text-white/60">{formatCompactAge(item.created_at)}</span>
          <button
            onClick={(event) => {
              event.stopPropagation();
              closeSmoothly();
            }}
            aria-label="Закрыть"
            className="-mr-1 flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/85"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {/* Ссылка на саму запись: история — витрина, а обсуждение живёт в ленте.
            Ниже кадра, поверх затемнения, и нажатие по ней не листает. */}
        {item.postId && (
        <Link
          href={`/posts/${item.postId}`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-medium text-white"
          style={{
            bottom: 'calc(16px + env(safe-area-inset-bottom))',
            background: 'rgba(255,255,255,0.16)',
            backdropFilter: 'blur(14px)',
          }}
        >
          {t('story.readFull')}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Link>
        )}
      </div>
    </div>,
    document.body
  );
}
