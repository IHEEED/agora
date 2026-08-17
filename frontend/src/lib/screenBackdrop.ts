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

/** Убрать снимок. Звать при уходе с экрана-накладки. */
export function releaseBackdrop() {
  held?.remove();
  held = null;
}
