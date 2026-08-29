import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { Comment } from '../lib/types';
import { CommentItem } from '../components/CommentItem';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Comments'>;

/** Быстрые реакции над строкой ввода — то же, что в вебе (CommentSheet). */
const QUICK_EMOJI = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];

/**
 * Комментарии шторкой — один в один с вебом (CommentSheet).
 *
 * Открывается модалкой поверх ленты той же анимацией, что «Новый пост»: почти
 * во весь экран, свайпом вниз закрывается. Дерево веток тем же CommentItem, что
 * на странице поста; внизу — быстрые эмодзи и строка ввода со стрелкой-отправкой
 * внутри. Так не теряется место в ленте, до которого дочитали.
 */
export function CommentsScreen({ route }: Props) {
  const { postId } = route.params;
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const { session } = useSession();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const load = useCallback(() => {
    apiFetch<Comment[]>(`/comments/post/${postId}`)
      .then(setComments)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить комментарии'))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(value: string) {
    const body = value.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const created = await apiFetch<Comment>('/comments', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, body }),
      });
      // Свой комментарий сразу наверх — не дожидаясь перечитывания списка.
      setComments((prev) => [{ ...created, replies: created.replies ?? [] }, ...prev]);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить комментарий');
    } finally {
      setSending(false);
    }
  }

  const canSend = Boolean(text.trim()) && !sending;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={comments}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
        ListEmptyComponent={
          loading ? (
            <Text style={{ paddingVertical: 24, textAlign: 'center', color: palette.textMuted }}>Загрузка…</Text>
          ) : (
            <Text style={{ paddingVertical: 48, textAlign: 'center', color: palette.textMuted }}>
              Комментариев пока нет. Будьте первым.
            </Text>
          )
        }
        renderItem={({ item }) => <CommentItem comment={item} postId={postId} onAdded={load} />}
      />

      {session ? (
        <View
          style={{
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: insets.bottom > 0 ? insets.bottom : 12,
            borderTopWidth: 1,
            borderTopColor: palette.border,
            gap: 8,
            backgroundColor: palette.bg,
          }}
        >
          {error ? <Text style={{ fontSize: 13, color: palette.down }}>{error}</Text> : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 4 }}>
            {QUICK_EMOJI.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => submit(emoji)}
                style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 21 }}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 4,
              borderBottomWidth: 1,
              borderBottomColor: focused ? palette.accent : palette.border,
            }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder="Напишите комментарий…"
              placeholderTextColor={palette.textMuted}
              returnKeyType="send"
              onSubmitEditing={() => submit(text)}
              style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: palette.text }}
            />
            <Pressable
              onPress={() => submit(text)}
              disabled={!canSend}
              hitSlop={8}
              style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: canSend ? 1 : 0.3 }}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M4 12h15M13 6l6 6-6 6" />
              </Svg>
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
