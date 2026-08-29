import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Community, Post } from '../lib/types';
import { formatRelativeDate } from '../lib/formatDate';
import { Avatar } from '../components/Avatar';
import { VerifiedMark } from '../components/VerifiedMark';
import { FollowButton } from '../components/FollowButton';
import { SuggestedPeople } from '../components/SuggestedPeople';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Person = { id: string; username: string; avatar_url?: string | null; verified_at?: string | null; karma: number; isFollowing?: boolean };
type Scope = 'all' | 'people' | 'posts' | 'communities';

const SCOPES: ReadonlyArray<readonly [Scope, string]> = [
  ['all', 'Всё'],
  ['people', 'Люди'],
  ['posts', 'Посты'],
  ['communities', 'Клубы'],
];

const HISTORY_KEY = 'parafraz-search-history';

/**
 * Поиск — один в один с вебом (/search).
 *
 * Клиентский: тянет три списка (люди, записи, клубы) и фильтрует по запросу.
 * Крупный заголовок, строка-подчёркивание с лупой, обойма областей во всю
 * ширину. Пустой запрос показывает историю поиска (на устройстве) и «кого
 * почитать». Записи в выдаче — компактными строками, а не карточками.
 */
export function SearchScreen() {
  const palette = usePalette();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [focused, setFocused] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<Person[]>('/users').then(setPeople).catch(() => {});
    apiFetch<Post[]>('/posts?sort=new').then(setPosts).catch(() => {});
    apiFetch<Community[]>('/communities').then(setCommunities).catch(() => {});
    AsyncStorage.getItem(HISTORY_KEY)
      .then((raw) => {
        try {
          const list = raw ? JSON.parse(raw) : [];
          if (Array.isArray(list)) setHistory(list);
        } catch {
          // повреждённая запись — начинаем с пустой истории
        }
      })
      .catch(() => {});
  }, []);

  const writeHistory = useCallback((next: string[]) => {
    setHistory(next);
    AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  const remember = useCallback(
    (value: string) => {
      const item = value.trim();
      if (item.length < 2) return;
      writeHistory([item, ...history.filter((x) => x !== item)].slice(0, 8));
    },
    [history, writeHistory]
  );

  const removeFromHistory = (item: string) => writeHistory(history.filter((x) => x !== item));

  const q = query.trim().toLowerCase();
  const foundPeople = useMemo(() => (q ? people.filter((p) => p.username.toLowerCase().includes(q)) : []), [people, q]);
  const foundCommunities = useMemo(
    () => (q ? communities.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) : []),
    [communities, q]
  );
  const foundPosts = useMemo(
    () =>
      q
        ? posts.filter(
            (p) =>
              p.title.toLowerCase().includes(q) ||
              p.body?.toLowerCase().includes(q) ||
              p.author.username.toLowerCase().includes(q)
          )
        : [],
    [posts, q]
  );

  const showPeople = (scope === 'all' || scope === 'people') && foundPeople.length > 0;
  const showCommunities = (scope === 'all' || scope === 'communities') && foundCommunities.length > 0;
  const showPosts = (scope === 'all' || scope === 'posts') && foundPosts.length > 0;
  const nothing = q.length > 0 && !showPeople && !showCommunities && !showPosts;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, paddingTop: topInset }}>
      <TopBar back right="none" />

      {/* Крупный заголовок с акцентной точкой — как ScreenTitle в вебе. */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text }}>
          {t('Поиск')}<Text style={{ color: palette.accent }}>.</Text>
        </Text>
      </View>

      {/* Строка поиска — подчёркиванием (field-line), лупа слева. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          marginHorizontal: 16,
          paddingLeft: 2,
          paddingVertical: 4,
          borderBottomWidth: 1,
          borderBottomColor: focused ? palette.accent : palette.border,
        }}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="11" cy="11" r="6.5" />
          <Path d="m20 20-4.3-4.3" />
        </Svg>
        <TextInput
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); remember(query); }}
          onSubmitEditing={() => remember(query)}
          placeholder={t('Посты, люди, клубы…')}
          placeholderTextColor={palette.textMuted}
          returnKeyType="search"
          autoFocus
          style={{ flex: 1, paddingVertical: 8, fontSize: 15, color: palette.text }}
        />
      </View>

      {/* Обойма областей во всю ширину: рамка, активная — акцентом. */}
      <View style={{ flexDirection: 'row', gap: 4, marginHorizontal: 16, marginTop: 12, padding: 4, borderRadius: 999, borderWidth: 1, borderColor: palette.border }}>
        {SCOPES.map(([value, label]) => {
          const on = scope === value;
          return (
            <Pressable
              key={value}
              onPress={() => setScope(value)}
              style={{ flex: 1, borderRadius: 999, paddingVertical: 6, alignItems: 'center', backgroundColor: on ? palette.accent : 'transparent' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? palette.accentContrast : palette.textMuted }}>{t(label)}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={{ flex: 1, marginTop: 8 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      >
        {/* Пустой запрос: история поиска + «кого почитать». */}
        {!q ? (
          <View>
            {history.length > 0 ? (
              <View style={{ paddingHorizontal: 16 }}>
                <Text style={{ paddingBottom: 4, fontSize: 13, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.textMuted }}>
                  {t('История поиска')}
                </Text>
                {history.map((item) => (
                  <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable onPress={() => setQuery(item)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                        <Circle cx="12" cy="12" r="9" />
                        <Path d="M12 7v5l3 2" />
                      </Svg>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, color: palette.text }}>{item}</Text>
                    </Pressable>
                    <Pressable onPress={() => removeFromHistory(item)} hitSlop={8} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
                      <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={2} strokeLinecap="round">
                        <Path d="M6 6l12 12M18 6 6 18" />
                      </Svg>
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ marginTop: history.length > 0 ? 12 : 0 }}>
              <SuggestedPeople />
            </View>
          </View>
        ) : null}

        {showPeople ? (
          <Section title={t('Люди')} palette={palette}>
            {foundPeople.map((person) => (
              <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
                <Pressable onPress={() => navigation.navigate('User', { userId: person.id })}>
                  <Avatar name={person.username} uri={person.avatar_url} size={40} />
                </Pressable>
                <Pressable onPress={() => navigation.navigate('User', { userId: person.id })} style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: palette.text }}>{person.username}</Text>
                    <VerifiedMark verified={person.verified_at} size={14} />
                  </View>
                  <Text style={{ fontSize: 12, color: palette.textMuted }}>
                    <Text>{person.karma}</Text> influence
                  </Text>
                </Pressable>
                <FollowButton userId={person.id} initiallyFollowing={person.isFollowing} />
              </View>
            ))}
          </Section>
        ) : null}

        {showCommunities ? (
          <Section title={t('Клубы')} palette={palette}>
            {foundCommunities.map((community) => (
              <Pressable
                key={community.id}
                onPress={() => navigation.navigate('Community', { community })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}
              >
                <Avatar name={community.name} size={40} kind="community" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{community.name}</Text>
                  {community.description ? (
                    <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted }}>{community.description}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </Section>
        ) : null}

        {showPosts ? (
          <Section title={t('Посты')} palette={palette}>
            {foundPosts.map((post) => (
              <Pressable
                key={post.id}
                onPress={() => navigation.navigate('Post', { postId: post.id })}
                style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 2 }}
              >
                <Text numberOfLines={2} style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{post.title}</Text>
                <Text style={{ fontSize: 12, color: palette.textMuted }}>
                  {post.author.username} · {formatRelativeDate(post.created_at)}
                </Text>
              </Pressable>
            ))}
          </Section>
        ) : null}

        {nothing ? (
          <Text style={{ paddingVertical: 40, textAlign: 'center', color: palette.textMuted }}>
            {t('По запросу «')}{query.trim()}{t('» ничего не нашлось.')}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Section({ title, palette, children }: { title: string; palette: ReturnType<typeof usePalette>; children: React.ReactNode }) {
  return (
    <View style={{ paddingTop: 8 }}>
      <Text style={{ paddingHorizontal: 16, paddingVertical: 6, fontSize: 13, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.textMuted }}>
        {title}
      </Text>
      {children}
    </View>
  );
}
