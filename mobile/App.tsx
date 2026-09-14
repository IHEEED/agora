import * as Sentry from '@sentry/react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationTheme, useIsDark, usePalette } from './src/theme';

/**
 * Мониторинг ошибок — включается наличием EXPO_PUBLIC_SENTRY_DSN.
 *
 * Без ключа init не зовём: Sentry становится тихим no-op, локальная разработка
 * никуда ничего не шлёт. DSN клиентский (EXPO_PUBLIC_), он и так в бандле — это
 * нормально, отправку ограничивают настройки проекта в Sentry. Ловит и падения
 * нативной части (крэши), и необработанные ошибки JS.
 */
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Только ошибки: трассировку производительности пока не гоняем.
    tracesSampleRate: 0,
    // Не тащим личные данные пользователя в события без нужды.
    sendDefaultPii: false,
  });
}

function App() {
  const palette = usePalette();
  // Тёмность — с учётом настройки темы (система/светлая/тёмная), а не только
  // системной: иначе выбор «Тёмная» в настройках красит экраны, но фон под
  // навигацией и строка статуса остаются светлыми.
  const dark = useIsDark();

  return (
    <SafeAreaProvider>
      {/* Тему отдаём NavigationContainer, а не красим экраны по одному: он
          красит фон под ними и то, что рисует сам, — иначе при переходе между
          экранами на кадр проглядывает белый фон по умолчанию. */}
      <NavigationContainer theme={navigationTheme(palette, dark)}>
        <RootNavigator />
        <StatusBar style={dark ? 'light' : 'dark'} />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

// Обёртка Sentry: ловит ошибки рендера деревом ошибок и подключает
// инструментацию. Без активного init (нет DSN) — тихий no-op.
export default Sentry.wrap(App);
