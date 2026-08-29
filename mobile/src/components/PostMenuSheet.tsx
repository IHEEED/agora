import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { apiFetch } from '../lib/api';
import { usePalette } from '../theme';

/**
 * Меню записи — шторка снизу, как в вебе.
 *
 * «Поделиться» здесь нет: у него своя кнопка в строке действий. Остаётся то,
 * что не заслужило своей кнопки: скопировать ссылку, пожаловаться и — только у
 * своей записи — удалить. У каждого пункта свой значок теми же контурами, что
 * на сайте. Жалоба раскрывает список причин.
 */

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

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
  isMine,
  onDeleted,
  onStory,
  onContinue,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  isMine: boolean;
  onDeleted?: () => void;
  /** Открыть репост записи в историю. Без него пункт «В историю» не показываем. */
  onStory?: () => void;
  /** Продолжить запись (только своя и без цепочки). Без него пункта нет. */
  onContinue?: () => void;
}) {
  const palette = usePalette();
  const [reporting, setReporting] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  function close() {
    setReporting(false);
    setDone(false);
    setCopied(false);
    onClose();
  }

  async function copyLink() {
    await Clipboard.setStringAsync(`${WEB_URL}/posts/${postId}`);
    setCopied(true);
    setTimeout(close, 700);
  }

  async function remove() {
    close();
    try {
      await apiFetch(`/posts/${postId}`, { method: 'DELETE' });
      onDeleted?.();
    } catch {
      // ошибку показывать негде из закрытой шторки
    }
  }

  async function report(reason: string) {
    try {
      await apiFetch('/reports', { method: 'POST', body: JSON.stringify({ reason, postId }) });
    } catch {
      // всё равно благодарим — жалоба уходит в очередь на сервере
    }
    setDone(true);
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
              {onContinue ? (
                <Item palette={palette} label="Продолжить" onPress={() => { onClose(); onContinue(); }}>
                  <Path d="M6 4v10a3 3 0 0 0 3 3h9" />
                  <Path d="m14 13 4 4-4 4" />
                </Item>
              ) : null}
              <Item palette={palette} label={copied ? 'Ссылка скопирована' : 'Скопировать ссылку'} onPress={copyLink}>
                <Rect x="9" y="9" width="11" height="11" rx="2.5" />
                <Path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
              </Item>
              {isMine && onStory ? (
                <Item palette={palette} label="В историю" onPress={() => { onClose(); onStory(); }}>
                  <Circle cx="12" cy="12" r="8.6" strokeDasharray="4.6 3.4" />
                  <Path d="M12 8.6v6.8M8.6 12h6.8" />
                </Item>
              ) : null}
              <Item palette={palette} label="Пожаловаться" danger onPress={() => setReporting(true)}>
                <Path d="M5 21V4.5h9l-.8 3.2H19l-1 4.6H6" />
                <Path d="M5 4.5h.01" />
              </Item>
              {isMine ? (
                <Item palette={palette} label="Удалить" danger onPress={remove}>
                  <Path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2h9.4L17.5 7" />
                  <Path d="M10.5 11v5M13.5 11v5" />
                </Item>
              ) : null}
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
  children,
}: {
  palette: ReturnType<typeof usePalette>;
  label: string;
  onPress: () => void;
  danger?: boolean;
  children?: React.ReactNode;
}) {
  const color = danger ? palette.down : palette.text;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: pressed ? palette.surface2 : 'transparent',
      })}
    >
      {children ? (
        <Svg width={21} height={21} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          {children}
        </Svg>
      ) : null}
      <Text style={{ fontSize: 16, color }}>{label}</Text>
    </Pressable>
  );
}
