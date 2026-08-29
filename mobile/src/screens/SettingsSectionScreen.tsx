import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { setStylePreference, setThemePreference, StyleId, ThemePreference, useStylePreference, useThemePreference } from '../lib/appearance';
import { LocalToggle } from '../components/LocalToggle';
import { SegmentedControl } from '../components/SegmentedControl';
import { InvitesPanel } from '../components/InvitesPanel';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { ChevronIcon } from '../components/icons';
import { SettingsSectionId } from '../lib/settingsSections';
import { useIsDark, usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SettingsSection'>;
type Palette = ReturnType<typeof usePalette>;

const THEMES: ReadonlyArray<readonly [ThemePreference, string]> = [
  ['light', 'Светлая'],
  ['dark', 'Тёмная'],
  ['system', 'Системная'],
];

/** Стили с превью-цветами из веба: [фон, поверхность, акцент] для свет/тьмы. */
const STYLES: { id: StyleId; label: string; hint: string; serif: boolean; light: [string, string, string]; dark: [string, string, string] }[] = [
  { id: 'chronicle', label: 'Хроника', hint: 'Тёплая бумага, терракота, газетная антиква', serif: true, light: ['#faf7f2', '#fffdf9', '#bf5b38'], dark: ['#16140f', '#1f1c16', '#e08a5f'] },
  { id: 'atelier', label: 'Ателье', hint: 'Чернила на бумаге, без единого лишнего цвета', serif: true, light: ['#fbfbf9', '#ffffff', '#141412'], dark: ['#0b0b0a', '#141412', '#f5f4f0'] },
  { id: 'midnight', label: 'Полночь', hint: 'Синий полумрак и ледяной акцент', serif: false, light: ['#f6f7f9', '#ffffff', '#3457d5'], dark: ['#090b10', '#12151c', '#86a8ff'] },
  { id: 'garden', label: 'Сад', hint: 'Приглушённая зелень и тёплый небелый', serif: true, light: ['#f5f7f1', '#fdfefb', '#4a6b3a'], dark: ['#10130d', '#181c14', '#a3c47e'] },
  { id: 'signal', label: 'Сигнал', hint: 'Нейтральный холст и одна фиолетовая нота', serif: false, light: ['#fbfbfd', '#ffffff', '#5b3ad6'], dark: ['#0d0d11', '#16161d', '#a88cff'] },
];

const LOCALES = [
  { id: 'ru', label: 'Русский', on: true },
  { id: 'en', label: 'English', on: false },
  { id: 'es', label: 'Español', on: false },
];

/** Правила — три пункта, тем же текстом, что в вебе (AboutSheets). */
const RULES = [
  {
    title: 'Спорьте, а не побеждайте',
    body: 'Минус здесь — не наказание, а участие: он говорит «прочитал и не согласен». Запись с двадцатью плюсами и восемнадцатью минусами интереснее записи с пятью плюсами. Несогласие — нормальная часть разговора, переход на человека — нет.',
  },
  {
    title: 'Отвечайте тому, кто написал',
    body: 'Цепочку продолжает только автор и только один раз. Это не ограничение доступа, а форма: мысль в три захода читается, мысль в тридцать — нет.',
  },
  {
    title: 'Чужое остаётся чужим',
    body: 'Пересланное сообщение подписано автором, репост в историю ведёт на источник. Выдавать чужое за своё нечем — и не стоит пытаться обойти.',
  },
];

/**
 * Содержимое раздела настроек — все разделы перенесены с веба целиком.
 *
 * Оформление: тема (светлая/тёмная/системная) той же «гусеницей», что в вебе;
 * ниже — пять стилей превью-макетами. Аккаунт: почта, телефон, код-приглашение
 * и выход. Модерация — двери в рабочие экраны. Уведомления, приватность, контент
 * — локальные переключатели. Язык — список с галочкой. О приложении — версия,
 * правила и поддержка шторками (fade), настоящим текстом с сайта.
 */
export function SettingsSectionScreen({ route }: Props) {
  const palette = usePalette();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useSession();
  const section = route.params.section as SettingsSectionId;
  const themePref = useThemePreference();
  const stylePref = useStylePreference();
  const dark = useIsDark();

  const [sheet, setSheet] = useState<null | 'rules' | 'support'>(null);
  // Пасхалка «Гламур»: сколько раз упёрлись в дно раздела «О приложении».
  const [bumps, setBumps] = useState(0);
  const glamUnlocked = bumps >= 3;
  const glamOn = stylePref === 'glam';
  const phoneVerified = Boolean((session?.user as { phone_confirmed_at?: string } | undefined)?.phone_confirmed_at);

  if (section === 'appearance') {
    return (
      <Wrap palette={palette} title={route.params.title}>
        <Card palette={palette}>
          <View style={{ padding: 16, gap: 10 }}>
            <Text style={{ fontSize: 15, color: palette.text }}>Тема</Text>
            <SegmentedControl value={themePref} onChange={setThemePreference} options={THEMES} />
          </View>
        </Card>

        <Text style={{ fontSize: 15, color: palette.text, marginTop: 6, marginHorizontal: 4 }}>Стиль</Text>
        <Text style={{ fontSize: 12.5, lineHeight: 18, color: palette.textMuted, marginHorizontal: 4 }}>
          Фон, цвета, шрифт заголовков и фактура подобраны вместе — стиль меняется целиком.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {STYLES.map((s) => {
            const swatch = dark ? s.dark : s.light;
            const selected = stylePref === s.id;
            return (
              <Pressable key={s.id} onPress={() => setStylePreference(s.id)} style={{ width: '47%', gap: 6 }}>
                {/* Превью-макет как в вебе: фон стиля, «Aa» его гарнитурой и
                    карточка с двумя строками текста и акцентной точкой. */}
                <View
                  style={{
                    height: 86,
                    borderRadius: 12,
                    padding: 10,
                    justifyContent: 'flex-end',
                    gap: 6,
                    backgroundColor: swatch[0],
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? swatch[2] : palette.border,
                  }}
                >
                  <Text style={{ fontSize: 13, color: swatch[2], fontFamily: s.serif ? 'Georgia' : 'System', fontWeight: s.serif ? '500' : '700' }}>Aa</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 6, padding: 6, backgroundColor: swatch[1] }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <View style={{ height: 3, borderRadius: 2, backgroundColor: swatch[2], opacity: 0.55 }} />
                      <View style={{ height: 3, width: '66%', borderRadius: 2, backgroundColor: swatch[2], opacity: 0.25 }} />
                    </View>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: swatch[2] }} />
                  </View>
                </View>
                <View style={{ paddingHorizontal: 2 }}>
                  <Text style={{ fontSize: 13.5, fontWeight: '600', color: selected ? palette.accent : palette.text }}>{s.label}</Text>
                  <Text style={{ fontSize: 11.5, lineHeight: 15, color: palette.textMuted }}>{s.hint}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Wrap>
    );
  }

  if (section === 'account') {
    return (
      <Wrap palette={palette} title={route.params.title}>
        <Card palette={palette}>
          <Line palette={palette} label="Почта" hint={session?.user.email ?? ''} first />
          <Line palette={palette} label="Телефон" hint={phoneVerified ? 'Подтверждён' : 'Нужен, чтобы писать посты и комментарии'}>
            {phoneVerified ? (
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.up }}>Готово</Text>
            ) : (
              <Pill palette={palette} label="Подтвердить" onPress={() => {}} />
            )}
          </Line>
          <InvitesPanel />
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
    return (
      <Wrap palette={palette} title={route.params.title}>
        <Card palette={palette}>
          <Line palette={palette} label="Разбор жалоб" hint="Очередь и баны" onPress={() => navigation.navigate('Moderation')} first />
          <Line palette={palette} label="Подтверждение личности" hint="Галочки и заявки" onPress={() => navigation.navigate('Verification')} />
          <Line palette={palette} label="Статистика" hint="Люди и написанное" onPress={() => navigation.navigate('Stats')} />
        </Card>
      </Wrap>
    );
  }

  if (section === 'notifications') {
    return (
      <Wrap palette={palette} title={route.params.title}>
        <Card palette={palette}>
          <Line palette={palette} label="Ответы на мои посты" hint="Когда кто-то комментирует вашу запись" first>
            <LocalToggle storageKey="parafraz-notify-replies" defaultOn />
          </Line>
          <Line palette={palette} label="Упоминания" hint="Когда вас отмечают через @">
            <LocalToggle storageKey="parafraz-notify-mentions" defaultOn />
          </Line>
          <Line palette={palette} label="Реакции" hint="Когда за вашу запись голосуют">
            <LocalToggle storageKey="parafraz-notify-votes" />
          </Line>
        </Card>
        <LocalNote palette={palette} />
      </Wrap>
    );
  }

  if (section === 'privacy') {
    return (
      <Wrap palette={palette} title={route.params.title}>
        <Card palette={palette}>
          <Line palette={palette} label="Закрытый профиль" hint="Записи видны только подписчикам" first>
            <LocalToggle storageKey="parafraz-private-profile" />
          </Line>
          <Line palette={palette} label="Показывать influence-очки" hint="Другие видят ваш счёт в профиле">
            <LocalToggle storageKey="parafraz-show-influence" defaultOn />
          </Line>
        </Card>
        <LocalNote palette={palette} />
      </Wrap>
    );
  }

  if (section === 'content') {
    return (
      <Wrap palette={palette} title={route.params.title}>
        <Card palette={palette}>
          <Line palette={palette} label="Материалы 18+" hint="Показывать записи с пометкой для взрослых" first>
            <LocalToggle storageKey="parafraz-nsfw" />
          </Line>
          <Line palette={palette} label="Автовоспроизведение" hint="Видео запускается само при прокрутке">
            <LocalToggle storageKey="parafraz-autoplay" defaultOn />
          </Line>
        </Card>
        <LocalNote palette={palette} />
      </Wrap>
    );
  }

  if (section === 'language') {
    return (
      <Wrap palette={palette} title={route.params.title}>
        <Card palette={palette}>
          {LOCALES.map((l, i) => (
            <View key={l.id}>
              {i > 0 ? <View style={{ height: 1, marginLeft: 16, backgroundColor: palette.border }} /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 46, paddingHorizontal: 16, paddingVertical: 9, opacity: l.on ? 1 : 0.5 }}>
                <Text style={{ flex: 1, fontSize: 16, color: palette.text }}>{l.label}</Text>
                {l.on ? <Check palette={palette} /> : null}
              </View>
            </View>
          ))}
        </Card>
        <Note palette={palette}>Пока приложение говорит по-русски; выбор языка появится позже.</Note>
      </Wrap>
    );
  }

  // about
  return (
    <Wrap palette={palette} title={route.params.title} onBump={() => setBumps((b) => b + 1)}>
      <Card palette={palette}>
        <Line palette={palette} label="Версия" hint="PARAFRAZ, сборка для разработки" first />
        <Line palette={palette} label="Правила" onPress={() => setSheet('rules')} />
        <Line palette={palette} label="Поддержка" onPress={() => setSheet('support')} />
      </Card>
      <Note palette={palette}>
        Переключатели уведомлений, приватности и контента пока сохраняются только на этом устройстве — серверной части у них ещё нет.
      </Note>

      <Sheet palette={palette} open={sheet !== null} onClose={() => setSheet(null)} title={sheet === 'support' ? 'Поддержка' : 'Правила'}>
        {sheet === 'support' ? (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 14, lineHeight: 21, color: palette.text }}>
              Напишите в <Text style={{ fontWeight: '700', color: palette.accent }}>@parafraz</Text> — это общий аккаунт поддержки. Отвечает тот из модераторов, кто сейчас свободен, в той же переписке.
            </Text>
            <Text style={{ fontSize: 13.5, lineHeight: 20, color: palette.textMuted }}>
              Если что-то сломалось, приложите снимок экрана и скажите, что делали за секунду до поломки: почти всегда именно это её и объясняет.
            </Text>
            <Text style={{ fontSize: 13.5, lineHeight: 20, color: palette.textMuted }}>
              Если человек мешает лично вам — быстрее заблокировать: это работает мгновенно и никого не ждёт. Жалоба уходит модератору и тому, на кого жалуются, не показывается.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <Text style={{ fontSize: 13.5, lineHeight: 20, color: palette.textMuted }}>
              Три пункта, а не свод. Правила, которые не дочитывают, не работают.
            </Text>
            {RULES.map((rule) => (
              <View key={rule.title} style={{ gap: 4 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.text }}>{rule.title}</Text>
                <Text style={{ fontSize: 13.5, lineHeight: 20, color: palette.textMuted }}>{rule.body}</Text>
              </View>
            ))}
          </View>
        )}
      </Sheet>

      {/* Дно и то, что в нём спрятано. Пролистав до конца, человек упирается в
          настоящее дно; упрётся трижды (bounce внизу) — приложение уступит и
          покажет кнопку «Гламура» (пасхалка из веба). */}
      <View style={{ height: 320 }} />
      {glamUnlocked || glamOn ? (
        <View style={{ alignItems: 'center', gap: 12, paddingBottom: 24 }}>
          <Text style={{ fontSize: 13, lineHeight: 19, textAlign: 'center', color: palette.textMuted }}>
            {glamOn ? 'Розовое включено. Выключить можно здесь же.' : 'Дно уступило. Держите.'}
          </Text>
          {glamUnlocked || glamOn ? (
            <Pressable
              onPress={() => setStylePreference(glamOn ? 'chronicle' : 'glam')}
              style={{ borderRadius: 999, paddingHorizontal: 20, paddingVertical: 11, backgroundColor: glamOn ? palette.surface2 : '#e0338c' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: glamOn ? palette.text : '#fff' }}>
                {glamOn ? 'Хватит' : 'Забрать'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Wrap>
  );
}

/* ── Кусочки ──────────────────────────────────────────────────────────── */

function Wrap({ palette, title, children, onBump }: { palette: Palette; title: string; children: React.ReactNode; onBump?: () => void }) {
  const topInset = useTopBarInset();
  const armed = useRef(true);
  const rearm = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Один непрерывный «упор» в дно (bounce ниже конца) = один вызов onBump.
  // Пауза 380 мс, чтобы десятки событий одного жеста не набрали счёт разом.
  function onScroll(e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) {
    if (!onBump) return;
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const overshoot = contentOffset.y + layoutMeasurement.height - contentSize.height;
    if (overshoot > 40 && armed.current) {
      armed.current = false;
      if (rearm.current) clearTimeout(rearm.current);
      rearm.current = setTimeout(() => { armed.current = true; }, 380);
      onBump();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      {/* Та же стеклянная шапка, что на ленте (колокол, :P, действие) —
          накладная, с блюром и вуалью-затемнением под ней. */}
      <TopBar back right="none" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 16, paddingBottom: 40, gap: 12 }}
        scrollIndicatorInsets={{ top: topInset }}
        onScroll={onBump ? onScroll : undefined}
        scrollEventThrottle={16}
      >
        {/* Имя раздела крупным заголовком с акцентной точкой — как ScreenTitle. */}
        <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text, paddingBottom: 6 }}>
          {title}<Text style={{ color: palette.accent }}>.</Text>
        </Text>
        {children}
      </ScrollView>
    </View>
  );
}

