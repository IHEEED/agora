import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
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
import { ScreenHeader } from '../components/ScreenHeader';
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      <ScreenHeader
        title="Клубы"
        right={
          session ? (
            <Pressable
              onPress={openCreate}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: palette.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={2.3} strokeLinecap="round">
                <Path d="M12 5v14M5 12h14" />
              </Svg>
            </Pressable>
          ) : undefined
        }
      />

      {loading ? <Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>Загрузка…</Text> : null}
      {error ? <Text style={{ paddingHorizontal: 16, color: palette.down }}>{error}</Text> : null}

      <FlatList
        data={communities}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: insets.bottom + 80, gap: 10 }}
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={{ color: palette.textMuted, textAlign: 'center', marginTop: 40 }}>Клубов пока нет.</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
              (parent ?? navigation).navigate('Community', { community: item });
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 14,
              borderRadius: 16,
              padding: 16,
              backgroundColor: palette.surface2,
            }}
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
