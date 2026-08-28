import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { setThemePreference, ThemePreference, useThemePreference } from '../lib/appearance';
import { LocalToggle } from '../components/LocalToggle';
import { ChevronIcon } from '../components/icons';
import { SettingsSectionId } from '../lib/settingsSections';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsSection'>;
type Palette = ReturnType<typeof usePalette>;

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Светлая' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'system', label: 'Системная' },
];

const STYLES = [
  { label: 'Хроника', hint: 'Тёплая бумага, терракота, газетная антиква', on: true },
  { label: 'Ателье', hint: 'Чернила на бумаге, без единого лишнего цвета', on: false },
  { label: 'Полночь', hint: 'Синий полумрак и ледяной акцент', on: false },
  { label: 'Сад', hint: 'Приглушённая зелень и тёплый небелый', on: false },
  { label: 'Сигнал', hint: 'Нейтральный холст и одна фиолетовая нота', on: false },
];

const LOCALES = [
  { id: 'ru', label: 'Русский', on: true },
  { id: 'en', label: 'English', on: false },
  { id: 'es', label: 'Español', on: false },
];

/**
 * Содержимое раздела настроек — все разделы перенесены с веба целиком.
 *
 * Оформление: тема (светлая/тёмная/системная) работает по-настоящему; выбор
 * стиля пока показывает единственный реализованный — Хронику. Аккаунт: почта,
 * телефон, код-приглашение со ссылкой и выход. Модерация — двери в веб-разделы.
 * Уведомления, приватность, контент — локальные переключатели. Язык — список с
 * галочкой. О приложении — версия, правила и поддержка шторками.
 */
