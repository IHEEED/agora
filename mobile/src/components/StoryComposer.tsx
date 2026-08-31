import { useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { apiFetch } from '../lib/api';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';

/** Что уходит в историю: запись и её кадр. null — шторка закрыта. */
export type StoryDraft = {
  postId: string;
  title: string | null;
  body: string | null;
  image?: string | null;
};

/**
 * Репост записи в свою историю — как в вебе (StoryComposer).
 *
 * Между «мне это подходит» и «пусть висит сутки под моим именем» есть шаг, и он
 * должен быть виден: кадр целиком, необязательная подпись и «Отправить». Не
 * подтверждение «вы уверены?», а редактор — здесь можно посмотреть, что уйдёт.
 */
export function StoryComposer({ draft, onClose, onPublished }: { draft: StoryDraft | null; onClose: () => void; onPublished?: () => void }) {
  const palette = usePalette();
  const { t } = useT();
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Сброс при смене кадра сравнением с прошлым, а не эффектом.
  const [lastId, setLastId] = useState(draft?.postId ?? null);
  if ((draft?.postId ?? null) !== lastId) {
    setLastId(draft?.postId ?? null);
    setNote('');
    setError(null);
    setDone(false);
  }

  async function send() {
    if (!draft || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch('/stories', { method: 'POST', body: JSON.stringify({ post_id: draft.postId, body: note.trim() || null }) });
      setDone(true);
      onPublished?.();
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={draft !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 34, paddingHorizontal: 20, gap: 12 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border }} />
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>{done ? t('Готово') : t('В свою историю')}</Text>

            {/* Кадр целиком, как он появится в истории. */}
            {draft ? (
              <View style={{ height: 208, borderRadius: 16, overflow: 'hidden', justifyContent: 'flex-end' }}>
                {draft.image ? (
                  <>
                    <Image source={{ uri: draft.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={StyleSheet.absoluteFill} />
                  </>
                ) : (
                  <LinearGradient colors={[palette.accent, '#0b0a09']} style={StyleSheet.absoluteFill} />
                )}
                <Text style={{ fontFamily: palette.displayFamily, fontSize: 19, lineHeight: 24, color: '#fff', padding: 16 }} numberOfLines={4}>
                  {draft.title ?? draft.body}
                </Text>
              </View>
            ) : null}

            {done ? (
              <Text style={{ paddingVertical: 8, textAlign: 'center', fontSize: 14, color: palette.textMuted }}>
                {t('История опубликована и будет видна сутки.')}
              </Text>
            ) : (
              <>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  maxLength={200}
                  placeholder={t('Добавить подпись — необязательно')}
                  placeholderTextColor={palette.textMuted}
                  style={{ paddingVertical: 9, fontSize: 15, color: palette.text, borderBottomWidth: 1, borderBottomColor: palette.border }}
                />
                {error ? <Text style={{ fontSize: 12.5, color: palette.down }}>{error}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Pressable onPress={onClose} style={{ flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: palette.surface2 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>{t('Отмена')}</Text>
                  </Pressable>
                  <Pressable onPress={send} disabled={sending} style={{ flex: 1, borderRadius: 999, paddingVertical: 12, alignItems: 'center', backgroundColor: palette.accent, opacity: sending ? 0.6 : 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: palette.accentContrast }}>{sending ? t('Отправляем…') : t('Отправить')}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
