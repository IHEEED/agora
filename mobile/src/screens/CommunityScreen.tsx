import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { Post } from '../lib/types';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { AvatarFollow } from '../components/AvatarFollow';
import { BottomSheet } from '../components/BottomSheet';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { communityPalette } from '../lib/communityPalette';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Community'>;

/**
 * Страница клуба — устроена как профиль человека, по образцу веба: цветная
 * обложка (цвет клуба), знак на ней, справка и стена. Вкладок нет — читают
 * здесь одно, стену; участники и справка живут в шторке «О клубе». Число
 * участников честное — считаем тех, кто здесь писал.
 */
export function CommunityScreen({ route, navigation }: Props) {
  const { community } = route.params;
  const palette = usePalette();
  const insets = useSafeAreaInsets().bottom;
  const topInset = useTopBarInset();
  const { session } = useSession();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [joined, setJoined] = useState(Boolean(community.isSubscribed));
  const [joining, setJoining] = useState(false);

  const loadPosts = useCallback(() => {
    apiFetch<Post[]>(`/posts/community/${community.id}?sort=hot`)
      .then(setPosts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [community.id]);

  useFocusEffect(useCallback(() => loadPosts(), [loadPosts]));

  async function toggleJoin() {
    if (joining) return;
    const next = !joined;
    setJoined(next);
    setJoining(true);
    try {
      await apiFetch(`/communities/${community.id}/join`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      setJoined(!next);
    } finally {
      setJoining(false);
    }
  }

  // Участники — те, кто здесь писал: честная величина, таблицы участников нет.
  const people = useMemo(() => {
    const seen = new Map<string, { id: string; username: string; posts: number; isFollowing?: boolean; avatar_url?: string | null }>();
    for (const post of posts) {
      const id = post.author.id;
      if (!id) continue;
      const found = seen.get(id);
      if (found) { found.posts += 1; continue; }
      seen.set(id, { id, username: post.author.username, posts: 1, isFollowing: post.author.isFollowing, avatar_url: post.author.avatar_url });
    }
    return [...seen.values()].sort((a, b) => b.posts - a.posts);
  }, [posts]);

  const influence = useMemo(() => posts.reduce((sum, p) => sum + p.score, 0), [posts]);
  const [from, to] = communityPalette(community.name);
  const handle = 'c/' + community.name.toLowerCase().replace(/\s+/g, '');
  const created = community.created_at
    ? new Date(community.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const header = (
    <View style={{ paddingTop: 8 }}>
      <View style={{ marginHorizontal: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: palette.surface }}>
        {/* Обложка цветом клуба. */}
        <LinearGradient colors={[from, to]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={{ height: 132 }} />

        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 10 }}>
          {/* Знак клуба на обложке. */}
          <View style={{ marginTop: -44, width: 88, height: 88, borderRadius: 24, backgroundColor: palette.surface, padding: 3, alignSelf: 'flex-start' }}>
            <Avatar name={community.name} size={82} kind="community" />
          </View>

          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>{community.name}</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: from }}>{handle}</Text>
            {community.description ? <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 19, color: palette.text }}>{community.description}</Text> : null}
          </View>

          <Pressable
            onPress={toggleJoin}
            style={{ borderRadius: 999, paddingVertical: 11, alignItems: 'center', backgroundColor: joined ? palette.surface2 : palette.accent }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: joined ? palette.text : palette.accentContrast }}>
              {joined ? 'Вы подписаны' : 'Подписаться'}
            </Text>
          </Pressable>

          <Pressable onPress={() => setAboutOpen(true)} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, alignSelf: 'flex-start' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>{people.length}</Text>
            <Text style={{ fontSize: 13.5, color: palette.textMuted }}>участн.</Text>
          </Pressable>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13, color: palette.textMuted }}><Text style={{ color: palette.text }}>{posts.length}</Text> записей</Text>
            <Text style={{ color: palette.textMuted }}>·</Text>
            <Text style={{ fontSize: 13, color: palette.textMuted }}><Text style={{ color: palette.text }}>{influence}</Text> influence</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => navigation.navigate('CreatePost', { communityId: community.id })}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 11, backgroundColor: palette.accent }}
            >
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={2.4} strokeLinecap="round"><Path d="M12 5v14M5 12h14" /></Svg>
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accentContrast }}>Опубликовать пост</Text>
            </Pressable>
            <Pressable onPress={() => setAboutOpen(true)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: `${palette.accent}22` }}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="12" cy="12" r="9" /><Path d="M12 11v5.5M12 7.6v.1" />
              </Svg>
            </Pressable>
          </View>
        </View>
      </View>

      <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4 }}>Стена</Text>
      {loading ? <Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>Загрузка…</Text> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar back right="search" />
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: insets + 24 }}
        scrollIndicatorInsets={{ top: topInset }}
        ListHeaderComponent={header}
        ListEmptyComponent={!loading ? <Text style={{ paddingVertical: 40, textAlign: 'center', color: palette.textMuted }}>В этом клубе пока нет записей.</Text> : null}
        renderItem={({ item }) => <PostCard post={item} />}
      />

      <BottomSheet open={aboutOpen} onClose={() => setAboutOpen(false)} title="О клубе">
        <View style={{ gap: 18, paddingTop: 4 }}>
          <Text style={{ fontSize: 14.5, lineHeight: 21, color: palette.text }}>
            {community.description || 'Описание пока не заполнено.'}
          </Text>

          <View style={{ gap: 8 }}>
            {community.creator ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13.5, color: palette.textMuted }}>Создатель</Text>
                <Pressable onPress={() => { setAboutOpen(false); if (community.creator.id) navigation.navigate('User', { userId: community.creator.id }); }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: palette.accent }}>{community.creator.username}</Text>
                </Pressable>
              </View>
            ) : null}
            {created ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13.5, color: palette.textMuted }}>Создано</Text>
                <Text style={{ fontSize: 13.5, color: palette.text }}>{created}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 4 }}>Участники</Text>
            {people.map((person) => (
              <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                <Pressable onPress={() => { setAboutOpen(false); navigation.navigate('User', { userId: person.id }); }} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <Avatar name={person.username} uri={person.avatar_url} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{person.username}</Text>
                    <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{person.posts} записей</Text>
                  </View>
                </Pressable>
                {person.id !== session?.user.id ? (
                  <AvatarFollow userId={person.id} username={person.username} avatar={person.avatar_url} initiallyFollowing={person.isFollowing} size={34} />
                ) : null}
              </View>
            ))}
            {people.length === 0 ? <Text style={{ paddingVertical: 12, fontSize: 14, color: palette.textMuted }}>Пока никто здесь не писал.</Text> : null}
          </View>
        </View>
      </BottomSheet>
    </View>
  );
}
