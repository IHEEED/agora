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
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { formatCompactAge } from '@/lib/formatDate';
import { StoryGroup, StoryItem } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { haptic } from '@/lib/haptics';
import { setStoriesHidden, useAreStoriesHidden } from '@/lib/hiddenStories';
import { BottomSheet } from '@/components/BottomSheet';
import { useRouter } from 'next/navigation';

/**
 * Разворот из кружка и складывание обратно.
 *
 * Одно число на оба конца: открытие и закрытие — это один и тот же путь, просто
 * пройденный в разные стороны, и разная длительность превращала бы возврат в
 * другое движение. Сто двадцать миллисекунд — у самой границы, за которой глаз
 * перестаёт видеть путь и видит подмену кадра; здесь путь ещё читается, но
 * ждать его уже не приходится.
 *
 * Прежние 320 на вход и 260 на выход были той самой «долгой» анимацией: история
 * открывается по нажатию на кружок, и всё, что дольше трети секунды, стоит
 * между нажатием и тем, ради чего нажимали.
 */
const STORY_MORPH_MS = 120;

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

      {/* Низ отдан подписи. Прежние pb-16 держали место под ряд из шести
          кнопок; теперь внизу одна полоса ответа, и текст может дышать. */}
      <div className="relative flex flex-col gap-2.5 p-6 pb-24">
        <h2
          // 27 пикселей заголовок съедал кадр: на трёх строках от фотографии
          // оставалась полоска сверху. Здесь заголовок — не витрина, а подпись
          // к картинке, и главным должен быть кадр.
          className="display-type text-[21px] leading-[1.15] text-white"
          style={{ textShadow: '0 2px 24px rgba(0,0,0,0.5)' }}
        >
          {item.title ?? item.body}
        </h2>
        {item.title && item.body && (
          <p className="line-clamp-6 text-[14.5px] leading-relaxed text-white/80">{item.body}</p>
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
  onCompose,
}: {
  stories: StoryGroup[];
  /** Какая история открыта. −1 — закрыто. */
  index: number;
  /** Кружок, по которому нажали, — из него история и вырастает. */
  origin?: DOMRect | null;
  onIndex: (next: number) => void;
  onClose: () => void;
  /** Открыть редактор истории с этим кадром. Без него репост не предлагаем. */
  onCompose?: (item: StoryItem) => void;
}) {
  const { t } = useT();
  const router = useRouter();
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
      duration: STORY_MORPH_MS,
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
  /** Открыт ли ввод ответа. Пока открыт — время кадра стоит. */
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const replyRef = useRef<HTMLInputElement>(null);
  /**
   * Голос, а не «нравится».
   *
   * Сердце в истории было чужой механикой: во всём остальном приложении у записи
   * две стрелки, и несогласие — такой же ответ, как согласие. История — окно в
   * запись, значит и голосовать в ней надо тем же способом, иначе получается,
   * что из ленты запись можно заминусовать, а из истории только похвалить.
   */
  const [vote, setVote] = useState<1 | -1 | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const hidden = useAreStoriesHidden(story?.author.id);

  /**
   * Ответить автору, не покидая историю.
   *
   * Раньше кнопка уводила в переписку: история закрывалась, экран менялся,
   * человек оказывался в списке чужих реплик — и ту мысль, ради которой он
   * нажал, по дороге терял. Ответ на историю живёт минуту и относится к
   * конкретному кадру; уводить за ним на другой экран — всё равно что просить
   * выйти в коридор, чтобы сказать слово.
   *
   * Отправляем в личные, как и раньше: письмо приходит обычной репликой. Кадр
   * при этом стоит на паузе, а после отправки строка на секунду говорит
   * «отправлено» и уступает место обычной полосе.
   */
  async function sendReply() {
    const text = replyText.trim();
    if (!text || replyBusy || !story?.author.id) return;
    setReplyBusy(true);
    try {
      await apiFetch('/messages', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: story.author.id, body: text }),
      });
      setReplyText('');
      setReplySent(true);
      haptic();
      window.setTimeout(() => {
        setReplySent(false);
        setReplying(false);
      }, 1400);
    } catch {
      // Молча: сообщение об ошибке поверх чужой истории — не то место, где его
      // будут читать. Текст остаётся в поле, отправку можно повторить.
    } finally {
      setReplyBusy(false);
    }
  }

  function castVote(postId: string, value: 1 | -1) {
    haptic();
    // Повторное нажатие по своей же стрелке снимает голос — как и в ленте.
    const next = vote === value ? null : value;
    setVote(next);
    apiFetch('/votes', {
      method: 'POST',
      body: JSON.stringify({ post_id: postId, value: next ?? value }),
    }).catch(() => setVote(vote));
  }

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
    // Пока пишут ответ — время стоит. Иначе история улистывается из-под
    // человека, который как раз набирает про неё реплику, и отправлено будет
    // уже не о том кадре.
    if (!open || held || replying) return;
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
  }, [open, held, replying, frame, index, resumeFrom, next]);

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
      { duration: STORY_MORPH_MS, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
  }, [open, origin]);

  // Свайп вниз закрывает — так же, как в просмотрщике картинок.
  const from = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);

  if (!mounted || !story) return null;

  const item = story.items[Math.min(frame, total - 1)];
  const dismiss = Math.min(1, dragY / 220);

  return createPortal(
    <>
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
          <DefaultAvatar name={story.author.username} size={30} src={story.author.avatar_url} />
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-white">
            {story.author.username}
          </span>
          <span className="text-[12.5px] text-white/60">{formatCompactAge(item.created_at)}</span>
          {/* Три точки наверху, у имени автора, — там же, где они в Instagram
              и в Telegram. Внизу им было не место: низ кадра — это ответ, а
              редкие действия не должны занимать в нём строку наравне с ним. */}
          <button
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen(true);
            }}
            aria-label="Ещё"
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/85"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.7" />
              <circle cx="12" cy="12" r="1.7" />
              <circle cx="19" cy="12" r="1.7" />
            </svg>
          </button>
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

        {/* Низ кадра — разговор, а не панель управления.
            Раньше здесь стоял ряд из шести круглых кнопок: два голоса, репост,
            «читать полностью», ответ и «ещё». Шесть одинаковых кружков на
            фотографии не читаются — глазу не за что зацепиться, и чтобы найти
            нужный, приходится разглядывать значки по одному.

            Теперь внизу то, что делают с историей чаще всего: пишут автору. Оно
            занимает всю ширину и выглядит строкой ввода, потому что ею и
            является по смыслу. Голоса — двумя стрелками рядом: они относятся к
            записи, из которой сделана история, и их место возле неё. Всё
            остальное ушло под три точки наверх.

            Нажатия не листают кадр: ряд гасит указатель у себя. */}
        <div
          className="absolute inset-x-0 flex items-center gap-2 px-3"
          style={{ bottom: 'calc(14px + env(safe-area-inset-bottom))' }}
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          {/* Ответ уходит в личные сообщения, а не в комментарии под записью:
              на историю отвечают ей самой и её автору, а не залу. И пишется он
              здесь же — история остаётся на экране, время её стоит. */}
          {story.author.id && (
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-full px-4 py-3 text-left text-[14px]"
              style={{
                // Обводка, а не заливка: сплошная плашка во всю ширину закрыла
                // бы низ фотографии, а контур по дымке очерчивает поле ввода и
                // оставляет кадр видимым.
                border: '1px solid rgba(255,255,255,0.4)',
                background: 'rgba(255,255,255,0.10)',
                backdropFilter: 'blur(14px)',
                WebkitBackdropFilter: 'blur(14px)',
              }}
              onClick={(event) => event.stopPropagation()}
            >
              {replySent ? (
                <span className="flex min-w-0 flex-1 items-center gap-2 text-white">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                    <path d="M4 12.5 9 17.5 20 6.5" />
                  </svg>
                  {t('common.sent')}
                </span>
              ) : (
                <>
                  <input
                    ref={replyRef}
                    value={replyText}
                    onChange={(event) => setReplyText(event.target.value)}
                    onFocus={() => setReplying(true)}
                    onBlur={() => {
                      // Пустое поле — значит передумали: возвращаем ход
                      // истории. С набранным текстом пауза держится, иначе
                      // случайное касание мимо стоило бы человеку реплики.
                      if (!replyText.trim()) setReplying(false);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void sendReply();
                      }
                      // Побег из истории по Escape — но сперва из поля.
                      if (event.key === 'Escape') {
                        event.stopPropagation();
                        setReplyText('');
                        setReplying(false);
                        replyRef.current?.blur();
                      }
                    }}
                    enterKeyHint="send"
                    placeholder={t('story.replyPlaceholder')}
                    aria-label={t('story.replyPlaceholder')}
                    className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/60"
                  />
                  {/* Кнопка появляется только когда есть что отправлять:
                      пустая стрелка рядом с пустым полем — обещание действия,
                      которого не будет. */}
                  {replyText.trim() && (
                    <button
                      type="button"
                      onClick={() => void sendReply()}
                      disabled={replyBusy}
                      aria-label="Отправить"
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-white transition-transform active:scale-90 disabled:opacity-50"
                      style={{ background: 'var(--accent)' }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19V5M6 11l6-6 6 6" />
                      </svg>
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {item.postId && (
            <>
              <StoryAction
                label="За"
                active={vote === 1}
                tint={vote === 1 ? 'var(--up)' : undefined}
                onClick={() => castVote(item.postId!, 1)}
              >
                <path d="M12 5v14M6 11l6-6 6 6" />
              </StoryAction>

              <StoryAction
                label="Против"
                active={vote === -1}
                tint={vote === -1 ? 'var(--down)' : undefined}
                onClick={() => castVote(item.postId!, -1)}
              >
                <path d="M12 19V5M6 13l6 6 6-6" />
              </StoryAction>
            </>
          )}
        </div>
      </div>
    </div>

      <StoryMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        postId={item.postId}
        onRepost={
          item.postId && onCompose
            ? () => {
                setMenuOpen(false);
                onCompose(item);
              }
            : undefined
        }
        onOpenPost={
          item.postId
            ? () => {
                setMenuOpen(false);
                closeSmoothly();
                router.push(`/posts/${item.postId}`);
              }
            : undefined
        }
        hidden={hidden}
        onToggleHidden={() => {
          if (story.author.id) setStoriesHidden(story.author.id, !hidden);
          setMenuOpen(false);
          closeSmoothly();
        }}
      />
    </>,
    document.body
  );
}

/**
 * Кнопка поверх кадра. Не из палитры: она лежит на произвольной фотографии, и
 * читаться обязана одинаково на светлой и на тёмной — отсюда белое на дымке.
 */
function StoryAction({
  label,
  active,
  tint,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  /** Свой цвет знака: зелёный за, красный против, жёлтый репост. */
  tint?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      aria-label={label}
      aria-pressed={active}
      className="flex h-10 w-10 flex-none items-center justify-center rounded-full transition-transform active:scale-90"
      style={{
        background: active ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.16)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        color: tint ?? '#ffffff',
      }}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}

/**
 * «Ещё» над историей: поделиться, скопировать ссылку, скрыть, пожаловаться.
 *
 * Отдельным компонентом, а не веткой внутри просмотрщика: там он оказывался
 * посреди разметки кадра, между полосками прогресса и кнопками, и читать это
 * место становилось незачем — оно про совсем другое.
 */
function StoryMenu({
  open,
  onClose,
  postId,
  onRepost,
  onOpenPost,
  hidden,
  onToggleHidden,
}: {
  open: boolean;
  onClose: () => void;
  /** Есть только у историй, сделанных из записи: делиться иначе нечем. */
  postId: string | null;
  /** Репост в свою историю. Нет — если истории не из записи или редактор не подключён. */
  onRepost?: () => void;
  /** Перейти к записи, из которой сделана история. */
  onOpenPost?: () => void;
  hidden: boolean;
  onToggleHidden: () => void;
}) {
  const { t } = useT();
  const url = postId && typeof window !== 'undefined' ? `${window.location.origin}/posts/${postId}` : null;

  // Порядок — по частоте, а не по важности: сверху то, за чем сюда заходят.
  const rows = [
    onRepost && {
      key: 'repost',
      // Репост не публикует сразу, а открывает редактор истории. Мгновенная
      // публикация под своим именем — решение, которое принимают, а не
      // нажимают: между «мне это подходит» и «пусть это сутки висит у меня»
      // есть шаг, и он должен быть виден.
      label: 'Репост в свою историю',
      tint: 'var(--repost)',
      onSelect: onRepost,
    },
    onOpenPost && {
      key: 'open',
      label: t('story.readFull'),
      onSelect: onOpenPost,
    },
    url && {
      key: 'share',
      label: t('share.title'),
      onSelect: () => {
        if (navigator.share) navigator.share({ url }).catch(() => undefined);
        else navigator.clipboard?.writeText(url).catch(() => undefined);
        onClose();
      },
    },
    url && {
      key: 'copy',
      label: t('action.copyLink'),
      onSelect: () => {
        navigator.clipboard?.writeText(url).catch(() => undefined);
        onClose();
      },
    },
    {
      key: 'hide',
      label: hidden ? 'Показывать истории' : 'Скрыть истории',
      onSelect: onToggleHidden,
    },
    { key: 'report', label: t('action.report'), danger: true, onSelect: onClose },
  ].filter(Boolean) as {
    key: string;
    label: string;
    danger?: boolean;
    tint?: string;
    onSelect: () => void;
  }[];

  return (
    <BottomSheet open={open} onClose={onClose} title="История" height="auto">
      <div
        className="flex flex-col py-1"
        style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
      >
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={row.onSelect}
            className="rounded-xl px-1 py-3.5 text-left text-[15px] transition-colors hover:bg-[var(--surface-2)]"
            style={{ color: row.tint ?? (row.danger ? 'var(--down)' : 'var(--text)') }}
          >
            {row.label}
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
