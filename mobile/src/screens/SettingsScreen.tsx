import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { ChevronIcon } from '../components/icons';
import { TopBar, useTopBarInset } from '../components/TopBar';
import { SETTINGS_GROUPS, SettingsSection } from '../lib/settingsSections';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Настройки — хаб, один в один с вебом.
 *
 * Разделы сгруппированы карточками, у каждого — своя цветная плитка со значком
 * (те же оттенки и контуры, что на сайте). Модерация видна только модераторам.
 * Тап уводит в раздел. Крупный заголовок «Настройки.» рисуем сами, поэтому
 * нативную панель на этом экране прячем (см. RootNavigator).
 */
export function SettingsScreen() {
  const palette = usePalette();
  const topInset = useTopBarInset();
  const navigation = useNavigation<Nav>();
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    apiFetch<{ isModerator: boolean }>('/users/me')
      .then((me) => setIsModerator(Boolean(me.isModerator)))
      .catch(() => {});
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <TopBar back right="none" />
      <ScrollView contentContainerStyle={{ paddingTop: topInset, paddingHorizontal: 16, paddingBottom: 40, gap: 20 }} scrollIndicatorInsets={{ top: topInset }}>
      <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, color: palette.text, paddingBottom: 6 }}>
        Настройки<Text style={{ color: palette.accent }}>.</Text>
      </Text>

      {SETTINGS_GROUPS.map((group, groupIndex) => {
        const rows = group.filter((section) => !section.modOnly || isModerator);
        if (rows.length === 0) return null;
        return (
          <View key={groupIndex} style={{ borderRadius: 20, backgroundColor: palette.surface, overflow: 'hidden' }}>
            {rows.map((section, index) => (
              <Row
                key={section.id}
                palette={palette}
                section={section}
                first={index === 0}
                onPress={() => navigation.navigate('SettingsSection', { section: section.id, title: section.label })}
              />
            ))}
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
}

function Row({
  palette,
  section,
  first,
  onPress,
}: {
  palette: ReturnType<typeof usePalette>;
  section: SettingsSection;
  first: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ backgroundColor: pressed ? palette.surface2 : 'transparent' })}
    >
      {/* Разделитель — волосяной, с отступом слева 16 (как ios-group в вебе:
          линия начинается от левого поля строки, а не от края карточки). */}
      {!first ? <View style={{ height: 1, marginLeft: 16, backgroundColor: palette.border }} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingHorizontal: 16, paddingVertical: 8.5 }}>
        <TintTile tint={section.tint} path={section.path} />
        <Text style={{ flex: 1, fontSize: 16, color: palette.text }}>{section.label}</Text>
        <ChevronIcon size={17} color={palette.textMuted} />
      </View>
    </Pressable>
  );
}

/** Цветная плитка со значком — путь разбит по « M», как в вебе (29×29, r8). */
function TintTile({ tint, path }: { tint: string; path: string }) {
  const pieces = path.split(' M').map((piece, index) => (index === 0 ? piece : `M${piece}`));
  return (
    <View style={{ width: 29, height: 29, borderRadius: 8, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {pieces.map((d, index) => (
          <Path key={index} d={d} />
        ))}
      </Svg>
    </View>
  );
}
