import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../lib/api';
import { StoryGroup } from '../lib/types';
import { Avatar } from './Avatar';
import { StoryViewer } from './StoryViewer';
import { usePalette } from '../theme';

/**
 * Полоса историй наверху ленты, как в вебе.
 *
 * Первый кружок — своя история с плюсом (открывает конструктор); дальше люди со
 * свежими историями. Кольцо у непросмотренной — акцентом, у просмотренной —
 * приглушённое. Тап по кружку человека открывает полноэкранный просмотрщик.
 * Конструктор пока делает текстовую историю; картинка с загрузкой в хранилище
 * ляжет отдельным заходом.
 */

function Ring({ children, color, dashed = false }: { children: React.ReactNode; color: string; dashed?: boolean }) {
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
  const [viewing, setViewing] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(() => {
    apiFetch<StoryGroup[] | { stories: StoryGroup[] }>('/stories')
      .then((data) => setGroups(Array.isArray(data) ? data : data.stories ?? []))
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
        {/* Своя история — пунктирное кольцо с плюсом. */}
        <Pressable onPress={() => setComposing(true)} style={{ alignItems: 'center', gap: 4, width: 72 }}>
          <Ring color={palette.border} dashed>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 24, color: palette.accent }}>+</Text>
            </View>
          </Ring>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: palette.textMuted }}>Ваша история</Text>
        </Pressable>

        {groups.map((group, index) => (
          <Pressable key={group.author.id} onPress={() => setViewing(index)} style={{ alignItems: 'center', gap: 4, width: 72 }}>
            <Ring color={group.unseen > 0 ? palette.accent : palette.border}>
              <Avatar name={group.author.username} uri={group.author.avatar_url} size={56} />
            </Ring>
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: palette.text }}>{group.author.username}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {viewing !== null ? (
        <StoryViewer
          groups={groups}
          startIndex={viewing}
          onClose={() => {
            setViewing(null);
            load();
          }}
        />
      ) : null}

      {composing ? <StoryComposer onClose={() => setComposing(false)} onPublished={load} /> : null}
    </>
  );
}

/** Простой конструктор: текстовая история. */
function StoryComposer({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const palette = usePalette();
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function publish() {
    if (!body.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch('/stories', { method: 'POST', body: JSON.stringify({ body: body.trim() }) });
      onPublished();
      onClose();
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, gap: 12 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border }} />
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Новая история</Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Что происходит?"
            placeholderTextColor={palette.textMuted}
            multiline
            autoFocus
            style={{ minHeight: 90, fontSize: 16, lineHeight: 22, color: palette.text, borderWidth: 1, borderColor: palette.border, borderRadius: 12, padding: 12, textAlignVertical: 'top' }}
          />
          <Pressable
            onPress={publish}
            disabled={submitting || !body.trim()}
            style={{ alignSelf: 'flex-start', backgroundColor: palette.accent, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, opacity: submitting || !body.trim() ? 0.4 : 1 }}
          >
            <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 15 }}>{submitting ? 'Секунду…' : 'Опубликовать'}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
