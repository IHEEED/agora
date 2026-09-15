import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { apiFetch } from '../lib/api';
import { uploadImage } from '../lib/uploadImage';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';

const HOURS = [6, 12, 24] as const;

/** Цвета текста и варианты начертания — как палитра шрифтов/цветов на вебе. */
const COLORS = ['#ffffff', '#000000', '#ffd93b', '#ff5c5c', '#5ac8fa', '#8affc1'];
type FontKind = 'system' | 'bold' | 'serif';
const FONTS: { key: FontKind; label: string }[] = [
  { key: 'system', label: 'Обычный' },
  { key: 'bold', label: 'Жирный' },
  { key: 'serif', label: 'Засечки' },
];
function fontStyle(f: FontKind) {
  if (f === 'serif') return { fontFamily: 'Georgia', fontWeight: '600' as const };
  if (f === 'bold') return { fontWeight: '800' as const };
  return { fontWeight: '600' as const };
}

type Layer = { id: string; text: string; x: number; y: number; color: string; font: FontKind };

/**
 * Редактор новой истории — конструктор текстовых слоёв, как в вебе (StoryEditor).
 *
 * Кадр во весь экран, поверх — перетаскиваемые надписи со своим цветом и
 * начертанием. При публикации кадр вместе с надписями сплющивается в одну
 * картинку через view-shot (аналог canvas на вебе) и уходит в историю —
 * получатель видит ровно то, что собрали, независимо от платформы.
 */
