import { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { usePalette } from '../theme';

/**
 * Заглушка карточки на время загрузки — геометрией как настоящая запись, чтобы
 * подмена не двигала раскладку (как feed-list со SkeletonPost в вебе). Мягко
 * пульсирует.
 */
export function SkeletonPost() {
  const palette = usePalette();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const Bar = ({ w, h = 12 }: { w: number | string; h?: number }) => (
    <Animated.View style={{ width: w as number, height: h, borderRadius: 6, backgroundColor: palette.surface2, opacity: pulse }} />
  );

  return (
    <View style={{ gap: 10, paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: palette.border }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Animated.View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: palette.surface2, opacity: pulse }} />
        <Bar w={120} />
      </View>
      <Bar w="70%" h={16} />
      <Bar w="95%" />
      <Bar w="85%" />
    </View>
  );
}
