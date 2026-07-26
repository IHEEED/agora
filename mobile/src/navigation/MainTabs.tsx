import { Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommunitiesScreen } from '../screens/CommunitiesScreen';
import { FeedScreen } from '../screens/FeedScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { BlurTabBarBackground } from './BlurTabBarBackground';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: { position: 'absolute' },
        tabBarBackground: () => <BlurTabBarBackground />,
        // на Android BlurView не такой прозрачный, как на iOS —
        // подстрахуемся полупрозрачным фоном самого стиля таб-бара
        ...(Platform.OS === 'android' ? { tabBarActiveTintColor: '#111' } : null),
      }}
    >
      <Tab.Screen
        name="Communities"
        component={CommunitiesScreen}
        options={{ title: 'Сообщества', tabBarLabel: 'Сообщества' }}
      />
      <Tab.Screen name="Feed" component={FeedScreen} options={{ title: 'Лента', tabBarLabel: 'Лента' }} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Профиль', tabBarLabel: 'Профиль' }}
      />
    </Tab.Navigator>
  );
}
