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
 * Отсюда и выбор, который приходилось делать до сих пор: либо анимировать уход
 * (и тогда лента появляется уже после), либо показать ленту мгновенно (и тогда
 * уход происходит подменой кадра). Оба варианта человек и назвал — «медленное
 * появление ленты» и «резко уезжает».
 *
 * Поэтому маршрут меняем сразу, а вместо уходящего экрана уводим его снимок —
 * копию узла, вынутую из потока. Лента под ним настоящая и на месте с первого
 * кадра, а снимок ничего не знает про React и спокойно живёт свои двести
 * миллисекунд.
 *
 * Копия статична, и это не изъян, а условие: за те кадры, что она на экране,
 * в ней нечему меняться — она уже уехала.
 */

/** Сколько едет слой. Достаточно, чтобы увидеть движение, и не больше. */
const PEEL_MS = 220;

/** Растворение короче: оно без пути, а значит и следить не за чем. */
const DISSOLVE_MS = 160;

/**
 * Снимок узла поверх страницы.
 *
 * Два вложенных узла, а не один. Внешний прибит к окну и несёт анимацию;
 * внутренний повторяет положение экрана относительно окна.
 *
 * Разделение обязательное: внутри экрана бывают fixed-элементы, а transform на
 * предке превращает их в absolute относительно него. Пока анимация на внешнем
 * узле размером ровно с окно, они встают туда же, где стояли; повесь мы
 * transform прямо на копию — строка ввода переписки уехала бы к низу копии, а
 * та высотой со всю страницу.
 */
function snapshot(node: HTMLElement): HTMLElement | null {
  if (typeof window === 'undefined') return null;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null;

  const rect = node.getBoundingClientRect();

  const layer = document.createElement('div');
  layer.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:30',
    'overflow:hidden',
    'pointer-events:none',
    'will-change:transform,opacity',
  ].join(';');

  const copy = node.cloneNode(true) as HTMLElement;
  copy.style.position = 'absolute';
  copy.style.top = `${rect.top}px`;
  copy.style.left = `${rect.left}px`;
  copy.style.width = `${rect.width}px`;
  // Ни transform, ни transition от живого экрана копии не нужны: она уже
  // на своём месте, а поедет внешний узел.
  copy.style.transform = 'none';
  copy.style.transition = 'none';
  copy.style.opacity = '1';

  layer.appendChild(copy);
  document.body.appendChild(layer);
  return layer;
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

  play(
    layer,
    [
      { transform: `translateX(${fromX}px)` },
      // Плюс запас: слой обязан уйти за кромку целиком, вместе с тенью.
      { transform: 'translateX(calc(100% + 42px))' },
    ],
    PEEL_MS,
    'cubic-bezier(0.32, 0.72, 0, 1)'
  );
}

/**
 * То же, но для того, кто до узла экрана не дотягивается.
 *
 * Кнопка мессенджера живёт в шапке, вне дерева страницы, а уводит с неё ровно
 * так же, как её собственная кнопка «назад», — значит и выглядеть это обязано
 * одинаково. Узел ищем по пометке, которую ставит PageTransition.
 */
export function peelCurrentScreen(fromX = 0) {
  if (typeof document === 'undefined') return;
  peelScreen(document.querySelector<HTMLElement>('[data-screen]'), fromX);
}

/**
 * Экран-накладка (поиск, новая запись) не уезжает вбок — он растворяется на
 * месте: вглубь он и не уходил, а лежал поверх того же экрана.
 *
 * Подложки у слоя нет намеренно: он полупрозрачен с первого кадра, и лента под
 * ним обязана просвечивать. Иначе получится не «накладку убрали», а «одну
 * заливку сменили другой».
 */
export function dissolveScreen(node: HTMLElement | null) {
  if (!node) return;
  const layer = snapshot(node);
  if (!layer) return;

  play(
    layer,
    [
      { opacity: 1, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(0.985) translateY(6px)' },
    ],
    DISSOLVE_MS,
    'cubic-bezier(0.4, 0, 1, 1)'
  );
}
