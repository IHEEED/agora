import { Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useSession } from '../lib/useSession';
import { ChevronIcon } from '../components/icons';
import { SettingsSectionId } from '../lib/settingsSections';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsSection'>;
type Palette = ReturnType<typeof usePalette>;

/**
 * Содержимое одного раздела настроек. Разделы, которые в мобильном ещё не
 * подкреплены рабочими экранами (модерация) или переключателями на сервере
 * (уведомления, приватность, контент), показывают пояснение, а не пустоту —
 * так видно, что раздел есть и куда он ведёт, а не будто он сломан.
 */
export function SettingsSectionScreen({ route }: Props) {
  const palette = usePalette();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useSession();
  const section = route.params.section as SettingsSectionId;

  if (section === 'account') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <Line palette={palette} label="Email" hint={session?.user.email ?? ''} />
          <Line palette={palette} label="Редактировать профиль" onPress={() => navigation.navigate('ProfileEdit')} last />
        </Card>
      </Wrap>
    );
  }

  if (section === 'appearance') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <Line palette={palette} label="Тема" hint="Следует за системой" last />
        </Card>
        <Note palette={palette}>
          Пока приложение подхватывает светлую или тёмную тему телефона. Выбор стиля
          вручную, как в вебе, добавим, когда тем станет больше одной.
        </Note>
      </Wrap>
    );
  }

  if (section === 'moderation') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <Line palette={palette} label="Разбор жалоб" hint="Очередь и баны" />
          <Line palette={palette} label="Подтверждение личности" hint="Галочки и заявки" />
          <Line palette={palette} label="Статистика" hint="Люди и написанное" last />
        </Card>
        <Note palette={palette}>Разделы модерации пока доступны в веб-версии — перенесём их отдельным заходом.</Note>
      </Wrap>
    );
  }

  if (section === 'about') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <Line palette={palette} label="Версия" hint="PARAFRAZ • iOS" last />
        </Card>
        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={{ marginTop: 4, borderRadius: 14, paddingVertical: 14, alignItems: 'center', backgroundColor: palette.surface }}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: palette.down }}>Выйти</Text>
        </Pressable>
      </Wrap>
    );
  }

  // notifications / content / privacy / language — переключатели живут на
  // устройстве и в вебе, серверной части у них нет.
  const text: Record<string, string> = {
    notifications: 'Какие уведомления показывать — ответы, упоминания, поддержку. Переключатели добавим отдельным заходом.',
    content: 'Чувствительный контент и автовоспроизведение. Настройки появятся здесь позже.',
    privacy: 'Закрытый профиль и показ influence. Настройки появятся здесь позже.',
    language: 'Язык интерфейса. Пока приложение говорит по-русски; выбор языка добавим позже.',
  };

  return (
    <Wrap palette={palette}>
      <Note palette={palette}>{text[section] ?? 'Раздел появится здесь позже.'}</Note>
    </Wrap>
  );
}

function Wrap({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16, gap: 14 }}>
      {children}
    </ScrollView>
  );
}

function Card({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return <View style={{ borderRadius: 16, backgroundColor: palette.surface, overflow: 'hidden' }}>{children}</View>;
}

function Line({
  palette,
  label,
  hint,
  onPress,
  last = false,
}: {
  palette: Palette;
  label: string;
  hint?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
        backgroundColor: pressed && onPress ? palette.surface2 : 'transparent',
      })}
    >
      <Text style={{ flex: 1, fontSize: 15, color: palette.text }}>{label}</Text>
      {hint ? <Text numberOfLines={1} style={{ fontSize: 14, color: palette.textMuted, maxWidth: '55%' }}>{hint}</Text> : null}
      {onPress ? <ChevronIcon size={16} color={palette.textMuted} /> : null}
    </Pressable>
  );
}

function Note({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 13.5, lineHeight: 19, color: palette.textMuted, paddingHorizontal: 4 }}>{children}</Text>
  );
}
