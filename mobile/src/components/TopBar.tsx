import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, useColorScheme, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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

  // Две отдельные анимации, как в вебе: двоеточие моргает (сжимается по
  // вертикали), а «P» — язык — коротко «облизывается» лёгким наклоном и
  // возвратом. Запускаются с небольшим сдвигом.
  const colon = useRef(new Animated.Value(0)).current;
  const tongue = useRef(new Animated.Value(0)).current;

  function play() {
    colon.setValue(0);
    tongue.setValue(0);
    Animated.sequence([
      Animated.timing(colon, { toValue: 1, duration: 120, useNativeDriver: true }),
      Animated.timing(colon, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start();
    Animated.sequence([
      Animated.delay(90),
      Animated.timing(tongue, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(tongue, { toValue: 0, friction: 4, tension: 120, useNativeDriver: true }),
    ]).start();
  }

  useEffect(() => {
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
      <BlurView tint={dark ? 'dark' : 'light'} intensity={30} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      {/* Мягкий край: подложка плотная вверху и сходит на нет книзу, поэтому
          резкой границы, где шапка кончается, больше нет. */}
      <LinearGradient
        colors={[palette.bg, `${palette.bg}00`]}
        locations={[0.55, 1]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />

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

        <Pressable onPress={play} hitSlop={10} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Animated.Text
            style={{
              fontSize: 27,
              fontWeight: '600',
              color: palette.text,
              transform: [{ scaleY: colon.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }) }],
            }}
          >
            :
          </Animated.Text>
          <Animated.Text
            style={{
              fontSize: 27,
              fontWeight: '600',
              color: palette.accent,
              transform: [
                { rotate: tongue.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '14deg'] }) },
                { translateY: tongue.interpolate({ inputRange: [0, 1], outputRange: [0, 1.5] }) },
              ],
            }}
          >
            P
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
