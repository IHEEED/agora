import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { useVote } from '../lib/useVote';
import { formatRelativeDate } from '../lib/formatDate';
import { Comment } from '../lib/types';
import { Badge } from './Badge';

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
  const { session } = useSession();
  const { score, myVote, vote, error: voteError } = useVote(comment.id, comment.score, comment.myVote, 'comment');

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
        borderLeftWidth: depth > 0 ? 1 : 0,
        borderLeftColor: '#e5e5e5',
        paddingLeft: depth > 0 ? 10 : 0,
        gap: 6,
      }}
    >
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ alignItems: 'center', gap: 1, width: 24 }}>
          <Pressable onPress={() => vote(1)} hitSlop={8}>
            <Text style={{ fontSize: 13, color: myVote === 1 ? '#f97316' : '#999' }}>▲</Text>
          </Pressable>
          <Text style={{ fontSize: 11, fontWeight: '600' }}>{score}</Text>
          <Pressable onPress={() => vote(-1)} hitSlop={8}>
            <Text style={{ fontSize: 13, color: myVote === -1 ? '#3b82f6' : '#999' }}>▼</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#333' }}>{comment.author.username}</Text>
            <Badge type={comment.author.badge} />
            <Text style={{ fontSize: 12, color: '#888' }}> · {formatRelativeDate(comment.created_at)}</Text>
          </View>
          <Text style={{ fontSize: 14, color: '#111' }}>{comment.body}</Text>
          {voteError ? <Text style={{ fontSize: 11, color: '#dc2626' }}>{voteError}</Text> : null}

          {session ? (
            <Pressable onPress={() => setReplying((v) => !v)}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#666' }}>
                {replying ? 'Отмена' : 'Ответить'}
              </Text>
            </Pressable>
          ) : null}

          {replying ? (
            <View style={{ gap: 6 }}>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Ваш ответ…"
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 6,
                  padding: 8,
                  fontSize: 13,
                  minHeight: 50,
                }}
              />
              {replyError ? <Text style={{ fontSize: 11, color: '#dc2626' }}>{replyError}</Text> : null}
              <Pressable
                onPress={submitReply}
                disabled={submitting}
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: '#111',
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 6,
                  opacity: submitting ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>Отправить</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {comment.replies.length > 0 ? (
        <View style={{ gap: 10, marginTop: 2 }}>
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} postId={postId} onAdded={onAdded} depth={depth + 1} />
          ))}
        </View>
      ) : null}
    </View>
  );
}
