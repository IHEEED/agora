import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { apiFetch } from '../lib/api';
import { usePalette } from '../theme';

/**
 * Подписка на человека — знаком, а не надписью (перенос вебового FollowButton).
 *
 * Плюс и минус занимают одно место, поэтому кнопка не меняет ширину при
 * переключении. Состояние показываем сразу, не дожидаясь сети: действие
 * безобидное, а если запрос не прошёл — возвращаем как было. С withLabel рядом
 * со знаком стоит слово — там, где кнопка одна и должна читаться.
 */
export function FollowButton({
  userId,
  initiallyFollowing = false,
  withLabel = false,
}: {
  userId: string;
  initiallyFollowing?: boolean;
  withLabel?: boolean;
}) {
  const palette = usePalette();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;
    const next = !following;
    setFollowing(next);
    setBusy(true);
    try {
      await apiFetch(`/users/${userId}/follow`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      setFollowing(!next);
    } finally {
      setBusy(false);
    }
  }

  const bg = following ? palette.surface2 : palette.accent;
  const fg = following ? palette.textMuted : palette.accentContrast;

  return (
    <Pressable
      onPress={toggle}
      hitSlop={6}
      style={
        withLabel
          ? { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 11, backgroundColor: bg }
          : { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: bg }
      }
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={fg} strokeWidth={2.4} strokeLinecap="round">
        <Path d="M5 12h14" />
        {!following ? <Path d="M12 5v14" /> : null}
      </Svg>
      {withLabel ? (
        <Text style={{ fontSize: 14, fontWeight: '600', color: fg }}>
          {following ? 'Вы подписаны' : 'Подписаться'}
        </Text>
      ) : null}
    </Pressable>
  );
}
