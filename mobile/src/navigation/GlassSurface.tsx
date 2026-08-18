import type { ViewProps } from 'react-native';
import { View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { usePalette } from '../theme';

/**
 * Стеклянная поверхность — настоящая там, где система её умеет.
 *
 * Раньше этот файл подкладывал BlurView под нарисованный таб-бар. Таб-бар с
 * тех пор стал нативным и красит себя сам (см. MainTabs), так что здесь
 * осталось то, ради чего стекло нужно в остальных местах: плавающие панели
 * поверх контента.
 *
 * Разница между BlurView и Liquid Glass не в качестве размытия. Размытие
 * усредняет пиксели под собой; стекло преломляет — сильнее у краёв, слабее в
 * середине — и подсвечивает кромку, исходя из того, где у экрана свет.
 * Посчитать это можно только зная всю сцену, поэтому считает система, а
 * GlassView лишь просит её об этом.
 *
 * Где Liquid Glass недоступен — старая iOS, Android, включённые настройки
 * доступности — падаем на сплошную поверхность, а не на размытие. Мутная
 * плёнка, изображающая стекло, выглядит хуже честной непрозрачной панели:
 * первое читается как поломка, второе — как решение.
 */
export function GlassSurface({ style, children, ...rest }: ViewProps) {
  const palette = usePalette();

  if (!isLiquidGlassAvailable()) {
    return (
      <View style={[{ backgroundColor: palette.surface }, style]} {...rest}>
        {children}
      </View>
    );
  }

  return (
    // glassEffectStyle="regular" — тот же материал, что у системных панелей.
    // 'clear' прозрачнее и годится поверх фотографии, но под текстом даёт
    // слишком мало контраста.
    <GlassView glassEffectStyle="regular" style={style} {...rest}>
      {children}
    </GlassView>
  );
}
