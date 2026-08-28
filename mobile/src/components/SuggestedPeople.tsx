import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { AvatarFollow } from './AvatarFollow';
import { VerifiedMark } from './VerifiedMark';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/**
 * «Кого почитать» — горизонтальная лента карточек, как в вебе.
 *
 * Карточка ужата до лица, имени и счёта influence: подписка живёт значком на
 * самой аватарке (AvatarFollow), а не отдельной кнопкой-пилюлей под именем.
 * В углу крестик — убрать одного человека из подсказок. Плитки плоские,
 * отличаются от фона тоном, а не тенью.
 */

type Person = {
  id: string;
  username: string;
  avatar_url?: string | null;
  verified_at?: string | null;
  isFollowing?: boolean;
  karma: number;
};

const CARD_WIDTH = 148;

export function SuggestedPeople() {
  const palette = usePalette();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    apiFetch<Person[]>('/users/suggestions')
      .then(setPeople)
      .catch(() => {});
  }, []);

  function dismiss(id: string) {
    setPeople((prev) => prev.filter((person) => person.id !== id));
  }

  if (people.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 4 }}
    >
      {people.map((person) => (
        <Pressable
          key={person.id}
          onPress={() => navigation.navigate('User', { userId: person.id })}
          style={{
            width: CARD_WIDTH,
            borderRadius: 16,
            padding: 12,
            alignItems: 'center',
            gap: 8,
            backgroundColor: palette.surface2,
          }}
        >
          <Pressable
            onPress={() => dismiss(person.id)}
            hitSlop={10}
            style={{ position: 'absolute', right: 6, top: 6, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', zIndex: 1 }}
          >
            <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={2.2} strokeLinecap="round">
              <Path d="M6 6l12 12M18 6 6 18" />
            </Svg>
          </Pressable>

          <AvatarFollow
            userId={person.id}
            username={person.username}
            avatar={person.avatar_url}
            initiallyFollowing={person.isFollowing}
            size={60}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
            <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 13.5, fontWeight: '600', color: palette.text }}>
              {person.username}
            </Text>
            <VerifiedMark verified={person.verified_at} size={14} />
          </View>
          <Text style={{ fontSize: 11.5, color: palette.textMuted }}>{person.karma} influence</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
