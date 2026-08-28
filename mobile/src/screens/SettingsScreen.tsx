import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { ChevronIcon } from '../components/icons';
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
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const [isModerator, setIsModerator] = useState(false);

  useEffect(() => {
    apiFetch<{ isModerator: boolean }>('/users/me')
      .then((me) => setIsModerator(Boolean(me.isModerator)))
      .catch(() => {});
  }, []);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 22 }}>
      {/* Свой крупный заголовок с кружком-назад — как в вебе; нативная панель
          на этом экране спрятана. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: insets.top + 8, paddingBottom: 6 }}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={8}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: palette.surface, alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={palette.text} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="m15 6-6 6 6 6" />
          </Svg>
        </Pressable>
        <Text style={{ fontFamily: palette.displayFamily, fontSize: 32, color: palette.text }}>
          Настройки<Text style={{ color: palette.accent }}>.</Text>
        </Text>
      </View>

      {SETTINGS_GROUPS.map((group, groupIndex) => {
        const rows = group.filter((section) => !section.modOnly || isModerator);
        if (rows.length === 0) return null;
        return (
          <View key={groupIndex} style={{ borderRadius: 16, backgroundColor: palette.surface, overflow: 'hidden' }}>
            {rows.map((section, index) => (
              <Row
                key={section.id}
                palette={palette}
                section={section}
                last={index === rows.length - 1}
                onPress={() => navigation.navigate('SettingsSection', { section: section.id, title: section.label })}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}

function Row({
  palette,
  section,
  last,
  onPress,
}: {
  palette: ReturnType<typeof usePalette>;
  section: SettingsSection;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: palette.border,
        backgroundColor: pressed ? palette.surface2 : 'transparent',
      })}
    >
      <TintTile tint={section.tint} path={section.path} />
      <Text style={{ flex: 1, fontSize: 16, color: palette.text }}>{section.label}</Text>
      <ChevronIcon size={17} color={palette.textMuted} />
    </Pressable>
  );
}

/** Цветная плитка со значком — путь разбит по « M», как в вебе. */
function TintTile({ tint, path }: { tint: string; path: string }) {
  const pieces = path.split(' M').map((piece, index) => (index === 0 ? piece : `M${piece}`));
  return (
    <View style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {pieces.map((d, index) => (
          <Path key={index} d={d} />
        ))}
      </Svg>
    </View>
  );
}
