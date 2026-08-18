'use client';

/**
 * Замороженный экран под шторкой-накладкой.
 *
 * Комментарии и «поделиться» выезжают шторкой поверх живой ленты: та никуда не
 * девается, её видно сквозь размытие, и понятно, что шторку сейчас закроют и
 * работа продолжится там же. «Новая запись» выглядела иначе — за ней была
 * пустота, потому что это отдельный маршрут: лента к моменту открытия шторки
 * уже снята.
 *
 * Отдельный маршрут ей нужен (на неё приходят по ссылке, из бара, из клуба, по
 * «вслед»), так что переносить её в шторку внутри ленты нельзя. Зато можно
 * оставить под ней снимок: копию экрана, снятую в момент нажатия, — она стоит
 * неподвижно, пока шторка открыта, и убирается, когда шторка ушла.
 *
 * Размывать её отдельно не нужно и не следует: затемнение шторки уже несёт
 * backdrop-filter, и снимок размывается им — тем же самым способом и до той же
 * степени, что живая лента под шторкой комментариев.
 */

/** Ниже всего в приложении: снимок — фон, а не участник. */
const Z_INDEX = 1;

const SCREEN = '[data-screen]';
const SCREEN_FIXED = '[data-screen-fixed]';

let held: HTMLElement | null = null;

/**
 * Заморозить то, что сейчас на экране. Звать в обработчике нажатия — до того,
 * как маршрут сменится и узел исчезнет.
 */
export function holdBackdrop() {
  if (typeof document === 'undefined') return;
  releaseBackdrop();

  const node = document.querySelector<HTMLElement>(SCREEN);
  if (!node) return;

  const layer = document.createElement('div');
  layer.style.cssText = [
    'position:fixed',
    'inset:0',
    `z-index:${Z_INDEX}`,
    'overflow:hidden',
    'pointer-events:none',
  ].join(';');

  const place = (source: HTMLElement, absolute: boolean) => {
    const rect = source.getBoundingClientRect();
    const copy = source.cloneNode(true) as HTMLElement;
    if (absolute) {
      copy.style.position = 'absolute';
      copy.style.top = `${rect.top}px`;
      copy.style.left = `${rect.left}px`;
      copy.style.width = `${rect.width}px`;
    }
    copy.style.transform = 'none';
    copy.style.transition = 'none';
    layer.appendChild(copy);
  };

  place(node, true);
  document.querySelectorAll<HTMLElement>(SCREEN_FIXED).forEach((el) => place(el, false));

  document.body.appendChild(layer);
  held = layer;
}

/**
 * Убрать снимок — но не раньше, чем под ним окажется настоящий экран.
 *
 * Звать при уходе с экрана-накладки. Снять его в тот же кадр нельзя: React к
 * этому моменту только начал отрисовывать ленту, и между исчезновением снимка и
 * первым кадром ленты остаётся пустота. Ровно это и было «пустой экран после
 * закрытия написания нового поста»: шторка уезжала правильно, за ней всё было
 * на месте, а потом на кадр-два экран становился белым.
 *
 * Поэтому ждём, пока узел экрана окажется в разметке и получит высоту, и только
 * тогда убираем. Ограничение по кадрам — на случай, если экрана не будет вовсе:
 * снимок не должен остаться висеть навсегда.
 */
const RELEASE_WAIT_FRAMES = 12;

export function releaseBackdrop(immediate = false) {
  const layer = held;
  held = null;
  if (!layer) return;

  // Немедленно — когда поверх уже лежит снимок уходящего экрана.
  //
  // Иначе на экране оказывались два одинаковых списка разом: замороженный
  // здесь и настоящий, который в этот момент монтируется. Совпадать они не
  // обязаны — у одного своя прокрутка, у другого анимация появления, — и
  // накладка читается как двоение экрана. Ждать первого кадра ленты имеет смысл
  // только там, где под снимком ничего нет.
  if (immediate) {
    layer.remove();
    return;
  }

  let left = RELEASE_WAIT_FRAMES;
  const tick = () => {
    const screen = document.querySelector<HTMLElement>(SCREEN);
    // Не высота, а наличие содержимого. Высота у обёртки есть всегда — она
    // flex-1 и растягивается на остаток экрана даже пустой. А пустая она ровно
    // на «новой записи»: та рисует одну шторку, и шторка уходит порталом в
    // body, так что в самой обёртке не остаётся ни одного узла. Появился
    // первый — значит на месте уже лента.
    if ((screen && screen.children.length > 0) || left <= 0) {
      layer.remove();
      return;
    }
    left -= 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
