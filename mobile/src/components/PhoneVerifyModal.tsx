import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';

/**
 * Подтверждение телефона через Telegram-бота (вместо SMS).
 *
 * Открываем бота по одноразовой ссылке (Linking → приложение Telegram), человек
 * жмёт «Поделиться номером» — Telegram отдаёт боту номер, привязанный к его
 * аккаунту. Опрашиваем /telegram/status и, как только бэкенд пометил телефон
 * подтверждённым, обновляем сессию (refreshSession), чтобы гейт снялся.
 */
export function PhoneVerifyModal({
  open,
  onClose,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const palette = usePalette();
  const { t } = useT();
  const [waiting, setWaiting] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPoll() {
    if (poll.current) {
      clearInterval(poll.current);
      poll.current = null;
    }
  }

  useEffect(() => {
    if (!open) {
      stopPoll();
      setWaiting(false);
      setUrl(null);
      setError(null);
    }
  }, [open]);
  useEffect(() => () => stopPoll(), []);

  async function begin() {
    setError(null);
    try {
      const res = await apiFetch<{ token: string; url: string }>('/telegram/start', { method: 'POST' });
      setUrl(res.url);
      setWaiting(true);
      Linking.openURL(res.url).catch(() => {});
      stopPoll();
      poll.current = setInterval(async () => {
        try {
          const { status } = await apiFetch<{ status: string }>(`/telegram/status?token=${res.token}`);
          if (status === 'done') {
            stopPoll();
            await supabase.auth.refreshSession();
            onVerified();
          } else if (status === 'expired' || status === 'error') {
            stopPoll();
            setWaiting(false);
            setError(t('Подтверждение не завершилось. Попробуйте ещё раз.'));
          }
        } catch {
          // Разрыв сети — ждём следующего тика.
        }
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Не удалось начать подтверждение'));
    }
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ borderRadius: 20, backgroundColor: palette.surface, padding: 22, gap: 16 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>{t('Подтвердите телефон')}</Text>
          <Text style={{ fontSize: 13.5, lineHeight: 19, color: palette.textMuted }}>
            {t('Публикация постов и комментариев — после подтверждения номера. Это защита от спама. Подтвердить можно через Telegram, без SMS.')}
          </Text>

          {waiting ? (
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 4 }}>
              <ActivityIndicator color={palette.accent} />
              <Text style={{ fontSize: 13, lineHeight: 18, textAlign: 'center', color: palette.textMuted }}>
                {t('Откройте бота и нажмите «Поделиться номером». Как подтвердите — экран закроется сам.')}
              </Text>
              {url ? (
                <Pressable onPress={() => url && Linking.openURL(url).catch(() => {})} style={{ borderRadius: 999, borderWidth: 1, borderColor: palette.border, paddingHorizontal: 18, paddingVertical: 9 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{t('Открыть Telegram ещё раз')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable
              onPress={begin}
              style={{ borderRadius: 999, paddingVertical: 13, alignItems: 'center', backgroundColor: palette.accent }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.accentContrast }}>{t('Подтвердить через Telegram')}</Text>
            </Pressable>
          )}

          {error ? <Text style={{ fontSize: 13, color: palette.down }}>{error}</Text> : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
