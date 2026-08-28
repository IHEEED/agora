import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BellIcon, SearchIcon, GearIcon } from './icons';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Верхняя шапка — одна на всех экранах, как в вебе.
 *
 * Слева колокол → уведомления, по центру знак :P, справа контекстное действие:
 * лупа → поиск почти везде, а на профиле — шестерёнка → настройки (искать в
 * своём профиле незачем). Отступ сверху учитывает вырез телефона.
 */
export function TopBar({ right = 'search' }: { right?: 'search' | 'settings' }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: insets.top + 6,
        paddingBottom: 10,
      }}
    >
      <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={10}>
        <BellIcon size={24} color={palette.control} />
      </Pressable>

      <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text }}>
        :<Text style={{ color: palette.accent }}>P</Text>
      </Text>

      {right === 'settings' ? (
        <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10}>
          <GearIcon size={24} color={palette.control} />
        </Pressable>
      ) : (
        <Pressable onPress={() => navigation.navigate('Search')} hitSlop={10}>
          <SearchIcon size={22} color={palette.control} />
        </Pressable>
      )}
    </View>
  );
}
