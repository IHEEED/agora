'use client';

/**
 * Откуда экран разворачивается.
 *
 * Поиск вырастает из лупы в шапке, и точку роста надо знать в момент, когда он
 * ещё только монтируется. Мерить кнопку из его собственного layout-эффекта не
 * годится: эффект срабатывает в кадре, где шапка уже перерисована под новый
 * маршрут (лупа превращается в крестик), и рамка кнопки в этот момент читается
 * не той — а иногда и нулевой, если глиф ещё меняется.
 *
 * Поэтому точку запоминает тот, по кому нажали: в обработчике нажатия она
 * известна точно. Значение одноразовое — экран его забирает и обнуляет, чтобы
 * следующий заход по прямой ссылке не развернулся из случайного места.
 */
let origin: DOMRect | null = null;

export function setFoldOrigin(rect: DOMRect | null) {
  origin = rect;
}

/** Забрать точку. Чтение обнуляет её. */
export function takeFoldOrigin(): DOMRect | null {
  const value = origin;
  origin = null;
  // Нулевая рамка — это не точка, а скрытый элемент: display: none отдаёт
  // getBoundingClientRect() из нулей, и разворот пошёл бы из левого верхнего
  // угла окна. Лучше без анимации, чем из ниоткуда.
  return value && value.width > 0 ? value : null;
}

/**
 * Найти кнопку, в которую складываться.
 *
 * Именно видимую. Одна и та же кнопка есть и в шапке, и в боковой панели:
 * панель скрыта на телефоне, шапка — на широком экране, а querySelector отдаёт
 * первую по разметке независимо от того, видна она или нет. Скрытая отдаёт
 * нулевую рамку, и экран складывался в левый верхний угол.
 */
export function findFoldTarget(selector: string): DOMRect | null {
  if (typeof document === 'undefined') return null;
  for (const element of document.querySelectorAll<HTMLElement>(selector)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}
