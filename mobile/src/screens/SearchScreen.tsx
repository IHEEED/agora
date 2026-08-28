import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Community, Post } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { VerifiedMark } from '../components/VerifiedMark';
import { PostCard } from '../components/PostCard';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Person = { id: string; username: string; avatar_url?: string | null; verified_at?: string | null; karma: number };
type Scope = 'all' | 'people' | 'posts' | 'communities';
const SCOPES: { value: Scope; label: string }[] = [
  { value: 'all', label: 'Всё' },
  { value: 'people', label: 'Люди' },
  { value: 'posts', label: 'Записи' },
  { value: 'communities', label: 'Клубы' },
];

/**
 * Поиск — как в вебе: клиентский, по уже загруженным людям, записям и клубам.
 *
 * Отдельного серверного поиска нет и там; экран тянет три списка и фильтрует их
 * по запросу. Область сужается вкладками. Пустой запрос ничего не показывает —
 * лента для этого и так есть.
 */
export function SearchScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [people, setPeople] = useState<Person[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);

  useEffect(() => {
    apiFetch<Person[]>('/users').then(setPeople).catch(() => {});
    apiFetch<Post[]>('/posts?sort=new').then(setPosts).catch(() => {});
    apiFetch<Community[]>('/communities').then(setCommunities).catch(() => {});
  }, []);

  const q = query.trim().toLowerCase();
  const foundPeople = useMemo(() => (q ? people.filter((p) => p.username.toLowerCase().includes(q)) : []), [people, q]);
  const foundCommunities = useMemo(
    () => (q ? communities.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)) : []),
    [communities, q]
  );
  const foundPosts = useMemo(
    () => (q ? posts.filter((p) => p.title.toLowerCase().includes(q) || p.body?.toLowerCase().includes(q)) : []),
    [posts, q]
  );

  const showPeople = (scope === 'all' || scope === 'people') && foundPeople.length > 0;
  const showCommunities = (scope === 'all' || scope === 'communities') && foundCommunities.length > 0;
  const showPosts = (scope === 'all' || scope === 'posts') && foundPosts.length > 0;
  const nothing = q.length > 0 && !showPeople && !showCommunities && !showPosts;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, paddingTop: insets.top + 8 }}>
      {/* Строка поиска. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: palette.surface2 }}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="11" cy="11" r="6.5" />
          <Path d="m20 20-4.3-4.3" />
        </Svg>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск людей, записей, клубов"
          placeholderTextColor={palette.textMuted}
          autoFocus
          style={{ flex: 1, fontSize: 15, color: palette.text }}
        />
      </View>

      {/* Область поиска. */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 10 }}>
        {SCOPES.map((option) => {
          const on = scope === option.value;
          return (
            <Pressable key={option.value} onPress={() => setScope(option.value)} style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: on ? palette.accent : palette.surface2 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? palette.accentContrast : palette.textMuted }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={showPosts ? foundPosts : []}
        keyExtractor={(post) => post.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        ListHeaderComponent={
          <View>
            {showPeople ? (
              <Section palette={palette} title="Люди">
                {foundPeople.map((person) => (
                  <Pressable
                    key={person.id}
                    onPress={() => navigation.navigate('User', { userId: person.id })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}
                  >
                    <Avatar name={person.username} uri={person.avatar_url} size={44} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{person.username}</Text>
                      <VerifiedMark verified={person.verified_at} size={14} />
                    </View>
                  </Pressable>
                ))}
              </Section>
            ) : null}

            {showCommunities ? (
              <Section palette={palette} title="Клубы">
                {foundCommunities.map((community) => (
                  <Pressable
                    key={community.id}
                    onPress={() => navigation.navigate('Community', { community })}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 }}
                  >
                    <Avatar name={community.name} size={44} kind="community" />
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{community.name}</Text>
                      {community.description ? (
                        <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted }}>{community.description}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                ))}
              </Section>
            ) : null}

            {showPosts ? <Section palette={palette} title="Записи">{null}</Section> : null}
            {nothing ? <Text style={{ paddingHorizontal: 16, paddingVertical: 20, color: palette.textMuted }}>Ничего не нашлось.</Text> : null}
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </View>
  );
}

function Section({ palette, title, children }: { palette: ReturnType<typeof usePalette>; title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontSize: 13, fontWeight: '700', color: palette.textMuted, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>{title}</Text>
      {children}
    </View>
  );
}
