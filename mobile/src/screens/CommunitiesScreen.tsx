import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { Community } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { TopBar } from '../components/TopBar';
import { usePalette } from '../theme';
import type { RootStackParamList, TabParamList } from '../navigation/types';

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Communities'>,
  NativeStackNavigationProp<RootStackParamList>
>;

/**
 * Клубы — список сообществ, по образцу веба.
 *
 * Заголовок экрана и «плюс» акцентным кружком справа; ниже — плоские карточки
 * на приглушённом холсте: знак сообщества, имя и описание. Число подписчиков
 * в карточке не показываем — как и в вебе, оно перегружало строку.
 */
export function CommunitiesScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const { session } = useSession();

  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return communities;
    return communities.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
  }, [communities, query]);

  useFocusEffect(
    useCallback(() => {
      apiFetch<Community[]>('/communities')
        .then(setCommunities)
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    }, [])
  );

  function openCreate() {
    const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    (parent ?? navigation).navigate('CreateCommunity');
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar right="search" />

      {/* Крупный заголовок экрана и «плюс» — под общей шапкой, как в вебе. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
        <Text style={{ fontFamily: 'Georgia', fontSize: 30, color: palette.text }}>
          Клубы<Text style={{ color: palette.accent }}>.</Text>
        </Text>
        {session ? (
          <Pressable
            onPress={openCreate}
            hitSlop={8}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={2.3} strokeLinecap="round">
              <Path d="M12 5v14M5 12h14" />
            </Svg>
          </Pressable>
        ) : null}
      </View>

      {loading ? <Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>Загрузка…</Text> : null}
      {error ? <Text style={{ paddingHorizontal: 16, color: palette.down }}>{error}</Text> : null}

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: insets.bottom + 80, gap: 10 }}
        ListHeaderComponent={
          communities.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 6, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: palette.surface2 }}>
              <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z" />
                <Path d="m20 20-4.3-4.3" />
              </Svg>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Поиск"
                placeholderTextColor={palette.textMuted}
                style={{ flex: 1, fontSize: 15, color: palette.text, paddingVertical: 2 }}
              />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={{ color: palette.textMuted, textAlign: 'center', marginTop: 40 }}>
              {query ? 'Ничего не нашлось.' : 'Клубов пока нет.'}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
              (parent ?? navigation).navigate('Community', { community: item });
            }}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderRadius: 16,
              padding: 16,
              backgroundColor: palette.surface2,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <Avatar name={item.name} size={52} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: palette.text }}>
                {item.name}
              </Text>
              {item.description ? (
                <Text numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 18, color: palette.textMuted }}>
                  {item.description}
                </Text>
              ) : null}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}
