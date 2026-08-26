'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { VelocityTracker, committed } from '@/lib/gestureVelocity';
import { spring, type SpringHandle } from '@/lib/spring';
import { lockScroll } from '@/lib/scrollLock';

/**
 * Изображение во весь экран, с листанием.
 *
 * Раньше картинку в записи нельзя было открыть вовсе: она жила в колонке ленты
 * шириной в телефон, и всё, что мельче лица крупным планом, приходилось
 * разглядывать как есть. Открывать её в новой вкладке — не выход: это уводит из
 * приложения и теряет место в ленте.
 *
 * Листание — жестом и стрелками. Счётчик показывается только когда листать
 * есть что: «1 / 1» сообщает ровно ничего.
 *
 * Закрывается тремя способами: по фону, свайпом вниз и Escape. Три, потому что
 * это тупик — из него обязано быть видно выход, каким бы способом человек его
 * ни искал.
 */
export function ImageViewer({
  images,
  index,
  onClose,
  onIndex,
  originFor,
}: {
  images: string[];
  /** Какая картинка открыта. Хранится снаружи: её задаёт нажатие в ленте. */
  index: number;
  onClose: () => void;
  onIndex: (next: number) => void;
  /**
   * Где эта картинка лежит в ленте. Нужна для возврата на место при закрытии.
   * Необязательна: если origin неизвестен, просмотр просто гаснет.
   */
  originFor?: (index: number) => DOMRect | null;
}) {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const open = index >= 0 && index < images.length;

  // Сдвиг пальцем: по горизонтали листает, по вертикали закрывает.
  /**
   * Сдвиг живёт в стиле узлов, а не в состоянии.
   *
   * Двигаются двое: лента кадров и затемнение под ней, которое гаснет по мере
   * вытягивания вниз. Раньше оба читали состояние, то есть каждое движение
   * пальца перерисовывало просмотр вместе со всеми загруженными картинками.
   *
   * Оси разведены на две пружины намеренно. Одна пружина на двумерное
   * расстояние рассинхронизируется, когда по X и Y скорости разные: диагональ
   * доезжает, а составляющие — нет.
   */
  const drag = useRef({ x: 0, y: 0 });
  const springX = useRef<SpringHandle | null>(null);
  const springY = useRef<SpringHandle | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  /**
   * Индекс в ref — только для кадрового цикла.
   *
   * Он живёт в состоянии (его задаёт нажатие в ленте), но transform собирается
   * вне отрисовки, а замыкание с прошлым индексом там дало бы ленту, съехавшую
   * на кадр назад. Синхронизируем эффектом и заново показываем сдвиг: смена
   * индекса — это тоже смена transform.
   */
  const indexRef = useRef(index);
  useEffect(() => {
    indexRef.current = index;
    applyDrag();
  });
  const from = useRef<{ x: number; y: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const speedX = useRef(new VelocityTracker());
  const speedY = useRef(new VelocityTracker());
  /**
   * Текущий сдвиг — ещё и в ref, не только в состоянии.
   *
   * Состояние нужно отрисовке, а решение «пролистали или вернулись» принимается
   * в момент отпускания и обязано опираться на настоящую величину. Обработчик
   * же видит то значение, что было на его рендере: React успевает применить
   * setDrag не всегда, и быстрый короткий взмах — когда движение и отпускание
   * попадают в один кадр — читался как нулевой сдвиг. Со стороны это ровно
   * «крупнее не листается».
   */
  const offset = useRef({ x: 0, y: 0 });
  // Какую ось человек выбрал первым движением. Без фиксации картинка ездила
  // по диагонали и не понимала, листают её или закрывают.
  const axis = useRef<'x' | 'y' | null>(null);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next < 0 || next >= images.length) return;
      onIndex(next);
    },
    [index, images.length, onIndex]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') go(1);
      if (event.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, go]);

  // Пока смотрят картинку, страница под ней не листается.
  useEffect(() => {
    if (!open) return;
    // Общий счётчик, а не своё запоминание: накладок на экране бывает
    // несколько, и «вернуть как было» у каждой по отдельности оставляло
    // страницу заблокированной навсегда (см. lib/scrollLock).
    return lockScroll();
  }, [open]);

  /**
   * Показать текущий сдвиг.
   *
   * Индекс сюда приходит извне, из отрисовки: он меняется редко и живёт в
   * состоянии, а вот сдвиг пальцем — на каждом кадре. Собираем их вместе здесь,
   * потому что transform один и владеть им может только кто-то один.
   */
  function applyDrag() {
    const { x, y } = drag.current;
    const progress = Math.min(1, y / 220);

    const track = trackRef.current;
    if (track) {
      track.style.transform =
        `translate3d(calc(${-indexRef.current * 100}% + ${x}px), ${y}px, 0)` +
        ` scale(${1 - progress * 0.12})`;
    }

    // Затемнение уходит вместе с картинкой: она не просто уезжает, а буквально
    // забирает его с собой.
    const root = rootRef.current;
    if (root) root.style.background = `rgba(0, 0, 0, ${0.94 - progress * 0.5})`;
  }

  function onPointerDown(event: React.PointerEvent) {
    from.current = { x: event.clientX, y: event.clientY };
    axis.current = null;
    speedX.current.reset();
    speedY.current.reset();
    // Без захвата указатель, ушедший за пределы окна или на элемент выше,
    // перестаёт слать события — картинка застревает на полпути.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    // Схватили — снимаем пружины: возвращающаяся картинка подхватывается на
    // ходу, а не начинает с нуля.
    springX.current?.stop();
    springY.current?.stop();
    springX.current = null;
    springY.current = null;
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!from.current) return;
    const dx = event.clientX - from.current.x;
    const dy = event.clientY - from.current.y;
    if (!axis.current && Math.hypot(dx, dy) > 8) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    // Две оси — два счётчика: скорость по диагонали, посчитанная как одно
    // число, десинхронизируется, когда по X и Y движение разное (см. §3
    // apple-design про разложение на независимые пружины).
    speedX.current.add(event.clientX);
    speedY.current.add(event.clientY);
    if (axis.current === 'x') offset.current = { x: dx, y: 0 };
    // Вверх не тянем: закрывать движением вверх некуда — там шапка.
    if (axis.current === 'y') offset.current = { x: 0, y: Math.max(0, dy) };
    drag.current = offset.current;
    applyDrag();
  }

  /**
   * Закрыть, вернув картинку туда, откуда её взяли.
   *
   * Открывается просмотр ростом из ленты — а закрывался простым угасанием, и
   * связь терялась ровно там, где она нужнее: человек только что разглядывал
   * снимок и должен понимать, в какое место ленты он возвращается. Особенно
   * после листания вбок, когда открывали второй кадр, а долистали до пятого.
   *
   * Считаем два прямоугольника — где картинка сейчас и где её место в ленте, —
   * и едем из первого во второй. Через Web Animations, а не через переход
   * состояния: узел через мгновение исчезнет вместе с порталом, и дожидаться
   * его анимации в React пришлось бы отдельным состоянием «закрываюсь».
   *
   * Ленту при этом гасим синхронно тем же сроком: картинка садится на место в
   * тот момент, когда чёрное окончательно уходит.
   */
  const RETURN_MS = 260;

  function closeWithReturn() {
    const target = originFor?.(index);
    const node = trackRef.current?.querySelector<HTMLElement>(`[data-slide='${index}'] img`);

    if (!target || !node || target.width === 0) return onClose();

    const now = node.getBoundingClientRect();
    // Масштаб по ширине, а не по обеим сторонам: в ленте картинка обрезана по
    // рамке (object-cover), во весь экран — вписана целиком. Разное соотношение
    // сторон, и растягивать по двум осям значило бы её плющить на лету.
    const scale = target.width / now.width;

    node.animate(
      [
        { transform: 'none', opacity: 1 },
        {
          transform:
            `translate(${target.left + target.width / 2 - (now.left + now.width / 2)}px, ` +
            `${target.top + target.height / 2 - (now.top + now.height / 2)}px) scale(${scale})`,
          opacity: 0.6,
        },
      ],
      { duration: RETURN_MS, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', fill: 'forwards' }
    );

    const backdrop = node.closest<HTMLElement>('[data-viewer-root]');
    backdrop?.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: RETURN_MS,
      easing: 'ease-out',
      fill: 'forwards',
    });

    window.setTimeout(onClose, RETURN_MS);
  }

  function onPointerUp() {
    if (!from.current) return;
    const { x, y } = offset.current;
    from.current = null;
    axis.current = null;
    offset.current = { x: 0, y: 0 };
    // Возврат — пружиной по каждой оси отдельно, унося скорость пальца.
    const back = (axis: 'x' | 'y', velocity: number) =>
      spring({
        from: drag.current[axis],
        to: 0,
        velocity,
        onUpdate: (value) => {
          drag.current = { ...drag.current, [axis]: value };
          applyDrag();
        },
      });

    const vx = speedX.current.get();
    const vy = speedY.current.get();

    // Далеко утащили или быстро бросили — см. lib/gestureVelocity.
    if (committed(y, vy, 110)) return closeWithReturn();
    // Четверть ширины — столько нужно протащить, чтобы это было решением, а не
    // случайным смахиванием во время разглядывания. Резкий флик засчитывается
    // и раньше: он однозначен.
    const threshold = window.innerWidth * 0.25;
    if (committed(x, vx, threshold)) {
      go(x < 0 ? 1 : -1);
      // Индекс сменился — сдвиг обнуляем мгновенно, иначе пружина повезла бы
      // ленту обратно поверх уже произошедшего перелистывания.
      drag.current = { x: 0, y: 0 };
      return;
    }

    springX.current = back('x', vx);
    springY.current = back('y', vy);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      data-viewer-root
      ref={rootRef}
      className="fixed inset-0 z-[95] flex items-center justify-center"
      style={{
        // Затемнение в покое. Дальше его пишет кадровый цикл (applyDrag):
        // оно гаснет по мере вытягивания картинки вниз.
        background: 'rgba(0, 0, 0, 0.94)',
        // Жест целиком наш: и вбок, и вниз. touch-action по умолчанию отдаёт
        // горизонталь браузеру, и на телефоне палец просто ничего не двигал —
        // это и было «крупнее не листается». Выделение отключаем по той же
        // причине: мышью протаскивание по картинке начиналось как выделение.
        touchAction: 'none',
        userSelect: 'none',
        // Затемнение появляется само, а картинка приезжает из мелкого масштаба —
        // как будто её вынули из ленты, а не открыли отдельным экраном.
        animation: 'image-viewer-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={(event) => {
        // Нажатие мимо картинки закрывает. Проверяем цель, а не координаты:
        // картинка внутри и сама остановит событие.
        if (event.target === event.currentTarget) closeWithReturn();
      }}
    >
      {/* Лента картинок целиком, сдвигаемая на индекс. Так соседние уже
          загружены, и листание не начинается с пустого кадра. */}
      <div
        ref={trackRef}
        className="flex h-full w-full items-center"
        style={{
          // Ни transform, ни transition: их пишет applyDrag прямо в узел.
          // Переход владел бы transform и не дал бы схватить уезжающую
          // картинку на полпути.
          transform: `translate3d(${-index * 100}%, 0, 0)`,
        }}
      >
        {images.map((src, position) => (
          <div
            key={`${src}-${position}`}
            data-slide={position}
            // Нажатие по полю вокруг картинки тоже закрывает.
            //
            // Проверка на подложке этого не ловила: лента кадров растянута на
            // весь экран и лежит поверх неё, так что чёрные поля сверху и снизу
            // от вертикального снимка принадлежат вот этому кадру, а не
            // подложке. Нажатия по ним просто ничего не делали — а именно туда
            // и метит палец, когда хочет выйти, не задев картинку.
            onClick={(event) => {
              if (event.target === event.currentTarget) closeWithReturn();
            }}
            className="flex h-full w-full flex-none items-center justify-center p-4"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              draggable={false}
              onClick={(event) => event.stopPropagation()}
              className="max-h-full max-w-full select-none rounded-xl object-contain"
              style={{ boxShadow: '0 30px 90px -20px rgba(0, 0, 0, 0.8)' }}
            />
          </div>
        ))}
      </div>

      <button
        onClick={closeWithReturn}
        aria-label="Закрыть"
        className="material-media absolute right-3 flex h-12 w-12 items-center justify-center rounded-full transition-transform active:scale-90"
        style={{ top: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>

      {images.length > 1 && (
        <>
          <span
            className="material-media font-num absolute left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[13px] font-medium"
            style={{
              top: 'calc(18px + env(safe-area-inset-top))',
            }}
          >
            {index + 1} / {images.length}
          </span>

          {/* Точки внизу — то же, что счётчик, но на ощупь: видно, сколько
              осталось, не читая цифр. */}
          <div
            className="absolute left-1/2 flex -translate-x-1/2 gap-1.5"
            style={{ bottom: 'calc(20px + env(safe-area-inset-bottom))' }}
          >
            {images.map((src, position) => (
              <span
                key={`dot-${src}-${position}`}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: position === index ? 18 : 6,
                  background:
                    position === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>,
    document.body
  );
}
