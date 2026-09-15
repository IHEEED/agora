import { Pressable, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMe } from '../lib/useMe';
import { SUPPORT_USER_ID } from '../lib/support';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/** Текст с датой окончания бана; вечный ('infinity') — без даты. */
function banText(until?: string | null): string {
  if (!until || until.startsWith('infinity')) return 'Вы забанены и пока не можете писать.';
  const date = new Date(until);
  if (Number.isNaN(date.getTime())) return 'Вы забанены и пока не можете писать.';
  return `Вы не можете писать до ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}.`;
}

/**
 * Плашка забанённому — на своей ленте. Показывает срок и путь к апелляции,
 * чтобы человек не узнавал о бане, только упёршись в отказ при отправке.
 */
export function BannedBanner() {
  const palette = usePalette();
  const me = useMe();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  if (!me?.banned) return null;

  return (
    <View
      style={{
        marginHorizontal: 16,
        borderRadius: 16,
        padding: 14,
        gap: 8,
        backgroundColor: `${palette.down}1f`,
        borderWidth: 1,
        borderColor: `${palette.down}47`,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: palette.down }}>{banText(me.banned_until)}</Text>
      {me.ban_reason ? <Text style={{ fontSize: 12.5, color: palette.textMuted }}>Причина: {me.ban_reason}</Text> : null}
      <Pressable onPress={() => navigation.navigate('Chat', { userId: SUPPORT_USER_ID, username: 'parafraz' })}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: palette.accent }}>
          Считаете бан ошибкой? Написать в поддержку →
        </Text>
      </Pressable>
    </View>
  );
}
