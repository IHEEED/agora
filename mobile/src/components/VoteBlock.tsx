import { useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { useVote } from '../lib/useVote';
import { VoteArrow } from './icons';
import { usePalette } from '../theme';

/**
 * Блок голосования — общий для постов и комментариев, как в вебе.
 *
 * Цветом отвечает только сама стрелка: за отданный голос она заливается своим
 * цветом (вверх — зелёным, вниз — красным), соседняя остаётся контурной. При
 * постановке голоса стрелка коротко подпрыгивает пружиной — тот же отклик в
 * палец, что даёт салют на вебе (искры в RN без нативного слоя рисовать дорого,
 * а пружина читается так же ясно). Откат голоса идёт без прыжка. При голосе
 * «против» счётчик прячем: минус рядом со стрелкой вниз читался бы дважды.
 */
export function VoteBlock({
  id,
  score,
  myVote,
  kind = 'post',
  compact = false,
}: {
  id: string;
  score: number;
  myVote: 1 | -1 | null;
  kind?: 'post' | 'comment';
  compact?: boolean;
}) {
  const palette = usePalette();
  const vote = useVote(id, score, myVote, kind);
  const arrow = compact ? 22 : 24;
  const hit = compact ? 36 : 44;

  const upScale = useRef(new Animated.Value(1)).current;
  const downScale = useRef(new Animated.Value(1)).current;

  const upColor = vote.myVote === 1 ? palette.up : palette.control;
  const downColor = vote.myVote === -1 ? palette.down : palette.control;

  /** Короткий прыжок стрелки — только при постановке голоса, не при откате. */
  function pop(value: Animated.Value) {
    value.setValue(0.7);
    Animated.spring(value, { toValue: 1, useNativeDriver: true, friction: 4, tension: 140 }).start();
  }

  function handleVote(value: 1 | -1) {
    if (vote.myVote !== value) pop(value === 1 ? upScale : downScale);
    vote.vote(value);
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={() => handleVote(1)}
        hitSlop={4}
        style={{ width: hit, height: hit, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale: upScale }] }}>
          <VoteArrow direction="up" filled={vote.myVote === 1} size={arrow} color={upColor} />
        </Animated.View>
      </Pressable>

      {vote.myVote !== -1 ? (
        <Text
          style={{
            minWidth: compact ? 20 : 22,
            textAlign: 'center',
            fontSize: compact ? 14 : 15,
            fontWeight: '600',
            color: vote.myVote === 1 ? palette.up : palette.control,
          }}
        >
          {vote.score}
        </Text>
      ) : null}

      <Pressable
        onPress={() => handleVote(-1)}
        hitSlop={4}
        style={{ width: hit, height: hit, alignItems: 'center', justifyContent: 'center' }}
      >
        <Animated.View style={{ transform: [{ scale: downScale }] }}>
          <VoteArrow direction="down" filled={vote.myVote === -1} size={arrow} color={downColor} />
        </Animated.View>
      </Pressable>
    </View>
  );
}
