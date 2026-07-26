import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';

// полупрозрачный размытый фон вместо сплошного цвета — приближение
// к нативному Liquid Glass доступными в Expo Go средствами;
// настоящий нативный tab bar (createNativeBottomTabNavigator) требует
// Dev Client и здесь сознательно не используется
export function BlurTabBarBackground() {
  return <BlurView tint="light" intensity={80} style={StyleSheet.absoluteFill} />;
}
