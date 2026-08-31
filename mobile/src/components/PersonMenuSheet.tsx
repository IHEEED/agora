import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { apiFetch } from '../lib/api';
import { setBlocked, useIsBlocked } from '../lib/blockedUsers';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

const REASONS: { key: string; label: string }[] = [
  { key: 'spam', label: 'Спам' },
  { key: 'abuse', label: 'Оскорбления' },
  { key: 'impersonation', label: 'Выдаёт себя за другого' },
  { key: 'threats', label: 'Угрозы' },
  { key: 'other', label: 'Другое' },
];

type Step = 'menu' | 'report' | 'done' | 'clear';

/**
 * Меню человека — то, что под тремя точками в чужом профиле и в переписке, как
 * в вебе (PersonMenuSheet). Один компонент на оба места: скопировать ссылку,
 * заблокировать/разблокировать, пожаловаться и — только в переписке — очистить
 * её. Жалоба раскрывает список причин и заканчивается благодарностью.
 */
export function PersonMenuSheet({
  open,
  onClose,
  userId,
  username,
  onClearChat,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  /** Есть только в переписке. Без него пункт очистки не показывается. */
  onClearChat?: () => Promise<void> | void;
}) {
  const palette = usePalette();
  const { t } = useT();
  const blocked = useIsBlocked(userId);
  const [step, setStep] = useState<Step>('menu');
  const [copied, setCopied] = useState(false);

  function close() {
    onClose();
    // Сброс шага после закрытия — со следующим открытием меню начинается заново.
    setTimeout(() => { setStep('menu'); setCopied(false); }, 200);
  }

  async function copyLink() {
    await Clipboard.setStringAsync(`${WEB_URL}/u/${userId}`);
    setCopied(true);
  }

  async function report(reason: string) {
    setStep('done');
    try {
      await apiFetch('/reports', { method: 'POST', body: JSON.stringify({ userId, reason }) });
    } catch {
      // всё равно благодарим — жалоба уходит в очередь на сервере
    }
  }

  const title =
    step === 'menu' ? username : t(step === 'report' ? 'Что не так?' : step === 'clear' ? 'Очистить переписку?' : 'Жалоба принята');

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1 }}>
        <Pressable onPress={close} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        <View style={{ marginTop: 'auto', backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 34 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border, marginBottom: 6 }} />
          <Text style={{ paddingHorizontal: 20, paddingVertical: 8, fontSize: 16, fontWeight: '700', color: palette.text }} numberOfLines={1}>
            {title}
          </Text>

          {step === 'menu' ? (
            <>
              <Item palette={palette} label={copied ? 'Ссылка скопирована' : 'Скопировать ссылку'} onPress={copyLink}>
                <Rect x="9" y="9" width="11" height="11" rx="2.5" />
                <Path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
              </Item>

              <Item
                palette={palette}
                label={blocked ? 'Разблокировать' : 'Заблокировать'}
                hint={blocked ? 'Записи снова появятся в ленте' : 'Он не сможет вам писать, подписки снимутся'}
                danger={!blocked}
                onPress={() => { void setBlocked(userId, !blocked).catch(() => {}); close(); }}
              >
                {blocked ? (
                  <>
                    <Circle cx="12" cy="12" r="8.5" />
                    <Path d="m8.5 12 2.5 2.5 4.5-5" />
                  </>
                ) : (
                  <>
                    <Circle cx="12" cy="12" r="8.5" />
                    <Path d="m6 6 12 12" />
                  </>
                )}
              </Item>

              <Item palette={palette} label="Пожаловаться" danger onPress={() => setStep('report')}>
                <Path d="M5 21V4.5h9l-.8 3.2H19l-1 4.6H6" />
                <Path d="M5 4.5h.01" />
              </Item>

              {onClearChat ? (
                <Item palette={palette} label="Очистить переписку" hint="Удалятся только ваши сообщения" danger onPress={() => setStep('clear')}>
                  <Path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2h9.4L17.5 7" />
                  <Path d="M10.5 11v5M13.5 11v5" />
                </Item>
              ) : null}
            </>
          ) : null}

          {step === 'report' ? (
            REASONS.map((r) => (
              <Pressable key={r.key} onPress={() => report(r.key)} style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 15, backgroundColor: pressed ? palette.surface2 : 'transparent' })}>
                <Text style={{ fontSize: 16, color: palette.text }}>{t(r.label)}</Text>
              </Pressable>
            ))
          ) : null}

          {step === 'done' ? (
            <View style={{ alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 24 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${palette.accent}22`, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="m5 12.5 4.5 4.5L19 7.5" />
                </Svg>
              </View>
              <Text style={{ textAlign: 'center', fontSize: 14.5, lineHeight: 21, color: palette.textMuted }}>
                {t('Спасибо, мы посмотрим. Жалоба ушла модераторам.')}
              </Text>
              <Pressable onPress={close} style={{ borderRadius: 999, paddingHorizontal: 22, paddingVertical: 11, backgroundColor: palette.accent }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accentContrast }}>{t('Понятно')}</Text>
              </Pressable>
            </View>
          ) : null}

          {step === 'clear' ? (
            <View style={{ gap: 16, paddingHorizontal: 20, paddingVertical: 14 }}>
              <Text style={{ fontSize: 14.5, lineHeight: 21, color: palette.textMuted }}>
                {t('Ваши сообщения в этой переписке будут удалены без возможности вернуть. Реплики собеседника останутся: они принадлежат ему.')}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable onPress={() => setStep('menu')} style={{ flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: palette.surface2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{t('Отмена')}</Text>
                </Pressable>
                <Pressable onPress={async () => { await onClearChat?.(); close(); }} style={{ flex: 1, borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: `${palette.down}29` }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: palette.down }}>{t('Удалить')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Item({ palette, label, hint, onPress, danger = false, children }: { palette: ReturnType<typeof usePalette>; label: string; hint?: string; onPress: () => void; danger?: boolean; children: React.ReactNode }) {
  const { t } = useT();
  const color = danger ? palette.down : palette.text;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 13, backgroundColor: pressed ? palette.surface2 : 'transparent' })}>
      <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </Svg>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, color }}>{t(label)}</Text>
        {hint ? <Text style={{ fontSize: 12.5, color: palette.textMuted, marginTop: 1 }}>{t(hint)}</Text> : null}
      </View>
    </Pressable>
  );
}
