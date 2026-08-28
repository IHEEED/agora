import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../theme';

/**
 * Крупный заголовок экрана с отступом безопасной зоны сверху — как ScreenTitle
 * в вебе.
 *
 * У нативных вкладок своей шапки нет, поэтому каждый экран сам отступает от
 * чёлки: без этого содержимое лезет под часы и вырез. Заголовок газетной
 * антиквой (Georgia — тот же откат, что в вебе), фирменность несёт точка в
 * конце акцентным цветом. Справа можно поставить действие (например «плюс»).
 */
export function ScreenHeader({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const trimmed = title.trim();
  const needsDot = !/[.!?…:]$/.test(trimmed);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: insets.top + 8,
        paddingBottom: 10,
      }}
    >
      <Text style={{ fontFamily: palette.displayFamily, fontSize: 30, lineHeight: 34, color: palette.text }}>
        {trimmed}
        {needsDot ? <Text style={{ color: palette.accent }}>.</Text> : null}
      </Text>
      {right ?? null}
    </View>
  );
}
