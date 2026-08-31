import { useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width, height } = Dimensions.get('window');

/**
 * Изображение во весь экран, с листанием — как в вебе (ImageViewer).
 *
 * Открывается тапом по снимку в карточке. Листание страницами, счётчик и точки
 * — только когда кадров больше одного. Закрывается тапом по кадру или крестиком.
 *
 * Отличие от веба: там закрытие свайпом вниз с пружиной и возврат кадра на его
 * место в ленте — на RN без gesture-handler это не воспроизводится, поэтому
 * закрытие тапом/крестиком, а появление — обычным затуханием.
 */
export function ImageViewer({
  images,
  index,
  onClose,
}: {
  images: string[];
  /** Какой кадр открыт. −1 — закрыто. */
  index: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [shown, setShown] = useState(Math.max(0, index));

  const open = index >= 0 && index < images.length;
  if (!open) return null;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: index * width, y: 0 }}
          onMomentumScrollEnd={(e) => setShown(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {images.map((src, i) => (
            <Pressable key={`${src}-${i}`} onPress={onClose} style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
              <Image source={{ uri: src }} style={{ width, height }} resizeMode="contain" />
            </Pressable>
          ))}
        </ScrollView>

        {/* Крестик. */}
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={{ position: 'absolute', top: insets.top + 8, right: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
            <Path d="M6 6l12 12M18 6 6 18" />
          </Svg>
        </Pressable>

        {images.length > 1 ? (
          <>
            <View style={{ position: 'absolute', top: insets.top + 14, alignSelf: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: 'rgba(0,0,0,0.45)' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#fff' }}>{shown + 1}/{images.length}</Text>
            </View>
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 16, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              {images.map((src, i) => (
                <View
                  key={`dot-${src}-${i}`}
                  style={{ height: 6, width: i === shown ? 16 : 6, borderRadius: 999, backgroundColor: i === shown ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)' }}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}