export function StoryEditor({
  image,
  onCancel,
  onPublished,
}: {
  image: { uri: string; base64: string; mime: string } | null;
  onCancel: () => void;
  onPublished: () => void;
}) {
  const palette = usePalette();
  const { t } = useT();
  const insets = useSafeAreaInsets();
  const frameRef = useRef<View>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [layers, setLayers] = useState<Layer[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hours, setHours] = useState<(typeof HOURS)[number]>(24);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = layers.find((l) => l.id === activeId) ?? null;
  const editing = layers.find((l) => l.id === editingId) ?? null;

  function addLayer() {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setLayers((prev) => [
      ...prev,
      { id, text: '', x: frame.w / 2 - 80, y: frame.h / 2 - 20, color: '#ffffff', font: 'system' },
    ]);
    setActiveId(id);
    setEditingId(id);
  }

  function update(id: string, patch: Partial<Layer>) {
    setLayers((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function removeLayer(id: string) {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (activeId === id) setActiveId(null);
  }

  // Пустой слой при закрытии редактора текста убираем — незачем пустая надпись.
  function finishEditing() {
    const id = editingId;
    setEditingId(null);
    if (id && !layers.find((l) => l.id === id)?.text.trim()) removeLayer(id);
  }

  async function publish() {
    if (!image || busy) return;
    setBusy(true);
    setError(null);
    setActiveId(null);
    try {
      // Сплющиваем кадр с надписями в одну картинку. Без слоёв — тоже кадр,
      // просто без текста (обычная история).
      const base64 =
        layers.length > 0
          ? await captureRef(frameRef, { format: 'jpg', quality: 0.9, result: 'base64' })
          : image.base64;
      const url = await uploadImage(base64, 'image/jpeg', 'stories');
      await apiFetch('/stories', {
        method: 'POST',
        body: JSON.stringify({ image_url: url, hours }),
      });
      onPublished();
      reset();
      onCancel();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не вышло опубликовать — попробуйте ещё раз');
      setBusy(false);
    }
  }

  function reset() {
    setLayers([]);
    setActiveId(null);
    setEditingId(null);
    setHours(24);
    setBusy(false);
    setError(null);
  }

  return (
    <Modal visible={image !== null} transparent={false} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Кадр с надписями — именно его снимает view-shot. */}
        <View
          ref={frameRef}
          collapsable={false}
          style={StyleSheet.absoluteFill}
          onLayout={(e) => setFrame({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {image ? <Image source={{ uri: image.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          {layers.map((layer) => (
            <DraggableText
              key={layer.id}
              layer={layer}
              frameW={frame.w}
              selected={activeId === layer.id}
              onGrab={() => setActiveId(layer.id)}
              onMoveEnd={(x, y) => update(layer.id, { x, y })}
              onTap={() => { setActiveId(layer.id); setEditingId(layer.id); }}
            />
          ))}
        </View>

        {/* Крестик слева сверху. */}
        <Pressable
          onPress={() => { reset(); onCancel(); }}
          hitSlop={10}
          style={{ position: 'absolute', top: insets.top + 8, left: 14, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
            <Path d="M6 6l12 12M18 6 6 18" />
          </Svg>
        </Pressable>

        {/* Добавить надпись — справа сверху. */}
        <Pressable
          onPress={addLayer}
          hitSlop={10}
          style={{ position: 'absolute', top: insets.top + 8, right: 14, height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Text style={{ fontSize: 19, fontWeight: '800', color: '#fff' }}>Aa</Text>
          <Text style={{ fontSize: 20, color: '#fff', marginTop: -2 }}>+</Text>
        </Pressable>

        {/* Панель стиля выбранного слоя (когда не редактируем текст). */}
        {active && !editing ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: insets.bottom + 96, gap: 12, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
              {COLORS.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => update(active.id, { color: c })}
                  style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: 2, borderColor: active.color === c ? palette.accent : 'rgba(255,255,255,0.6)' }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
              {FONTS.map((f) => (
                <Pressable
                  key={f.key}
                  onPress={() => update(active.id, { font: f.key })}
                  style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: active.font === f.key ? '#fff' : 'rgba(255,255,255,0.16)' }}
                >
                  <Text style={[{ fontSize: 13, color: active.font === f.key ? '#000' : '#fff' }, fontStyle(f.key)]}>{t(f.label)}</Text>
                </Pressable>
              ))}
              <Pressable onPress={() => removeLayer(active.id)} style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: 'rgba(255,80,80,0.28)' }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#ff8080' }}>{t('Убрать')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Редактор текста слоя — центрированный ввод поверх затемнения. */}
        {editing ? (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={StyleSheet.absoluteFill}>
            <Pressable onPress={finishEditing} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 28 }}>
              <TextInput
                value={editing.text}
                onChangeText={(v) => update(editing.id, { text: v })}
                autoFocus
                multiline
                maxLength={200}
                placeholder={t('Текст')}
                placeholderTextColor="rgba(255,255,255,0.5)"
                style={[{ fontSize: 30, textAlign: 'center', color: editing.color }, fontStyle(editing.font)]}
              />
              <Pressable onPress={finishEditing} style={{ alignSelf: 'center', marginTop: 24, borderRadius: 999, paddingHorizontal: 22, paddingVertical: 10, backgroundColor: '#fff' }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#000' }}>{t('Готово')}</Text>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        ) : null}

        {/* Нижняя панель: срок жизни и публикация (скрыта во время правки текста). */}
        {!editing ? (
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingBottom: insets.bottom + 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{t('Показывать:')}</Text>
              {HOURS.map((value) => {
                const on = hours === value;
                return (
                  <Pressable key={value} onPress={() => setHours(value)} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: on ? '#fff' : 'rgba(255,255,255,0.16)' }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: on ? '#000' : '#fff' }}>{value} ч</Text>
                  </Pressable>
                );
              })}
            </View>

            {error ? <Text style={{ fontSize: 13, color: '#ff6b6b' }}>{error}</Text> : null}

            <Pressable
              onPress={publish}
              disabled={busy}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 999, paddingVertical: 13, backgroundColor: palette.accent, opacity: busy ? 0.6 : 1 }}
            >
              {busy ? <ActivityIndicator color={palette.accentContrast} /> : null}
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.accentContrast }}>
                {busy ? t('Публикуем…') : t('В историю')}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

/** Перетаскиваемая надпись. Короткий тап (без сдвига) открывает правку текста. */
function DraggableText({
  layer,
  frameW,
  selected,
  onGrab,
  onMoveEnd,
  onTap,
}: {
  layer: Layer;
  frameW: number;
  selected: boolean;
  onGrab: () => void;
  onMoveEnd: (x: number, y: number) => void;
  onTap: () => void;
}) {
  const pan = useRef(new Animated.ValueXY({ x: layer.x, y: layer.y })).current;
  const pos = useRef({ x: layer.x, y: layer.y });
  const moved = useRef(false);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        moved.current = false;
        onGrab();
        pan.setOffset({ x: pos.current.x, y: pos.current.y });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_e, g) => {
        if (Math.abs(g.dx) > 2 || Math.abs(g.dy) > 2) moved.current = true;
        pan.setValue({ x: g.dx, y: g.dy });
      },
      onPanResponderRelease: (_e, g) => {
        pan.flattenOffset();
        pos.current = { x: pos.current.x + g.dx, y: pos.current.y + g.dy };
        if (moved.current) onMoveEnd(pos.current.x, pos.current.y);
        else onTap();
      },
    })
  ).current;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{
        position: 'absolute',
        transform: pan.getTranslateTransform(),
        maxWidth: frameW ? frameW * 0.86 : undefined,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: selected ? 1 : 0,
        borderColor: 'rgba(255,255,255,0.5)',
        borderStyle: 'dashed',
      }}
    >
      <Text
        style={[
          {
            fontSize: 30,
            lineHeight: 36,
            textAlign: 'center',
            color: layer.color,
            textShadowColor: 'rgba(0,0,0,0.45)',
            textShadowRadius: 6,
            textShadowOffset: { width: 0, height: 1 },
          },
          fontStyle(layer.font),
        ]}
      >
        {layer.text || ' '}
      </Text>
    </Animated.View>
  );
}
