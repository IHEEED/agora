import { useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch } from '../lib/api';
import { uploadImage } from '../lib/uploadImage';
import { usePalette } from '../theme';

const HOURS = [6, 12, 24] as const;

/**
 * Редактор новой истории — как в вебе (StoryEditor), в рамках возможного на RN.
 *
 * Кадр во весь экран, снизу — необязательная подпись и срок жизни (6/12/24 ч),
 * сверху крестик. Публикация грузит снимок в хранилище и создаёт историю.
 *
 * Отличие от веба: там подпись впечатывается в саму картинку через canvas —
 * на RN без нативного view-shot это невозможно, поэтому подпись уходит
 * отдельным полем и рисуется просмотрщиком поверх кадра (результат тот же
 * визуально). Рисование, стикеры и фильтры веба тоже требуют canvas/Skia и
 * здесь не воспроизводятся.
 */
export function StoryEditor({
  image,
  onCancel,
  onPublished,
}: {
  image: { uri: string; base64: string; mime: string } | null;
  onCancel: () => void;
  onPublished: () => void;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const [caption, setCaption] = useState('');
  const [hours, setHours] = useState<(typeof HOURS)[number]>(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    if (!image || busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(image.base64, image.mime, 'stories');
      await apiFetch('/stories', {
        method: 'POST',
        body: JSON.stringify({ image_url: url, body: caption.trim() || null, hours }),
      });
      onPublished();
      reset();
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать');
      setBusy(false);
    }
  }

  function reset() {
    setCaption('');
    setHours(24);
    setBusy(false);
    setError(null);
  }

  return (
    <Modal visible={image !== null} transparent={false} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {image ? <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : null}

        {/* Крестик слева сверху. */}
        <Pressable
          onPress={() => { reset(); onCancel(); }}
          hitSlop={10}
          style={{ position: 'absolute', top: insets.top + 8, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
            <Path d="M6 6l12 12M18 6 6 18" />
          </Svg>
        </Pressable>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={{ paddingHorizontal: 16, paddingTop: 40 }}>
            <View style={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 14, gap: 14 }}>
              {/* Подпись — наложением, белым по кадру. */}
              <TextInput
                value={caption}
                onChangeText={setCaption}
                placeholder="Добавить подпись…"
                placeholderTextColor="rgba(255,255,255,0.6)"
                maxLength={200}
                multiline
                style={{ fontSize: 18, lineHeight: 24, color: '#fff' }}
              />

              {/* Срок жизни. */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Показывать:</Text>
                {HOURS.map((value) => {
                  const on = hours === value;
                  return (
                    <Pressable key={value} onPress={() => setHours(value)} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.16)' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#000' : '#fff' }}>{value} ч</Text>
                    </Pressable>
                  );
                })}
              </View>

              {error ? <Text style={{ fontSize: 13, color: '#ff6b6b' }}>{error}</Text> : null}

              <Pressable
                onPress={publish}
                disabled={busy}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 13, backgroundColor: palette.accent, opacity: busy ? 0.6 : 1 }}
              >
                {busy ? <ActivityIndicator color={palette.accentContrast} /> : null}
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.accentContrast }}>
                  {busy ? 'Публикуем…' : 'В историю'}
                </Text>
              </Pressable>
            </View>
          </LinearGradient>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
