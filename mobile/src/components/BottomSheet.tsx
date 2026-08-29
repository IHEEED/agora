import { useEffect, useRef } from 'react';
import { Animated, KeyboardAvoidingView, Modal, PanResponder, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '../theme';

/**
 * Шторка снизу — как в вебе (BottomSheet).
 *
 * Фон плавно затемняется (Modal fade), а панель отдельно выезжает снизу
 * пружиной — без «слайда всего окна разом», отчего раньше было криво. Сверху
 * палочка-ручка, за которую шторку стягивают вниз, чтобы закрыть. Контент
 * прокручивается, футер прижат к низу над безопасной зоной.
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
  const y = useRef(new Animated.Value(600)).current;
  const height = useRef(600);

  useEffect(() => {
    if (open) {
      y.setValue(height.current);
      Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 11, tension: 90 }).start();
    }
  }, [open, y]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) y.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 110 || g.vy > 0.8) {
          Animated.timing(y, { toValue: height.current, duration: 160, useNativeDriver: true }).start(() => onClose());
        } else {
          Animated.spring(y, { toValue: 0, useNativeDriver: true, friction: 11 }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
        <Animated.View style={{ transform: [{ translateY: y }] }}>
          <Pressable onPress={(e) => e.stopPropagation()}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View
                onLayout={(e) => { height.current = e.nativeEvent.layout.height; }}
                style={{ backgroundColor: palette.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingBottom: insets.bottom + 12, maxHeight: '90%' }}
              >
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
