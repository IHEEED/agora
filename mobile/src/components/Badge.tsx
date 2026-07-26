import { Text, View } from 'react-native';
import type { BadgeType } from '../lib/types';

// один конфиг на все типы галочек — чтобы добавить новый тип
// (например 'developer') не нужно трогать места использования <Badge />
const BADGE_CONFIG: Record<BadgeType, { icon: string; color: string; label: string }> = {
  verified: { icon: '✓', color: '#3b82f6', label: 'Подтверждённый аккаунт' },
  developer: { icon: '⚙', color: '#8b5cf6', label: 'Разработчик' },
};

export function Badge({ type }: { type: BadgeType | null | undefined }) {
  if (!type) return null;

  const config = BADGE_CONFIG[type];
  if (!config) return null;

  return (
    <View
      accessibilityLabel={config.label}
      style={{
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: config.color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', lineHeight: 10 }}>{config.icon}</Text>
    </View>
  );
}
