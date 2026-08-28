import { useState } from 'react';
import { Modal, Pressable, Share, Text, View } from 'react-native';
import { apiFetch } from '../lib/api';
import { usePalette } from '../theme';

/**
 * Меню записи — шторка снизу, как в вебе.
 *
 * Общее место для всего, что делают с записью и что не заслужило своей кнопки
 * в строке действий: поделиться, пожаловаться, удалить (только своё). «Продолжить
 * цепочку» и «в историю» лягут позже — им нужен редактор. Жалоба раскрывает
 * список причин теми же словами, что на сайте.
 */

const REASONS: { key: string; label: string }[] = [
  { key: 'spam', label: 'Спам' },
  { key: 'abuse', label: 'Оскорбления' },
  { key: 'false', label: 'Ложь и вброс' },
  { key: 'violence', label: 'Насилие' },
  { key: 'other', label: 'Другое' },
];

export function PostMenuSheet({
  open,
  onClose,
  postId,
  title,
  isMine,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  title: string;
  isMine: boolean;
  onDeleted?: () => void;
}) {
  const palette = usePalette();
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState(false);

  function close() {
    setReporting(false);
    setDone(false);
    onClose();
  }

  async function share() {
    close();
    try {
      await Share.share({ message: title });
    } catch {
      // отменили — молча
    }
  }

  async function remove() {
    close();
    try {
      await apiFetch(`/posts/${postId}`, { method: 'DELETE' });
      onDeleted?.();
    } catch {
      // ошибку удаления показывать негде из закрытой шторки — оставляем как есть
    }
  }

  async function report(reason: string) {
    try {
      await apiFetch('/reports', { method: 'POST', body: JSON.stringify({ reason, postId }) });
      setDone(true);
    } catch {
      setDone(true);
    }
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <Pressable onPress={close} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{ backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 34 }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border, marginBottom: 8 }} />

          {done ? (
            <Text style={{ textAlign: 'center', paddingVertical: 24, fontSize: 15, color: palette.text }}>
              Жалоба отправлена. Спасибо.
            </Text>
          ) : reporting ? (
            <>
              <Text style={{ paddingHorizontal: 20, paddingVertical: 10, fontSize: 13, color: palette.textMuted }}>
                За что жалуетесь?
              </Text>
              {REASONS.map((r) => (
                <Item key={r.key} palette={palette} label={r.label} onPress={() => report(r.key)} />
              ))}
            </>
          ) : (
            <>
              <Item palette={palette} label="Поделиться" onPress={share} />
              <Item palette={palette} label="Пожаловаться" onPress={() => setReporting(true)} />
              {isMine ? <Item palette={palette} label="Удалить" danger onPress={remove} /> : null}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Item({
  palette,
  label,
  onPress,
  danger = false,
}: {
  palette: ReturnType<typeof usePalette>;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ paddingHorizontal: 20, paddingVertical: 15, backgroundColor: pressed ? palette.surface2 : 'transparent' })}
    >
      <Text style={{ fontSize: 16, color: danger ? palette.down : palette.text }}>{label}</Text>
    </Pressable>
  );
}
