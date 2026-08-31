import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { usePalette } from '../theme';

/**
 * Кольцо истории, разрезанное на дуги по числу кадров — как в вебе (SegmentRing).
 *
 * Непросмотренная история — голубой градиент, и кольцо медленно вращается
 * («панельки крутятся»); просмотренная — тихая серая обводка без движения.
 * Голубой зашит намеренно: это знак «здесь новое», он не должен меняться с
 * темой и путаться с акцентом. Одна история — сплошное кольцо, разрыв на одной
 * дуге читался бы обрывом.
 */
const AnimatedSvg = Animated.createAnimatedComponent(Svg);

export function SegmentRing({
  size,
  segments,
  viewed = false,
}: {
  size: number;
  segments: number;
  viewed?: boolean;
}) {
  const palette = usePalette();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (viewed) return;
    const loop = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 26000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [viewed, spin]);

  const { radius, arc, spacing } = useMemo(() => {
    const stroke = size * 0.045;
    const r = (size - stroke) / 2 - 0.5;
    const circumference = 2 * Math.PI * r;
    const count = Math.min(Math.max(segments, 1), 7);
    const sp = count === 1 ? 0 : size * 0.08;
    return { radius: r, arc: circumference / count - sp, spacing: sp };
  }, [size, segments]);

  const stroke = size * 0.045;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <AnimatedSvg
      width={size}
      height={size}
      style={{ position: 'absolute', transform: [{ rotate: viewed ? '0deg' : rotate }] }}
    >
      <Defs>
        <LinearGradient id="storyRing" x1="0.1" y1="1" x2="0.9" y2="0">
          <Stop offset="0%" stopColor="#7fd8ff" />
          <Stop offset="40%" stopColor="#38b0f5" />
          <Stop offset="100%" stopColor="#2f7de0" />
        </LinearGradient>
      </Defs>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={viewed ? palette.border : 'url(#storyRing)'}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${arc} ${spacing}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </AnimatedSvg>
  );
}
