import Svg, { Path, Rect } from 'react-native-svg';

/**
 * Значки нижнего бара — те же контуры, что в вебе (navTabs).
 *
 * Активная вкладка залита, спящая — только контур: заливка всегда нарисована,
 * меняется её непрозрачность. Толщина обводки 2.1, как на сайте, чтобы на
 * 24-й сетке контур не размазывался.
 */

type Props = { active: boolean; size?: number; color: string };

function Base({ active, size = 26, color, children }: Props & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      fillOpacity={active ? 1 : 0}
      stroke={color}
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function HomeIcon(props: Props) {
  return (
    <Base {...props}>
      <Path d="M12 3.4 2.9 11.4v7.9a1.4 1.4 0 0 0 1.4 1.4h15.4a1.4 1.4 0 0 0 1.4-1.4v-7.9Z" />
      <Path d="M9.7 20.7v-6.1h4.6v6.1Z" />
    </Base>
  );
}

export function CommunitiesIcon(props: Props) {
  return (
    <Base {...props}>
      <Path d="M9 5.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
      <Path d="M9 13.6c-3.1 0-5.7 2.4-6.1 5.6h12.2c-.4-3.2-3-5.6-6.1-5.6Z" />
      <Path d="M16.6 7.4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
      <Path d="M15.9 14.1c2.7.2 4.8 2.3 5.2 5.1h-3.4c-.2-1.9-.8-3.6-1.8-5.1Z" />
    </Base>
  );
}

export function MessagesIcon(props: Props) {
  return (
    <Svg width={props.size ?? 26} height={props.size ?? 26} viewBox="0 0 24 24" fill="none" stroke={props.color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 9a2 2 0 0 1-2 2H6l-4 3.5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z" fill={props.active ? props.color : 'none'} />
      <Path d="M18 9h2a2 2 0 0 1 2 2v10.5L18 18h-6a2 2 0 0 1-2-2v-1" />
    </Svg>
  );
}

export function ProfileIcon(props: Props) {
  return (
    <Base {...props}>
      <Path d="M12 4.6a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
      <Path d="M12 13.6c-4.2 0-7.5 2.8-7.5 6.4h15c0-3.6-3.3-6.4-7.5-6.4Z" />
    </Base>
  );
}

/** Плюс в скруглённом квадрате — вход в создание записи. */
export function CreateIcon({ size = 28, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3.5" y="3.5" width="17" height="17" rx="5.5" />
      <Path d="M12 8v8M8 12h8" />
    </Svg>
  );
}
