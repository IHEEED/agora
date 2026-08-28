import { Image, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { usePalette } from '../theme';

/**
 * Лицо по умолчанию — один в один с вебом (DefaultAvatar).
 *
 * Не буква и не пёстрый градиент: пёстрый кружок читается как поставленное
 * фото, и человек с настоящим лицом ничем не выделялся бы. Заглушка — силуэт на
 * бледной подложке акцента (--avatar-bg): для человека один силуэт в круге, для
 * клуба двое в скруглённом квадрате. Есть снимок — показываем его в той же
 * форме. Именно эта подложка и «выделяет» аватарки в списках.
 */
export function Avatar({
  name,
  uri,
  size = 40,
  kind = 'person',
}: {
  name?: string;
  uri?: string | null;
  size?: number;
  kind?: 'person' | 'community';
}) {
  const palette = usePalette();
  const radius = kind === 'community' ? size * 0.28 : size / 2;

  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: palette.avatarBg }} />;
  }

  const glyph = size * 0.62;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: palette.avatarBg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg width={glyph} height={glyph} viewBox="0 0 24 24" fill={palette.avatarInk}>
        {kind === 'community' ? (
          <>
            <Circle cx="9" cy="8.5" r="3.6" />
            <Path d="M2.6 19.4c0-3.1 2.9-5.2 6.4-5.2s6.4 2.1 6.4 5.2c0 .6-.5 1.1-1.1 1.1H3.7c-.6 0-1.1-.5-1.1-1.1Z" />
            <Circle cx="17.2" cy="9.6" r="2.7" opacity={0.55} />
            <Path d="M17.2 13.6c2.6 0 4.5 1.6 4.5 3.9 0 .5-.4.9-.9.9h-3.4c.2-.4.3-.9.3-1.4 0-1.4-.5-2.6-1.4-3.4Z" opacity={0.55} />
          </>
        ) : (
          <>
            <Circle cx="12" cy="8.2" r="4.1" />
            <Path d="M3.8 20.2c0-3.6 3.4-6 8.2-6s8.2 2.4 8.2 6c0 .7-.6 1.3-1.3 1.3H5.1c-.7 0-1.3-.6-1.3-1.3Z" />
          </>
        )}
      </Svg>
    </View>
  );
}
