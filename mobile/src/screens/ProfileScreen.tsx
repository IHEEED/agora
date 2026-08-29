import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
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
import { SuggestedPeople } from '../components/SuggestedPeople';
import { SegmentedControl } from '../components/SegmentedControl';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { CommentIcon, ChevronIcon } from '../components/icons';
import { usePalette } from '../theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Profile'>,
  NativeStackNavigationProp<RootStackParamList>
>;

type Tab = 'posts' | 'comments' | 'reposts';

const TABS: ReadonlyArray<readonly [Tab, string]> = [
  ['posts', 'Посты'],
  ['comments', 'Комменты'],
  ['reposts', 'Репосты'],
];

/** Пояснение к influence — тем же текстом, что тултип ⓘ в вебе. */
const INFLUENCE_EXPLAIN =
  'Influence-очки — сумма голосов за все ваши записи. Каждый голос «за» добавляет очко, «против» — отнимает. Чем полезнее ваши записи, тем их больше.';

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
  const [note, setNote] = useState('');
  const [noteEditing, setNoteEditing] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');

  const userId = session?.user.id;

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      apiFetch<UserProfile>(`/users/${userId}`).then(setProfile).catch(() => {});
      apiFetch<Post[]>(`/posts/user/${userId}?sort=new`).then(setPosts).catch(() => {});
      apiFetch<CommentWithPost[]>(`/comments/user/${userId}`).then(setComments).catch(() => {});
      apiFetch<Post[]>(`/posts/reposts/${userId}`).then(setReposts).catch(() => {});
      apiFetch<{ author_id: string; body: string }[]>(`/notes?ids=${userId}`)
        .then((rows) => setNote(rows.find((r) => r.author_id === userId)?.body ?? ''))
        .catch(() => {});
    }, [userId])
  );

  async function saveNote() {
    const body = noteDraft.trim();
    setNote(body);
    setNoteEditing(false);
    try {
      await apiFetch('/notes', { method: 'PUT', body: JSON.stringify({ body }) });
    } catch {
      // молча — заметка необязательна
    }
  }

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
  const phoneVerified = Boolean((session.user as { phone_confirmed_at?: string }).phone_confirmed_at);
  const rootNav = () => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const openEdit = () => rootNav()?.navigate('ProfileEdit');
  const openPeople = (mode: 'followers' | 'following') =>
    userId &&
    rootNav()?.navigate('People', {
      endpoint: `/users/${userId}/${mode}`,
      title: mode === 'followers' ? 'Подписчики' : 'Подписки',
      emptyText: mode === 'followers' ? 'Пока никто не подписался.' : 'Пока ни на кого не подписан.',
    });
  const showInfluence = () => Alert.alert('Что такое influence-очки', INFLUENCE_EXPLAIN);

  const header = (
    <View style={{ paddingTop: 8 }}>
      {/* Блок 1 — обложка, аватар и цифры, единой карточкой, как в вебе.
          Обложка не отдельной полосой, а градиентом-размывом поверх карточки:
          акцент вверху сходит на нет книзу, поэтому жёсткого стыка, где обложка
          кончается, нет — она растворяется в карточке. */}
      <View style={{ marginHorizontal: 10, borderRadius: 18, overflow: 'hidden', backgroundColor: palette.surface }}>
        {profile?.cover_url ? (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 150 }}>
            <Image source={{ uri: profile.cover_url }} style={{ width: '100%', height: '100%' }} />
            <LinearGradient colors={['transparent', palette.surface]} locations={[0.55, 1]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          </View>
        ) : (
          <LinearGradient
            colors={[`${palette.accent}5c`, `${palette.accent}1a`, `${palette.accent}00`]}
            locations={[0, 0.55, 0.9]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 190 }}
          />
        )}

        {/* Кнопка «добавить фон» — только пока фона нет. С поставленной
            обложкой она закрывала бы ровно то, ради чего её ставили; заменить и
            подогнать можно из «Редактировать профиль» (как в вебе). */}
        {!profile?.cover_url ? (
          <Pressable
            onPress={openEdit}
            style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(0,0,0,0.32)' }}
          >
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.1} strokeLinecap="round">
              <Path d="M12 6v12M6 12h12" />
            </Svg>
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#fff' }}>Добавить фон профиля</Text>
          </Pressable>
        ) : null}

        <View style={{ paddingHorizontal: 16, paddingTop: 108, paddingBottom: 16, gap: 12 }}>
          {/* Аватар приподнят на обложку; облачко-мысль над ним. Кольца нет —
              оно означает непросмотренные истории, а их у своего профиля нет. */}
          <View style={{ marginTop: -44, width: 96, height: 96 }}>
            <View style={{ position: 'absolute', left: 0, top: 0, borderRadius: 999, backgroundColor: palette.surface, padding: 3 }}>
              <Avatar name={handle} uri={profile?.avatar_url} size={88} />
            </View>
            <Pressable
              onPress={() => { setNoteDraft(note); setNoteEditing(true); }}
              style={{ position: 'absolute', left: 56, top: -20, maxWidth: 200, backgroundColor: palette.surface2, borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 7 }}
            >
              <Text numberOfLines={2} style={{ fontSize: 12.5, color: note ? palette.text : palette.textMuted }}>
                {note || 'мысль…'}
              </Text>
            </Pressable>
          </View>

          <View style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: palette.text }}>{displayName}</Text>
              <VerifiedMark verified={profile?.verified_at} size={19} />
            </View>
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accent }}>@{handle}</Text>
            {bio ? <Text style={{ marginTop: 4, fontSize: 14, lineHeight: 19, color: palette.text }}>{bio}</Text> : null}
          </View>

          {/* Люди отдельно от цифр: за подписчиками ходят (нажимаются, ведут в
              список), а посты и influence — справка о профиле, по ней не
              нажимают. */}
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
              <Text style={{ color: palette.text }}>{influence}</Text> influence
            </Text>
            {/* Серая «i»: коротко объясняет, откуда берётся число (как в вебе). */}
            <Pressable onPress={showInfluence} hitSlop={8}>
              <Svg width={15} height={15} viewBox="0 0 16 16" fill="none">
                <Circle cx={8} cy={8} r={7} fill={palette.textMuted} opacity={0.16} />
                <Circle cx={8} cy={4.6} r={1.05} fill={palette.textMuted} />
                <Rect x={7.05} y={6.7} width={1.9} height={5} rx={0.95} fill={palette.textMuted} />
              </Svg>
            </Pressable>
          </View>

          <Pressable
            onPress={openEdit}
            style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 999, paddingVertical: 9, alignItems: 'center' }}
          >
            <Text style={{ fontSize: 14, fontWeight: '500', color: palette.text }}>Редактировать профиль</Text>
          </Pressable>
        </View>
      </View>

      {/* «Кого почитать» — той же лентой, что и на главной, как в вебе. */}
      <SuggestedPeople />

      {/* Тот же переключатель-«гусеница», что в вебе и в остальном приложении.
          Счётчик — только у выбранной вкладки: со счётчиками у всех трёх
          подписи переставали помещаться в колонку и обрезались. */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={TABS.map(
            ([value, label]) => [value, value === tab ? `${label} ${counts[value]}` : label] as const
          )}
        />
      </View>

      {/* Редактор заметки-облачка. Появление — затуханием (fade), а не выездом
          снизу: при slide вся модалка вместе с затемнением ползла вверх, и
          панель гналась за клавиатурой. Так фон просто затемняется, а панель
          поднимается над клавиатурой вместе с ней (KeyboardAvoidingView).
          Затемнение — отдельным слоем на весь экран, чтобы оставаться и за
          поднятой панелью. */}
      <Modal visible={noteEditing} transparent animationType="fade" onRequestClose={() => setNoteEditing(false)}>
        <View style={{ flex: 1 }}>
          <Pressable onPress={() => setNoteEditing(false)} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 12 }}>
              <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border }} />
              <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Мысль дня</Text>
              <TextInput
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="Что у вас на уме?"
                placeholderTextColor={palette.textMuted}
                maxLength={80}
                autoFocus
                onSubmitEditing={saveNote}
                returnKeyType="done"
                style={{ borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 12, fontSize: 15, color: palette.text, backgroundColor: palette.surface }}
              />
              <Pressable onPress={saveNote} style={{ alignSelf: 'flex-start', backgroundColor: palette.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11 }}>
                <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 15 }}>Сохранить</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );

  /** Пусто: у постов без подтверждённого телефона — призыв подтвердить. */
  const renderEmpty = () => {
    if (tab === 'posts' && !phoneVerified) {
      return (
        <View style={{ alignItems: 'center', gap: 14, paddingHorizontal: 32, paddingTop: 32 }}>
          <Text style={{ textAlign: 'center', fontSize: 14.5, lineHeight: 21, color: palette.textMuted }}>
            Чтобы публиковать посты и комментарии, подтвердите номер телефона.
          </Text>
          <Pressable
            onPress={() => navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Settings')}
            style={{ backgroundColor: palette.accent, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accentContrast }}>Подтвердить телефон</Text>
          </Pressable>
        </View>
      );
    }
    const text = tab === 'posts' ? 'Постов пока нет.' : tab === 'comments' ? 'Комментариев пока нет.' : 'Репостов пока нет.';
    return <Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>{text}</Text>;
  };

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
          ListEmptyComponent={renderEmpty()}
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
        ListEmptyComponent={renderEmpty()}
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </View>
  );
}
