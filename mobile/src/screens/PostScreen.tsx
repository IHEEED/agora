import { useCallback, useEffect, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { markPostViewed } from '../lib/viewedPosts';
import { formatCompactAge } from '../lib/formatDate';
import { Post, Comment, CommentSort } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { VerifiedMark } from '../components/VerifiedMark';
import { VoteBlock } from '../components/VoteBlock';
import { CommentIcon, ViewIcon } from '../components/icons';
import { CommentItem } from '../components/CommentItem';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

const COMMENT_SORT_OPTIONS: { value: CommentSort; label: string }[] = [
  { value: 'best', label: 'По рейтингу' },
  { value: 'new', label: 'Новые' },
];

/** Сам пост — по устройству карточки в ленте, но без перехода вглубь. */
function PostDetail({ post }: { post: Post }) {
  const palette = usePalette();

  return (
    <View style={{ gap: 8, paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={post.author.username} uri={post.author.avatar_url} size={38} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: '600', color: palette.text }}>
            {post.author.username}
          </Text>
          <VerifiedMark verified={post.author.verified_at} size={17} />
          <Text style={{ fontSize: 13, color: palette.textMuted }}>{formatCompactAge(post.created_at)}</Text>
        </View>
      </View>

      <Text style={{ fontFamily: palette.displayFamily, fontSize: 20, color: palette.text, lineHeight: 26 }}>{post.title}</Text>
      {post.body ? <Text style={{ fontSize: 15, color: palette.text, lineHeight: 23 }}>{post.body}</Text> : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginLeft: -4 }}>
        <VoteBlock id={post.id} score={post.score} myVote={post.myVote} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8 }}>
          <CommentIcon size={22} color={palette.control} />
          <Text style={{ fontSize: 15, color: palette.control }}>{post.commentCount}</Text>
        </View>
        {post.views > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 8 }}>
            <ViewIcon size={17} color={palette.textMuted} />
            <Text style={{ fontSize: 13, color: palette.textMuted }}>{post.views}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export function PostScreen({ route }: Props) {
  const { postId } = route.params;
  const palette = usePalette();
  const { session } = useSession();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentSort, setCommentSort] = useState<CommentSort>('best');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [body, setBody] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadComments = useCallback(() => {
    apiFetch<Comment[]>(`/comments/post/${postId}?sort=${commentSort}`).then(setComments);
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: palette.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 24 }}
        // Тап по кнопке при открытой клавиатуре теперь срабатывает сразу, а не
        // только гасит клавиатуру: без этого «Отправить» требовал двух нажатий.
        keyboardShouldPersistTaps="handled"
        data={comments}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            {loading ? <Text style={{ padding: 16, color: palette.textMuted }}>Загрузка…</Text> : null}
            {error ? <Text style={{ padding: 16, color: palette.down }}>{error}</Text> : null}
            {post ? <PostDetail post={post} /> : null}

            <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>Комментарии</Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {COMMENT_SORT_OPTIONS.map((option) => {
                    const on = commentSort === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => setCommentSort(option.value)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: on ? palette.accent : palette.surface2 }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '600', color: on ? palette.accentContrast : palette.textMuted }}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {session ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={body}
                    onChangeText={setBody}
                    placeholder="Ваш комментарий…"
                    placeholderTextColor={palette.textMuted}
                    multiline
                    style={{
                      borderWidth: 1,
                      borderColor: palette.border,
                      borderRadius: 12,
                      padding: 12,
                      minHeight: 70,
                      fontSize: 15,
                      color: palette.text,
                      backgroundColor: palette.surface,
                    }}
                  />
                  {formError ? <Text style={{ color: palette.down, fontSize: 12 }}>{formError}</Text> : null}
                  <Pressable
                    onPress={handleSubmit}
                    disabled={submitting || !body.trim()}
                    style={{
                      alignSelf: 'flex-start',
                      backgroundColor: palette.accent,
                      borderRadius: 999,
                      paddingHorizontal: 18,
                      paddingVertical: 9,
                      opacity: submitting || !body.trim() ? 0.4 : 1,
                    }}
                  >
                    <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 14 }}>Отправить</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={{ fontSize: 14, color: palette.textMuted }}>Войдите, чтобы оставить комментарий.</Text>
              )}

              {!loading && comments.length === 0 ? (
                <Text style={{ color: palette.textMuted, marginTop: 8 }}>Комментариев пока нет.</Text>
              ) : null}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
            <CommentItem comment={item} postId={postId} onAdded={loadComments} />
          </View>
        )}
      />
    </KeyboardAvoidingView>
  );
}
