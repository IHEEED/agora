import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { formatCompactAge } from '../lib/formatDate';
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

type Actor = { id: string; username: string; avatar_url?: string | null };

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
  reply: 'ответил вам',
  comment: 'прокомментировал запись',
  vote_post: 'проголосовал за запись',
  vote_comment: 'проголосовал за комментарий',
  follow: 'подписался',
  repost: 'поделился записью',
};

export function NotificationsScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
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
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        ListHeaderComponent={
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                onPress={() => navigation.goBack()}
                hitSlop={8}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}
              >
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="m15 6-6 6 6 6" />
                </Svg>
              </Pressable>
              <Text style={{ fontFamily: 'Georgia', fontSize: 30, color: palette.text }}>
                Уведомления<Text style={{ color: palette.accent }}>.</Text>
              </Text>
            </View>
            {loading ? <Text style={{ paddingTop: 16, color: palette.textMuted }}>Загрузка…</Text> : null}
            {!loading && items.length === 0 ? (
              <Text style={{ paddingTop: 16, color: palette.textMuted }}>Новых уведомлений нет. Пока тихо.</Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const unread = item.read_at === null;
          return (
            <Pressable
              onPress={() => openTarget(item)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: unread ? palette.surface2 : 'transparent',
                borderBottomWidth: 1,
                borderBottomColor: palette.border,
              }}
            >
              <Avatar name={item.actor?.username ?? '?'} uri={item.actor?.avatar_url} size={44} />
              <Text style={{ flex: 1, fontSize: 14.5, lineHeight: 19, color: palette.text }}>
                <Text style={{ fontWeight: '700' }}>{item.actor?.username ?? 'кто-то'}</Text> {WHAT[item.kind]}
              </Text>
              <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{formatCompactAge(item.created_at)}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
