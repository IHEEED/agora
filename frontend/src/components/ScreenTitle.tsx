/**
 * Крупный заголовок экрана.
 *
 * Пиксельный шрифт отсюда убран: в длинных словах вроде «Уведомления» он
 * читался хуже обычного, сколько кегль ни поднимай. Фирменность теперь несёт
 * точка в конце — тот же приём, что и в вывеске, но без потери разборчивости.
 *
 * Точку не добавляем, если строка уже кончается знаком препинания: у
 * «Куда опубликовать?» она превратила бы концовку в «?.».
 */
export function ScreenTitle({
  children,
  className = '',
}: {
  children: string;
  className?: string;
}) {
  const trimmed = children.trim();
  const needsDot = !/[.!?…:]$/.test(trimmed);

  return (
    <h1
      className={`text-[30px] font-semibold leading-tight tracking-tight text-[var(--text)] ${className}`}
    >
      {trimmed}
      {needsDot && <span style={{ color: 'var(--accent)' }}>.</span>}
    </h1>
  );
}
