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
import { SettingsScreen } from '../screens/SettingsScreen';
import { SettingsSectionScreen } from '../screens/SettingsSectionScreen';
import { ProfileEditScreen } from '../screens/ProfileEditScreen';
import { usePalette } from '../theme';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const palette = usePalette();

  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={{
        // Панель НЕ прозрачная: при headerTransparent контент кладётся под неё
        // от самого верха экрана — и все стек-экраны «съезжали» под часы и
        // заголовок. Обычная панель (система сама рисует её полупрозрачным
        // материалом, на iOS 26 — стеклом) отодвигает контент вниз, под себя.
        headerTintColor: palette.accent,
        headerTitleStyle: { color: palette.text },
        // Назад — только стрелка, без ярлыка «MainTabs»: имя предыдущего
        // маршрута рядом со стрелкой читалось служебной ошибкой.
        headerBackButtonDisplayMode: 'minimal',
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
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="SettingsSection"
        component={SettingsSectionScreen}
        options={({ route }) => ({ title: route.params.title })}
      />
      <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} options={{ title: 'Профиль' }} />
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
