import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { Post, UserProfile } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { VerifiedMark } from '../components/VerifiedMark';
import { PostCard } from '../components/PostCard';
import { usePalette } from '../theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Профиль — по образцу веба.
 *
 * Лицо крупно, показываемое имя с галочкой, @ник акцентом, подпись; строка
 * «подписчиков · подписок», ниже «записей · influence». Дальше — свои записи
 * карточками PostCard, теми же, что в ленте. Вкладки «комментарии/репосты» и
 * редактор профиля — следующим заходом; пока показываем записи.
 */
export function ProfileScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { session, loading } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  const userId = session?.user.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      apiFetch<UserProfile>(`/users/${userId}`).then(setProfile).catch(() => {});
      apiFetch<Post[]>(`/posts/user/${userId}?sort=new`).then(setPosts).catch(() => {});
    }, [userId])
  );

  const influence = useMemo(() => posts.reduce((sum, post) => sum + post.score, 0), [posts]);

  function goToLogin() {
    const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    (parent ?? navigation).navigate('Login');
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top + 40 }}>
        <Text style={{ padding: 16, color: palette.textMuted }}>Загрузка…</Text>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top + 40, paddingHorizontal: 20, gap: 12 }}>
        <Text style={{ fontSize: 16, color: palette.text }}>Вы не вошли в аккаунт.</Text>
        <Pressable
          onPress={goToLogin}
          style={{ alignSelf: 'flex-start', backgroundColor: palette.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 }}
        >
          <Text style={{ color: palette.accentContrast, fontWeight: '600' }}>Войти</Text>
        </Pressable>
      </View>
    );
  }

  const handle = profile?.username ?? session.user.email?.split('@')[0] ?? '';
  const displayName = profile?.display_name || profile?.username || handle;
  const bio = profile?.bio || '';

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 16, gap: 12 }}>
            <Avatar name={handle} uri={profile?.avatar_url} size={88} />

            <View style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{displayName}</Text>
                <VerifiedMark verified={profile?.verified_at} size={19} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accent }}>@{handle}</Text>
              {bio ? <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 19, color: palette.text }}>{bio}</Text> : null}
            </View>

            {/* Люди: подписчики и подписки. */}
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{profile?.followers ?? 0}</Text>
                <Text style={{ fontSize: 14, color: palette.textMuted }}>подписчиков</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{profile?.following ?? 0}</Text>
                <Text style={{ fontSize: 14, color: palette.textMuted }}>подписок</Text>
              </View>
            </View>

            {/* Цифры про сам профиль. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 13, color: palette.textMuted }}>
                <Text style={{ color: palette.text }}>{posts.length}</Text> записей
              </Text>
              <Text style={{ color: palette.textMuted }}>·</Text>
              <Text style={{ fontSize: 13, color: palette.textMuted }}>
                <Text style={{ color: palette.text }}>{influence}</Text> influence
              </Text>
            </View>

            <Pressable
              onPress={() => supabase.auth.signOut()}
              style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 999, paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>Выйти</Text>
            </Pressable>

            <View style={{ height: 8 }} />
          </View>
        }
        ListEmptyComponent={
          <Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>Записей пока нет.</Text>
        }
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </View>
  );
}
