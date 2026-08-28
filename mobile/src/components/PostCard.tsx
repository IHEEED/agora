import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Post } from '../lib/types';
import { useVote } from '../lib/useVote';
import { formatRelativeDate } from '../lib/formatDate';
import { pluralizeComments } from '../lib/pluralize';
import { Avatar } from './Avatar';
import { VerifiedMark } from './VerifiedMark';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/** Просмотры коротко: 1200 → «1,2К». */
function compactViews(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${k < 10 ? k.toFixed(1).replace('.', ',').replace(',0', '') : Math.round(k)}К`;
  }
  return `${(value / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')}М`;
}

/**
 * Карточка записи — в том же виде, что в вебе.
 *
 * Плоская строка, а не карточка в рамке: лента — сплошной список, разделённый
 * волосяной чертой, а не набор плиток. Голоса стрелками слева, лицо автора с
 * галочкой, заголовок, текст, внизу — просмотры и комментарии.
 */
export function PostCard({ post }: { post: Post }) {
  const palette = usePalette();
  const { score, myVote, vote, error } = useVote(post.id, post.score, post.myVote);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const authorName = post.author.display_name || post.author.username;

  return (
    <Pressable
      onPress={() => navigation.navigate('Post', { postId: post.id })}
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        backgroundColor: palette.bg,
      }}
    >
      {/* Голоса стрелками — вверх зелёная, вниз красная, как в вебе. */}
      <View style={{ alignItems: 'center', gap: 2, width: 30 }}>
        <Pressable onPress={() => vote(1)} hitSlop={8}>
          <Text style={{ fontSize: 15, color: myVote === 1 ? palette.up : palette.textMuted }}>▲</Text>
        </Pressable>
        <Text style={{ fontSize: 13, fontWeight: '700', color: palette.text }}>{score}</Text>
        <Pressable onPress={() => vote(-1)} hitSlop={8}>
          <Text style={{ fontSize: 15, color: myVote === -1 ? palette.down : palette.textMuted }}>▼</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        {post.pinned_global ? (
          <Text style={{ fontSize: 12, fontWeight: '600', color: palette.accent }}>📌 Закреплено</Text>
        ) : null}

        {/* Автор: лицо, имя, галочка, время. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Avatar name={authorName} uri={post.author.avatar_url} size={22} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{authorName}</Text>
          <VerifiedMark verified={post.author.verified_at} size={13} />
          <Text style={{ fontSize: 12, color: palette.textMuted }}>
            · {formatRelativeDate(post.created_at)}
          </Text>
        </View>

        <Text style={{ fontSize: 16, fontWeight: '700', color: palette.text }}>{post.title}</Text>

        {post.community ? (
          <Text style={{ fontSize: 12, fontWeight: '600', color: palette.accent }}>
            {post.community.name}
          </Text>
        ) : null}

        {post.body ? (
          <Text style={{ fontSize: 14, color: palette.text, lineHeight: 20 }} numberOfLines={4}>
            {post.body}
          </Text>
        ) : null}

        {error ? <Text style={{ fontSize: 12, color: palette.down }}>{error}</Text> : null}

        {/* Низ: комментарии и просмотры. Просмотры мельче — это показание. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 2 }}>
          <Text style={{ fontSize: 13, color: palette.textMuted }}>
            💬 {post.commentCount} {pluralizeComments(post.commentCount)}
          </Text>
          {post.views > 0 ? (
            <Text style={{ fontSize: 12, color: palette.textMuted }}>👁 {compactViews(post.views)}</Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
