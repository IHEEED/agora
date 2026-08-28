import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Community, Post } from '../lib/types';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePost'>;

/**
 * Новая запись.
 *
 * Клуб выбирается здесь, если не передан заранее, — как в вебе: запись обязана
 * лежать в каком-то клубе, иначе ей некуда вернуться из ленты. Пришли со
 * страницы клуба — он уже выбран, спрашивать незачем.
 */
export function CreatePostScreen({ navigation, route }: Props) {
  const palette = usePalette();
  const preset = route.params.communityId;

  const [communityId, setCommunityId] = useState(preset || '');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (preset) return;
    apiFetch<Community[]>('/communities')
      .then(setCommunities)
      .catch(() => {});
  }, [preset]);

  async function handleCreate() {
    if (!title.trim() || !communityId) return;
    setError(null);
    setSubmitting(true);

    try {
      await apiFetch<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({ title, body, community_id: communityId }),
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать запись');
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
      {/* Выбор клуба — только когда не задан заранее. */}
      {!preset ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, color: palette.textMuted }}>Куда опубликовать</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {communities.map((community) => {
                const on = community.id === communityId;
                return (
                  <Pressable
                    key={community.id}
                    onPress={() => setCommunityId(community.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      backgroundColor: on ? palette.accent : palette.surface2,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '600',
                        color: on ? palette.accentContrast : palette.textMuted,
                      }}
                    >
                      {community.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <Text style={{ fontSize: 13, color: palette.textMuted }}>Заголовок</Text>
      <TextInput value={title} onChangeText={setTitle} style={field} placeholderTextColor={palette.textMuted} />

      <Text style={{ fontSize: 13, color: palette.textMuted }}>Текст (необязательно)</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        style={{ ...field, minHeight: 120, textAlignVertical: 'top' }}
        placeholderTextColor={palette.textMuted}
      />

      {error ? <Text style={{ color: palette.down }}>{error}</Text> : null}

      <Pressable
        onPress={handleCreate}
        disabled={submitting || !title.trim() || !communityId}
        style={{
          alignSelf: 'flex-start',
          backgroundColor: palette.accent,
          borderRadius: 999,
          paddingHorizontal: 20,
          paddingVertical: 11,
          opacity: submitting || !title.trim() || !communityId ? 0.4 : 1,
        }}
      >
        <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 15 }}>
          {submitting ? 'Секунду…' : 'Опубликовать'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
