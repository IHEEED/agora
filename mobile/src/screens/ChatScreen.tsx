import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiFetch } from '../lib/api';
import { uploadImage } from '../lib/uploadImage';
import { useSession } from '../lib/useSession';
import { Message, UserProfile } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/** Эмодзи для быстрой реакции по долгому тапу — как в вебе. */
const QUICK_REACTIONS = ['❤️', '👍', '😂', '🔥', '😮', '😢'];

type Palette = ReturnType<typeof usePalette>;

/** Время письма: 22:14. */
function clock(iso: string) {
  return format(new Date(iso), 'HH:mm');
}
/** Заголовок-разделитель дня: «25 августа», «Сегодня», «Вчера». */
function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return 'Сегодня';
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return 'Вчера';
  return format(d, 'd MMMM', { locale: ru });
}
function mmss(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Одна переписка — по устройству веб-чата.
 *
 * Свои письма справа акцентом, чужие слева поверхностью. У каждого письма время,
 * у своих — галочки прочтения и метка «изменено»; картинки и голосовые своими
 * пузырями; реакции — эмодзи под пузырём; дни разделены датой. Запись голоса и
 * постановку реакций тапом добавим отдельным заходом — здесь пока показ и
 * отправка текста и картинок.
 */
export function ChatScreen() {
  const palette = usePalette();
  const route = useRoute<RouteProp<RootStackParamList, 'Chat'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userId, username } = route.params;
  const { session } = useSession();
  const me = session?.user.id;

  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reacting, setReacting] = useState<string | null>(null);
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const listRef = useRef<FlatList<Message>>(null);

  const load = useCallback(() => {
    apiFetch<Message[]>(`/messages/${userId}`)
      .then(setMessages)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить'));
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
      apiFetch(`/messages/${userId}/read`, { method: 'POST' }).catch(() => {});
      apiFetch<UserProfile>(`/users/${userId}`).then((p) => setPeerAvatar(p.avatar_url ?? null)).catch(() => {});
    }, [load, userId])
  );

  // Лицо и имя собеседника в шапке — как в вебе, вместо одного имени.
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Avatar name={username} uri={peerAvatar} size={30} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: palette.text }}>{username}</Text>
        </View>
      ),
    });
  }, [navigation, username, peerAvatar, palette.text]);

  /** Поставить/снять реакцию на письмо. */
  async function react(messageId: string, emoji: string) {
    setReacting(null);
    if (!me) return;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const rest = (m.reactions ?? []).filter((r) => r.userId !== me);
        const had = (m.reactions ?? []).some((r) => r.userId === me && r.emoji === emoji);
        return { ...m, reactions: had ? rest : [...rest, { emoji, userId: me }] };
      })
    );
    try {
      await apiFetch(`/messages/${messageId}/reaction`, { method: 'PUT', body: JSON.stringify({ emoji }) });
    } catch {
      load();
    }
  }

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
      setMessages((prev) => [...prev, created]);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  }

  async function sendImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (result.canceled || !result.assets[0]?.base64) return;
    setSending(true);
    try {
      const asset = result.assets[0];
      const url = await uploadImage(asset.base64!, asset.mimeType ?? 'image/jpeg', 'messages');
      const created = await apiFetch<Message>('/messages', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: userId, image_url: url }),
      });
      setMessages((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить картинку');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12, gap: 4 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const prev = messages[index - 1];
          const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(item.created_at).toDateString();
          return (
            <>
              {newDay ? (
                <View style={{ alignItems: 'center', marginVertical: 10 }}>
                  <View style={{ backgroundColor: palette.surface2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 12, color: palette.textMuted }}>{dayLabel(item.created_at)}</Text>
                  </View>
                </View>
              ) : null}
              <Bubble palette={palette} message={item} mine={item.sender_id === me} onLongPress={() => setReacting(item.id)} />
            </>
          );
        }}
      />

      {/* Выбор реакции по долгому тапу. */}
      <Modal visible={reacting !== null} transparent animationType="fade" onRequestClose={() => setReacting(null)}>
        <Pressable onPress={() => setReacting(null)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ flexDirection: 'row', gap: 6, backgroundColor: palette.surface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 8 }}>
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable key={emoji} onPress={() => reacting && react(reacting, emoji)} hitSlop={4} style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {error ? <Text style={{ paddingHorizontal: 16, paddingBottom: 4, color: palette.down }}>{error}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: palette.border, backgroundColor: palette.surface }}>
        <Pressable onPress={sendImage} hitSlop={8} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
            <Path d="m4 16 4.5-4.5 3 3L16 10l4 4" />
            <Path d="M9 9.5a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0Z" fill={palette.textMuted} />
          </Svg>
        </Pressable>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Сообщение"
          placeholderTextColor={palette.textMuted}
          multiline
          style={{ flex: 1, maxHeight: 120, fontSize: 15, color: palette.text, backgroundColor: palette.surface2, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 }}
        />
        <Pressable
          onPress={send}
          disabled={sending || !body.trim()}
          style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent, opacity: sending || !body.trim() ? 0.4 : 1 }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M12 19V5M6 11l6-6 6 6" />
          </Svg>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ palette, message, mine, onLongPress }: { palette: Palette; message: Message; mine: boolean; onLongPress: () => void }) {
  const ink = mine ? palette.accentContrast : palette.text;
  const sub = mine ? `${palette.accentContrast}b0` : palette.textMuted;
  const hasImage = Boolean(message.image_url);
  const hasAudio = Boolean(message.audio_url);
  const reactions = message.reactions ?? [];

  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', marginTop: 2 }}>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={280}
        style={{
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: mine ? palette.accent : palette.surface2,
          paddingHorizontal: hasImage ? 0 : 14,
          paddingTop: hasImage ? 0 : 8,
          paddingBottom: hasImage ? 0 : 8,
        }}
      >
        {message.forwardedFrom ? (
          <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 2, color: mine ? palette.accentContrast : palette.accent }}>
            Переслано от {message.forwardedFrom.username}
          </Text>
        ) : null}

        {hasImage ? (
          <Image source={{ uri: message.image_url! }} style={{ width: 240, height: 240 }} resizeMode="cover" />
        ) : hasAudio ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: mine ? `${palette.accentContrast}33` : palette.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill={ink}><Path d="M8 5v14l11-7z" /></Svg>
            </View>
            {/* Волна — палочками, как в вебе. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, height: 22 }}>
              {[8, 14, 20, 12, 18, 9, 16, 22, 11, 15, 7, 13].map((h, i) => (
                <View key={i} style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: mine ? `${palette.accentContrast}99` : palette.textMuted }} />
              ))}
            </View>
            <Text style={{ fontSize: 12, color: sub }}>{mmss(message.audio_seconds ?? 0)}</Text>
          </View>
        ) : null}

        {message.body ? (
          <Text style={{ fontSize: 15, lineHeight: 20, color: ink, paddingHorizontal: hasImage ? 14 : 0, paddingTop: hasImage ? 8 : 0, paddingBottom: hasImage ? 8 : 0 }}>
            {message.body}
          </Text>
        ) : null}

        {/* Мета: время, «изменено», галочки прочтения у своих. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingHorizontal: hasImage ? 10 : 0, paddingBottom: hasImage ? 6 : 0, marginTop: 2 }}>
          {message.edited_at ? <Text style={{ fontSize: 11, color: sub }}>изменено</Text> : null}
          <Text style={{ fontSize: 11, color: sub }}>{clock(message.created_at)}</Text>
          {mine ? (
            <Svg width={15} height={12} viewBox="0 0 24 18" fill="none" stroke={message.read_at ? (mine ? palette.accentContrast : palette.accent) : sub} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M2 9l4 4 8-9" />
              {message.read_at ? <Path d="M9 13l1 1 8-9" /> : null}
            </Svg>
          ) : null}
        </View>
      </Pressable>

      {reactions.length > 0 ? (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 3, alignSelf: mine ? 'flex-end' : 'flex-start' }}>
          {Object.entries(reactions.reduce<Record<string, number>>((acc, r) => { acc[r.emoji] = (acc[r.emoji] ?? 0) + 1; return acc; }, {})).map(([emoji, count]) => (
            <View key={emoji} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: palette.surface2, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ fontSize: 12 }}>{emoji}</Text>
              {count > 1 ? <Text style={{ fontSize: 11, color: palette.textMuted }}>{count}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
