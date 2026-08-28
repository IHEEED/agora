import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { UserProfile } from '../lib/types';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

/**
 * Редактор профиля — показываемое имя и подпись, как в вебе (шторка там же).
 *
 * Аватар и обложку пока не трогаем: для них нужен выбор картинки из галереи —
 * это отдельный заход с expo-image-picker. Пустое поле означает «убрать»: стёр
 * подпись — её не станет, как и на сервере.
 */
export function ProfileEditScreen({ navigation }: Props) {
  const palette = usePalette();
  const { session } = useSession();
  const userId = session?.user.id;

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    apiFetch<UserProfile>(`/users/${userId}`)
      .then((profile) => {
        setDisplayName(profile.display_name ?? '');
        setBio(profile.bio ?? '');
      })
      .catch(() => {});
  }, [userId]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await apiFetch('/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim() }),
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  const field = {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.surface,
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: 20, gap: 10 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={{ fontSize: 13, color: palette.textMuted }}>Показываемое имя</Text>
      <TextInput
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={40}
        placeholder="Как вас зовут"
        placeholderTextColor={palette.textMuted}
        style={field}
      />

      <Text style={{ fontSize: 13, color: palette.textMuted, marginTop: 6 }}>Подпись</Text>
      <TextInput
        value={bio}
        onChangeText={setBio}
        maxLength={160}
        multiline
        placeholder="Пара слов о себе"
        placeholderTextColor={palette.textMuted}
        style={{ ...field, minHeight: 90, textAlignVertical: 'top' }}
      />
      <Text style={{ fontSize: 12, color: palette.textMuted, textAlign: 'right' }}>{bio.length}/160</Text>

      {error ? <Text style={{ color: palette.down }}>{error}</Text> : null}

      <Pressable
        onPress={save}
        disabled={saving}
        style={{
          marginTop: 6,
          backgroundColor: palette.accent,
          borderRadius: 999,
          paddingVertical: 13,
          alignItems: 'center',
          opacity: saving ? 0.4 : 1,
        }}
      >
        <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 15 }}>
          {saving ? 'Секунду…' : 'Сохранить'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
