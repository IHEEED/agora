import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { useVote } from '../lib/useVote';
import { markPostViewed } from '../lib/viewedPosts';
import { formatRelativeDate } from '../lib/formatDate';
import { Post, Comment, CommentSort } from '../lib/types';
import { CommentItem } from '../components/CommentItem';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Post'>;

const COMMENT_SORT_OPTIONS: { value: CommentSort; label: string }[] = [
  { value: 'best', label: 'По рейтингу' },
  { value: 'new', label: 'Новые' },
];

function PostDetail({ post }: { post: Post }) {
  const { score, myVote, vote, error } = useVote(post.id, post.score, post.myVote);

  return (
    <View style={{ flexDirection: 'row', gap: 12, padding: 16, backgroundColor: '#fff' }}>
      <View style={{ alignItems: 'center', gap: 2, width: 32 }}>
        <Pressable onPress={() => vote(1)} hitSlop={8}>
          <Text style={{ fontSize: 18, color: myVote === 1 ? '#f97316' : '#999' }}>▲</Text>
        </Pressable>
        <Text style={{ fontSize: 14, fontWeight: '600' }}>{score}</Text>
        <Pressable onPress={() => vote(-1)} hitSlop={8}>
          <Text style={{ fontSize: 18, color: myVote === -1 ? '#3b82f6' : '#999' }}>▼</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontSize: 17, fontWeight: '700' }}>{post.title}</Text>
        <Text style={{ fontSize: 12, color: '#888' }}>
          {post.author.username} · 👁 {post.views} · {formatRelativeDate(post.created_at)}
        </Text>
        {post.body ? <Text style={{ fontSize: 14, color: '#333' }}>{post.body}</Text> : null}
        {error ? <Text style={{ fontSize: 12, color: '#dc2626' }}>{error}</Text> : null}
      </View>
    </View>
  );
}

export function PostScreen({ route }: Props) {
  const { postId } = route.params;
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
      if (isNewView) {
        apiFetch(`/posts/${postId}/view`, { method: 'POST' }).catch(() => {});
      }
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
      await apiFetch('/comments', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, body }),
      });
      setBody('');
      loadComments();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Не удалось отправить комментарий');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: '#fafafa' }}
      contentContainerStyle={{ paddingBottom: 24 }}
      data={comments}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          {loading ? <Text style={{ padding: 16, color: '#666' }}>Загрузка…</Text> : null}
          {error ? <Text style={{ padding: 16, color: '#dc2626' }}>{error}</Text> : null}
          {post ? <PostDetail post={post} /> : null}

          <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '700' }}>Комментарии</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {COMMENT_SORT_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    onPress={() => setCommentSort(option.value)}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 999,
                      backgroundColor: commentSort === option.value ? '#111' : '#eee',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: commentSort === option.value ? '#fff' : '#444',
                      }}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {session ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Ваш комментарий…"
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: '#ddd',
                    borderRadius: 8,
                    padding: 10,
                    minHeight: 70,
                    backgroundColor: '#fff',
                  }}
                />
                {formError ? <Text style={{ color: '#dc2626', fontSize: 12 }}>{formError}</Text> : null}
                <Pressable
                  onPress={handleSubmit}
                  disabled={submitting}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#111',
                    borderRadius: 999,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>Отправить</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={{ fontSize: 13, color: '#666' }}>Войдите, чтобы оставить комментарий.</Text>
            )}

            {!loading && comments.length === 0 ? (
              <Text style={{ color: '#666', marginTop: 8 }}>Комментариев пока нет.</Text>
            ) : null}
          </View>
        </View>
      }
      contentInsetAdjustmentBehavior="automatic"
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
          <CommentItem comment={item} postId={postId} onAdded={loadComments} />
        </View>
      )}
    />
  );
}
