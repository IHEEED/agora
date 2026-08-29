import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { VerifiedMark } from '../components/VerifiedMark';
import { SuggestedPeople } from '../components/SuggestedPeople';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Уведомления — один в один с вебом.
 *
 * Крупный заголовок «Уведомления.», ниже строки, разделённые волосяной чертой:
 * лицо автора, что он сделал (глаголом от третьего лица) и когда. Непрочитанное
 * подсвечено фоном. Помечается прочитанным при открытии — одним разом, с
 * отсечкой по времени самого свежего. Подписка ведёт к человеку, остальное — к
 * записи.
 */

type Actor = { id: string; username: string; avatar_url?: string | null; verified_at?: string | null };

type Notification = {
  id: string;
  kind: 'reply' | 'comment' | 'vote_post' | 'vote_comment' | 'follow' | 'repost';
  read_at: string | null;
  created_at: string;
  actor: Actor | null;
  post: { id: string; title: string } | null;
  comment: { id: string; body: string; post_id: string } | null;
};

const WHAT: Record<Notification['kind'], string> = {
  reply: 'ответил',
  comment: 'прокомментировал',
  vote_post: 'проголосовал за запись',
  vote_comment: 'проголосовал за комментарий',
  follow: 'подписался',
  repost: 'поделился записью',
};

/** Контекст под именем: текст комментария или заголовок записи. */
function contextOf(item: Notification): string | null {
  if (item.kind === 'reply' || item.kind === 'comment') return item.comment?.body ?? null;
  return item.post?.title ?? null;
}

/** Время: «только что», «N мин», «N ч», «N дн» — как в вебе. */
function when(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} дн`;
}

export function NotificationsScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    apiFetch<{ notifications: Notification[] }>('/notifications')
      .then((data) => {
        const list = data.notifications ?? [];
        setItems(list);
        const newest = list[0]?.created_at;
        if (newest && list.some((n) => n.read_at === null)) {
          apiFetch('/notifications/read', { method: 'POST', body: JSON.stringify({ until: newest }) }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  function openTarget(item: Notification) {
    if (item.kind === 'follow' && item.actor) navigation.navigate('User', { userId: item.actor.id });
    else if (item.comment) navigation.navigate('Post', { postId: item.comment.post_id });
    else if (item.post) navigation.navigate('Post', { postId: item.post.id });
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar back right="none" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: insets.bottom + 24 }}
        scrollIndicatorInsets={{ top: topInset }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text }}>
              Уведомления<Text style={{ color: palette.accent }}>.</Text>
            </Text>
            {loading ? <Text style={{ paddingTop: 16, color: palette.textMuted }}>Загрузка…</Text> : null}
          </View>
        }
        ListFooterComponent={
          // Пусто — колокол-подсказка и «кого почитать», как в вебе.
          !loading && items.length === 0 ? (
            <View style={{ paddingHorizontal: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: palette.surface2 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${palette.accent}22`, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5" /><Path d="M13.7 20a2 2 0 0 1-3.4 0" />
                  </Svg>
                </View>
                <Text style={{ flex: 1, fontSize: 14, lineHeight: 19, color: palette.textMuted }}>
                  Новых уведомлений нет. Пока тихо — вот кого можно почитать.
                </Text>
              </View>
              <SuggestedPeople />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const unread = item.read_at === null;
          const context = contextOf(item);
          return (
            <Pressable
              onPress={() => openTarget(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: unread ? `${palette.accent}1f` : 'transparent',
              }}
            >
              <Avatar name={item.actor?.username ?? '?'} uri={item.actor?.avatar_url} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14.5, fontWeight: '600', color: palette.text }}>
                    {item.actor?.username ?? 'кто-то'}
                  </Text>
                  <VerifiedMark verified={item.actor?.verified_at} size={14} />
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14.5, color: palette.text }}> {WHAT[item.kind]}</Text>
                </View>
                {context ? <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted }}>{context}</Text> : null}
              </View>
              <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{when(item.created_at)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
