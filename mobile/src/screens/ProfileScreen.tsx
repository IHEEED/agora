import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/useSession';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export function ProfileScreen() {
  const { session, loading } = useSession();
  const navigation = useNavigation<Nav>();

  function goToLogin() {
    const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    (parent ?? navigation).navigate('Login');
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
        <Text style={{ padding: 16, color: '#666' }}>Загрузка…</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: '#fafafa', padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 16, color: '#333' }}>Вы не вошли в аккаунт.</Text>
        <Pressable
          onPress={goToLogin}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: '#111',
            borderRadius: 999,
            paddingHorizontal: 18,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>Войти</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#fafafa', padding: 20, gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 13, color: '#888' }}>Email</Text>
        <Text style={{ fontSize: 16, fontWeight: '600' }}>{session.user.email}</Text>
      </View>

      <Pressable
        onPress={() => supabase.auth.signOut()}
        style={{
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderColor: '#ccc',
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 10,
        }}
      >
        <Text style={{ fontWeight: '600' }}>Выйти</Text>
      </Pressable>
    </View>
  );
}
