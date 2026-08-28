import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../lib/api';
import { VerifiedMark } from '../components/VerifiedMark';
import { formatRelativeDate } from '../lib/formatDate';
import { usePalette } from '../theme';

type Verified = { id: string; username: string; verified_at: string };

/**
 * Подтверждение личности — выдать галочку по нику и список подтверждённых, как
 * в вебе. Регистр и знак «@» не важны. Галочку можно снять кнопкой.
 */
export function VerificationScreen() {
  const palette = usePalette();
  const [username, setUsername] = useState('');
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
    <FlatList
      style={{ flex: 1, backgroundColor: palette.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      data={verified}
      keyExtractor={(v) => v.id}
      ListHeaderComponent={
        <View style={{ gap: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="@ник"
              placeholderTextColor={palette.textMuted}
              autoCapitalize="none"
              style={{ flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, fontSize: 15, color: palette.text, backgroundColor: palette.surface }}
            />
            <Pressable onPress={grant} disabled={busy || !username.trim()} style={{ borderRadius: 12, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: palette.accent, opacity: busy || !username.trim() ? 0.4 : 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accentContrast }}>{busy ? 'Секунду…' : 'Подтвердить'}</Text>
            </Pressable>
          </View>
          <Text style={{ fontSize: 13, lineHeight: 18, color: palette.textMuted }}>
            Регистр и знак «@» не важны. Галочка говорит только одно: человек — тот, за кого себя выдаёт.
          </Text>
          {error ? <Text style={{ color: palette.down }}>{error}</Text> : null}
          <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>
            Подтверждённые{verified.length > 0 ? ` · ${verified.length}` : ''}
          </Text>
        </View>
      }
      ListEmptyComponent={<Text style={{ color: palette.textMuted }}>Пока никого.</Text>}
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
  );
}
