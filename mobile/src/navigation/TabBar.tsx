import { Pressable, Text, useColorScheme, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { HomeIcon, CommunitiesIcon, MessagesIcon, ProfileIcon, CreateIcon } from '../components/navIcons';
import { usePalette } from '../theme';
import type { RootStackParamList } from './types';

/**
 * Нижний бар — свой, как в вебе: две вкладки, «плюс» по центру, ещё две.
 *
 * Раньше бар был нативным (ради Liquid Glass), но нативная панель принимает
 * только системные значки и не даёт вставить действие вместо экрана. Чтобы
 * значки и центральная кнопка создания совпали с сайтом дословно, бар рисуем
 * сами: те же контуры, тот же порядок, плюс по центру уводит в создание записи.
 */

const ICONS = {
  Feed: HomeIcon,
  Communities: CommunitiesIcon,
  MessagesTab: MessagesIcon,
  Profile: ProfileIcon,
} as const;

const LABELS: Record<string, string> = {
  Feed: 'Главная',
  Communities: 'Клубы',
  MessagesTab: 'Сообщения',
  Profile: 'Профиль',
};

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';

  // Порядок слотов: две вкладки, кнопка создания, ещё две.
  const left = state.routes.slice(0, 2);
  const right = state.routes.slice(2);

  function go(routeName: string, index: number) {
    const focused = state.index === index;
    const event = navigation.emit({ type: 'tabPress', target: state.routes[index].key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(routeName);
  }

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const focused = state.index === index;
    const Icon = ICONS[route.name as keyof typeof ICONS];
    const color = focused ? palette.accent : palette.textMuted;
    return (
      <Pressable
        key={route.key}
        onPress={() => go(route.name, index)}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 3, transform: [{ scale: pressed ? 0.88 : 1 }] })}
      >
        {Icon ? <Icon active={focused} size={26} color={color} /> : null}
        <Text style={{ fontSize: 11, fontWeight: '600', color }}>{LABELS[route.name] ?? route.name}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        right: 12,
        bottom: insets.bottom > 0 ? insets.bottom : 10,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 6,
        borderRadius: 28,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      {/* Стекло: нативный системный блюр под баром размывает уезжающий контент,
          поверх — полупрозрачная поверхность темы, чтобы значки читались. */}
      <BlurView
        tint={dark ? 'dark' : 'light'}
        intensity={60}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.surface, opacity: 0.55 }} />

      {left.map((route) => renderTab(route, state.routes.indexOf(route)))}

      {/* Плюс по центру — уводит в создание записи на родительском стеке. */}
      <View style={{ width: 56, alignItems: 'center' }}>
        <Pressable
          onPress={() =>
            navigation
              .getParent<NativeStackNavigationProp<RootStackParamList>>()
              ?.navigate('CreatePost', { communityId: '' })
          }
          style={({ pressed }) => ({
            width: 46,
            height: 46,
            borderRadius: 16,
            backgroundColor: palette.accent,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.9 : 1 }],
          })}
        >
          <CreateIcon size={26} color={palette.accentContrast} />
        </Pressable>
      </View>

      {right.map((route) => renderTab(route, state.routes.indexOf(route)))}
    </View>
  );
}
