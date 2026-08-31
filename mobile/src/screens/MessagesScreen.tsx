import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Thread } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { VerifiedMark } from '../components/VerifiedMark';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import { formatCompactAge } from '../lib/formatDate';
import type { RootStackParamList } from '../navigation/types';

/**
 * Мессенджер — список переписок, по образцу веба.
 *
 * Заголовок «Мессенджер.», справа кнопка «Написать» → выбор человека. Строки:
 * лицо, имя с галочкой, значки приглушения и закрепа, последняя реплика, время
 * и счётчик непрочитанных. Долгий тап открывает меню переписки: закрепить,
 * отметить прочитанным, приглушить, удалить (с переспросом — письма уходят у
 * обоих). Настройки правим у себя сразу, сервер догоняет.
 */
export function MessagesScreen() {
  const palette = usePalette();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<Thread | null>(null);

  const load = useCallback(() => {
    apiFetch<Thread[]>('/messages/threads')
      .then((list) => {
        setThreads(list);
        // Мысли-облачка собеседников — одним запросом на весь список, как в вебе.
        const ids = list.map((t) => t.user.id).join(',');
        if (ids) {
          apiFetch<{ author_id: string; body: string }[]>(`/notes?ids=${ids}`)
            .then((rows) => setNotes(Object.fromEntries(rows.map((n) => [n.author_id, n.body]))))
            .catch(() => {});
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  function patch(peerId: string, p: { pinned?: boolean; muted?: boolean }) {
    setThreads((prev) => prev.map((t) => (t.user.id === peerId ? { ...t, ...p } : t)));
    apiFetch(`/messages/prefs/${peerId}`, { method: 'PATCH', body: JSON.stringify(p) }).catch(() => {});
  }

  function markRead(peerId: string) {
    setThreads((prev) => prev.map((t) => (t.user.id === peerId ? { ...t, unread: 0 } : t)));
    apiFetch(`/messages/${peerId}/read`, { method: 'POST' }).catch(() => {});
  }

  function confirmDelete(thread: Thread) {
    setMenuFor(null);
    Alert.alert(t('Удалить переписку?'), t('Все письма исчезнут у обоих. Вернуть их будет нечем.'), [
      { text: t('Отмена'), style: 'cancel' },
      {
        text: t('Удалить'),
        style: 'destructive',
        onPress: () => {
          setThreads((prev) => prev.filter((t) => t.user.id !== thread.user.id));
          apiFetch(`/messages/thread/${thread.user.id}`, { method: 'DELETE' }).catch(() => {});
        },
      },
    ]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar right="search" />

      <FlatList
        data={threads}
        keyExtractor={(thread) => thread.user.id}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: insets.bottom + 80 }}
        scrollIndicatorInsets={{ top: topInset }}
        ListHeaderComponent={
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 8 }}>
            <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text }}>
              {t('Мессенджер')}<Text style={{ color: palette.accent }}>.</Text>
            </Text>
            <Pressable
              onPress={() => navigation.navigate('NewMessage')}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center' }}
            >
              <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" /><Path d="M14.5 7.5 16.5 9.5" />
              </Svg>
            </Pressable>
          </View>
        }
        ListEmptyComponent={
          !loading && !error ? (
            <Text style={{ paddingHorizontal: 16, paddingVertical: 40, textAlign: 'center', lineHeight: 21, color: palette.textMuted }}>
              {t('Переписок пока нет.')}{'\n'}{t('Напишите первому — кнопка справа сверху.')}
            </Text>
          ) : loading ? <Text style={{ paddingHorizontal: 16, color: palette.textMuted }}>{t('Загрузка…')}</Text> : null
        }
        renderItem={({ item }) => {
          const name = item.user.display_name || item.user.username;
          return (
            <Pressable
              onPress={() => navigation.navigate('Chat', { userId: item.user.id, username: name })}
              onLongPress={() => setMenuFor(item)}
              delayLongPress={280}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? palette.surface2 : 'transparent' })}
            >
              <View>
                <Avatar name={name} uri={item.user.avatar_url} size={48} />
                {notes[item.user.id] ? (
                  // Облачко-мысль над лицом, как в вебе.
                  <View style={{ position: 'absolute', top: -12, left: 20, maxWidth: 150, backgroundColor: palette.surface2, borderRadius: 12, borderBottomLeftRadius: 3, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: palette.textMuted }}>{notes[item.user.id]}</Text>
                  </View>
                ) : null}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: palette.text }}>{name}</Text>
                  <VerifiedMark verified={item.user.verified_at} size={14} />
                  {item.muted ? (
                    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><Path d="M4 4l16 16M6 8a6 6 0 0 1 .3-1.9M18 8c0 5 2 6 2 6H8M9.7 19a2 2 0 0 0 3.4 0" /></Svg>
                  ) : null}
                  {item.pinned ? (
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill={palette.textMuted}><Path d="M14 3l7 7-3 1-3 5-2-2-4 4-1-1 4-4-2-2 5-3z" /></Svg>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 13, color: item.unread > 0 ? palette.text : palette.textMuted }}>
                  {item.lastMessage.mine ? t('Вы: ') : ''}{item.lastMessage.body}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontSize: 11, color: palette.textMuted }}>{formatCompactAge(item.lastMessage.created_at)}</Text>
                {item.unread > 0 ? (
                  <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 6, backgroundColor: item.muted ? palette.control : palette.accent, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: item.muted ? palette.bg : palette.accentContrast }}>{item.unread}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      {/* Меню переписки по долгому тапу — шторкой снизу, как в вебе. */}
      <Modal visible={menuFor !== null} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable onPress={() => setMenuFor(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: insets.bottom + 12 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border, marginBottom: 4 }} />
            {menuFor ? (
              <Text style={{ textAlign: 'center', paddingVertical: 8, fontSize: 15, fontWeight: '700', color: palette.text }}>
                {menuFor.user.display_name || menuFor.user.username}
              </Text>
            ) : null}
            {menuFor ? (
              <>
                <Item palette={palette} label={menuFor.pinned ? 'Открепить' : 'Закрепить'} onPress={() => { patch(menuFor.user.id, { pinned: !menuFor.pinned }); setMenuFor(null); }} />
                {menuFor.unread > 0 ? <Item palette={palette} label="Отметить прочитанным" onPress={() => { markRead(menuFor.user.id); setMenuFor(null); }} /> : null}
                <Item palette={palette} label={menuFor.muted ? 'Вернуть звук' : 'Приглушить'} onPress={() => { patch(menuFor.user.id, { muted: !menuFor.muted }); setMenuFor(null); }} />
                <Item palette={palette} label="Удалить переписку" danger onPress={() => confirmDelete(menuFor)} />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Item({ palette, label, onPress, danger = false }: { palette: ReturnType<typeof usePalette>; label: string; onPress: () => void; danger?: boolean }) {
  const { t } = useT();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 15, backgroundColor: pressed ? palette.surface2 : 'transparent' })}>
      <Text style={{ fontSize: 16, color: danger ? palette.down : palette.text }}>{t(label)}</Text>
    </Pressable>
  );
}
