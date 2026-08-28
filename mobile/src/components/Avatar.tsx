import { Image, Text, View } from 'react-native';
import { usePalette } from '../theme';

/**
 * Лицо человека: снимок или кружок с первой буквой имени.
 *
 * Один компонент на все места, где показан автор, — как ProfileAvatar в вебе.
 * Пустого силуэта нет: пока лицо не поставили или не загрузилось, кружок с
 * буквой читается лучше серого силуэта, который у всех одинаковый.
 */
export function Avatar({
  name,
  uri,
  size = 40,
}: {
  name: string;
  uri?: string | null;
  size?: number;
}) {
  const palette = usePalette();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: palette.surface2 }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.surface2,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.4, fontWeight: '600', color: palette.textMuted }}>
        {(name || '?').slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}
