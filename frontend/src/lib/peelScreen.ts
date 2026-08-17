'use client';

/**
 * Уход экрана — снятием слоя, а не затуханием живой разметки.
 *
 * Задача: нажал «назад» — и за уходящим экраном сразу лента. Не «лента
 * появится, когда он исчезнет», а именно сразу: он уходит поверх неё, как
 * верхний контроллер в Telegram или в системной навигации iOS.
 *
 * Обычной анимацией такое не делается. Уходящий экран и тот, к которому
 * возвращаются, — два разных маршрута, и router.back() снимает первый ровно в
 * тот кадр, в который монтирует второй: одновременно на экране их не бывает.
 * Отсюда и выбор, который приходилось делать: либо анимировать уход (и тогда
 * лента появляется уже после), либо показать ленту мгновенно (и тогда уход
 * происходит подменой кадра). Оба варианта человек и назвал — «медленное
 * появление ленты» и «резко уезжает».
 *
 * Поэтому маршрут меняем сразу, а вместо уходящего экрана уводим его снимок —
 * копию узла, вынутую из потока. Снимок ничего не знает про React и спокойно
 * живёт свои двести миллисекунд.
 *
 * Копия статична, и это не изъян, а условие: за те кадры, что она на экране,
 * в ней нечему меняться — она уже уехала.
 */

/** Сколько едет слой. Достаточно, чтобы увидеть движение, и не больше. */
const PEEL_MS = 220;

/** Растворение короче: оно без пути, а значит и следить не за чем. */
const DISSOLVE_MS = 160;

/** Складывание в лупу: быстро, но с торможением — иначе просто мигает. */
const FOLD_MS = 240;

/**
 * Сколько кадров ждём подмену экрана, прежде чем увести слой.
 *
 * Шести хватает с запасом: данные лежат в кеше, и следующий экран рисуется в
 * один-два кадра. Ограничение здесь на случай, когда подмены не будет вовсе
 * (навигацию отменили) — слой не должен остаться висеть навсегда.
 */
const SWAP_WAIT_FRAMES = 6;

/** Пометка узла экрана. Ставит PageTransition, читают снимки. */
const SCREEN = '[data-screen]';

/**
 * Пометка для fixed-элементов, живущих порталом в body, но принадлежащих
 * экрану, — строка ввода переписки. В сам узел экрана они не входят, а уехать
 * обязаны вместе с ним, иначе останутся висеть поверх уже другого экрана.
 */
const SCREEN_FIXED = '[data-screen-fixed]';

