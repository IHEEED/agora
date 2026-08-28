import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Modal, Pressable, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';
import { StoryGroup } from '../lib/types';
import { Avatar } from './Avatar';
import { VerifiedMark } from './VerifiedMark';
import { formatCompactAge } from '../lib/formatDate';
import { usePalette } from '../theme';

/**
 * Полноэкранный просмотрщик историй — как в вебе.
 *
 * Сверху полоски по числу кадров, текущая наливается за пять секунд, потом кадр
 * сам сменяется. Тап справа — вперёд, слева — назад; дойдя до конца автора,
 * переходим к следующему, а после последнего закрываемся. Каждый показанный
 * кадр отмечаем просмотренным на сервере.
 */

const ITEM_MS = 5000;
const { width, height } = Dimensions.get('window');

export function StoryViewer({
  groups,
  startIndex,
  onClose,
}: {
  groups: StoryGroup[];
  startIndex: number;
  onClose: () => void;
}) {
  const palette = usePalette();
  const [groupIndex, setGroupIndex] = useState(startIndex);
  const [itemIndex, setItemIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const group = groups[groupIndex];
  const item = group?.items[itemIndex];

  // Отметить кадр просмотренным на сервере.
  useEffect(() => {
    if (item && !item.seen) apiFetch(`/stories/${item.id}/seen`, { method: 'POST' }).catch(() => {});
  }, [item]);

  // Наливаем полоску и по завершении идём вперёд.
  useEffect(() => {
    if (!item) return;
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: ITEM_MS, useNativeDriver: false });
    anim.start(({ finished }) => {
      if (finished) next();
    });
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupIndex, itemIndex]);

  function next() {
    if (!group) return onClose();
    if (itemIndex + 1 < group.items.length) {
      setItemIndex(itemIndex + 1);
    } else if (groupIndex + 1 < groups.length) {
      setGroupIndex(groupIndex + 1);
      setItemIndex(0);
    } else {
      onClose();
    }
  }

  function prev() {
    if (itemIndex > 0) {
      setItemIndex(itemIndex - 1);
    } else if (groupIndex > 0) {
      const gi = groupIndex - 1;
      setGroupIndex(gi);
      setItemIndex(Math.max(0, groups[gi].items.length - 1));
    } else {
      progress.setValue(0);
      setItemIndex(0);
    }
  }

  if (!group || !item) return null;

  const image = item.images[0];

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {image ? (
          <Image source={{ uri: image }} style={{ position: 'absolute', width, height }} resizeMode="contain" />
        ) : (
          <View style={{ position: 'absolute', width, height, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: palette.surface2 }}>
            <Text style={{ fontFamily: palette.displayFamily, fontSize: 24, lineHeight: 32, color: palette.text, textAlign: 'center' }}>
              {item.title || item.body}
            </Text>
          </View>
        )}

        {/* Полоски прогресса. */}
        <View style={{ position: 'absolute', top: 52, left: 10, right: 10, flexDirection: 'row', gap: 4 }}>
          {group.items.map((it, i) => (
            <View key={it.id} style={{ flex: 1, height: 3, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <Animated.View
                style={{
                  height: 3,
                  borderRadius: 3,
                  backgroundColor: '#fff',
                  width: i < itemIndex ? '100%' : i > itemIndex ? '0%' : progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }}
              />
            </View>
          ))}
        </View>

        {/* Автор и закрытие. */}
        <View style={{ position: 'absolute', top: 66, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={group.author.username} uri={group.author.avatar_url} size={34} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>{group.author.username}</Text>
          <VerifiedMark verified={group.author.verified_at} size={14} />
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{formatCompactAge(item.created_at)}</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ fontSize: 26, color: '#fff' }}>✕</Text>
          </Pressable>
        </View>

        {/* Подпись под картинкой. */}
        {image && (item.title || item.body) ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 60, paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 16, lineHeight: 22, color: '#fff', textAlign: 'center' }}>{item.title || item.body}</Text>
          </View>
        ) : null}

        {/* Зоны тапа: слева назад, справа вперёд. */}
        <Pressable onPress={prev} style={{ position: 'absolute', left: 0, top: 90, bottom: 0, width: width * 0.35 }} />
        <Pressable onPress={next} style={{ position: 'absolute', right: 0, top: 90, bottom: 0, width: width * 0.65 }} />
      </View>
    </Modal>
  );
}
