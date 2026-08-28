import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { CommentWithPost, Post, UserProfile } from '../lib/types';
import { formatCompactAge } from '../lib/formatDate';
import { Avatar } from '../components/Avatar';
import { VerifiedMark } from '../components/VerifiedMark';
import { VoteBlock } from '../components/VoteBlock';
import { PostCard } from '../components/PostCard';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { CommentIcon, ChevronIcon } from '../components/icons';
import { usePalette } from '../theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Tab = 'posts' | 'comments' | 'reposts';

const TABS: { value: Tab; label: string }[] = [
  { value: 'posts', label: 'Записи' },
  { value: 'comments', label: 'Комментарии' },
  { value: 'reposts', label: 'Репосты' },
];

/**
 * Профиль — по образцу веба.
 *
 * Лицо крупно, показываемое имя с розеткой, @ник акцентом, подпись; строка
 * «подписчиков · подписок», ниже «записей · influence». Дальше — переключатель
 * из трёх вкладок: записи и репосты карточками PostCard, комментарии — с
 * цитатой записи, под которой оставлены. Редактор профиля — следующим заходом.
 */
export function ProfileScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
  const navigation = useNavigation<Nav>();
  const { session, loading } = useSession();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<CommentWithPost[]>([]);
  const [reposts, setReposts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>('posts');

  const userId = session?.user.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      apiFetch<UserProfile>(`/users/${userId}`).then(setProfile).catch(() => {});
      apiFetch<Post[]>(`/posts/user/${userId}?sort=new`).then(setPosts).catch(() => {});
      apiFetch<CommentWithPost[]>(`/comments/user/${userId}`).then(setComments).catch(() => {});
      apiFetch<Post[]>(`/posts/reposts/${userId}`).then(setReposts).catch(() => {});
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
  const counts: Record<Tab, number> = { posts: posts.length, comments: comments.length, reposts: reposts.length };

  const header = (
    <View>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 12 }}>
        <Avatar name={handle} uri={profile?.avatar_url} size={88} />

        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{displayName}</Text>
            <VerifiedMark verified={profile?.verified_at} size={19} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accent }}>@{handle}</Text>
          {bio ? <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 19, color: palette.text }}>{bio}</Text> : null}
        </View>

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
          onPress={() => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('ProfileEdit')}
          style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 999, paddingVertical: 10, alignItems: 'center' }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>Редактировать профиль</Text>
        </Pressable>
      </View>

      {/* Переключатель вкладок: у выбранной — число рядом с подписью. */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
        {TABS.map((option) => {
          const on = tab === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setTab(option.value)}
              style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? palette.accent : palette.surface2 }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? palette.accentContrast : palette.textMuted }}>
                {option.label}{on ? ` ${counts[option.value]}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const emptyText =
    tab === 'posts' ? 'Записей пока нет.' : tab === 'comments' ? 'Комментариев пока нет.' : 'Репостов пока нет.';

  if (tab === 'comments') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <TopBar right="settings" />
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: topInset, paddingBottom: insets.bottom + 80 }}
          scrollIndicatorInsets={{ top: topInset }}
          ListHeaderComponent={header}
          ListEmptyComponent={<Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>{emptyText}</Text>}
          renderItem={({ item }) => (
            <View style={{ gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}>
              {item.post ? (
                <Pressable
                  onPress={() => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Post', { postId: item.post!.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: palette.surface2 }}
                >
                  <CommentIcon size={15} color={palette.textMuted} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: palette.textMuted }}>{item.post.title}</Text>
                  <ChevronIcon size={15} color={palette.textMuted} />
                </Pressable>
              ) : null}
              <Text style={{ fontSize: 14.5, lineHeight: 21, color: palette.text }}>{item.body}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 }}>
                <VoteBlock id={item.id} score={item.score} myVote={item.myVote} kind="comment" compact />
                <Text style={{ fontSize: 12, color: palette.textMuted }}>{formatCompactAge(item.created_at)}</Text>
              </View>
            </View>
          )}
        />
      </View>
    );
  }

  const list = tab === 'posts' ? posts : reposts;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar right="settings" />
      <FlatList
        data={list}
        keyExtractor={(post) => post.id}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: insets.bottom + 80 }}
          scrollIndicatorInsets={{ top: topInset }}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>{emptyText}</Text>}
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </View>
  );
}
