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
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111' }}>+</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, community.name, community.id, session]);

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
    <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
            <Text style={{ fontSize: 12, color: '#666' }}>
              {subscriberCount} {subscriberCount === 1 ? 'подписчик' : 'подписчиков'}
            </Text>
            <Badge type={community.creator.badge} />
          </View>

          {session ? (
            <Pressable
              onPress={toggle}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 999,
                backgroundColor: isSubscribed ? '#eee' : '#111',
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: isSubscribed ? '#333' : '#fff' }}>
                {isSubscribed ? 'Вы подписаны' : 'Подписаться'}
              </Text>
            </Pressable>
          ) : null}
        </View>
        {subscribeError ? <Text style={{ fontSize: 12, color: '#dc2626' }}>{subscribeError}</Text> : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, padding: 12 }}>
        {SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => setSort(option.value)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: sort === option.value ? '#111' : '#eee',
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: sort === option.value ? '#fff' : '#444' }}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? <Text style={{ paddingHorizontal: 16, color: '#666' }}>Загрузка…</Text> : null}
      {error ? <Text style={{ paddingHorizontal: 16, color: '#dc2626' }}>{error}</Text> : null}

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 10 }}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>
              В этом сообществе пока нет постов.
            </Text>
          ) : null
        }
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </View>
  );
}
