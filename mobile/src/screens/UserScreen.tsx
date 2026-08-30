import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
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
import { SegmentedControl } from '../components/SegmentedControl';
import { PersonMenuSheet } from '../components/PersonMenuSheet';
import { setBlocked, useIsBlocked } from '../lib/blockedUsers';
import { CommentIcon, MoreIcon } from '../components/icons';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'User'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

type Tab = 'posts' | 'comments' | 'reposts';

/**
 * Чужой профиль — один в один с вебом (/u/[userId]).
 *
 * Та же карточка, что и в своём профиле: обложка-заливка, растворяющаяся в
 * стекло, аватар на ней, метрики. Отличие — вместо «Редактировать» здесь пара
 * «Написать» + подписка, а вместо шестерёнки — меню (три точки) с жалобой.
 * Подписи/цифры и переключатель вкладок совпадают со своим профилем, только у
 * чужого счётчик стоит лишь у вкладки «Посты».
 */
export function UserScreen({ route }: Props) {
  const { userId } = route.params;
  const palette = usePalette();
  const { t } = useT();
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

  const blocked = useIsBlocked(userId);

  const handle = profile?.username ?? posts[0]?.author.username ?? '';
  const displayName = profile?.display_name || profile?.username || handle || '—';
  const counts: Record<Tab, number> = { posts: posts.length, comments: comments.length, reposts: reposts.length };

  const openPeople = (mode: 'followers' | 'following') =>
    navigation.navigate('People', {
      endpoint: `/users/${userId}/${mode}`,
      title: mode === 'followers' ? t('Подписчики') : t('Подписки'),
      emptyText: mode === 'followers' ? t('Пока никто не подписался.') : t('Пока ни на кого не подписан.'),
    });

  const header = (
    <View style={{ paddingTop: 8 }}>
      {/* Заблокированного не прячем целиком: человек пришёл сам, и пустой экран
          выглядел бы поломкой. Достаточно сказать, что записи скрыты, и дать снять. */}
      {blocked ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 10, marginBottom: 10, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: palette.surface2 }}>
          <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: palette.textMuted }}>
            Вы заблокировали этого человека. Его записи скрыты.
          </Text>
          <Pressable onPress={() => { void setBlocked(userId, false).catch(() => {}); }} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: palette.accent }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accentContrast }}>Разблокировать</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Блок 1 — карточка с обложкой-заливкой, аватаром и метриками, как в
          своём профиле. У чужого обложка не показывается картинкой (как в
          вебе) — только акцентная заливка, сходящая на нет книзу. */}
      <View style={{ marginHorizontal: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: palette.surface }}>
        <LinearGradient
          colors={[`${palette.accent}5c`, `${palette.accent}1a`, `${palette.accent}00`]}
          locations={[0, 0.55, 0.9]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 190 }}
        />

        <View style={{ paddingHorizontal: 16, paddingTop: 108, paddingBottom: 16, gap: 12 }}>
          {/* Аватар приподнят на обложку, в ободке цвета поверхности. */}
          <View style={{ marginTop: -44, borderRadius: 999, backgroundColor: palette.surface, padding: 3, alignSelf: 'flex-start' }}>
            <Avatar name={handle || '?'} uri={profile?.avatar_url} size={88} />
          </View>

          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{displayName}</Text>
              <VerifiedMark verified={profile?.verified_at} size={19} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accent }}>@{handle}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Pressable onPress={() => openPeople('followers')} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.text }}>{profile?.followers ?? 0}</Text>
              <Text style={{ fontSize: 13.5, color: palette.textMuted }}>подписчиков</Text>
            </Pressable>
            <Pressable onPress={() => openPeople('following')} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: palette.text }}>{profile?.following ?? 0}</Text>
              <Text style={{ fontSize: 13.5, color: palette.textMuted }}>подписок</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ fontSize: 13, color: palette.textMuted }}>
              <Text style={{ color: palette.text }}>{posts.length}</Text> постов
            </Text>
            <Text style={{ color: palette.textMuted }}>·</Text>
            <Text style={{ fontSize: 13, color: palette.textMuted }}>
              <Text style={{ color: palette.text }}>{profile?.karma ?? influence}</Text> influence
            </Text>
          </View>

          {/* Написать + подписка — знаком и словом, как в вебе. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => navigation.navigate('Chat', { userId, username: displayName || handle })}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 11, backgroundColor: `${palette.accent}1f` }}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M14 9a2 2 0 0 1-2 2H6l-4 3.5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2Z" />
                <Path d="M18 9h2a2 2 0 0 1 2 2v10.5L18 18h-6a2 2 0 0 1-2-2v-1" />
              </Svg>
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accent }}>{t('Написать')}</Text>
            </Pressable>

            <Pressable
              onPress={toggleFollow}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 11, backgroundColor: following ? palette.surface2 : palette.accent }}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={following ? palette.textMuted : palette.accentContrast} strokeWidth={2.4} strokeLinecap="round">
                <Path d="M5 12h14" />
                {!following ? <Path d="M12 5v14" /> : null}
              </Svg>
              <Text style={{ fontSize: 14, fontWeight: '600', color: following ? palette.textMuted : palette.accentContrast }}>
                {following ? t('Вы подписаны') : t('Подписаться')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Переключатель-«гусеница»: счётчик — только у «Постов» (как в вебе). */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            ['posts', `${t('Посты')} ${counts.posts}`],
            ['comments', t('Комменты')],
            ['reposts', t('Репосты')],
          ]}
        />
      </View>
    </View>
  );

  const emptyText = t(
    tab === 'posts' ? 'Здесь пока нет записей.' : tab === 'comments' ? 'Здесь пока нет комментариев.' : 'Репостов пока нет.'
  );

  const reportSheet = (
    <PersonMenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} userId={userId} username={displayName} />
  );

  if (tab === 'comments') {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }}>
        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={header}
          ListEmptyComponent={<Text style={{ paddingVertical: 48, textAlign: 'center', color: palette.textMuted }}>{emptyText}</Text>}
          renderItem={({ item }) => (
            <View style={{ gap: 8, paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: palette.border }}>
              {item.post ? (
                <Pressable
                  onPress={() => navigation.navigate('Post', { postId: item.post!.id })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: palette.surface2 }}
                >
                  <CommentIcon size={15} color={palette.textMuted} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: palette.textMuted }}>{item.post.title}</Text>
                </Pressable>
              ) : null}
              <Text style={{ fontSize: 14.5, lineHeight: 21, color: palette.text }}>{item.body}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 }}>
                <VoteBlock id={item.id} score={item.score} myVote={item.myVote} kind="comment" compact />
                <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{formatCompactAge(item.created_at)}</Text>
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
        ListEmptyComponent={<Text style={{ paddingVertical: 48, textAlign: 'center', color: palette.textMuted }}>{emptyText}</Text>}
        renderItem={({ item }) => <PostCard post={item} />}
      />
      {reportSheet}
    </View>
  );
}
