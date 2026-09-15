import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';
import { PollOption } from '../lib/types';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';

/**
 * Опрос под записью — один в один с вебом (PollBlock).
 *
 * До своего голоса видны только варианты; после — доли в процентах, чтобы
 * первый выбор не смещался чужими цифрами. Повторный тап по своему варианту
 * снимает голос. Обновление оптимистичное: цифры двигаются сразу, при ошибке
 * откатываемся.
 */
export function PollBlock({
  postId,
  options,
  myVote,
}: {
  postId: string;
  options: PollOption[];
  myVote: string | null;
}) {
  const palette = usePalette();
  const { t } = useT();
  const [votes, setVotes] = useState(options);
  const [chosen, setChosen] = useState<string | null>(myVote);
  const [error, setError] = useState<string | null>(null);

  const total = votes.reduce((sum, option) => sum + option.votes, 0);

  async function choose(optionId: string) {
    const previous = chosen;
    // Повторный тап по своему варианту снимает голос.
    const removing = previous === optionId;

    setChosen(removing ? null : optionId);
    setVotes((prev) =>
      prev.map((option) => {
        if (!removing && option.id === optionId) return { ...option, votes: option.votes + 1 };
        if (option.id === previous) return { ...option, votes: Math.max(option.votes - 1, 0) };
        return option;
      })
    );

    try {
      await apiFetch(
        `/posts/${postId}/poll-vote`,
        removing
          ? { method: 'DELETE' }
          : { method: 'POST', body: JSON.stringify({ option_id: optionId }) }
      );
    } catch (err) {
      setChosen(previous);
      setVotes(options);
      setError(err instanceof Error ? err.message : 'Не вышло изменить голос');
    }
  }

  return (
    <View style={{ marginTop: 4, gap: 6 }}>
      {votes.map((option) => {
        const share = total > 0 ? Math.round((option.votes / total) * 100) : 0;
        return (
          <PollBar
            key={option.id}
            palette={palette}
            text={option.text}
            share={share}
            revealed={Boolean(chosen)}
            selected={chosen === option.id}
            onPress={() => choose(option.id)}
          />
        );
      })}

      <Text style={{ fontSize: 12, color: palette.textMuted }}>
        {total === 0 ? t('Голосов пока нет') : `${total} ${t('голосов')}`}
      </Text>

      {error ? <Text style={{ fontSize: 12, color: palette.down }}>{error}</Text> : null}
    </View>
  );
}

/** Пилюля-вариант со шкалой доли, разворачивающейся из ничего после голоса. */
function PollBar({
  palette,
  text,
  share,
  revealed,
  selected,
  onPress,
}: {
  palette: ReturnType<typeof usePalette>;
  text: string;
  share: number;
  revealed: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  // Ширина полосы едет от 0: до голоса — ноль, первый выбор разворачивает её.
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: revealed ? share : 0,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [revealed, share, progress]);
  const width = progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <Pressable
      onPress={onPress}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? palette.accent : palette.border,
        paddingHorizontal: 16,
        paddingVertical: 10,
      }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width,
          // Выбранный вариант — плотнее прочих, чтобы его было видно первым.
          backgroundColor: selected ? `${palette.accent}57` : `${palette.accent}33`,
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: palette.text }}>
          {text}
        </Text>
        {revealed ? <Text style={{ fontSize: 13, color: palette.textMuted }}>{share}%</Text> : null}
      </View>
    </Pressable>
  );
}
