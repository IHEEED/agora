import { useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { AvatarFollow } from '../components/AvatarFollow';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'People'>;

/** То, что отдаёт /users/:id/followers и подобные — как UserSummary в вебе. */
type Person = {
  id: string;
  username: string;
  karma: number;
  avatar_url?: string | null;
  isFollowing?: boolean;
};

/**
 * Список людей шторкой — один в один с вебом (PeopleSheet).
 *
 * Подписчики, подписки, участники сообщества — один и тот же экран, разница
 * только в адресе запроса и заголовке. Значок подписки живёт на аватарке
 * (AvatarFollow) и не уводит в профиль; нажатие на имя — уводит.
 */
export function PeopleScreen({ route, navigation }: Props) {
  const { endpoint, emptyText } = route.params;
  const palette = usePalette();
  const insets = useSafeAreaInsets();

  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Person[]>(endpoint)
      .then(setPeople)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить список'));
  }, [endpoint]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <FlatList
        data={people ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 16 }}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: palette.border, marginLeft: 58 }} />}
        ListEmptyComponent={
          error ? (
            <Text style={{ paddingVertical: 24, color: palette.down }}>{error}</Text>
          ) : people === null ? (
            <Text style={{ paddingVertical: 24, textAlign: 'center', color: palette.textMuted }}>Загрузка…</Text>
          ) : (
            <Text style={{ paddingVertical: 48, textAlign: 'center', color: palette.textMuted }}>{emptyText}</Text>
          )
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
            <AvatarFollow
              userId={item.id}
              username={item.username}
              avatar={item.avatar_url}
              initiallyFollowing={item.isFollowing}
              size={46}
            />
            <Pressable
              onPress={() => navigation.navigate('User', { userId: item.id })}
              style={{ flex: 1, minWidth: 0 }}
            >
              <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>
                {item.username}
              </Text>
              <Text style={{ fontSize: 12.5, color: palette.textMuted }}>
                <Text style={{ color: palette.text }}>{item.karma}</Text> influence
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
