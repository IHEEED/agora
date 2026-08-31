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
import { TopBar, useTopBarInset } from '../components/TopBar';
import { useT } from '../lib/i18n';
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
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
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
    // Нативным модал-экраном (presentation: 'modal') — он выезжает и тянется
    // вниз тем же красивым жестом, что и «новый пост».
    const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    (parent ?? navigation).navigate('CreateCommunity');
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar right="search" />

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 10, paddingBottom: insets.bottom + 80, gap: 10 }}
        scrollIndicatorInsets={{ top: topInset }}
        ListHeaderComponent={
          <View>
            {/* Заголовок и «плюс» — уезжают под стеклянную шапку при прокрутке. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingBottom: 12 }}>
              <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text }}>
                {t('Клубы')}<Text style={{ color: palette.accent }}>.</Text>
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

            {communities.length > 0 ? (
              // Поиск волосяной строкой, как в вебе (field-line): лупа и
              // постоянная подпись «Поиск» слева, ввод — за ними.
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 6, marginBottom: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: palette.border }}>
                <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M11 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z" />
                  <Path d="m20 20-4.3-4.3" />
                </Svg>
                <Text style={{ fontSize: 15, color: palette.textMuted }}>{t('Поиск')}</Text>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  style={{ flex: 1, fontSize: 15, color: palette.text, paddingVertical: 2 }}
                />
              </View>
            ) : null}

            {loading ? <Text style={{ paddingHorizontal: 10, color: palette.textMuted }}>{t('Загрузка…')}</Text> : null}
            {error ? <Text style={{ paddingHorizontal: 10, color: palette.down }}>{error}</Text> : null}
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <View style={{ marginHorizontal: 6, borderRadius: 16, backgroundColor: palette.surface, padding: 24 }}>
              <Text style={{ color: palette.textMuted, textAlign: 'center' }}>
                {query ? t('Ничего не нашлось.') : t('Клубов пока нет.')}
              </Text>
            </View>
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
              backgroundColor: palette.surface,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <Avatar name={item.name} size={52} kind="community" />
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
