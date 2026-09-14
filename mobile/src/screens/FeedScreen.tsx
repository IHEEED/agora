import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Post, PostSort } from '../lib/types';
import { PostCard } from '../components/PostCard';
import { Avatar } from '../components/Avatar';
import { StoriesBar } from '../components/StoriesBar';
import { SuggestedPeople } from '../components/SuggestedPeople';
import { SegmentedControl } from '../components/SegmentedControl';
import { SkeletonPost } from '../components/SkeletonPost';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { useSession } from '../lib/useSession';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Лента — перенесена с веба (app/page.tsx) один в один.
 *
 * Полоса историй, строка-вход в создание записи волосяной чертой, переключатель
 * сортировки едущей каплей (Свежие/Обсуждаемые/Популярные), рекомендации и
 * сплошной список записей, разделённый полосками. «Горячее» с формулой
 * затухания убрано намеренно: три оставшихся порядка объяснимы одним словом.
 */
const SORTS = [
  ['new', 'Свежие'],
  ['commented', 'Обсуждаемые'],
  ['viewed', 'Популярные'],
] as const satisfies ReadonlyArray<readonly [PostSort, string]>;

/** Ответ ленты с курсором: старше приезжает страницами (см. бэкенд /posts). */
type FeedPage = { posts: Post[]; nextCursor: string | null };
const PAGE = 20;

/** Терпимость к старому бэкенду: пока он не передеплоен, ?limit отдаёт плоский
 *  массив — считаем это единственной страницей без курсора. */
function asPage(res: FeedPage | Post[]): FeedPage {
  return Array.isArray(res) ? { posts: res, nextCursor: null } : res;
}

export function FeedScreen() {
  const palette = usePalette();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useSession();

  const [sort, setSort] = useState<PostSort>('new');
  const [posts, setPosts] = useState<Post[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Догрузка только для «Свежих»: там порядок хронологический и курсор по
  // created_at точен. У «Обсуждаемых»/«Популярных» переход между страницами по
  // created_at ломал бы их порядок — там остаётся один экран (как в вебе).
  const paginated = sort === 'new';

  const load = useCallback(() => {
    // Для «Свежих» — первая страница с курсором; для остальных полный список
    // одним экраном (без limit), как на вебе.
    const url = paginated ? `/posts?sort=${sort}&limit=${PAGE}` : `/posts?sort=${sort}`;
    apiFetch<FeedPage | Post[]>(url)
      .then((raw) => { const res = asPage(raw); setPosts(res.posts); setNextCursor(res.nextCursor); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не получилось загрузить — попробуйте ещё раз'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [paginated, sort]);

  // Догрузка более старых записей по курсору: страницы идут строго «старше».
  const loadMore = useCallback(() => {
    if (!paginated || loadingMore || !nextCursor) return;
    setLoadingMore(true);
    apiFetch<FeedPage | Post[]>(`/posts?sort=${sort}&limit=${PAGE}&cursor=${encodeURIComponent(nextCursor)}`)
      .then((raw) => {
        const res = asPage(raw);
        // Страховка от дублей: курсор строго «<», пересечений быть не должно.
        setPosts((prev) => {
          const seen = new Set(prev.map((p) => p.id));
          return [...prev, ...res.posts.filter((p) => !seen.has(p.id))];
        });
        setNextCursor(res.nextCursor);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  }, [paginated, sort, nextCursor, loadingMore]);

  useFocusEffect(useCallback(() => load(), [load]));

  const emailHandle = session?.user.email?.split('@')[0] ?? '?';
  const hairline = useMemo(() => palette.border, [palette.border]);

  const header = (
    <View style={{ gap: 16, paddingTop: 4 }}>
      <StoriesBar />

      {/* Вход в создание записи — строкой с волосяной чертой во всю ширину
          (field-line в вебе), а не плашкой. */}
      <Pressable
        onPress={() => navigation.navigate('CreatePost', { communityId: '' })}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: hairline }}
      >
        <Avatar name={emailHandle} size={32} />
        <Text style={{ fontSize: 15, color: palette.textMuted }}>{t('Напишите пару фраз…')}</Text>
      </Pressable>

      <View style={{ paddingHorizontal: 16 }}>
        <SegmentedControl value={sort} options={SORTS.map(([v, l]) => [v, t(l)] as const)} onChange={setSort} />
      </View>

      <SuggestedPeople />

      {error ? <Text style={{ paddingHorizontal: 16, color: palette.down }}>{error}</Text> : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar right="search" />

      {loading ? (
        // Скелетоны геометрией настоящих карточек: подмена не двигает раскладку.
        <View style={{ paddingTop: topInset }}>
          {header}
          <View style={{ marginTop: 4 }}>
            <SkeletonPost />
            <SkeletonPost />
            <SkeletonPost />
          </View>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          contentContainerStyle={{ paddingTop: topInset, paddingBottom: insets.bottom + 72 }}
          scrollIndicatorInsets={{ top: topInset }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.accent} progressViewOffset={topInset} />
          }
          ListHeaderComponent={header}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ paddingVertical: 20 }} color={palette.textMuted} /> : null
          }
          ListEmptyComponent={
            !error ? (
              <View style={{ alignItems: 'center', gap: 14, paddingVertical: 64 }}>
                <Text style={{ color: palette.textMuted }}>{t('В ленте пока пусто.')}</Text>
                <Pressable
                  onPress={() => navigation.navigate('Communities' as never)}
                  style={{ backgroundColor: palette.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 10 }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accentContrast }}>{t('Найти клубы')}</Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => <PostCard post={item} />}
        />
      )}

      {/* Создание записи — плавающая кнопка над стеклянным баром. */}
      <Pressable
        onPress={() => navigation.navigate('CreatePost', { communityId: '' })}
        style={{ position: 'absolute', right: 20, bottom: insets.bottom + 80, width: 56, height: 56, borderRadius: 28, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 }}
      >
        <Text style={{ fontSize: 30, lineHeight: 34, color: palette.accentContrast }}>+</Text>
      </Pressable>
    </View>
  );
}
