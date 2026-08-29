import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { apiFetch } from '../lib/api';
import { Community } from '../lib/types';
import { BottomSheet } from './BottomSheet';
import { usePalette } from '../theme';

/**
 * Создание клуба — шторкой снизу, как в вебе (BottomSheet с формой).
 *
 * Имя и описание; обложку/аватар клуба веб задаёт в той же форме, но в базе
 * колонок под них пока нет — здесь их не показываем, чтобы не обещать
 * несуществующее. Создан — сообщаем наверх, чтобы список обновился сразу.
 */
export function CreateCommunitySheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (c: Community) => void }) {
  const palette = usePalette();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function create() {
    if (!name.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const community = await apiFetch<Community>('/communities', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), description: description.trim() }),
      });
      onCreated(community);
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать клуб');
    } finally {
      setSubmitting(false);
    }
  }

  const field = {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.bg,
  } as const;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Создать"
      footer={
        <Pressable
          onPress={create}
          disabled={submitting || !name.trim()}
          style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: palette.accent, opacity: submitting || !name.trim() ? 0.4 : 1 }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.accentContrast }}>{submitting ? 'Секунду…' : 'Создать'}</Text>
        </Pressable>
      }
    >
      <View style={{ gap: 10, paddingTop: 4 }}>
        <Text style={{ fontSize: 13, color: palette.textMuted }}>Название</Text>
        <TextInput value={name} onChangeText={setName} maxLength={40} placeholder="Как назовём клуб" placeholderTextColor={palette.textMuted} style={field} />

        <Text style={{ fontSize: 13, color: palette.textMuted, marginTop: 6 }}>Описание (необязательно)</Text>
        <TextInput value={description} onChangeText={setDescription} multiline placeholder="О чём этот клуб" placeholderTextColor={palette.textMuted} style={{ ...field, minHeight: 80, textAlignVertical: 'top' }} />

        {error ? <Text style={{ color: palette.down }}>{error}</Text> : null}
      </View>
    </BottomSheet>
  );
}
