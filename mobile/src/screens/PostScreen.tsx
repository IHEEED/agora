import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { markPostViewed } from '../lib/viewedPosts';
import { Post, Comment, CommentSort } from '../lib/types';
import { PostCard } from '../components/PostCard';
import { CommentItem } from '../components/CommentItem';
import { SegmentedControl } from '../components/SegmentedControl';
import { SkeletonPost } from '../components/SkeletonPost';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

const COMMENT_SORT_OPTIONS: ReadonlyArray<readonly [CommentSort, string]> = [
  ['best', 'По рейтингу'],
  ['new', 'Новые'],
];

/**
 * Экран поста с комментариями — один в один с вебом (/posts/[postId]).
 *
 * Сама запись рисуется той же карточкой, что в ленте, но без перехода вглубь и
 * без кнопки комментариев (linkToDetail=false). Ниже — блок комментариев за
 * отделяющей чертой: заголовок с переключателем сортировки, строка ввода с
 * стрелкой-отправкой внутри и дерево веток. Пусто — «Комментариев пока нет».
 */
export function PostScreen({ route }: Props) {
  const { postId } = route.params;
  const palette = usePalette();
  const { session } = useSession();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentSort, setCommentSort] = useState<CommentSort>('best');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);

  const [body, setBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const loadComments = useCallback(() => {
    apiFetch<Comment[]>(`/comments/post/${postId}?sort=${commentSort}`)
      .then(setComments)
      .catch(() => {})
      .finally(() => setCommentsLoading(false));
  }, [postId, commentSort]);

  useEffect(() => {
    markPostViewed(postId).then((isNewView) => {
      if (isNewView) apiFetch(`/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
    });
  }, [postId]);

  useEffect(() => {
    apiFetch<Post>(`/posts/${postId}`)
      .then(setPost)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  async function handleSubmit() {
    if (!body.trim()) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await apiFetch('/comments', { method: 'POST', body: JSON.stringify({ post_id: postId, body }) });
      setBody('');
      loadComments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось отправить комментарий');
    } finally {
      setSubmitting(false);
    }
  }

  const canSend = Boolean(body.trim()) && !submitting;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        // Тап по кнопке при открытой клавиатуре срабатывает сразу, а не только
        // гасит её: без этого «Отправить» требовал двух нажатий.
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={comments}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {loading ? <SkeletonPost /> : null}
            {error ? <Text style={{ padding: 16, color: palette.down }}>{error}</Text> : null}
            {post ? <PostCard post={post} linkToDetail={false} /> : null}

            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 20,
                gap: 16,
                borderTopWidth: 1,
                borderTopColor: palette.border,
                marginTop: 4,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Комментарии</Text>
                <View style={{ width: 176 }}>
                  <SegmentedControl value={commentSort} options={COMMENT_SORT_OPTIONS} onChange={setCommentSort} />
                </View>
              </View>

              {session ? (
                <View style={{ gap: 6 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 8,
                      paddingLeft: 4,
                      borderBottomWidth: 1,
                      borderBottomColor: inputFocused ? palette.accent : palette.border,
                    }}
                  >
                    <TextInput
                      value={body}
                      onChangeText={setBody}
                      onFocus={() => setInputFocused(true)}
                      onBlur={() => setInputFocused(false)}
                      placeholder="Поделитесь своим мнением"
                      placeholderTextColor={palette.textMuted}
                      returnKeyType="send"
                      onSubmitEditing={handleSubmit}
                      style={{ flex: 1, paddingVertical: 10, fontSize: 15, color: palette.text }}
                    />
                    <Pressable
                      onPress={handleSubmit}
                      disabled={!canSend}
                      hitSlop={8}
                      style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', opacity: canSend ? 1 : 0.3 }}
                    >
                      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M4 12h15M13 6l6 6-6 6" />
                      </Svg>
                    </Pressable>
                  </View>
                  {formError ? <Text style={{ color: palette.down, fontSize: 13 }}>{formError}</Text> : null}
                </View>
              ) : null}

              {!commentsLoading && comments.length === 0 ? (
                <Text style={{ paddingVertical: 32, textAlign: 'center', color: palette.textMuted }}>
                  Комментариев пока нет. Будьте первым.
                </Text>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
            <CommentItem comment={item} postId={postId} onAdded={loadComments} />
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}
