import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Post } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePost'>;

export function CreatePostScreen({ navigation, route }: Props) {
  const { communityId } = route.params;
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!title.trim()) return;
    setError(null);
    setSubmitting(true);

    try {
      await apiFetch<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({ title, body, community_id: communityId }),
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать пост');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={{ flex: 1, padding: 20, backgroundColor: '#fafafa', gap: 12 }}>
      <Text style={{ fontSize: 13, color: '#666' }}>Заголовок</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fff' }}
      />

      <Text style={{ fontSize: 13, color: '#666' }}>Текст (необязательно)</Text>
      <TextInput
        value={body}
        onChangeText={setBody}
        multiline
        style={{
          borderWidth: 1,
          borderColor: '#ddd',
          borderRadius: 8,
          padding: 10,
          minHeight: 100,
          backgroundColor: '#fff',
        }}
      />

      {error ? <Text style={{ color: '#dc2626' }}>{error}</Text> : null}

      <Pressable
        onPress={handleCreate}
        disabled={submitting}
        style={{
          alignSelf: 'flex-start',
          backgroundColor: '#111',
          borderRadius: 999,
          paddingHorizontal: 18,
          paddingVertical: 10,
          opacity: submitting ? 0.5 : 1,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Создать</Text>
      </Pressable>
    </View>
  );
}
