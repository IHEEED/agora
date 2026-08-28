import { Pressable, Text, View } from 'react-native';
import { useVote } from '../lib/useVote';
import { VoteArrow } from './icons';
import { usePalette } from '../theme';

/**
 * Блок голосования — общий для постов и комментариев, как в вебе.
 *
 * Цветом отвечает только сама стрелка: за отданный голос она заливается своим
 * цветом (вверх — зелёным, вниз — красным), соседняя остаётся контурной. Весь
 * блок плашкой не подсвечивается — иначе ряд кнопок перетягивал бы внимание с
 * текста записи. При голосе «против» счётчик прячем: минус рядом со стрелкой
 * вниз читался бы дважды.
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

  const upColor = vote.myVote === 1 ? palette.up : palette.control;
  const downColor = vote.myVote === -1 ? palette.down : palette.control;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Pressable
        onPress={() => vote.vote(1)}
        hitSlop={4}
        style={{ width: hit, height: hit, alignItems: 'center', justifyContent: 'center' }}
      >
        <VoteArrow direction="up" filled={vote.myVote === 1} size={arrow} color={upColor} />
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
        onPress={() => vote.vote(-1)}
        hitSlop={4}
        style={{ width: hit, height: hit, alignItems: 'center', justifyContent: 'center' }}
      >
        <VoteArrow direction="down" filled={vote.myVote === -1} size={arrow} color={downColor} />
      </Pressable>
    </View>
  );
}
