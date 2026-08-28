import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Thread } from '../lib/types';
import { usePalette } from '../theme';
import { formatRelativeDate } from '../lib/formatDate';
import type { RootStackParamList } from '../navigation/types';

/**
 * Список переписок.
 *
 * Первый из перенесённых с веба экранов мессенджера. Форма ответа та же, что у
 * веб-клиента, — оба берут /messages/threads: закреплённые сверху, дальше по
 * свежести письма, у каждой строки лицо, имя, последняя реплика и счётчик
 * непрочитанных.
 *
 * Пустых аватарок нет: пока лицо не загрузилось или его не поставили, рисуем
 * кружок с первой буквой имени — как и на вебе.
 */
export function MessagesScreen() {
  const palette = usePalette();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Thread[]>('/messages/threads')
      .then(setThreads)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить'))
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {loading ? (
        <Text style={{ padding: 16, color: palette.textMuted }}>Загрузка…</Text>
      ) : null}
      {error ? <Text style={{ padding: 16, color: palette.down }}>{error}</Text> : null}

      {!loading && !error && threads.length === 0 ? (
        <Text style={{ padding: 16, color: palette.textMuted }}>
          Переписок пока нет. Напишите кому-нибудь из профиля.
        </Text>
      ) : null}

      <FlatList
        data={threads}
        keyExtractor={(thread) => thread.user.id}
        contentContainerStyle={{ paddingVertical: 4 }}
        renderItem={({ item }) => {
          const name = item.user.display_name || item.user.username;
          return (
            <Pressable
              onPress={() =>
                navigation.navigate('Chat', {
                  userId: item.user.id,
                  username: name,
                })
              }
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 10,
                backgroundColor: pressed ? palette.surface2 : 'transparent',
              })}
            >
              {/* Кружок с буквой вместо пустой аватарки. */}
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: palette.surface2,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '600', color: palette.textMuted }}>
                  {name.slice(0, 1).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text
                    numberOfLines={1}
                    style={{ flexShrink: 1, fontSize: 15, fontWeight: '600', color: palette.text }}
                  >
                    {name}
                  </Text>
                  {item.user.verified_at ? (
                    <Text style={{ color: '#1d9bf0', fontSize: 13 }}>✓</Text>
                  ) : null}
                  {item.muted ? (
                    <Text style={{ color: palette.textMuted, fontSize: 12 }}>🔕</Text>
                  ) : null}
                </View>
                <Text numberOfLines={1} style={{ fontSize: 13, color: palette.textMuted }}>
                  {item.lastMessage.mine ? 'Вы: ' : ''}
                  {item.lastMessage.body}
                </Text>
              </View>

              <View style={{ alignItems: 'flex-end', gap: 4 }}>
                <Text style={{ fontSize: 11, color: palette.textMuted }}>
                  {formatRelativeDate(item.lastMessage.created_at)}
                </Text>
                {item.unread > 0 ? (
                  <View
                    style={{
                      minWidth: 20,
                      height: 20,
                      borderRadius: 10,
                      paddingHorizontal: 6,
                      backgroundColor: palette.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: palette.accentContrast }}>
                      {item.unread}
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}
