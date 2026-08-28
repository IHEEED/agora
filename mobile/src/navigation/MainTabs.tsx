import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommunitiesScreen } from '../screens/CommunitiesScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { TabBar } from './TabBar';
import type { TabParamList } from './types';

/**
 * Нижняя навигация — свой бар с веб-значками и центральной кнопкой создания
 * (см. TabBar). Порядок как на сайте: Главная, Клубы, «плюс», Мессенджер,
 * Профиль. Уведомления — колоколом в шапке ленты, как и в вебе.
 */
const Tab = createBottomTabNavigator<TabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Communities" component={CommunitiesScreen} />
      <Tab.Screen name="MessagesTab" component={MessagesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
