import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { formatCompactAge } from '../lib/formatDate';
import { Comment } from '../lib/types';
import { Avatar } from './Avatar';
import { VerifiedMark } from './VerifiedMark';
import { VoteBlock } from './VoteBlock';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Одна ветка комментариев — по образцу веба.
 *
 * Слева лицо автора, справа имя с галочкой, возраст, текст и голоса тем же
 * блоком, что у постов (компактный размер). Вложенные ответы уходят вправо за
 * волосяной линией принадлежности. Кнопки — акцентные, не чёрные плашки.
 */
export function CommentItem({
  comment,
  postId,
  onAdded,
  depth = 0,
}: {
  comment: Comment;
  postId: string;
  onAdded: () => void;
  depth?: number;
}) {
  const palette = usePalette();
  const { session } = useSession();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [replying, setReplying] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  async function submitReply() {
    if (!body.trim()) return;
    setReplyError(null);
    setSubmitting(true);
    try {
      await apiFetch('/comments', {
        method: 'POST',
        body: JSON.stringify({ post_id: postId, parent_comment_id: comment.id, body }),
      });
      setBody('');
      setReplying(false);
      onAdded();
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : 'Не удалось отправить ответ');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View
      style={{
        borderLeftWidth: depth > 0 ? 1.5 : 0,
        borderLeftColor: palette.border,
        paddingLeft: depth > 0 ? 12 : 0,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={() => comment.author.id && navigation.navigate('User', { userId: comment.author.id })}>
          <Avatar name={comment.author.username} uri={comment.author.avatar_url} size={30} />
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <Pressable onPress={() => comment.author.id && navigation.navigate('User', { userId: comment.author.id })}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{comment.author.username}</Text>
            </Pressable>
            <VerifiedMark verified={comment.author.verified_at} size={13} />
            <Text style={{ fontSize: 12.5, color: palette.textMuted }}>· {formatCompactAge(comment.created_at)}</Text>
          </View>
          <Text style={{ fontSize: 14.5, lineHeight: 20, color: palette.text }}>{comment.body}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: -8 }}>
            <VoteBlock id={comment.id} score={comment.score} myVote={comment.myVote} kind="comment" compact />
            {session ? (
              <Pressable onPress={() => setReplying((v) => !v)} hitSlop={6}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: palette.textMuted }}>
                  {replying ? 'Отмена' : 'Ответить'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {replying ? (
            <View style={{ gap: 8, marginTop: 2 }}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Ваш ответ…"
                placeholderTextColor={palette.textMuted}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: 10,
                  padding: 10,
                  fontSize: 14,
                  minHeight: 50,
                  color: palette.text,
                  backgroundColor: palette.surface,
                }}
              />
              {replyError ? <Text style={{ fontSize: 12, color: palette.down }}>{replyError}</Text> : null}
              <Pressable
                onPress={submitReply}
                disabled={submitting || !body.trim()}
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: palette.accent,
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                  opacity: submitting || !body.trim() ? 0.4 : 1,
                }}
              >
                <Text style={{ color: palette.accentContrast, fontSize: 13, fontWeight: '600' }}>Отправить</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {comment.replies.length > 0 ? (
        <View style={{ gap: 12, marginTop: 2 }}>
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} postId={postId} onAdded={onAdded} depth={depth + 1} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
