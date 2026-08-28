import { Text, View } from 'react-native';

/**
 * Галочка подлинности — синий кружок с белой галкой.
 *
 * Цвет тот же, что в вебе (#1d9bf0), и не зависит от оформления: значение у
 * знака одно, и узнаваться он должен одинаково в любой теме. В вебе это
 * посчитанная розетка из двенадцати лепестков; в React Native без библиотеки
 * векторов рисуем кружок — на мелком размере разница неразличима, а смысл тот
 * же.
 *
 * Ничего не рисует, когда галочки нет, — можно ставить безусловно.
 */
export function VerifiedMark({ verified, size = 15 }: { verified?: string | null; size?: number }) {
  if (!verified) return null;

  return (
    <View
      accessibilityLabel="Подтверждённый аккаунт"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#1d9bf0',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#fff', fontSize: size * 0.62, fontWeight: '900', lineHeight: size }}>
        ✓
      </Text>
    </View>
  );
}
