import { useEffect, useMemo, useState } from 'react';
import { ScrollView, Pressable, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { Post } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { AvatarFollow } from '../components/AvatarFollow';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CommunityAbout'>;

/**
 * «О клубе» — нативным модал-экраном (presentation: 'modal'), как «новый пост»:
 * выезжает снизу и тянется вниз без зазора. Описание, создатель, дата и список
 * участников (считаются по написавшим). Данные те же, что на странице клуба.
 */
export function CommunityAboutScreen({ route, navigation }: Props) {
  const { community } = route.params;
  const palette = usePalette();
  const { t } = useT();
  const { session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    apiFetch<Post[]>(`/posts/community/${community.id}?sort=hot`).then(setPosts).catch(() => {});
  }, [community.id]);

  const people = useMemo(() => {
    const seen = new Map<string, { id: string; username: string; posts: number; isFollowing?: boolean; avatar_url?: string | null }>();
    for (const post of posts) {
      const id = post.author.id;
      if (!id) continue;
      const found = seen.get(id);
      if (found) { found.posts += 1; continue; }
      seen.set(id, { id, username: post.author.username, posts: 1, isFollowing: post.author.isFollowing, avatar_url: post.author.avatar_url });
    }
    return [...seen.values()].sort((a, b) => b.posts - a.posts);
  }, [posts]);

  const created = community.created_at
    ? new Date(community.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  function openUser(id: string) {
    navigation.goBack();
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('User', { userId: id });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 20, gap: 18 }}>
      <Text style={{ fontSize: 14.5, lineHeight: 21, color: palette.text }}>
        {community.description || t('Описание пока не заполнено.')}
      </Text>

      <View style={{ gap: 8 }}>
        {community.creator ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13.5, color: palette.textMuted }}>{t('Создатель')}</Text>
            <Pressable onPress={() => community.creator.id && openUser(community.creator.id)}>
              <Text style={{ fontSize: 13.5, fontWeight: '600', color: palette.accent }}>{community.creator.username}</Text>
            </Pressable>
          </View>
        ) : null}
        {created ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13.5, color: palette.textMuted }}>{t('Создано')}</Text>
            <Text style={{ fontSize: 13.5, color: palette.text }}>{created}</Text>
          </View>
        ) : null}
      </View>

      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text, marginBottom: 4 }}>{t('Участники')}</Text>
        {people.map((person) => (
          <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
            <Pressable onPress={() => openUser(person.id)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={person.username} uri={person.avatar_url} size={40} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{person.username}</Text>
                <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{person.posts} {t('записей')}</Text>
              </View>
            </Pressable>
            {person.id !== session?.user.id ? (
              <AvatarFollow userId={person.id} username={person.username} avatar={person.avatar_url} initiallyFollowing={person.isFollowing} size={34} />
            ) : null}
          </View>
        ))}
        {people.length === 0 ? <Text style={{ paddingVertical: 12, fontSize: 14, color: palette.textMuted }}>{t('Пока никто здесь не писал.')}</Text> : null}
      </View>
    </ScrollView>
  );
}
