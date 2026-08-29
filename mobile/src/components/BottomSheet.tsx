import { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../theme';

/**
 * Шторка снизу — как в вебе (BottomSheet).
 *
 * Затемнённый фон, панель выезжает снизу, сверху палочка-ручка, за которую
 * можно стянуть шторку вниз, чтобы закрыть. Заголовок строкой, контент
 * прокручивается, футер (например кнопка «Сохранить») прижат к низу над
 * безопасной зоной. Тап по фону закрывает.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) y.setValue(0);
  }, [open, y]);

  // Свайп вниз за ручку — тянет панель и закрывает, если увели достаточно далеко.
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) y.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.8) {
          onClose();
          y.setValue(0);
        } else {
          Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 9 }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Animated.View style={{ transform: [{ translateY: y }] }}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={{ backgroundColor: palette.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: insets.bottom + 12, maxHeight: '88%' }}>
                {/* Ручка + заголовок — за них тянут вниз. */}
                <View {...pan.panHandlers} style={{ paddingTop: 10, paddingBottom: title ? 8 : 4 }}>
                  <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border }} />
                  {title ? (
                    <Text style={{ textAlign: 'center', marginTop: 10, fontSize: 16, fontWeight: '700', color: palette.text }}>{title}</Text>
                  ) : null}
                </View>

                <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}>
                  {children}
                </ScrollView>

                {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>{footer}</View> : null}
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