function Card({ palette, children }: { palette: Palette; children: React.ReactNode }) {
  return <View style={{ borderRadius: 20, backgroundColor: palette.surface, overflow: 'hidden' }}>{children}</View>;
}

function Line({
  palette,
  label,
  hint,
  onPress,
  first = false,
  mono = false,
  children,
}: {
  palette: Palette;
  label: string;
  hint?: string;
  onPress?: () => void;
  /** Первая строка группы — без верхнего разделителя. */
  first?: boolean;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ backgroundColor: pressed && onPress ? palette.surface2 : 'transparent' })}>
      {/* Разделитель — волосяной, с отступом слева 16 (ios-group в вебе). */}
      {!first ? <View style={{ height: 1, marginLeft: 16, backgroundColor: palette.border }} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 16, paddingVertical: 9 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, color: palette.text, letterSpacing: mono ? 2 : 0 }}>{label}</Text>
          {hint ? <Text style={{ fontSize: 12.5, color: palette.textMuted, marginTop: 1 }}>{hint}</Text> : null}
        </View>
        {children ?? (onPress ? <ChevronIcon size={16} color={palette.textMuted} /> : null)}
      </View>
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

function Sheet({ palette, open, onClose, title, children }: { palette: Palette; open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        <View style={{ marginTop: 'auto', maxHeight: '82%', backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 36 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border, marginBottom: 12 }} />
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: palette.text }}>{title}</Text>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
