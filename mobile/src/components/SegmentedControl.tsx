import { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { usePalette } from '../theme';

/**
 * Переключатель с едущей каплей — один в один с вебом (SegmentedControl).
 *
 * Капля — отдельный слой под подписями, а не фон активной кнопки: она едет
 * (translateX + width) под выбранный вариант той же пружиной, что на сайте.
 * Дорожка — утопленная поверхность, без обводки. Ширины вариантов меряем по
 * факту (onLayout), заранее их не посчитать.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: ReadonlyArray<readonly [T, string]>;
  onChange: (next: T) => void;
}) {
  const palette = usePalette();
  const [layouts, setLayouts] = useState<Record<number, { x: number; width: number }>>({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;

  const activeIndex = Math.max(0, options.findIndex(([option]) => option === value));
  const active = layouts[activeIndex];

  useEffect(() => {
    if (!active) return;
    Animated.spring(x, { toValue: active.x, useNativeDriver: false, friction: 12, tension: 90 }).start();
    Animated.spring(w, { toValue: active.width, useNativeDriver: false, friction: 12, tension: 90 }).start();
  }, [active, x, w]);

  function onItemLayout(index: number, e: LayoutChangeEvent) {
    const { x: lx, width } = e.nativeEvent.layout;
    setLayouts((prev) => (prev[index]?.x === lx && prev[index]?.width === width ? prev : { ...prev, [index]: { x: lx, width } }));
  }

  return (
    <View style={{ flexDirection: 'row', backgroundColor: palette.surface2, borderRadius: 999, padding: 4 }}>
      {active ? (
        <Animated.View
          style={{ position: 'absolute', top: 4, bottom: 4, left: x, width: w, borderRadius: 999, backgroundColor: palette.accent }}
        />
      ) : null}
      {options.map(([option, label], index) => {
        const on = option === value;
        return (
          <Pressable key={option} onPress={() => onChange(option)} onLayout={(e) => onItemLayout(index, e)} style={{ flex: 1, paddingVertical: 7, alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '600', color: on ? palette.accentContrast : palette.textMuted }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
