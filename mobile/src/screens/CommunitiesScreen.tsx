import { useCallback, useLayoutEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { Community } from '../lib/types';
import { Badge } from '../components/Badge';
import type { RootStackParamList, TabParamList } from '../navigation/types';

// экран живёт внутри Tab.Navigator, но должен уметь открывать экраны
// из родительского Stack (Community, CreateCommunity) — CompositeNavigationProp
// даёт корректную типизацию для обоих уровней навигации сразу
type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Communities'>,
  NativeStackNavigationProp<RootStackParamList>
>;

function HeaderRight() {
  const { session } = useSession();
  const navigation = useNavigation<Nav>();

  if (!session) return null;

  return (
    <Pressable
      onPress={() => {
        // .navigate() отсюда должен бы бабблиться в родительский Stack сам,
        // но после переезда на вложенные табы понадёжнее адресовать явно
        const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
        (parent ?? navigation).navigate('CreateCommunity');
      }}
      hitSlop={8}
    >
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#111' }}>+</Text>
    </Pressable>
  );
}

export function CommunitiesScreen() {
  const navigation = useNavigation<Nav>();
  // Нативный таб-бар считает свою высоту сам, а useBottomTabBarHeight с ним
  // падает. Берём нижнюю безопасную зону и добавляем высоту бара, чтобы
  // список не уходил под него.
  const insets = useSafeAreaInsets();
  const tabBarHeight = insets.bottom + 64;
  const [communities, setCommunities] = useState<Community[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <HeaderRight /> });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Community[]>('/communities')
        .then(setCommunities)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#fafafa' }}>
      {loading ? <Text style={{ padding: 16, color: '#666' }}>Загрузка…</Text> : null}
      {error ? <Text style={{ padding: 16, color: '#dc2626' }}>{error}</Text> : null}

      <FlatList
        data={communities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 16 + tabBarHeight, gap: 10 }}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={{ color: '#666', textAlign: 'center', marginTop: 40 }}>Сообществ пока нет.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
              (parent ?? navigation).navigate('Community', { community: item });
            }}
            style={{
              borderWidth: 1,
              borderColor: '#e5e5e5',
              borderRadius: 8,
              padding: 14,
              backgroundColor: '#fff',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
              <Badge type={item.badge} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <Text style={{ fontSize: 12, color: '#888' }}>создано {item.creator.username}</Text>
              <Badge type={item.creator.badge} />
              <Text style={{ fontSize: 12, color: '#888' }}>
                · {item.subscriberCount} {item.subscriberCount === 1 ? 'подписчик' : 'подписчиков'}
              </Text>
            </View>
            {item.description ? (
              <Text style={{ fontSize: 13, color: '#555', marginTop: 4 }}>{item.description}</Text>
            ) : null}
          </Pressable>
        )}
      />
    </View>
  );
}
