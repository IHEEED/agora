import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { CommunitiesScreen } from '../screens/CommunitiesScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { usePalette } from '../theme';
import type { TabParamList } from './types';

/**
 * Нижняя навигация — нативная, и на iOS 26 сама получает Liquid Glass.
 *
 * Четыре вкладки: Лента, Клубы, Мессенджер, Профиль. Создание записи — не
 * вкладка, а плавающая кнопка на ленте: нативный таб-бар не даёт отменить
 * переключение, и «Создать» вкладкой мигало бы пустым экраном. Уведомления —
 * колоколом в шапке ленты, как и в вебе.
 *
 * Иконки — имена SF Symbols: система рисует их сама и даёт свои анимации
 * нажатия, чужие картинки она не примет.
 */
const Tab = createNativeBottomTabNavigator<TabParamList>();

export function MainTabs() {
  const palette = usePalette();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
      }}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{
          title: 'Лента',
          tabBarLabel: 'Лента',
          tabBarIcon: ({ focused }: { focused: boolean }) => ({
            type: 'sfSymbol' as const,
            name: focused ? 'house.fill' : 'house',
          }),
        }}
      />
      <Tab.Screen
        name="Communities"
        component={CommunitiesScreen}
        options={{
          title: 'Клубы',
          tabBarLabel: 'Клубы',
          tabBarIcon: ({ focused }: { focused: boolean }) => ({
            type: 'sfSymbol' as const,
            name: focused ? 'person.2.fill' : 'person.2',
          }),
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesScreen}
        options={{
          title: 'Мессенджер',
          tabBarLabel: 'Сообщения',
          tabBarIcon: ({ focused }: { focused: boolean }) => ({
            type: 'sfSymbol' as const,
            name: focused ? 'bubble.left.and.bubble.right.fill' : 'bubble.left.and.bubble.right',
          }),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Профиль',
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ focused }: { focused: boolean }) => ({
            type: 'sfSymbol' as const,
            name: focused ? 'person.crop.circle.fill' : 'person.crop.circle',
          }),
        }}
      />
    </Tab.Navigator>
  );
}
