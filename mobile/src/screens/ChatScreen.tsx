import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Image, Keyboard, Modal, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, createAudioPlayer, setAudioModeAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { apiFetch } from '../lib/api';
import { uploadImage } from '../lib/uploadImage';
import { useSession } from '../lib/useSession';
import { Message, UserProfile } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/** Быстрые реакции — как в вебе: первыми пара стрелок (согласие/несогласие),
 *  затем эмодзи. Стрелки хранятся строками 'up'/'down', рисуются значком. */
const QUICK_REACTIONS = ['up', 'down', '❤️', '👍', '🔥', '😂', '😮', '😢'];

/** Один значок реакции: стрелка для 'up'/'down', иначе — эмодзи. */
function ReactionGlyph({ emoji, size, color }: { emoji: string; size: number; color: string }) {
  if (emoji === 'up' || emoji === 'down') {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        {emoji === 'up' ? <Path d="M12 19V5M6 11l6-6 6 6" /> : <Path d="M12 5v14M6 13l6 6 6-6" />}
      </Svg>
    );
  }
  return <Text style={{ fontSize: size }}>{emoji}</Text>;
}

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
  const [reacting, setReacting] = useState<{ id: string; x: number; y: number; mine: boolean } | null>(null);
  const [peerAvatar, setPeerAvatar] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const topInset = useTopBarInset();
  const insets = useSafeAreaInsets();
  const dark = useColorScheme() === 'dark';
  const PEER_H = 54;
  const [kbHeight, setKbHeight] = useState(0);
  const listRef = useRef<FlatList<Message>>(null);

  // Сами поднимаем поле ввода над клавиатурой: KeyboardAvoidingView не двигает
  // absolute-элемент, а поле у нас накладное (стеклянное). Заодно доводим
  // список до низа, чтобы за клавиатурой не пряталось последнее письмо.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      setKbHeight(e.endCoordinates.height);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    });
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const playerRef = useRef<ReturnType<typeof createAudioPlayer> | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder);

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

  /** Проиграть голосовое (или остановить, если оно уже играет). */
  function playVoice(message: Message) {
    if (!message.audio_url) return;
    playerRef.current?.remove();
    if (playingId === message.id) { setPlayingId(null); return; }
    const player = createAudioPlayer({ uri: message.audio_url });
    playerRef.current = player;
    player.play();
    setPlayingId(message.id);
    // Сбрасываем значок play, когда дослушали (по длительности — надёжнее событий).
    setTimeout(() => setPlayingId((cur) => (cur === message.id ? null : cur)), ((message.audio_seconds ?? 0) + 1) * 1000);
  }

  async function startRecording() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) { setError('Нет доступа к микрофону — разрешите в настройках.'); return; }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }

  async function stopRecording() {
    const seconds = Math.round((recState.durationMillis ?? 0) / 1000);
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri || seconds < 1) return;
    setSending(true);
    try {
      const base64 = await new File(uri).base64();
      const url = await uploadImage(base64, 'audio/m4a', 'voice');
      const created = await apiFetch<Message>('/messages', {
        method: 'POST',
        body: JSON.stringify({ recipient_id: userId, audio_url: url, audio_seconds: seconds }),
      });
      setMessages((prev) => [...prev, created]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить голосовое');
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar right="search" />

      {/* Строка собеседника: «назад» кружком, ник с лицом пилюлей, «ещё»
          кружком. Накладная и стеклянная — список едет под ней, как под баром
          ленты; никаких жёстких границ. */}
      <MaskedView
        style={{ position: 'absolute', top: topInset, left: 0, right: 0, height: PEER_H + 16, zIndex: 9 }}
        maskElement={<LinearGradient colors={['#000', '#000', 'transparent']} locations={[0, 0.7, 1]} style={{ flex: 1 }} />}
      >
        <BlurView tint={dark ? 'dark' : 'light'} intensity={24} style={{ flex: 1 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.bg, opacity: 0.5 }} />
      </MaskedView>
      <View style={{ position: 'absolute', top: topInset, left: 0, right: 0, height: PEER_H, zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="m15 6-6 6 6 6" /></Svg>
        </Pressable>
        <Pressable onPress={() => navigation.navigate('User', { userId })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: palette.surface, borderRadius: 999, paddingLeft: 4, paddingRight: 14, paddingVertical: 4 }}>
          <Avatar name={username} uri={peerAvatar} size={30} />
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{username}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={6} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill={palette.text}><Circle cx="5" cy="12" r="1.7" /><Circle cx="12" cy="12" r="1.7" /><Circle cx="19" cy="12" r="1.7" /></Svg>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyboardShouldPersistTaps="handled"
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ paddingTop: topInset + PEER_H + 8, paddingBottom: insets.bottom + 72, paddingHorizontal: 12, gap: 4 }}
        scrollIndicatorInsets={{ top: topInset + PEER_H, bottom: 60 }}
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
              <Bubble
                palette={palette}
                message={item}
                mine={item.sender_id === me}
                playing={playingId === item.id}
                onPlay={() => playVoice(item)}
                onLongPress={(x, y) => setReacting({ id: item.id, x, y, mine: item.sender_id === me })}
              />
            </>
          );
        }}
      />

      {/* Выбор реакции — маленькой лентой прямо над сообщением, у места касания,
          а не на весь экран. Фон прозрачный: тап мимо закрывает. */}
      <Modal visible={reacting !== null} transparent animationType="fade" onRequestClose={() => setReacting(null)}>
        <Pressable onPress={() => setReacting(null)} style={{ flex: 1 }}>
          {reacting ? (
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: Math.max(70, reacting.y - 58),
                left: Math.min(Math.max(8, reacting.x - 150), 400),
                flexDirection: 'row',
                gap: 2,
                backgroundColor: palette.surface,
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 6,
                shadowColor: '#000',
                shadowOpacity: 0.18,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
                elevation: 8,
              }}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <Pressable key={emoji} onPress={() => reacting && react(reacting.id, emoji)} hitSlop={2} style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}>
                  <ReactionGlyph emoji={emoji} size={24} color={palette.text} />
                </Pressable>
              ))}
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>

      {error ? <Text style={{ paddingHorizontal: 16, paddingBottom: 4, color: palette.down }}>{error}</Text> : null}

      {/* Поле ввода — накладное и стеклянное, поднимается над клавиатурой;
          верхний край растворяется маской, жёсткой линии нет. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: kbHeight, zIndex: 9 }}>
      <MaskedView style={{ position: 'absolute', top: -16, left: 0, right: 0, bottom: 0 }} maskElement={<LinearGradient colors={['transparent', '#000', '#000']} locations={[0, 0.35, 1]} style={{ flex: 1 }} />}>
        <BlurView tint={dark ? 'dark' : 'light'} intensity={24} style={{ flex: 1 }} />
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: palette.bg, opacity: 0.6 }} />
      </MaskedView>
      {recState.isRecording ? (
        // Идёт запись: красная точка, таймер и кнопка «отправить голосовое».
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: (kbHeight > 0 ? 8 : insets.bottom + 8) }}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: palette.down }} />
          <Text style={{ flex: 1, fontSize: 15, color: palette.text }}>Запись… {mmss((recState.durationMillis ?? 0) / 1000)}</Text>
          <Pressable onPress={stopRecording} style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent }}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 19V5M6 11l6-6 6 6" />
            </Svg>
          </Pressable>
        </View>
      ) : (
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: (kbHeight > 0 ? 8 : insets.bottom + 8) }}>
          {/* Поле-овал: слева картинка, посередине текст, справа микрофон или
              отправка — всё внутри одной обоймы, как в вебе. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: palette.surface2, borderRadius: 24, paddingLeft: 8, paddingRight: 6, paddingVertical: 4 }}>
            <Pressable onPress={sendImage} hitSlop={8} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={23} height={23} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
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
              style={{ flex: 1, maxHeight: 110, fontSize: 15, color: palette.text, paddingVertical: 8 }}
            />
            {body.trim() ? (
              <Pressable onPress={send} disabled={sending} style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.accent, opacity: sending ? 0.4 : 1 }}>
                <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><Path d="M12 19V5M6 11l6-6 6 6" /></Svg>
              </Pressable>
            ) : (
              <Pressable onPress={startRecording} hitSlop={4} style={{ width: 34, height: 34, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3Z" />
                  <Path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                </Svg>
              </Pressable>
            )}
          </View>
        </View>
      )}
      </View>

      {/* Меню чата по «…»: пожаловаться. */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable onPress={() => setMenuOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 34 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border, marginBottom: 8 }} />
            <Pressable
              onPress={() => { setMenuOpen(false); apiFetch('/reports', { method: 'POST', body: JSON.stringify({ reason: 'abuse', userId }) }).catch(() => {}); }}
              style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 15, backgroundColor: pressed ? palette.surface2 : 'transparent' })}
            >
              <Text style={{ fontSize: 16, color: palette.down }}>Пожаловаться</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Bubble({ palette, message, mine, playing, onPlay, onLongPress }: { palette: Palette; message: Message; mine: boolean; playing: boolean; onPlay: () => void; onLongPress: (x: number, y: number) => void }) {
  const ink = mine ? palette.accentContrast : palette.text;
  const sub = mine ? `${palette.accentContrast}b0` : palette.textMuted;
  const hasImage = Boolean(message.image_url);
  const hasAudio = Boolean(message.audio_url);
  const reactions = message.reactions ?? [];

  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', marginTop: 2 }}>
      <Pressable
        onLongPress={(e) => onLongPress(e.nativeEvent.pageX, e.nativeEvent.pageY)}
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
            <Pressable onPress={onPlay} hitSlop={6} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: mine ? `${palette.accentContrast}33` : palette.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill={ink}>
                {playing ? <Path d="M6 5h4v14H6zM14 5h4v14h-4z" /> : <Path d="M8 5v14l11-7z" />}
              </Svg>
            </Pressable>
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
            <View key={emoji} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: palette.surface2, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 }}>
              <ReactionGlyph emoji={emoji} size={13} color={palette.text} />
              {count > 1 ? <Text style={{ fontSize: 11, color: palette.textMuted }}>{count}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
