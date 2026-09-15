import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';

type Step = 'phone' | 'code';

/**
 * supabase-js не всегда кладёт вменяемый текст в error.message (для 500-х от
 * GoTrue это бывает пустая строка) — достаём понятное сообщение.
 */
function normalizeAuthError(message?: string): string {
  const raw = message?.trim();
  if (raw?.toLowerCase().includes('sms provider')) {
    return 'В проекте не настроен SMS-провайдер (Authentication → Providers → Phone в Supabase) — без него коды не отправляются.';
  }
  return raw && raw !== '{}' ? raw : 'Не удалось выполнить запрос, попробуйте ещё раз';
}

/**
 * Подтверждение номера телефона — как в вебе (PhoneVerifyModal).
 *
 * Встроенный SMS OTP Supabase Auth: updateUser({ phone }) шлёт код,
 * verifyOtp({ type: 'phone_change' }) его проверяет. Требует включённого
 * SMS-провайдера в Supabase (Authentication → Providers → Phone) — своего
 * Twilio/Vonage с платным аккаунтом. Без него запрос кода вернёт ошибку.
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
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep('phone');
    setPhone('');
    setCode('');
    setError(null);
    setLoading(false);
  }

  function close() {
    reset();
    onClose();
  }

  async function sendCode() {
    if (loading || !phone.trim()) return;
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ phone: phone.trim() });
    setLoading(false);
    if (error) {
      setError(normalizeAuthError(error.message));
      return;
    }
    setStep('code');
  }

  async function confirmCode() {
    if (loading || !code.trim()) return;
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: code.trim(), type: 'phone_change' });
    setLoading(false);
    if (error) {
      setError(normalizeAuthError(error.message));
      return;
    }
    reset();
    onVerified();
  }

  const field = {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: palette.text,
    backgroundColor: palette.bg,
  } as const;

  const button = (label: string, onPress: () => void, primary = true) => (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: 999,
        paddingVertical: 12,
        backgroundColor: primary ? palette.accent : 'transparent',
        borderWidth: primary ? 0 : 1,
        borderColor: palette.border,
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading && primary ? <ActivityIndicator color={palette.accentContrast} /> : null}
      <Text style={{ fontSize: 14, fontWeight: '600', color: primary ? palette.accentContrast : palette.text }}>{label}</Text>
    </Pressable>
  );

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ borderRadius: 20, backgroundColor: palette.surface, padding: 22, gap: 14 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.text }}>{t('Подтвердите телефон')}</Text>
            <Text style={{ fontSize: 13.5, lineHeight: 19, color: palette.textMuted }}>
              {t('Публикация постов и комментариев — только после подтверждения номера. Это защита от спама и накрутки.')}
            </Text>

            {step === 'phone' ? (
              <>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoFocus
                  placeholder="+7 900 000-00-00"
                  placeholderTextColor={palette.textMuted}
                  style={field}
                />
                {error ? <Text style={{ fontSize: 13, color: palette.down }}>{error}</Text> : null}
                {button(loading ? t('Отправляем код…') : t('Получить код'), sendCode)}
              </>
            ) : (
              <>
                <Text style={{ fontSize: 13, color: palette.textMuted }}>{t('Код отправлен на')} {phone}</Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  autoFocus
                  placeholder="123456"
                  placeholderTextColor={palette.textMuted}
                  style={{ ...field, letterSpacing: 4 }}
                />
                {error ? <Text style={{ fontSize: 13, color: palette.down }}>{error}</Text> : null}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {button(t('Назад'), () => setStep('phone'), false)}
                  {button(loading ? t('Проверяем…') : t('Подтвердить'), confirmCode)}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
