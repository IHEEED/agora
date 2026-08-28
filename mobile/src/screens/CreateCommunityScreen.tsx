import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Community } from '../lib/types';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateCommunity'>;

export function CreateCommunityScreen({ navigation }: Props) {
  const palette = usePalette();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setError(null);
    setSubmitting(true);

    try {
      await apiFetch<Community>('/communities', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать сообщество');
    } finally {
      setSubmitting(false);
    }
  }

  const field = {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: palette.surface,
    color: palette.text,
    fontSize: 15,
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: 20, gap: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 13, color: palette.textMuted }}>Название</Text>
      <TextInput value={name} onChangeText={setName} style={field} placeholderTextColor={palette.textMuted} />

      <Text style={{ fontSize: 13, color: palette.textMuted }}>Описание (необязательно)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        multiline
        style={{ ...field, minHeight: 80, textAlignVertical: 'top' }}
        placeholderTextColor={palette.textMuted}
      />

      {error ? <Text style={{ color: palette.down }}>{error}</Text> : null}

      <Pressable
        onPress={handleCreate}
        disabled={submitting || !name.trim()}
        style={{
          alignSelf: 'flex-start',
          backgroundColor: palette.accent,
          borderRadius: 999,
          paddingHorizontal: 20,
          paddingVertical: 11,
          opacity: submitting || !name.trim() ? 0.4 : 1,
        }}
      >
        <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 15 }}>
          {submitting ? 'Секунду…' : 'Создать'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
