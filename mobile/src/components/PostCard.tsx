import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Post } from '../lib/types';
import { useVote } from '../lib/useVote';
import { formatRelativeDate } from '../lib/formatDate';
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
 * Карточка записи — один в один с вебом.
 *
 * Ни рамки, ни левой колонки голосов: пост отделяется от соседа полоской,
 * которую рисует список, и идёт во всю ширину. Сверху — автор с лицом, именем
 * и галочкой; заголовок газетной антиквой (на iOS это Georgia, тот же откат,
 * что в вебе); внизу — строка действий: голоса, комментарии, просмотры, репост,
 * поделиться.
 */
export function PostCard({ post }: { post: Post }) {
  const palette = usePalette();
  const { score, myVote, vote, error } = useVote(post.id, post.score, post.myVote);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const authorName = post.author.display_name || post.author.username;

  const iconBtn = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  };

  return (
    <Pressable
      onPress={() => navigation.navigate('Post', { postId: post.id })}
      style={{
        flexDirection: 'column',
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: palette.border,
        backgroundColor: palette.bg,
      }}
    >
      {post.pinned_global ? (
        <Text style={{ fontSize: 12.5, fontWeight: '600', color: palette.accent }}>📌 Закреплено</Text>
      ) : null}

      {/* Автор: лицо, имя, галочка, время. Три точки справа. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar name={authorName} uri={post.author.avatar_url} size={38} />
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>
            {authorName}
          </Text>
          <VerifiedMark verified={post.author.verified_at} size={14} />
          <Text style={{ fontSize: 13, color: palette.textMuted }}>
            {formatRelativeDate(post.created_at)}
          </Text>
        </View>
        <Text style={{ fontSize: 20, color: palette.textMuted, marginTop: -6 }}>⋯</Text>
      </View>

      {/* Заголовок антиквой, текст обычной гарнитурой. */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontFamily: 'Georgia', fontSize: 18, color: palette.text, lineHeight: 23 }}>
          {post.title}
        </Text>
        {post.community ? (
          <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accent }}>
            {post.community.name}
          </Text>
        ) : null}
        {post.body ? (
          <Text style={{ fontSize: 14, color: palette.text, lineHeight: 20 }} numberOfLines={5}>
            {post.body}
          </Text>
        ) : null}
      </View>

      {error ? <Text style={{ fontSize: 12, color: palette.down }}>{error}</Text> : null}

      {/* Строка действий: слева голоса и комментарии, справа просмотры, репост,
          поделиться. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Голоса горизонтально: вверх, счёт, вниз. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 4 }}>
            <Pressable onPress={() => vote(1)} hitSlop={8}>
              <Text style={{ fontSize: 17, color: myVote === 1 ? palette.up : palette.textMuted }}>▲</Text>
            </Pressable>
            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>{score}</Text>
            <Pressable onPress={() => vote(-1)} hitSlop={8}>
              <Text style={{ fontSize: 17, color: myVote === -1 ? palette.down : palette.textMuted }}>▼</Text>
            </Pressable>
          </View>

          <View style={iconBtn}>
            <Text style={{ fontSize: 16 }}>💬</Text>
            <Text style={{ fontSize: 14, color: palette.textMuted }}>
              {post.commentCount}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {post.views > 0 ? (
            <View style={{ ...iconBtn, gap: 4 }}>
              <Text style={{ fontSize: 13 }}>👁</Text>
              <Text style={{ fontSize: 13, color: palette.textMuted }}>{compactViews(post.views)}</Text>
            </View>
          ) : null}
          <View style={iconBtn}>
            <Text style={{ fontSize: 15, color: palette.textMuted }}>↻</Text>
          </View>
          <View style={iconBtn}>
            <Text style={{ fontSize: 15, color: palette.textMuted }}>↑</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
