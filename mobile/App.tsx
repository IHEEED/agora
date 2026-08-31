import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationTheme, useIsDark, usePalette } from './src/theme';

export default function App() {
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
