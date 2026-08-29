import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { formatCompactAge } from '../lib/formatDate';
import { pluralizeReplies } from '../lib/pluralize';
import { Comment } from '../lib/types';
import { Avatar } from './Avatar';
import { VerifiedMark } from './VerifiedMark';
import { VoteBlock } from './VoteBlock';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * Ветка комментариев — один в один с вебом (CommentThread).
 *
 * Слева лицо автора, справа имя с галочкой, возраст, текст и голоса тем же
 * блоком, что у постов (компактный размер). Ответы уходят вправо за изогнутой
 * линией принадлежности — она отходит от аватарки родителя и загибается к
 * первому ответу. Ветку можно свернуть: одна кнопка с двумя состояниями —
 * «Показать N ответов» / «Свернуть». Глубже четвёртого уровня сдвиг не растёт,
 * иначе на телефоне не остаётся ширины под текст.
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
  // Ветка открыта, пока её не свернули. Два состояния, оба видно по подписи.
  const [collapsed, setCollapsed] = useState(false);

  const hasReplies = comment.replies.length > 0;
  const replyCount = comment.replies.length;

  function openAuthor() {
    if (comment.author.id) navigation.navigate('User', { userId: comment.author.id });
  }

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
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable onPress={openAuthor}>
          <Avatar name={comment.author.username} uri={comment.author.avatar_url} size={30} />
        </Pressable>

        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Pressable onPress={openAuthor} style={{ flexShrink: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>
                {comment.author.username}
              </Text>
            </Pressable>
            <VerifiedMark verified={comment.author.verified_at} size={15} />
            <Text style={{ fontSize: 13, color: palette.textMuted }}>{formatCompactAge(comment.created_at)}</Text>
          </View>

          <Text style={{ fontSize: 14.5, lineHeight: 21, color: palette.text }}>{comment.body}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: -8, marginTop: 2 }}>
            <VoteBlock id={comment.id} score={comment.score} myVote={comment.myVote} kind="comment" compact />
            {session ? (
              <Pressable onPress={() => setReplying((v) => !v)} hitSlop={6} style={{ paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '600', color: palette.textMuted }}>
                  {replying ? 'Отмена' : 'Ответить'}
                </Text>
              </Pressable>
            ) : null}
          </View>

          {replying ? (
            <View style={{ gap: 8, marginTop: 2 }}>
              <TextInput
                autoFocus
                value={body}
                onChangeText={setBody}
                placeholder="Напишите ответ…"
                placeholderTextColor={palette.textMuted}
                multiline
                style={{
                  borderWidth: 1,
                  borderColor: palette.border,
                  borderRadius: 16,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  fontSize: 14,
                  minHeight: 54,
                  color: palette.text,
                  backgroundColor: palette.surface2,
                }}
              />
              {replyError ? <Text style={{ fontSize: 12.5, color: palette.down }}>{replyError}</Text> : null}
              <Pressable
                onPress={submitReply}
                disabled={submitting || !body.trim()}
                style={{
                  alignSelf: 'flex-start',
                  backgroundColor: palette.accent,
                  borderRadius: 999,
                  paddingHorizontal: 16,
                  paddingVertical: 7,
                  opacity: submitting || !body.trim() ? 0.5 : 1,
                }}
              >
                <Text style={{ color: palette.accentContrast, fontSize: 13, fontWeight: '600' }}>Отправить</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>

      {hasReplies ? (
        <View style={{ marginLeft: depth < 4 ? 15 : 0 }}>
          {/* Ствол линии принадлежности: отходит от аватарки родителя и
              загибается вправо — к первому ответу. Обрывается у низа ветки. */}
          {!collapsed ? (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                top: -6,
                bottom: 34,
                width: 15,
                borderLeftWidth: 1.5,
                borderBottomWidth: 1.5,
                borderColor: palette.border,
                borderBottomLeftRadius: 14,
              }}
            />
          ) : null}

          {!collapsed ? (
            <View style={{ paddingLeft: 22, gap: 16 }}>
              {comment.replies.map((reply, index) => (
                <View key={reply.id}>
                  {/* Волосяная черта между соседними ответами — за аватаркой. */}
                  {index > 0 ? (
                    <View style={{ position: 'absolute', top: -8, left: 40, right: 0, height: 1, backgroundColor: palette.border }} />
                  ) : null}
                  <CommentItem comment={reply} postId={postId} onAdded={onAdded} depth={depth + 1} />
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => setCollapsed((v) => !v)}
            hitSlop={6}
            style={{ alignSelf: 'flex-start', paddingLeft: 22, paddingVertical: 6, marginTop: collapsed ? 0 : 8 }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accent }}>
              {collapsed ? `Показать ${replyCount} ${pluralizeReplies(replyCount)}` : 'Свернуть'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
