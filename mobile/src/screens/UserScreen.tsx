import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { CommentWithPost, Post, UserProfile } from '../lib/types';
import { formatCompactAge } from '../lib/formatDate';
import { Avatar } from '../components/Avatar';
import { VerifiedMark } from '../components/VerifiedMark';
import { VoteBlock } from '../components/VoteBlock';
import { PostCard } from '../components/PostCard';
import { CommentIcon, ChevronIcon, MoreIcon } from '../components/icons';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'User'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Palette = ReturnType<typeof usePalette>;

type Tab = 'posts' | 'comments' | 'reposts';
const TABS: { value: Tab; label: string }[] = [
  { value: 'posts', label: 'Записи' },
  { value: 'comments', label: 'Комментарии' },
  { value: 'reposts', label: 'Репосты' },
];

const REPORT_REASONS = [
  { key: 'spam', label: 'Спам' },
  { key: 'abuse', label: 'Оскорбления' },
  { key: 'impersonation', label: 'Выдаёт себя за другого' },
  { key: 'threats', label: 'Угрозы' },
  { key: 'other', label: 'Другое' },
];

/**
 * Профиль другого человека — по образцу веба /u/[id].
 *
 * То же, что свой профиль, плюс подписка и «Написать», а вместо шестерёнки —
 * меню с жалобой. Открывается тапом по автору записи или комментария.
 */
export function UserScreen({ route }: Props) {
  const { userId } = route.params;
  const palette = usePalette();
  const navigation = useNavigation<Nav>();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [comments, setComments] = useState<CommentWithPost[]>([]);
  const [reposts, setReposts] = useState<Post[]>([]);
  const [tab, setTab] = useState<Tab>('posts');
  const [following, setFollowing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      apiFetch<UserProfile>(`/users/${userId}`)
        .then((data) => {
          setProfile(data);
          setFollowing(Boolean(data.isFollowing));
        })
        .catch(() => {});
      apiFetch<Post[]>(`/posts/user/${userId}?sort=new`).then(setPosts).catch(() => {});
      apiFetch<CommentWithPost[]>(`/comments/user/${userId}`).then(setComments).catch(() => {});
      apiFetch<Post[]>(`/posts/reposts/${userId}`).then(setReposts).catch(() => {});
    }, [userId])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: profile?.display_name || profile?.username || 'Профиль',
      headerRight: () => (
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={8}>
          <MoreIcon size={20} color={palette.accent} />
        </Pressable>
      ),
    });
  }, [navigation, profile, palette.accent]);

  const influence = useMemo(() => posts.reduce((sum, post) => sum + post.score, 0), [posts]);

  async function toggleFollow() {
    const next = !following;
    setFollowing(next);
    try {
      await apiFetch(`/users/${userId}/follow`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      setFollowing(!next);
    }
  }

  async function report(reason: string) {
    setMenuOpen(false);
    try {
      await apiFetch('/reports', { method: 'POST', body: JSON.stringify({ reason, userId }) });
    } catch {
      // молча
    }
  }

  const handle = profile?.username ?? '';
  const displayName = profile?.display_name || profile?.username || '';
  const bio = profile?.bio || '';
  const counts: Record<Tab, number> = { posts: posts.length, comments: comments.length, reposts: reposts.length };

  const header = (
    <View>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 12 }}>
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
          <Stat palette={palette} value={profile?.followers ?? 0} label="подписчиков" />
          <Stat palette={palette} value={profile?.following ?? 0} label="подписок" />
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

        {/* Подписка и сообщение. */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable
            onPress={toggleFollow}
            style={{ flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center', backgroundColor: following ? palette.surface2 : palette.accent }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: following ? palette.text : palette.accentContrast }}>
              {following ? 'Вы подписаны' : 'Подписаться'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate('Chat', { userId, username: displayName || handle })}
            style={{ flex: 1, borderRadius: 999, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: palette.border }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>Написать</Text>
          </Pressable>
        </View>
      </View>

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

  const emptyText = tab === 'posts' ? 'Записей пока нет.' : tab === 'comments' ? 'Комментариев пока нет.' : 'Репостов пока нет.';

  const reportSheet = (
    <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
      <Pressable onPress={() => setMenuOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 34 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border, marginBottom: 8 }} />
          <Text style={{ paddingHorizontal: 20, paddingVertical: 10, fontSize: 13, color: palette.textMuted }}>Пожаловаться на человека</Text>
          {REPORT_REASONS.map((r) => (
            <Pressable key={r.key} onPress={() => report(r.key)} style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 15, backgroundColor: pressed ? palette.surface2 : 'transparent' })}>
              <Text style={{ fontSize: 16, color: palette.text }}>{r.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (tab === 'comments') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          ListEmptyComponent={<Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>{emptyText}</Text>}
          renderItem={({ item }) => (
            <View style={{ gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: palette.border }}>
              {item.post ? (
                <Pressable
                  onPress={() => navigation.navigate('Post', { postId: item.post!.id })}
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
        {reportSheet}
      </View>
    );
  }

  const list = tab === 'posts' ? posts : reposts;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlatList
        data={list}
        keyExtractor={(post) => post.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>{emptyText}</Text>}
        renderItem={({ item }) => <PostCard post={item} />}
      />
      {reportSheet}
    </View>
  );
}

function Stat({ palette, value, label }: { palette: Palette; value: number; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{value}</Text>
      <Text style={{ fontSize: 14, color: palette.textMuted }}>{label}</Text>
    </View>
  );
}
