import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { apiFetch } from '../lib/api';
import { StoryGroup } from '../lib/types';
import { Avatar } from './Avatar';
import { StoryViewer } from './StoryViewer';
import { StoryEditor } from './StoryEditor';
import { SegmentRing } from './SegmentRing';
import { usePalette } from '../theme';

/**
 * Полоса историй наверху ленты, как в вебе.
 *
 * Первый кружок — своя история: пунктирное кольцо с плюсом. Нажатие сразу
 * открывает выбор фото (как NewStorySheet в вебе, без промежуточной шторки), с
 * нативным кадрированием (allowsEditing — роль вебового MediaEditor), а
 * выбранный кадр уходит в редактор истории во весь экран. Дальше — люди со
 * свежими историями: кольцо у непросмотренной акцентом, у просмотренной
 * приглушённое; тап открывает полноэкранный просмотрщик.
 */
export function StoriesBar() {
  const palette = usePalette();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewing, setViewing] = useState<number | null>(null);
  const [editing, setEditing] = useState<{ uri: string; base64: string; mime: string } | null>(null);

  const load = useCallback(() => {
    apiFetch<StoryGroup[] | { stories: StoryGroup[] }>('/stories')
      .then((data) => setGroups(Array.isArray(data) ? data : data.stories ?? []))
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => load(), [load]));

  async function pickForStory() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
      // Нативный кроп вместо вебового MediaEditor: история — вертикальный кадр.
      allowsEditing: true,
    });
    const asset = res.canceled ? null : res.assets[0];
    if (asset?.base64) {
      setEditing({ uri: asset.uri, base64: asset.base64, mime: asset.mimeType ?? 'image/jpeg' });
    }
  }

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
        {/* Своя история — пунктирное кольцо с плюсом-значком в углу. */}
        <Pressable onPress={pickForStory} style={{ alignItems: 'center', gap: 4, width: 72 }}>
          <View style={{ width: 68, height: 68 }}>
            <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: palette.border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
              <Avatar name="+" size={56} />
            </View>
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: palette.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.bg }}>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={3.2} strokeLinecap="round">
                <Path d="M12 5v14M5 12h14" />
              </Svg>
            </View>
          </View>
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: palette.textMuted }}>Ваша история</Text>
        </Pressable>

        {groups.map((group, index) => (
          <Pressable key={group.author.id} onPress={() => setViewing(index)} style={{ alignItems: 'center', gap: 4, width: 72 }}>
            <View style={{ width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }}>
              <SegmentRing size={68} segments={group.items.length} viewed={group.unseen === 0} />
              <Avatar name={group.author.username} uri={group.author.avatar_url} size={56} />
            </View>
            <Text numberOfLines={1} style={{ fontSize: 11.5, color: palette.text }}>{group.author.username}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {viewing !== null ? (
        <StoryViewer
          groups={groups}
          startIndex={viewing}
          onClose={() => {
            setViewing(null);
            load();
          }}
        />
      ) : null}

      <StoryEditor image={editing} onCancel={() => setEditing(null)} onPublished={load} />
    </>
  );
}
