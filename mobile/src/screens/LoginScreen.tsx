import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

/**
 * Вход — под тему «Хроника», как веб-экран авторизации.
 *
 * Наверху фирменный знак :P, ниже карточка с полями и акцентные кнопки. Вход и
 * регистрация переключаются местами: одна кнопка ведущая (акцентом), вторая —
 * контурная. Приглашения-код мобильному пока не завозим — регистрация идёт
 * напрямую через Supabase.
 */
export function LoginScreen({ navigation }: Props) {
  const palette = usePalette();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const { error: authError } = signup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    navigation.navigate('MainTabs');
  }

  const field = {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.surface,
  } as const;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: palette.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 60, paddingHorizontal: 24, paddingBottom: 40, alignItems: 'center', gap: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ fontSize: 46, fontWeight: '800', color: palette.text }}>
          :<Text style={{ color: palette.accent }}>P</Text>
        </Text>

        <View style={{ width: '100%', maxWidth: 380, borderRadius: 20, padding: 22, backgroundColor: palette.surface2, gap: 12 }}>
          <Text style={{ textAlign: 'center', fontSize: 15, fontWeight: '600', color: palette.text, marginBottom: 6 }}>
            {signup ? t('Новый аккаунт') : t('С возвращением')}
          </Text>

          <Text style={{ fontSize: 13, color: palette.textMuted }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={palette.textMuted}
            style={field}
          />

          <Text style={{ fontSize: 13, color: palette.textMuted }}>{t('Пароль')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={palette.textMuted}
            style={field}
          />

          {error ? <Text style={{ color: palette.down, fontSize: 13 }}>{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !email.trim() || !password}
            style={{
              marginTop: 4,
              borderRadius: 999,
              paddingVertical: 13,
              alignItems: 'center',
              backgroundColor: palette.accent,
              opacity: loading || !email.trim() || !password ? 0.4 : 1,
            }}
          >
            <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 15 }}>
              {loading ? t('Секунду…') : signup ? t('Завести аккаунт') : t('Войти')}
            </Text>
          </Pressable>

          <Pressable onPress={() => setSignup((v) => !v)} style={{ marginTop: 6, alignItems: 'center' }}>
            <Text style={{ fontSize: 13, color: palette.textMuted }}>
              {signup ? t('Уже есть аккаунт? ') : t('Нет аккаунта? ')}
              <Text style={{ color: palette.accent, fontWeight: '600' }}>{signup ? t('Войти') : t('Завести')}</Text>
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
