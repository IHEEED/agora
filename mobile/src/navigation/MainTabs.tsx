import { createNativeBottomTabNavigator } from '@react-navigation/bottom-tabs/unstable';
import { CommunitiesScreen } from '../screens/CommunitiesScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { usePalette } from '../theme';
import type { TabParamList } from './types';

/**
 * Нижняя навигация — нативная.
 *
 * Здесь стоял createBottomTabNavigator: таб-бар, нарисованный React Native, под
 * который подкладывался BlurView, чтобы «походить на Liquid Glass». Походить он
 * мог только издалека, и дело не в качестве подделки.
 *
 * Liquid Glass — не размытие. Размытие усредняет то, что под ним; стекло
 * преломляет — по-разному по краям и в середине, подстраиваясь под то, что
 * проезжает снизу, и подсвечивая кромку от источника света. Считает это
 * система на уровне компоновщика, и повторить снаружи нечем: BlurView не знает
 * ни о содержимом под собой, ни о том, где у экрана свет.
 *
 * Поэтому таб-бар отдан системе целиком. createNativeBottomTabNavigator
 * рендерит настоящий UITabBarController, и на iOS 26 тот сам получает Liquid
 * Glass — вместе с преломлением, подсветкой кромки и правильным поведением при
 * прокрутке. На Android тот же навигатор даёт нативный BottomNavigationView.
 *
 * Цена решения: Expo Go больше не подходит (нужен development build), а иконки
 * задаются именами SF Symbols, а не своими картинками, — система рисует их
 * сама, и это единственный способ получить её же анимации нажатия.
 */
const Tab = createNativeBottomTabNavigator<TabParamList>();

export function MainTabs() {
  const palette = usePalette();

  return (
    <Tab.Navigator
      screenOptions={{
        // Только акцент: всё остальное — фон таб-бара, его материал, толщина
        // и поведение при прокрутке — берёт на себя система. Любая попытка
        // задать здесь tabBarStyle возвращает нас к нарисованному бару и
        // отключает стекло.
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
          // «Клубы», как и в вебе: «сообщества» тянули за собой группы ВК.
          title: 'Клубы',
          tabBarLabel: 'Клубы',
          tabBarIcon: ({ focused }: { focused: boolean }) => ({
            type: 'sfSymbol' as const,
            name: focused ? 'person.2.fill' : 'person.2',
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
