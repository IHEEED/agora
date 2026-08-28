import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Уведомления — в том же виде, что в вебе.
 *
 * Ответ, комментарий, поддержка голосом, подписка, репост. Непрочитанное
 * подсвечено фоном, а не точкой сбоку. Помечается прочитанным при открытии
 * экрана — одним разом, с отсечкой по времени самого свежего.
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
  vote_post: 'поддержал запись',
  vote_comment: 'поддержал комментарий',
  follow: 'подписался на вас',
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
        // Прочитано при открытии — одним разом, с отсечкой по свежему.
        const newest = list[0]?.created_at;
        if (newest && list.some((n) => n.read_at === null)) {
          apiFetch('/notifications/read', {
            method: 'POST',
            body: JSON.stringify({ until: newest }),
          }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openTarget(item: Notification) {
    if (item.comment) navigation.navigate('Post', { postId: item.comment.post_id });
    else if (item.post) navigation.navigate('Post', { postId: item.post.id });
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {loading ? (
        <Text style={{ padding: 16, color: palette.textMuted }}>Загрузка…</Text>
      ) : null}

      {!loading && items.length === 0 ? (
        <Text style={{ padding: 16, color: palette.textMuted }}>
          Новых уведомлений нет. Пока тихо.
        </Text>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + 72 }}
        renderItem={({ item }) => {
          const unread = item.read_at === null;
          const context =
            item.kind === 'reply' || item.kind === 'comment'
              ? item.comment?.body
              : item.post?.title;
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
              <Avatar name={item.actor?.username ?? '?'} uri={item.actor?.avatar_url} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14.5, color: palette.text }}>
                  <Text style={{ fontWeight: '600' }}>{item.actor?.username ?? 'кто-то'}</Text>{' '}
                  {WHAT[item.kind]}
                </Text>
                {context ? (
                  <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted }}>
                    {context}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
