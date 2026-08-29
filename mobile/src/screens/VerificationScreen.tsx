import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../lib/api';
import { VerifiedMark } from '../components/VerifiedMark';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { formatRelativeDate } from '../lib/formatDate';
import { usePalette } from '../theme';

type Verified = { id: string; username: string; verified_at: string };

/**
 * Подтверждение личности — выдать галочку по нику и список подтверждённых, как
 * в вебе. Регистр и знак «@» не важны. Галочку можно снять кнопкой.
 */
export function VerificationScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
  const [username, setUsername] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState<Verified[]>([]);

  const load = useCallback(() => {
    apiFetch<Verified[]>('/moderation/verified').then(setVerified).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => load(), [load]));

  async function grant() {
    if (!username.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/moderation/verify', { method: 'POST', body: JSON.stringify({ username: username.trim(), verified: true }) });
      setUsername('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось подтвердить');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setVerified((prev) => prev.filter((v) => v.id !== id));
    try {
      await apiFetch('/moderation/verify', { method: 'POST', body: JSON.stringify({ userId: id, verified: false }) });
    } catch {
      load();
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar back right="none" />
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
        scrollIndicatorInsets={{ top: topInset }}
        keyboardShouldPersistTaps="handled"
        data={verified}
        keyExtractor={(v) => v.id}
        ListHeaderComponent={
          <View style={{ gap: 20, marginBottom: 8 }}>
            <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text }}>
              Подтверждение личности<Text style={{ color: palette.accent }}>.</Text>
            </Text>

            {/* Выдать по нику — поле-подчёркивание с «@» слева, как в вебе. */}
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: focused ? palette.accent : palette.border }}>
                  <Text style={{ fontSize: 15, color: palette.textMuted, paddingRight: 2 }}>@</Text>
                  <TextInput
                    value={username}
                    onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9._@-]/g, ''))}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="ник"
                    placeholderTextColor={palette.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{ flex: 1, paddingVertical: 9, fontSize: 15, color: palette.text }}
                  />
                </View>
                <Pressable onPress={grant} disabled={busy || !username.trim()} style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.accent, opacity: busy || !username.trim() ? 0.4 : 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accentContrast }}>{busy ? 'Секунду…' : 'Подтвердить'}</Text>
                </Pressable>
              </View>
              <Text style={{ fontSize: 12.5, lineHeight: 18, color: palette.textMuted }}>
                Регистр и знак «@» не важны. Галочка говорит только одно: человек — тот, за кого себя выдаёт.
              </Text>
              {error ? <Text style={{ color: palette.down, fontSize: 13 }}>{error}</Text> : null}
            </View>

            {/* Заявки — заглушка, как в вебе: подавать их пока негде. */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Заявки</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: palette.surface2 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${palette.accent}22`, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M5 4.5h11l3 3V19.5H5z" /><Path d="M9 11h6M9 14.5h4" />
                  </Svg>
                </View>
                <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: palette.textMuted }}>
                  Подавать заявки пока негде — экран подачи ещё не сделан. Здесь они появятся очередью, как жалобы.
                </Text>
              </View>
            </View>

            <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>
              Подтверждённые{verified.length > 0 ? ` · ${verified.length}` : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={{ fontSize: 13.5, color: palette.textMuted }}>
            Пока никого. Введите ник выше — человек появится в этом списке.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: palette.border }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{item.username}</Text>
            <VerifiedMark verified={item.verified_at} size={16} />
            <View style={{ flex: 1 }} />
            <Text style={{ fontSize: 12.5, color: palette.textMuted }}>{formatRelativeDate(item.verified_at)}</Text>
            <Pressable onPress={() => revoke(item.id)} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: `${palette.down}22` }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.down }}>Снять</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
