import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { supabase } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;
type Mode = 'signin' | 'signup' | 'reset';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

/**
 * Вход — под тему «Хроника», как веб-экран авторизации.
 *
 * PARAFRAZ по приглашению: регистрация просит код, имя, почту и пароль, создаёт
 * учётку на сервере (POST /invites/register) и тут же входит обычным
 * signInWithPassword — отдельной ветки хранения сессии так не появляется, как и
 * в вебе (AuthScreen). Вход — пара почта/пароль. Забытый пароль — только почта:
 * Supabase шлёт письмо со ссылкой на веб /reset, где придумывают новый.
 */
export function LoginScreen({ navigation }: Props) {
  const palette = usePalette();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('signin');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const signup = mode === 'signup';
  const reset = mode === 'reset';

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setSent(false);
  }

  async function handleSubmit() {
    setError(null);
    if (signup && password.length < 8) {
      setError(t('Пароль минимум 8 символов'));
      return;
    }
    setLoading(true);
    try {
      if (reset) {
        // Ссылку присылает Supabase; redirectTo ведёт на веб-страницу /reset,
        // где придумывают новый пароль. Об успехе говорим одинаково, есть такая
        // почта или нет — это не наш ответ на «зарегистрирован ли человек».
        await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${WEB_URL}/reset` });
        setSent(true);
        setLoading(false);
        return;
      }
      if (signup) {
        // Сервер создаёт учётку и помечает код использованным; сессию не
        // открывает — входим тем же обычным способом сразу следом.
        await apiFetch('/invites/register', {
          method: 'POST',
          body: JSON.stringify({ code: code.trim().toUpperCase(), email: email.trim(), password, username: username.trim() }),
        });
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw new Error(signInError.message);
      navigation.navigate('MainTabs');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Не получилось, попробуйте ещё раз'));
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = reset
    ? Boolean(email.trim())
    : Boolean(email.trim()) && Boolean(password) && (!signup || (Boolean(code.trim()) && Boolean(username.trim())));

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
            {signup ? t('Новый аккаунт') : reset ? t('Забыли пароль') : t('С возвращением')}
          </Text>

          {sent ? (
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, lineHeight: 20, color: palette.text }}>
                {t('Ссылка для сброса отправлена на')} {email.trim()}.
              </Text>
              <Text style={{ fontSize: 12.5, lineHeight: 18, color: palette.textMuted }}>
                {t('Откройте её — и придумаете новый пароль. Нет письма — посмотрите в «Спаме».')}
              </Text>
            </View>
          ) : (
          <>
          {signup ? (
            <>
              <Text style={{ fontSize: 13, color: palette.textMuted }}>{t('Код приглашения')}</Text>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholderTextColor={palette.textMuted}
                style={{ ...field, letterSpacing: 3 }}
              />

              <Text style={{ fontSize: 13, color: palette.textMuted }}>{t('Имя')}</Text>
              <TextInput
                value={username}
                onChangeText={(v) => setUsername(v.replace(/[^a-zA-Z0-9._-]/g, ''))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={24}
                placeholderTextColor={palette.textMuted}
                style={field}
              />
              <Text style={{ fontSize: 12, color: palette.textMuted, marginTop: -4 }}>
                {t('3–24 латинских буквы, цифры, точка, дефис, подчёркивание')}
              </Text>
            </>
          ) : null}

          <Text style={{ fontSize: 13, color: palette.textMuted }}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholderTextColor={palette.textMuted}
            style={field}
          />

          {!reset ? (
            <>
              <Text style={{ fontSize: 13, color: palette.textMuted }}>{t('Пароль')}</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor={palette.textMuted}
                style={field}
              />
            </>
          ) : null}

          {error ? <Text style={{ color: palette.down, fontSize: 13 }}>{error}</Text> : null}

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !canSubmit}
            style={{
              marginTop: 4,
              borderRadius: 999,
              paddingVertical: 13,
              alignItems: 'center',
              backgroundColor: palette.accent,
              opacity: loading || !canSubmit ? 0.4 : 1,
            }}
          >
            <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 15 }}>
              {loading ? t('Секунду…') : signup ? t('Завести аккаунт') : reset ? t('Прислать ссылку') : t('Войти')}
            </Text>
          </Pressable>
          </>
          )}

          {/* Переходы между режимами — всегда видны, в т.ч. на экране «письмо ушло». */}
          {reset || sent ? (
            <Pressable onPress={() => switchTo('signin')} style={{ marginTop: 6, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: palette.textMuted }}>
                {t('Вспомнили? ')}<Text style={{ color: palette.accent, fontWeight: '600' }}>{t('Войти')}</Text>
              </Text>
            </Pressable>
          ) : signup ? (
            <Pressable onPress={() => switchTo('signin')} style={{ marginTop: 6, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, color: palette.textMuted }}>
                {t('Уже есть аккаунт? ')}<Text style={{ color: palette.accent, fontWeight: '600' }}>{t('Войти')}</Text>
              </Text>
            </Pressable>
          ) : (
            <View style={{ marginTop: 6, alignItems: 'center', gap: 4 }}>
              <Pressable onPress={() => switchTo('signup')}>
                <Text style={{ fontSize: 13, color: palette.textMuted }}>
                  {t('Нет аккаунта? ')}<Text style={{ color: palette.accent, fontWeight: '600' }}>{t('Завести')}</Text>
                </Text>
              </Pressable>
              <Pressable onPress={() => switchTo('reset')}>
                <Text style={{ fontSize: 13, color: palette.textMuted }}>{t('Забыли пароль?')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
