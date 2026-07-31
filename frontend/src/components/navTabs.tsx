// Общая геометрия для нижнего бара (мобильный) и боковой панели (десктоп) —
// один набор иконок и ссылок, чтобы навигация не расходилась между версиями.

export type IconProps = { active: boolean };

export function iconProps(active: boolean) {
  return {
    width: 26,
    height: 26,
    viewBox: '0 0 24 24',
    // Заливка всегда есть, меняется её прозрачность — так переход плавный,
    // в отличие от переключения fill: none → currentColor.
    fill: 'currentColor' as const,
    fillOpacity: active ? 1 : 0,
    fillRule: 'evenodd' as const,
    stroke: 'currentColor' as const,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { transition: 'fill-opacity 0.15s ease' },
  };
}

export function HomeIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M12 3.4 2.9 11.4v7.9a1.4 1.4 0 0 0 1.4 1.4h15.4a1.4 1.4 0 0 0 1.4-1.4v-7.9Z" />
      <path d="M9.7 20.7v-6.1h4.6v6.1Z" />
    </svg>
  );
}

export function CommunitiesIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M9 5.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Z" />
      <path d="M9 13.6c-3.1 0-5.7 2.4-6.1 5.6h12.2c-.4-3.2-3-5.6-6.1-5.6Z" />
      <path d="M16.6 7.4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z" />
      <path d="M15.9 14.1c2.7.2 4.8 2.3 5.2 5.1h-3.4c-.2-1.9-.8-3.6-1.8-5.1Z" />
    </svg>
  );
}

export function CreateIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5.5" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

export function BellIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M12 3.3a5.4 5.4 0 0 0-5.4 5.4c0 4.2-1.5 5.8-2.1 6.7-.3.5 0 1.1.6 1.1h13.8c.6 0 .9-.6.6-1.1-.6-.9-2.1-2.5-2.1-6.7A5.4 5.4 0 0 0 12 3.3Z" />
      <path d="M9.8 19a2.2 2.2 0 0 0 4.4 0Z" />
    </svg>
  );
}

export function ProfileIcon({ active }: IconProps) {
  return (
    <svg {...iconProps(active)}>
      <path d="M12 4.6a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2Z" />
      <path d="M12 13.6c-4.2 0-7.5 2.8-7.5 6.4h15c0-3.6-3.3-6.4-7.5-6.4Z" />
    </svg>
  );
}

export const TABS = [
  { href: '/', label: 'Главная', Icon: HomeIcon },
  { href: '/search', label: 'Сообщества', Icon: CommunitiesIcon },
  { href: '/notifications', label: 'Уведомления', Icon: BellIcon },
  { href: '/profile', label: 'Профиль', Icon: ProfileIcon },
] as const;

// Порядок в мобильном баре: две вкладки, кнопка создания по центру, ещё две.
export const MOBILE_SLOTS = [TABS[0], TABS[1], null, TABS[2], TABS[3]] as const;
