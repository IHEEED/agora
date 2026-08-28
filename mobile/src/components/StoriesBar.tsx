import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../lib/api';
import { Avatar } from './Avatar';
import { usePalette } from '../theme';

/**
 * Полоса историй наверху ленты, как в вебе.
 *
 * Первый кружок — своя история с плюсом; дальше люди, у которых есть свежая
 * история. Кольцо вокруг непросмотренной — акцентом, у просмотренной —
 * приглушённое. Конструктора историй в мобильном пока нет, поэтому «своя»
 * ведёт в никуда; кружки чужих — на будущий просмотрщик.
 */

type StoryGroup = {
  author: { id: string; username: string; avatar_url?: string | null };
  items: unknown[];
  unseen: number;
};

/** Кружок в кольце — как аватар с обводкой в вебе. */
function Ring({
  children,
  color,
  dashed = false,
}: {
  children: React.ReactNode;
  color: string;
  dashed?: boolean;
}) {
  return (
    <View
      style={{
        width: 68,
        height: 68,
        borderRadius: 34,
        borderWidth: 2.5,
        borderColor: color,
        borderStyle: dashed ? 'dashed' : 'solid',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </View>
  );
}

export function StoriesBar() {
  const palette = usePalette();
  const [groups, setGroups] = useState<StoryGroup[]>([]);

  const load = useCallback(() => {
    apiFetch<StoryGroup[] | { stories: StoryGroup[] }>('/stories')
      .then((data) => setGroups(Array.isArray(data) ? data : (data.stories ?? [])))
      .catch(() => {});
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingVertical: 12 }}
    >
      {/* Своя история — пунктирное кольцо с плюсом. */}
      <View style={{ alignItems: 'center', gap: 4, width: 72 }}>
        <Ring color={palette.border} dashed>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: palette.surface2,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ fontSize: 22, color: palette.accent }}>+</Text>
          </View>
        </Ring>
        <Text numberOfLines={1} style={{ fontSize: 11.5, color: palette.textMuted }}>
          Ваша история
        </Text>
      </View>

      {groups.map((group) => (
        <View key={group.author.id} style={{ alignItems: 'center', gap: 4, width: 72 }}>
          <Ring color={group.unseen > 0 ? palette.accent : palette.border}>
            <Avatar name={group.author.username} uri={group.author.avatar_url} size={56} />
          </Ring>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: palette.text }}>
            {group.author.username}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}