function reducedMotion(): boolean {
  return (
    typeof window === 'undefined' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Снимок экрана поверх страницы.
 *
 * Два уровня узлов, а не один. Внешний прибит к окну и несёт анимацию;
 * внутренний повторяет положение экрана относительно окна.
 *
 * Разделение обязательное: внутри экрана бывают fixed-элементы, а transform на
 * предке превращает их в absolute относительно него. Пока анимация на внешнем
 * узле размером ровно с окно, они встают туда же, где стояли; повесь мы
 * transform прямо на копию — строка ввода переписки уехала бы к низу копии, а
 * та высотой со всю страницу.
 */
function snapshot(node: HTMLElement): HTMLElement | null {
  if (reducedMotion()) return null;

  // Слой начинается под шапкой, а не от верха окна.
  //
  // Шапка — рама, а не содержимое: она одна и та же до перехода и после, и
  // двигаться при переходе не должна ничто из того, что видно сквозь неё. Она
  // полупрозрачна и размывает то, что под ней, поэтому уезжающая копия,
  // проходя под шапкой, читалась движением самой шапки. Обрезаем копию по её
  // нижней кромке — то же делает и бар снизу, только он поверх слоя по z.
  const chrome = document.querySelector<HTMLElement>('.app-header');
  const top = chrome ? Math.max(0, chrome.getBoundingClientRect().bottom) : 0;

  const layer = document.createElement('div');
  layer.style.cssText = [
    'position:fixed',
    `top:${top}px`,
    'right:0',
    'bottom:0',
    'left:0',
    'z-index:30',
    'overflow:hidden',
    'pointer-events:none',
    'will-change:transform,opacity',
  ].join(';');

  const place = (source: HTMLElement, absolute: boolean) => {
    const rect = source.getBoundingClientRect();
    const copy = source.cloneNode(true) as HTMLElement;
    if (absolute) {
      copy.style.position = 'absolute';
      // Минус top: координаты узла — от окна, а слой начинается ниже.
      copy.style.top = `${rect.top - top}px`;
      copy.style.left = `${rect.left}px`;
      copy.style.width = `${rect.width}px`;
    }
    // Ни transform, ни transition от живого узла копии не нужны: она уже
    // на своём месте, а поедет внешний слой.
    copy.style.transform = 'none';
    copy.style.transition = 'none';
    copy.style.opacity = '1';
    layer.appendChild(copy);
    // Живой узел убираем сразу.
    //
    // Без этого под копией оставался тот же самый экран: router.back() меняет
    // маршрут не мгновенно, и пока React не отрисовал следующий, оригинал ещё
    // в разметке. Слой уезжал, из-под него показывался тот же экран, и только
    // потом — лента. Именно это и было «снимается, а под ним то же самое».
    source.style.visibility = 'hidden';
  };

  place(node, true);
  // Порталы экрана: у них своё fixed, и position внутри слоя с transform
  // считается уже от слоя — то есть от окна. Пересчитывать ничего не нужно.
  document.querySelectorAll<HTMLElement>(SCREEN_FIXED).forEach((el) => place(el, false));

  document.body.appendChild(layer);
  return layer;
}

/**
 * Дождаться, пока на месте экрана окажется другой узел.
 *
 * PageTransition ключует обёртку маршрутом, поэтому подмена экрана — это
 * появление нового узла вместо старого. Пока его нет, слой стоит на месте и
 * закрывает собой пересадку.
 */
function whenSwapped(run: () => void) {
  // Обёртку запоминаем здесь, а не берём снаружи: сравнивать нужно именно её,
  // а снимок часто снимают с узла внутри неё — тот обёртке не равен никогда, и
  // проверка «появился другой узел» проходила бы в первом же кадре, то есть не
  // ждала бы ничего.
  const previous = document.querySelector<HTMLElement>(SCREEN);
  let left = SWAP_WAIT_FRAMES;
  const tick = () => {
    const current = document.querySelector<HTMLElement>(SCREEN);
    if ((current && current !== previous) || left <= 0) {
      run();
      return;
    }
    left -= 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function play(layer: HTMLElement, frames: Keyframe[], duration: number, easing: string) {
  const animation = layer.animate(frames, { duration, easing, fill: 'forwards' });
  animation.onfinish = () => layer.remove();
  // Если анимацию отменят (вкладку свернули, элемент выкинули) — убрать всё
  // равно, иначе копия останется висеть поверх приложения.
  animation.oncancel = () => layer.remove();
}

/**
 * Вложенный экран уезжает вправо — обратным ходом к тому, как он въехал слева.
 *
 * @param node   Корневой узел уходящего экрана.
 * @param fromX  Откуда стартовать — сдвиг, набранный пальцем к моменту отпускания.
 *               Без него слой прыгал бы обратно к нулю перед тем, как уехать.
 */
export function peelScreen(node: HTMLElement | null, fromX = 0) {
  if (!node) return;
  const layer = snapshot(node);
  if (!layer) return;

  layer.style.background = 'var(--bg)';
  // Кромка слоя. Без неё копия и лента под ней одного цвета, и вместо
  // «уезжает верхний слой» видно, как по экрану едет его содержимое.
  layer.style.boxShadow = '-16px 0 42px rgba(0, 0, 0, 0.26)';
  layer.style.transform = `translateX(${fromX}px)`;

  whenSwapped(() =>
    play(
      layer,
      [
        { transform: `translateX(${fromX}px)` },
        // Плюс запас: слой обязан уйти за кромку целиком, вместе с тенью.
        { transform: 'translateX(calc(100% + 42px))' },
      ],
      PEEL_MS,
      'cubic-bezier(0.32, 0.72, 0, 1)'
    )
  );
}

/**
 * То же, но для того, кто до узла экрана не дотягивается.
 *
 * Кнопка мессенджера живёт в шапке, вне дерева страницы, а уводит с неё ровно
 * так же, как её собственная кнопка «назад», — значит и выглядеть это обязано
 * одинаково.
 */
export function peelCurrentScreen(fromX = 0) {
  if (typeof document === 'undefined') return;
  peelScreen(document.querySelector<HTMLElement>(SCREEN), fromX);
}

/**
 * Экран-накладка не уезжает вбок — он растворяется на месте: вглубь он и не
 * уходил, а лежал поверх того же экрана.
 */
export function dissolveScreen(node: HTMLElement | null) {
  if (!node) return;
  const layer = snapshot(node);
  if (!layer) return;

  whenSwapped(() =>
    play(
      layer,
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.985) translateY(6px)' },
      ],
      DISSOLVE_MS,
      'cubic-bezier(0.4, 0, 1, 1)'
    )
  );
}

/**
 * Экран складывается в точку — туда, откуда его открыли.
 *
 * Поиск разворачивается из лупы в шапке и складывается обратно в неё же. Это не
 * украшение: кнопка и экран так связаны одним движением, и человеку не нужно
 * догадываться, чем было открыто то, что он сейчас закрыл. Тот же приём в
 * Substack на переходе к профилю автора из записи.
 *
 * @param origin Прямоугольник кнопки, в которую складываемся, — в координатах окна.
 */
export function foldScreenTo(node: HTMLElement | null, origin: DOMRect | null) {
  if (!node) return;
  const layer = snapshot(node);
  if (!layer) return;

  if (origin) {
    // Точка схлопывания — центр кнопки. Слой начинается под шапкой, а кнопка
    // стоит в ней, то есть выше нуля слоя: смещение по вертикали отрицательное,
    // и это верно — экран складывается вверх, за кромку слоя.
    const box = layer.getBoundingClientRect();
    layer.style.transformOrigin = `${origin.left + origin.width / 2 - box.left}px ${
      origin.top + origin.height / 2 - box.top
    }px`;
  }

  whenSwapped(() =>
    play(
      layer,
      [
        { opacity: 1, transform: 'scale(1)' },
        // Не в ноль: на последних процентах масштаба содержимое превращается в
        // цветное пятно, и его лучше погасить прозрачностью раньше.
        { opacity: 0, transform: 'scale(0.12)' },
      ],
      FOLD_MS,
      'cubic-bezier(0.32, 0.72, 0, 1)'
    )
  );
}
