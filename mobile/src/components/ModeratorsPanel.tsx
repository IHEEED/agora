import { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { apiFetch } from '../lib/api';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';

type Mod = { id: string; username: string; role: 'moderator' | 'admin' };

/**
 * Управление модераторами — выдать/забрать роль по нику (только админ, сервер
 * проверяет). Админов список показывает, но снять их отсюда нельзя.
 */
export function ModeratorsPanel({ meId }: { meId?: string }) {
  const palette = usePalette();
  const { t } = useT();
  const [mods, setMods] = useState<Mod[]>([]);
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<Mod[]>('/moderation/moderators').then(setMods).catch(() => {});
  }, []);
  useEffect(() => load(), [load]);

  async function grant() {
    const name = username.trim().replace(/^@/, '');
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      await apiFetch('/moderation/moderators', { method: 'POST', body: JSON.stringify({ username: name }) });
      setUsername('');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вышло выдать модерацию');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await apiFetch(`/moderation/moderators/${id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не вышло забрать модерацию');
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder={t('ник')}
          placeholderTextColor={palette.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          style={{ flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: palette.text }}
        />
        <Pressable
          onPress={grant}
          disabled={busy || !username.trim()}
          style={{ borderRadius: 999, paddingHorizontal: 18, justifyContent: 'center', backgroundColor: palette.accent, opacity: busy || !username.trim() ? 0.4 : 1 }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.accentContrast }}>{t('Выдать')}</Text>
        </Pressable>
      </View>

      {error ? <Text style={{ fontSize: 13, color: palette.down }}>{error}</Text> : null}

      {mods.map((m) => (
        <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}>
          <Text style={{ flex: 1, fontSize: 15, color: palette.text }}>{m.username}</Text>
          <View style={{ borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: palette.surface2 }}>
            <Text style={{ fontSize: 12, color: palette.textMuted }}>{m.role === 'admin' ? t('админ') : t('модератор')}</Text>
          </View>
          {m.role === 'moderator' && m.id !== meId ? (
            <Pressable onPress={() => revoke(m.id)} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: `${palette.down}24` }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.down }}>{t('Убрать')}</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </View>
  );
}
