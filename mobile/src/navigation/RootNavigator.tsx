import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainTabs } from './MainTabs';
import { CommunityScreen } from '../screens/CommunityScreen';
import { PostScreen } from '../screens/PostScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { CreateCommunityScreen } from '../screens/CreateCommunityScreen';
import { CreatePostScreen } from '../screens/CreatePostScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="MainTabs">
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="Community" component={CommunityScreen} />
      <Stack.Screen name="Post" component={PostScreen} options={{ title: 'Пост' }} />
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Вход' }} />
      <Stack.Screen
        name="CreateCommunity"
        component={CreateCommunityScreen}
        options={{ title: 'Новое сообщество', presentation: 'modal' }}
      />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        options={{ title: 'Новый пост', presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
