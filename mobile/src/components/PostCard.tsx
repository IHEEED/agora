import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Post } from '../lib/types';
import { useVote } from '../lib/useVote';
import { formatRelativeDate } from '../lib/formatDate';
import { pluralizeComments } from '../lib/pluralize';
import { Badge } from './Badge';
import type { RootStackParamList } from '../navigation/types';

export function PostCard({ post }: { post: Post }) {
  const { score, myVote, vote, error } = useVote(post.id, post.score, post.myVote);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <Pressable
      onPress={() => navigation.navigate('Post', { postId: post.id })}
      style={{
        flexDirection: 'row',
        gap: 12,
        borderWidth: 1,
        borderColor: '#e5e5e5',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
      }}
    >
      <View style={{ alignItems: 'center', gap: 2, width: 32 }}>
        <Pressable onPress={() => vote(1)} hitSlop={8}>
          <Text style={{ fontSize: 16, color: myVote === 1 ? '#f97316' : '#999' }}>▲</Text>
        </Pressable>
        <Text style={{ fontSize: 13, fontWeight: '600' }}>{score}</Text>
        <Pressable onPress={() => vote(-1)} hitSlop={8}>
          <Text style={{ fontSize: 16, color: myVote === -1 ? '#3b82f6' : '#999' }}>▼</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontWeight: '600', fontSize: 15 }}>{post.title}</Text>

        {post.community ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#444' }}>{post.community.name}</Text>
            <Badge type={post.community.badge} />
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 12, color: '#888' }}>{post.author.username}</Text>
          <Badge type={post.author.badge} />
          <Text style={{ fontSize: 12, color: '#888' }}>
            · 👁 {post.views} · {formatRelativeDate(post.created_at)}
          </Text>
        </View>

        {post.body ? (
          <Text style={{ fontSize: 13, color: '#555' }} numberOfLines={3}>
            {post.body}
          </Text>
        ) : null}
        {error ? <Text style={{ fontSize: 12, color: '#dc2626' }}>{error}</Text> : null}
        <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
          💬 {post.commentCount} {pluralizeComments(post.commentCount)}
        </Text>
      </View>
    </Pressable>
  );
}
