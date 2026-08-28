import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, useColorScheme, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BellIcon, SearchIcon, GearIcon } from './icons';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/** Высота шапки без выреза — на неё же отступает контент под ней. */
export const TOP_BAR_HEIGHT = 58;

/** Полный отступ сверху под накладную шапку: вырез телефона плюс её высота. */
export function useTopBarInset() {
  const insets = useSafeAreaInsets();
  return insets.top + TOP_BAR_HEIGHT;
}

/**
 * Верхняя шапка — одна на всех экранах, как в вебе, и стеклянная.
 *
 * Накладная: лежит поверх контента, под ней нативный блюр (expo-blur) размывает
 * уезжающий список — тот самый эффект, что в вебе. Слева колокол → уведомления,
 * по центру крупный знак :P, справа лупа → поиск (на профиле — шестерёнка →
 * настройки). Знак моргает лёгким сжатием при появлении и по нажатию — тот же
 * приём, что и на сайте.
 */
export function TopBar({ right = 'search' }: { right?: 'search' | 'settings' }) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const blink = useRef(new Animated.Value(0)).current;

  function doBlink() {
    blink.setValue(0);
    Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 130, useNativeDriver: true }),
      Animated.timing(blink, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]).start();
  }

  useEffect(() => {
    doBlink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
      <BlurView tint={dark ? 'dark' : 'light'} intensity={40} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.bg, opacity: 0.6 }} />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          height: insets.top + TOP_BAR_HEIGHT,
        }}
      >
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={10}>
          <BellIcon size={26} color={palette.control} />
        </Pressable>

        <Pressable onPress={doBlink} hitSlop={10}>
          <Animated.Text
            style={{
              fontSize: 27,
              fontWeight: '800',
              color: palette.text,
              transform: [{ scaleY: blink.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) }],
            }}
          >
            :<Text style={{ color: palette.accent }}>P</Text>
          </Animated.Text>
        </Pressable>

        {right === 'settings' ? (
          <Pressable onPress={() => navigation.navigate('Settings')} hitSlop={10}>
            <GearIcon size={26} color={palette.control} />
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.navigate('Search')} hitSlop={10}>
            <SearchIcon size={25} color={palette.control} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
