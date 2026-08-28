import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { CommunityScreen } from '../screens/CommunityScreen';
import { PostScreen } from '../screens/PostScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { CreateCommunityScreen } from '../screens/CreateCommunityScreen';
import { CreatePostScreen } from '../screens/CreatePostScreen';
import { MessagesScreen } from '../screens/MessagesScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { usePalette } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const palette = usePalette();

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        // Заголовок отдан системе целиком: headerTransparent + прозрачный фон
        // означают, что панель рисует UIKit, а на iOS 26 она сама получает
        // Liquid Glass и сама решает, как преломлять уезжающий под неё
        // контент. Любой собственный backgroundColor здесь вернул бы плоскую
        // крашеную полосу.
        headerTransparent: true,
        headerStyle: { backgroundColor: 'transparent' },
        headerTintColor: palette.accent,
        headerTitleStyle: { color: palette.text },
        contentStyle: { backgroundColor: palette.bg },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Community" component={CommunityScreen} />
      <Stack.Screen name="Post" component={PostScreen} options={{ title: 'Пост' }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Мессенджер' }} />
      {/* Заголовок ставит сам экран из имени собеседника — см. навигацию. */}
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={({ route }) => ({ title: route.params.username })}
      />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Уведомления' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Вход' }} />
      <Stack.Screen
        name="CreateCommunity"
        component={CreateCommunityScreen}
        options={{ title: 'Новый клуб', presentation: 'modal' }}
      />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ title: 'Новый пост', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
