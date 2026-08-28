import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { apiFetch } from '../lib/api';
import { Avatar } from './Avatar';
import { usePalette } from '../theme';

/**
 * Аватарка со значком подписки в углу — приём из Threads, как в вебе.
 *
 * Плюс — пометка на лице, а не вторая кнопка рядом: видно лицо, имя и маленький
 * значок на лице. Пока не подписан — акцентный кружок с плюсом; подписался —
 * галка. Кольцо цвета фона отделяет значок от аватарки. Размер значка считается
 * от аватарки (четверть), чтобы на 46 и на 60 он выглядел одинаково.
 */
export function AvatarFollow({
  userId,
  username,
  avatar,
  initiallyFollowing = false,
  size = 60,
}: {
  userId: string;
  username: string;
  avatar?: string | null;
  initiallyFollowing?: boolean;
  size?: number;
}) {
  const palette = usePalette();
  const [following, setFollowing] = useState(initiallyFollowing);
  const badge = Math.max(16, Math.round(size * 0.26));
  const glyph = Math.round(badge * 0.62);

  async function toggle() {
    const next = !following;
    setFollowing(next);
    try {
      await apiFetch(`/users/${userId}/follow`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      setFollowing(!next);
    }
  }

  return (
    <View style={{ width: size, height: size }}>
      <Avatar name={username} uri={avatar} size={size} />
      {/* Значок только чтобы подписаться: плюс есть, пока не подписан, и
          исчезает после подписки. Отписываются со страницы человека, а не с
          его лица в ленте — минуса на аватарке нет. */}
      {following ? null : (
        <Pressable
          onPress={toggle}
          hitSlop={12}
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: badge,
            height: badge,
            borderRadius: badge / 2,
            backgroundColor: palette.accent,
            borderWidth: 1.5,
            borderColor: palette.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M5 12h14" />
            <Path d="M12 5v14" />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}