export function SettingsSectionScreen({ route }: Props) {
  const palette = usePalette();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useSession();
  const section = route.params.section as SettingsSectionId;
  const themePref = useThemePreference();

  const [sheet, setSheet] = useState<null | 'rules' | 'support'>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const phoneVerified = Boolean((session?.user as { phone_confirmed_at?: string } | undefined)?.phone_confirmed_at);

  useEffect(() => {
    if (section !== 'account') return;
    apiFetch<{ code: string }>('/invites/mine').then((data) => setInviteCode(data.code)).catch(() => {});
  }, [section]);

  async function copyInvite() {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(`${WEB_URL}/?code=${inviteCode}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (section === 'appearance') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 15, color: palette.text }}>Тема</Text>
            <Segmented palette={palette} value={themePref} onChange={setThemePreference} options={THEMES} />
          </View>
        </Card>

        <Text style={{ fontSize: 15, color: palette.text, marginTop: 6, marginHorizontal: 4 }}>Стиль</Text>
        <Text style={{ fontSize: 12.5, lineHeight: 18, color: palette.textMuted, marginHorizontal: 4 }}>
          Фон, цвета, шрифт заголовков и фактура подобраны вместе — стиль меняется целиком.
        </Text>
        <Card palette={palette}>
          {STYLES.map((s, i) => (
            <View
              key={s.label}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: i === STYLES.length - 1 ? 0 : 1, borderBottomColor: palette.border, opacity: s.on ? 1 : 0.5 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: s.on ? palette.accent : palette.text }}>{s.label}</Text>
                <Text style={{ fontSize: 12, color: palette.textMuted }}>{s.hint}</Text>
              </View>
              {s.on ? <Check palette={palette} /> : <Text style={{ fontSize: 12, color: palette.textMuted }}>скоро</Text>}
            </View>
          ))}
        </Card>
        <Note palette={palette}>Остальные стили пока доступны в веб-версии — перенесём их отдельным заходом.</Note>
      </Wrap>
    );
  }

  if (section === 'account') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <Line palette={palette} label="Почта" hint={session?.user.email ?? ''} />
          <Line palette={palette} label="Телефон" hint={phoneVerified ? 'Подтверждён' : 'Нужен, чтобы писать посты и комментарии'}>
            {phoneVerified ? (
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.up }}>Готово</Text>
            ) : (
              <Pill palette={palette} label="Подтвердить" onPress={() => {}} />
            )}
          </Line>
          <Line palette={palette} label={inviteCode ?? '••••••'} hint="Ваш код. Один на всех, кого позовёте" mono last>
            <Pill palette={palette} label={copied ? 'Скопировано' : 'Ссылка'} muted onPress={copyInvite} />
          </Line>
        </Card>

        <Pressable
          onPress={() => supabase.auth.signOut()}
          style={{ borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: `${palette.down}22` }}
        >
          <Text style={{ fontSize: 15, fontWeight: '700', color: palette.down }}>Выйти из аккаунта</Text>
        </Pressable>
      </Wrap>
    );
  }

  if (section === 'moderation') {
    const openMod = () => navigation.navigate('Settings');
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <Line palette={palette} label="Разбор жалоб" hint="Очередь и баны">
            <Pill palette={palette} label="Открыть" muted onPress={openMod} />
          </Line>
          <Line palette={palette} label="Подтверждение личности" hint="Галочки и заявки">
            <Pill palette={palette} label="Открыть" muted onPress={openMod} />
          </Line>
          <Line palette={palette} label="Статистика" hint="Люди и написанное" last>
            <Pill palette={palette} label="Открыть" muted onPress={openMod} />
          </Line>
        </Card>
        <Note palette={palette}>Экраны модерации пока живут в веб-версии — перенесём их отдельным заходом.</Note>
      </Wrap>
    );
  }

  if (section === 'notifications') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <Line palette={palette} label="Ответы на мои посты" hint="Когда кто-то комментирует вашу запись">
            <LocalToggle storageKey="parafraz-notify-replies" defaultOn />
          </Line>
          <Line palette={palette} label="Упоминания" hint="Когда вас отмечают через @">
            <LocalToggle storageKey="parafraz-notify-mentions" defaultOn />
          </Line>
          <Line palette={palette} label="Реакции" hint="Когда за вашу запись голосуют" last>
            <LocalToggle storageKey="parafraz-notify-votes" />
          </Line>
        </Card>
        <LocalNote palette={palette} />
      </Wrap>
    );
  }

  if (section === 'privacy') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <Line palette={palette} label="Закрытый профиль" hint="Записи видны только подписчикам">
            <LocalToggle storageKey="parafraz-private-profile" />
          </Line>
          <Line palette={palette} label="Показывать influence-очки" hint="Другие видят ваш счёт в профиле" last>
            <LocalToggle storageKey="parafraz-show-influence" defaultOn />
          </Line>
        </Card>
        <LocalNote palette={palette} />
      </Wrap>
    );
  }

  if (section === 'content') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          <Line palette={palette} label="Материалы 18+" hint="Показывать записи с пометкой для взрослых">
            <LocalToggle storageKey="parafraz-nsfw" />
          </Line>
          <Line palette={palette} label="Автовоспроизведение" hint="Видео запускается само при прокрутке" last>
            <LocalToggle storageKey="parafraz-autoplay" defaultOn />
          </Line>
        </Card>
        <LocalNote palette={palette} />
      </Wrap>
    );
  }

  if (section === 'language') {
    return (
      <Wrap palette={palette}>
        <Card palette={palette}>
          {LOCALES.map((l, i) => (
            <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 15, borderBottomWidth: i === LOCALES.length - 1 ? 0 : 1, borderBottomColor: palette.border, opacity: l.on ? 1 : 0.5 }}>
              <Text style={{ flex: 1, fontSize: 16, color: palette.text }}>{l.label}</Text>
              {l.on ? <Check palette={palette} /> : null}
            </View>
          ))}
        </Card>
        <Note palette={palette}>Пока приложение говорит по-русски; выбор языка появится позже.</Note>
      </Wrap>
    );
  }

  // about
  return (
    <Wrap palette={palette}>
      <Card palette={palette}>
        <Line palette={palette} label="Версия" hint="PARAFRAZ, сборка для разработки" />
        <Line palette={palette} label="Правила" onPress={() => setSheet('rules')} />
        <Line palette={palette} label="Поддержка" onPress={() => setSheet('support')} last />
      </Card>
      <Note palette={palette}>
        Переключатели уведомлений, приватности и контента пока сохраняются только на этом устройстве — серверной части у них ещё нет.
      </Note>

      <InfoSheet
        palette={palette}
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'support' ? 'Поддержка' : 'Правила'}
        body={
          sheet === 'support'
            ? 'Что-то сломалось или есть идея — напишите в телеграм @parafraz. Отвечает живой человек, обычно в тот же день.'
            : 'Три пункта, а не свод. Не оскорблять людей. Минус — это несогласие, а не травля. Чужое лицо и имя — только с разрешения.'
        }
      />
    </Wrap>
  );
}

/* ── Кусочки ──────────────────────────────────────────────────────────── */

function Wrap({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16, gap: 12 }}>
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
  mono = false,
  children,
}: {
  palette: Palette;
  label: string;
  hint?: string;
  onPress?: () => void;
  last?: boolean;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
        backgroundColor: pressed && onPress ? palette.surface2 : 'transparent',
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color: palette.text, letterSpacing: mono ? 2 : 0 }}>{label}</Text>
        {hint ? <Text style={{ fontSize: 12.5, color: palette.textMuted, marginTop: 1 }}>{hint}</Text> : null}
      </View>
      {children ?? (onPress ? <ChevronIcon size={16} color={palette.textMuted} /> : null)}
    </Pressable>
  );
}

function Pill({ palette, label, onPress, muted = false }: { palette: Palette; label: string; onPress: () => void; muted?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: muted ? palette.surface2 : palette.accent }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: muted ? palette.text : palette.accentContrast }}>{label}</Text>
    </Pressable>
  );
}

function Check({ palette }: { palette: Palette }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12.5 9 17.5 20 6.5" />
    </Svg>
  );
}

function Segmented<T extends string>({
  palette,
  value,
  onChange,
  options,
}: {
  palette: Palette;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: palette.surface2, borderRadius: 12, padding: 3 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: on ? palette.accent : 'transparent' }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: on ? palette.accentContrast : palette.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Note({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return <Text style={{ fontSize: 13, lineHeight: 18, color: palette.textMuted, paddingHorizontal: 4 }}>{children}</Text>;
}

function LocalNote({ palette }: { palette: Palette }) {
  return (
    <Note palette={palette}>
      Пока сохраняется только на этом устройстве — серверной части у переключателя ещё нет.
    </Note>
  );
}

function InfoSheet({ palette, open, onClose, title, body }: { palette: Palette; open: boolean; onClose: () => void; title: string; body: string }) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36, gap: 12 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border }} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>{title}</Text>
          <Text style={{ fontSize: 14.5, lineHeight: 21, color: palette.textMuted }}>{body}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
