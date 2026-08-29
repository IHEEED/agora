import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../lib/api';
import { StoryGroup } from '../lib/types';
import { Avatar } from './Avatar';
import { VerifiedMark } from './VerifiedMark';
import { formatCompactAge } from '../lib/formatDate';
import { usePalette } from '../theme';

/**
 * Полноэкранный просмотрщик историй — как в вебе.
 *
 * Сверху полоски по числу кадров, текущая наливается за пять секунд, потом кадр
 * сам сменяется. Тап справа — вперёд, слева — назад; удержание ставит время на
 * паузу. Внизу — ответ автору (уходит в личные) и реакция-сердечко на кадр.
 * Дойдя до конца автора, переходим к следующему; после последнего закрываемся.
 * Каждый показанный кадр отмечаем просмотренным на сервере.
 */

const ITEM_MS = 5000;
const { width, height } = Dimensions.get('window');

export function StoryViewer({
  groups,
  startIndex,
  onClose,
}: {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [itemIndex, setItemIndex] = useState(0);
  const [held, setHeld] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [reacted, setReacted] = useState<Record<string, boolean>>({});

  const progress = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const valueRef = useRef(0);

  const group = groups[groupIndex];
  const item = group?.items[itemIndex];

  useEffect(() => {
    const id = progress.addListener(({ value }) => { valueRef.current = value; });
    return () => progress.removeListener(id);
  }, [progress]);

  // Отметить кадр просмотренным на сервере.
  useEffect(() => {
    if (item && !item.seen) apiFetch(`/stories/${item.id}/seen`, { method: 'POST' }).catch(() => {});
  }, [item]);

  // Наливаем полоску от начала и по завершении идём вперёд.
  useEffect(() => {
    if (!item) return;
    run(0);
    return () => anim.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, itemIndex]);

  // Пока держат палец или пишут ответ — время стоит.
  useEffect(() => {
    if (held || replying) anim.current?.stop();
    else run(valueRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [held, replying]);

  function run(from: number) {
    progress.setValue(from);
    const a = Animated.timing(progress, { toValue: 1, duration: ITEM_MS * (1 - from), useNativeDriver: false });
    anim.current = a;
    a.start(({ finished }) => { if (finished) next(); });
  }

  function next() {
    if (!group) return onClose();
    if (itemIndex + 1 < group.items.length) setItemIndex(itemIndex + 1);
    else if (groupIndex + 1 < groups.length) { setGroupIndex(groupIndex + 1); setItemIndex(0); }
    else onClose();
  }

  function prev() {
    if (itemIndex > 0) setItemIndex(itemIndex - 1);
    else if (groupIndex > 0) { const gi = groupIndex - 1; setGroupIndex(gi); setItemIndex(Math.max(0, groups[gi].items.length - 1)); }
    else run(0);
  }

  async function sendReply() {
    const text = replyText.trim();
    if (!text || !group?.author.id) return;
    try {
      await apiFetch('/messages', { method: 'POST', body: JSON.stringify({ recipient_id: group.author.id, body: text }) });
      setReplyText('');
      setReplySent(true);
      setTimeout(() => { setReplySent(false); setReplying(false); }, 1400);
    } catch {
      // молча — текст остаётся в поле, можно повторить
    }
  }

  function toggleReaction() {
    if (!item) return;
    const next = !reacted[item.id];
    setReacted((prev) => ({ ...prev, [item.id]: next }));
    apiFetch(`/stories/${item.id}/reaction`, { method: 'POST' }).catch(() =>
      setReacted((prev) => ({ ...prev, [item.id]: !next }))
    );
  }

  if (!group || !item) return null;

  const image = item.images[0];
  const liked = reacted[item.id];

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {image ? (
          <Image source={{ uri: image }} style={{ position: 'absolute', width, height }} resizeMode="contain" />
        ) : (
          <View style={{ position: 'absolute', width, height, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: palette.surface2 }}>
            <Text style={{ fontFamily: palette.displayFamily, fontSize: 24, lineHeight: 32, color: palette.text, textAlign: 'center' }}>
              {item.title || item.body}
            </Text>
          </View>
        )}

        {/* Зоны тапа: слева назад, справа вперёд; удержание — пауза. */}
        <Pressable
          onPress={prev}
          onLongPress={() => setHeld(true)}
          onPressOut={() => setHeld(false)}
          delayLongPress={180}
          style={{ position: 'absolute', left: 0, top: 90, bottom: 0, width: width * 0.35 }}
        />
        <Pressable
          onPress={next}
          onLongPress={() => setHeld(true)}
          onPressOut={() => setHeld(false)}
          delayLongPress={180}
          style={{ position: 'absolute', right: 0, top: 90, bottom: 0, width: width * 0.65 }}
        />

        {/* Полоски прогресса. */}
        <View style={{ position: 'absolute', top: insets.top + 6, left: 10, right: 10, flexDirection: 'row', gap: 4 }}>
          {group.items.map((it, i) => (
            <View key={it.id} style={{ flex: 1, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: 3,
                  borderRadius: 3,
                  backgroundColor: '#fff',
                  width: i < itemIndex ? '100%' : i > itemIndex ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }}
              />
            </View>
          ))}
        </View>

        {/* Автор и закрытие. */}
        <View style={{ position: 'absolute', top: insets.top + 20, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={group.author.username} uri={group.author.avatar_url} size={34} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{group.author.username}</Text>
          <VerifiedMark verified={group.author.verified_at} size={14} />
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{formatCompactAge(item.created_at)}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={10}>
            <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
              <Path d="M6 6l12 12M18 6 6 18" />
            </Svg>
          </Pressable>
        </View>

        {/* Подпись под картинкой. */}
        {image && (item.title || item.body) ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 92, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 16, lineHeight: 22, color: '#fff', textAlign: 'center' }}>{item.title || item.body}</Text>
          </View>
        ) : null}

        {/* Ответ автору + реакция — снизу, поднимается над клавиатурой. */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: insets.bottom + 12, paddingTop: 8 }}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 16, paddingVertical: 4 }}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setReplying(true)}
                onBlur={() => { if (!replyText.trim()) setReplying(false); }}
                placeholder={replySent ? 'Отправлено' : 'Ответить…'}
                placeholderTextColor="rgba(255,255,255,0.6)"
                style={{ flex: 1, paddingVertical: 7, fontSize: 15, color: '#fff' }}
              />
              {replyText.trim() ? (
                <Pressable onPress={sendReply} hitSlop={8}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Отпр.</Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable onPress={toggleReaction} hitSlop={8}>
              <Svg width={30} height={30} viewBox="0 0 24 24" fill={liked ? '#ff375f' : 'none'} stroke={liked ? '#ff375f' : '#fff'} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 21s-7.5-4.6-10-9.3C.6 8.6 2 5.5 5 5c2-.3 3.4.9 4.2 2 .3.4.5.7.8 1 .3-.3.5-.6.8-1C11.6 5.9 13 4.7 15 5c3 .5 4.4 3.6 3 6.7C19.5 16.4 12 21 12 21Z" />
              </Svg>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
