import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { useSubscribe } from '../lib/useSubscribe';
import { Post, PostSort } from '../lib/types';
import { PostCard } from '../components/PostCard';
import { Badge } from '../components/Badge';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Community'>;

const SORT_OPTIONS: { value: PostSort; label: string }[] = [
  { value: 'hot', label: 'Горячее' },
  { value: 'new', label: 'Новое' },
  { value: 'top', label: 'Топ' },
  { value: 'commented', label: 'Обсуждаемые' },
];

export function CommunityScreen({ navigation, route }: Props) {
  const { community } = route.params;
  const palette = usePalette();
  const { session } = useSession();
  const { isSubscribed, subscriberCount, toggle, error: subscribeError } = useSubscribe(
    community.id,
    Boolean(community.isSubscribed),
    community.subscriberCount
  );
  const [sort, setSort] = useState<PostSort>('hot');
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: community.name,
      headerRight: () =>
        session ? (
          <Pressable onPress={() => navigation.navigate('CreatePost', { communityId: community.id })} hitSlop={8}>
            <Text style={{ fontSize: 24, fontWeight: '400', color: palette.accent }}>+</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, community.name, community.id, session, palette.accent]);

  const loadPosts = useCallback(() => {
    apiFetch<Post[]>(`/posts/community/${community.id}?sort=${sort}`)
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [community.id, sort]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts])
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Text style={{ fontSize: 13, color: palette.textMuted }}>
              {subscriberCount} {subscriberCount === 1 ? 'подписчик' : 'подписчиков'}
            </Text>
            <Badge type={community.creator.badge} />
          </View>

          {session ? (
            <Pressable
              onPress={toggle}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 999,
                backgroundColor: isSubscribed ? palette.surface2 : palette.accent,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: isSubscribed ? palette.text : palette.accentContrast }}>
                {isSubscribed ? 'Вы подписаны' : 'Подписаться'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {subscribeError ? <Text style={{ fontSize: 12, color: palette.down }}>{subscribeError}</Text> : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 12 }}>
        {SORT_OPTIONS.map((option) => {
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
              <Text style={{ fontSize: 13, fontWeight: '600', color: on ? palette.accentContrast : palette.textMuted }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {loading ? <Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>Загрузка…</Text> : null}
      {error ? <Text style={{ paddingHorizontal: 16, color: palette.down }}>{error}</Text> : null}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={{ color: palette.textMuted, textAlign: 'center', marginTop: 40 }}>
              В этом клубе пока нет записей.
            </Text>
          ) : null
        }
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </View>
  );
}
