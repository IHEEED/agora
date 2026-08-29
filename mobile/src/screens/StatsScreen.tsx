import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiFetch } from '../lib/api';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { usePalette } from '../theme';

type Stats = {
  users: number | null;
  online: number | null;
  phoneVerified: number | null;
  newToday: number | null;
  posts: number | null;
  comments: number | null;
};
type Palette = ReturnType<typeof usePalette>;

/**
 * Статистика сети — люди и написанное, как в вебе. Прочерк вместо числа значит,
 * что посчитать не вышло (обычно из-за невыполненной миграции), а не ноль.
 */
export function StatsScreen() {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const topInset = useTopBarInset();
  const [data, setData] = useState<Stats | null>(null);

  useEffect(() => {
    apiFetch<Stats>('/moderation/stats').then(setData).catch(() => {});
  }, []);

  const perUser = data?.users && data.posts !== null && data.users > 0 ? (data.posts / data.users).toFixed(1).replace('.', ',') : null;
  const perPost = data?.posts && data.posts > 0 && data.comments !== null ? (data.comments / data.posts).toFixed(1).replace('.', ',') : null;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar back right="none" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 16, paddingBottom: insets.bottom + 40, gap: 20 }}
        scrollIndicatorInsets={{ top: topInset }}
      >
        <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text }}>
          Статистика<Text style={{ color: palette.accent }}>.</Text>
        </Text>

        {!data ? <Text style={{ color: palette.textMuted }}>Загрузка…</Text> : null}

        {data ? (
          <>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Люди</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat palette={palette} value={data.online} label="В сети" hint="за последние пять минут" />
          <Stat palette={palette} value={data.users} label="Зарегистрировано" />
          <Stat palette={palette} value={data.phoneVerified} label="Подтвердили телефон" />
          <Stat palette={palette} value={data.newToday} label="Пришли за сутки" />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: palette.text }}>Написано</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat palette={palette} value={data.posts} label="Записей" />
          <Stat palette={palette} value={data.comments} label="Комментариев" />
        </View>
      </View>

      {perUser ? (
        <Text style={{ fontSize: 13, lineHeight: 19, color: palette.textMuted }}>
          Записей на человека: <Text style={{ color: palette.text }}>{perUser}</Text>
          {perPost ? <>. Комментариев на запись: <Text style={{ color: palette.text }}>{perPost}</Text></> : null}.
        </Text>
      ) : null}

      <Text style={{ fontSize: 12, lineHeight: 17, color: palette.textMuted }}>
        Прочерк вместо числа означает, что посчитать не вышло — обычно из-за невыполненной миграции. Ноль на его месте был бы неправдой.
      </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ palette, value, label, hint }: { palette: Palette; value: number | null; label: string; hint?: string }) {
  return (
    <View style={{ width: '47%', borderRadius: 16, backgroundColor: palette.surface2, padding: 14, gap: 2 }}>
      <Text style={{ fontSize: 26, fontWeight: '700', color: palette.text }}>{value === null ? '—' : value.toLocaleString('ru-RU')}</Text>
      <Text style={{ fontSize: 13, color: palette.text }}>{label}</Text>
      {hint ? <Text style={{ fontSize: 11.5, color: palette.textMuted }}>{hint}</Text> : null}
    </View>
  );
}
