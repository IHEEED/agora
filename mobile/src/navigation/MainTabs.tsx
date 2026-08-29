import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { CommunitiesScreen } from '../screens/CommunitiesScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { TabParamList } from './types';

/**
 * Нижняя навигация — нативная, и на iOS 26 сама получает Liquid Glass.
 *
 * Свой бар с блюром это стекло лишь имитировал; настоящее преломление рисует
 * только системная панель, поэтому вернулись к ней. Цена — значки системные
 * (SF Symbols), а не веб-контуры, и «Создать» не вкладкой: нативный таб-бар не
 * даёт отменить переключение, поэтому создание записи — плавающая кнопка на
 * ленте. Уведомления — колоколом в шапке, как и в вебе.
 */
const Tab = createNativeBottomTabNavigator<TabParamList>();

export function MainTabs() {
  const palette = usePalette();
  const { t } = useT();

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
          tabBarLabel: t('Главная'),
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
          tabBarLabel: t('Клубы'),
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
          tabBarLabel: t('Сообщения'),
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
          tabBarLabel: t('Профиль'),
          tabBarIcon: ({ focused }: { focused: boolean }) => ({
            type: 'sfSymbol' as const,
            name: focused ? 'person.crop.circle.fill' : 'person.crop.circle',
          }),
        }}
      />
    </Tab.Navigator>
  );
}
