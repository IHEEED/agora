import { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRoute, type RouteProp } from '@react-navigation/native';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { Message } from '../lib/types';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Одна переписка.
 *
 * Перенос веб-экрана в его сути: свои письма справа акцентом, чужие слева
 * поверхностью, поле ввода снизу. Всё богатство веба — реакции, ответы,
 * голосовые, удержание — сюда пока не переносится: сначала должна работать
 * простая отправка, а остальное ложится на неё слоями.
 *
 * Список перевёрнут (inverted): у переписки естественный низ — последнее
 * письмо, и открываться она должна на нём, а не на первом сообщении полугодовой
 * давности. Перевёрнутый FlatList держит прокрутку у последнего элемента сам.
 */
export function ChatScreen() {
  const palette = usePalette();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const { userId } = route.params;
  const { session } = useSession();
  const me = session?.user.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(() => {
    apiFetch<Message[]>(`/messages/${userId}`)
      .then(setMessages)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить'));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Открыли переписку — она прочитана. Ошибку глушим: точка на вкладке не
      // тот повод, чтобы показывать сбой поверх разговора.
      apiFetch(`/messages/${userId}/read`, { method: 'POST' }).catch(() => {});
    }, [load, userId])
  );

  async function send() {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setError(null);

    try {
      const created = await apiFetch<Message>('/messages', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: userId, body: text }),
      });
      // Дописываем в начало: список перевёрнут, и «начало» массива — это низ
      // экрана, где и должно появиться новое письмо.
      setMessages((prev) => [created, ...prev]);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  }

  // Перевёрнутый список хочет данные от новых к старым.
  const reversed = [...messages].reverse();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={listRef}
        data={reversed}
        inverted
        keyboardShouldPersistTaps="handled"
        keyExtractor={(message) => message.id}
        contentContainerStyle={{ padding: 12, gap: 6 }}
        renderItem={({ item }) => {
          const mine = item.sender_id === me;
          return (
            <View
              style={{
                alignSelf: mine ? 'flex-end' : 'flex-start',
                maxWidth: '80%',
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 8,
                backgroundColor: mine ? palette.accent : palette.surface2,
              }}
            >
              {item.forwardedFrom ? (
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    marginBottom: 2,
                    color: mine ? palette.accentContrast : palette.accent,
                  }}
                >
                  Переслано от {item.forwardedFrom.username}
                </Text>
              ) : null}
              <Text style={{ fontSize: 15, color: mine ? palette.accentContrast : palette.text }}>
                {item.body}
              </Text>
            </View>
          );
        }}
      />

      {error ? (
        <Text style={{ paddingHorizontal: 16, paddingBottom: 4, color: palette.down }}>{error}</Text>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderTopWidth: 1,
          borderTopColor: palette.border,
          backgroundColor: palette.surface,
        }}
      >
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Сообщение…"
          placeholderTextColor={palette.textMuted}
          multiline
          style={{
            flex: 1,
            maxHeight: 120,
            fontSize: 15,
            color: palette.text,
            backgroundColor: palette.surface2,
            borderRadius: 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
          }}
        />
        <Pressable
          onPress={send}
          disabled={sending || !body.trim()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: palette.accent,
            opacity: sending || !body.trim() ? 0.4 : 1,
          }}
        >
          <Text style={{ fontSize: 18, color: palette.accentContrast }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
