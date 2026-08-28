import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { apiFetch } from '../lib/api';
import { Post, PostSort } from '../lib/types';
import { PostCard } from '../components/PostCard';

const SORT_OPTIONS: { value: PostSort; label: string }[] = [
  { value: 'hot', label: 'Горячее' },
  { value: 'new', label: 'Новое' },
  { value: 'top', label: 'Топ' },
  { value: 'commented', label: 'Обсуждаемые' },
];

export function FeedScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [sort, setSort] = useState<PostSort>('hot');
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(() => {
    apiFetch<Post[]>(`/posts?sort=${sort}`)
      .then(setPosts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sort]);

  useFocusEffect(
    useCallback(() => {
      loadPosts();
    }, [loadPosts])
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
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
        contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 16 + tabBarHeight, gap: 10 }}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>Постов пока нет.</Text>
          ) : null
        }
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </View>
  );
}
