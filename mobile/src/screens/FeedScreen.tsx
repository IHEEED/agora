import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Post, PostSort } from '../lib/types';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { StoriesBar } from '../components/StoriesBar';
import { SuggestedPeople } from '../components/SuggestedPeople';
import { BellIcon, SearchIcon } from '../components/icons';
import { useSession } from '../lib/useSession';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Три способа сортировки, те же и в том же порядке, что в вебе.
 *
 * «Горячее» с его формулой затухания убрано намеренно: понять по нему, почему
 * запись стоит именно здесь, нельзя даже автору. Оставшиеся три объяснимы одним
 * словом каждый. «Свежие» первыми и по умолчанию.
 */
const SORTS: { value: PostSort; label: string }[] = [
  { value: 'new', label: 'Свежие' },
  { value: 'commented', label: 'Обсуждаемые' },
  { value: 'viewed', label: 'Популярные' },
];

export function FeedScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useSession();

  const [sort, setSort] = useState<PostSort>('new');
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    apiFetch<Post[]>(`/posts?sort=${sort}`)
      .then(setPosts)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [sort]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const emailHandle = session?.user.email?.split('@')[0] ?? '?';

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Шапка: колокол уведомлений слева, знак :P по центру. Тот же расклад,
          что в вебе, где уведомления переехали в шапку. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: insets.top + 6,
          paddingBottom: 10,
        }}
      >
        <Pressable onPress={() => navigation.navigate('Notifications')} hitSlop={10}>
          <BellIcon size={24} color={palette.control} />
        </Pressable>
        <Text style={{ fontSize: 22, fontWeight: '800', color: palette.text }}>
          :<Text style={{ color: palette.accent }}>P</Text>
        </Text>
        <Pressable onPress={() => navigation.navigate('Search')} hitSlop={10}>
          <SearchIcon size={22} color={palette.control} />
        </Pressable>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(post) => post.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={palette.accent}
          />
        }
        ListHeaderComponent={
          <View>
            <StoriesBar />

            {/* Строка «напишите пару фраз» — вход в создание записи, как в вебе. */}
            <Pressable
              onPress={() => navigation.navigate('CreatePost', { communityId: '' })}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: palette.border,
              }}
            >
              <Avatar name={emailHandle} size={32} />
              <Text style={{ fontSize: 15, color: palette.textMuted }}>Напишите пару фраз…</Text>
            </Pressable>

            {/* Сегменты сортировки. */}
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 }}>
              {SORTS.map((option) => {
                const on = sort === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setSort(option.value)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 7,
                      borderRadius: 999,
                      backgroundColor: on ? palette.accent : palette.surface2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: on ? palette.accentContrast : palette.textMuted,
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <SuggestedPeople />

            {loading ? (
              <Text style={{ paddingHorizontal: 16, paddingVertical: 8, color: palette.textMuted }}>
                Загрузка…
              </Text>
            ) : null}
            {error ? (
              <Text style={{ paddingHorizontal: 16, paddingVertical: 8, color: palette.down }}>
                {error}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </View>
  );
}
