import Svg, { Circle, Path } from 'react-native-svg';

/**
 * Иконки — те же контуры, что в вебе, дословно.
 *
 * В вебе каждый значок это `<svg><path d="…"/></svg>`; здесь `react-native-svg`
 * рисует ровно те же `d`. Поэтому колокол, лупа, три точки, комментарий, глаз,
 * репост и «поделиться» на телефоне и на сайте — один и тот же контур, а не
 * похожие эмодзи. Все линейные, обводкой в 1.9 и с круглыми стыками — как в
 * вебе; цвет приходит из палитры через `color`.
 */

type IconProps = {
  size?: number;
  color: string;
  /** Толщина обводки; по умолчанию как в вебе. */
  strokeWidth?: number;
};

/** Общая обёртка для линейных значков. */
function Line({
  size = 22,
  color,
  strokeWidth = 1.9,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

/** Колокол уведомлений. */
export function BellIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <Path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </Line>
  );
}

/** Лупа поиска. */
export function SearchIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Circle cx="11" cy="11" r="7" />
      <Path d="m21 21-4.3-4.3" />
    </Line>
  );
}

/** Три точки — меню «ещё». Залитые кружки, как в вебе. */
export function MoreIcon({ size = 18, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="5" cy="12" r="1.7" />
      <Circle cx="12" cy="12" r="1.7" />
      <Circle cx="19" cy="12" r="1.7" />
    </Svg>
  );
}

/** Пузырь комментария. */
export function CommentIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5c-1 0-2-.2-2.9-.6L4.5 20l1.2-4.4A7.5 7.5 0 1 1 20 11.5Z" />
    </Line>
  );
}

/** Глаз просмотров. Тоньше соседей — это показание, а не действие. */
export function ViewIcon(props: IconProps) {
  return (
    <Line strokeWidth={1.8} {...props}>
      <Path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" />
      <Circle cx="12" cy="12" r="3" />
    </Line>
  );
}

/** Репост — две встречные стрелки. */
export function RepostIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M6 7h9a3 3 0 0 1 3 3v2" />
      <Path d="m12 5-3 2 3 2" />
      <Path d="M18 17H9a3 3 0 0 1-3-3v-2" />
      <Path d="m12 19 3-2-3-2" />
    </Line>
  );
}

/** Поделиться — стрелка вверх из коробки. */
export function ShareIcon(props: IconProps) {
  return (
    <Line {...props}>
      <Path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <Path d="M16 6l-4-4-4 4" />
      <Path d="M12 2v14" />
    </Line>
  );
}

/** Кнопка. Залитая — когда голос отдан за эту сторону. */
const ARROW_PATH =
  'M12 4.5c.45 0 .87.2 1.15.55l5.9 7.2c.65.8.08 2-.96 2H15.2v4.3c0 .8-.65 1.45-1.45 1.45h-3.5c-.8 0-1.45-.65-1.45-1.45V14.25H5.91c-1.04 0-1.61-1.2-.96-2l5.9-7.2c.28-.35.7-.55 1.15-.55Z';

export function VoteArrow({
  direction,
  filled,
  size = 24,
  color,
}: {
  direction: 'up' | 'down';
  filled: boolean;
  size?: number;
  color: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={1.7}
      strokeLinejoin="round"
    >
      <Path d={ARROW_PATH} transform={direction === 'down' ? 'rotate(180 12 12)' : undefined} />
    </Svg>
  );
}

/** Флажок закрепа. */
export function PinIcon(props: IconProps) {
  return (
    <Line strokeWidth={2} {...props}>
      <Path d="M12 17v5" />
      <Path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
    </Line>
  );
}

/** Уголок-стрелка вправо — перед названием сообщества. */
export function ChevronIcon(props: IconProps) {
  return (
    <Line strokeWidth={2.2} {...props}>
      <Path d="m9 6 6 6-6 6" />
    </Line>
  );
}
