import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { VerifiedMark } from '../components/VerifiedMark';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Person = { id: string; username: string; avatar_url?: string | null; verified_at?: string | null };
type Props = NativeStackScreenProps<RootStackParamList, 'NewMessage'>;

/**
 * «Кому написать» — нативным модал-экраном (presentation: 'modal'), как в вебе
 * шторка выбора человека. Список людей с поиском; тап открывает переписку.
 */
export function NewMessageScreen({ navigation }: Props) {
  const palette = usePalette();
  const { t } = useT();
  const [people, setPeople] = useState<Person[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    apiFetch<Person[]>('/users').then(setPeople).catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? people.filter((p) => p.username.toLowerCase().includes(q)) : people;
  }, [people, query]);

  function open(person: Person) {
    navigation.goBack();
    navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('Chat', { userId: person.id, username: person.username });
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 12, marginBottom: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: palette.surface2 }}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="11" cy="11" r="6.5" />
          <Path d="m20 20-4.3-4.3" />
        </Svg>
        <TextInput value={query} onChangeText={setQuery} placeholder={t('Поиск людей')} placeholderTextColor={palette.textMuted} autoFocus style={{ flex: 1, fontSize: 15, color: palette.text }} />
      </View>

      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: pressed ? palette.surface2 : 'transparent' })}>
            <Avatar name={item.username} uri={item.avatar_url} size={44} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{item.username}</Text>
            <VerifiedMark verified={item.verified_at} size={14} />
          </Pressable>
        )}
      />
    </View>
  );
}
