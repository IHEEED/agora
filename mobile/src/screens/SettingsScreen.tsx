import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { ChevronIcon } from '../components/icons';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Настройки — хаб, как в вебе.
 *
 * Разделы строками: профиль, аккаунт, оформление, модерация (только у
 * модераторов) и выход. Открывается шестерёнкой из шапки профиля. Оформление
 * пока следует за системной темой (светлая/тёмная) — ручной выбор стиля,
 * как на сайте, ляжет отдельным заходом, когда в мобильном будет больше одной
 * темы.
 */
export function SettingsScreen() {
  const palette = usePalette();
  const navigation = useNavigation<Nav>();
  const { session } = useSession();
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    apiFetch<{ isModerator: boolean }>('/users/me')
      .then((me) => setIsModerator(Boolean(me.isModerator)))
      .catch(() => {});
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16, gap: 20 }}>
      <Group palette={palette} title="Профиль">
        <Row palette={palette} label="Редактировать профиль" hint="Имя и подпись" onPress={() => navigation.navigate('ProfileEdit')} last />
      </Group>

      <Group palette={palette} title="Аккаунт">
        <Row palette={palette} label="Email" hint={session?.user.email ?? ''} last />
      </Group>

      <Group palette={palette} title="Оформление">
        <Row palette={palette} label="Тема" hint="Следует за системой" last />
      </Group>

      {isModerator ? (
        <Group palette={palette} title="Модерация">
          <Row palette={palette} label="Разбор жалоб" hint="Очередь и баны — пока в вебе" />
          <Row palette={palette} label="Подтверждение личности" hint="Галочки и заявки — пока в вебе" />
          <Row palette={palette} label="Статистика" hint="Люди и написанное — пока в вебе" last />
        </Group>
      ) : null}

      <Pressable
        onPress={() => supabase.auth.signOut()}
        style={{ marginTop: 4, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: palette.surface2 }}
      >
        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.down }}>Выйти</Text>
      </Pressable>
    </ScrollView>
  );
}

function Group({ palette, title, children }: { palette: ReturnType<typeof usePalette>; title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: palette.textMuted, marginLeft: 4 }}>{title}</Text>
      <View style={{ borderRadius: 14, backgroundColor: palette.surface2, overflow: 'hidden' }}>{children}</View>
    </View>
  );
}

function Row({
  palette,
  label,
  hint,
  onPress,
  last = false,
}: {
  palette: ReturnType<typeof usePalette>;
  label: string;
  hint?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
      }}
    >
      <Text style={{ flex: 1, fontSize: 15, color: palette.text }}>{label}</Text>
      {hint ? <Text style={{ fontSize: 14, color: palette.textMuted, maxWidth: '55%' }} numberOfLines={1}>{hint}</Text> : null}
      {onPress ? <ChevronIcon size={16} color={palette.textMuted} /> : null}
    </Pressable>
  );
}
