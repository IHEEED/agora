import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';
import { Avatar } from './Avatar';
import { VerifiedMark } from './VerifiedMark';
import { usePalette } from '../theme';

/**
 * «Кого почитать» — горизонтальная лента плиток, как в вебе.
 *
 * Плитки плоские, отличаются от фона тоном, а не тенью: тень, рассчитанная на
 * панель размером с экран, на квадратике собирается в углах в грязные скобки
 * (та же причина, что и в вебе).
 */

type Person = {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  verified_at?: string | null;
  karma: number;
};

export function SuggestedPeople() {
  const palette = usePalette();
  const [people, setPeople] = useState<Person[]>([]);

  useEffect(() => {
    apiFetch<Person[]>('/users/suggestions')
      .then(setPeople)
      .catch(() => {});
  }, []);

  if (people.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingHorizontal: 16, paddingVertical: 12 }}
    >
      {people.map((person) => {
        const name = person.display_name || person.username;
        return (
          <View
            key={person.id}
            style={{
              width: 130,
              borderRadius: 16,
              padding: 12,
              alignItems: 'center',
              gap: 8,
              backgroundColor: palette.surface2,
            }}
          >
            <Avatar name={name} uri={person.avatar_url} size={56} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>
                {name}
              </Text>
              <VerifiedMark verified={person.verified_at} size={12} />
            </View>
            <Text style={{ fontSize: 12, color: palette.textMuted }}>{person.karma} influence</Text>
            <Pressable
              style={{
                marginTop: 2,
                borderRadius: 999,
                paddingHorizontal: 16,
                paddingVertical: 6,
                backgroundColor: palette.accent,
              }}
            >
              <Text style={{ fontSize: 12.5, fontWeight: '600', color: palette.accentContrast }}>
                Подписаться
              </Text>
            </Pressable>
          </View>
        );
      })}
    </ScrollView>
  );
}
