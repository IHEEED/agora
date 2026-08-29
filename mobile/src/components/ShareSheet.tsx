import { useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { usePalette } from '../theme';

/**
 * Куда поделиться записью — как в вебе (ShareSheet).
 *
 * Шторка (fade) с иконками мессенджеров и «Ссылкой». Каждая ведёт во внешнее
 * приложение через системный переход (Linking); копирование кладёт ссылку в
 * буфер и закрывает шторку.
 */
type Target = {
  id: string;
  label: string;
  color: string;
  href: (url: string, text: string) => string;
  icon: React.ReactNode;
};

const TARGETS: Target[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#29a9eb',
    href: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: <Path d="M21.7 3.6 2.9 10.9c-1 .4-1 1.8 0 2.1l4.7 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.6 3.4c.7.5 1.7.1 1.9-.8l3.1-15c.2-1-.8-1.8-1.8-1.4ZM8.9 14.1l9-5.6-7.4 6.7-.3 3-1.3-4.1Z" />,
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25d366',
    href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    icon: <Path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.7-.1a12 12 0 0 1-6.8-6c-.5-.9-.8-1.8-.2-2.7.2-.4.5-.6.8-.7h.7c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6a8.7 8.7 0 0 0 3.9 3.4c.3.1.5.1.7-.1l.8-1c.2-.2.3-.2.6-.1l1.9.9c.3.1.4.2.4.4 0 .2 0 .9-.2 1.4Z" />,
  },
  {
    id: 'vk',
    label: 'VK',
    color: '#0077ff',
    href: (url) => `https://vk.com/share.php?url=${encodeURIComponent(url)}`,
    icon: <Path d="M12.8 16.6c-5 0-8.2-3.5-8.3-9.3h2.6c.1 4.3 2 6.1 3.4 6.5V7.3h2.4v3.8c1.4-.2 2.9-1.8 3.4-3.8h2.4c-.4 2.4-2 4-3.1 4.7 1.1.6 3 2 3.7 4.6h-2.7c-.6-1.8-1.9-3.2-3.7-3.4v3.4h-.1Z" />,
  },
  {
    id: 'x',
    label: 'X',
    color: '#111111',
    href: (url, text) => `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: <Path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5 21H1.9l7.3-8.3L1.6 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z" />,
  },
];

export function ShareSheet({ open, onClose, url, text }: { open: boolean; onClose: () => void; url: string; text: string }) {
  const palette = usePalette();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await Clipboard.setStringAsync(url);
    setCopied(true);
    setTimeout(() => { setCopied(false); onClose(); }, 900);
  }

  function share(target: Target) {
    Linking.openURL(target.href(url, text)).catch(() => {});
    onClose();
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Pressable onPress={onClose} style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />
        <View style={{ marginTop: 'auto', backgroundColor: palette.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 36 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: palette.border, marginBottom: 8 }} />
          <Text style={{ paddingHorizontal: 20, paddingBottom: 8, fontSize: 16, fontWeight: '700', color: palette.text }}>Поделиться в</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingVertical: 8 }}>
            {TARGETS.map((target) => (
              <Pressable key={target.id} onPress={() => share(target)} style={{ width: '25%', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: target.color, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="#fff">
                    {target.icon}
                  </Svg>
                </View>
                <Text style={{ fontSize: 12, color: palette.textMuted }}>{target.label}</Text>
              </Pressable>
            ))}

            <Pressable onPress={copy} style={{ width: '25%', alignItems: 'center', gap: 8, paddingVertical: 10 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.text} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M9 9h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z" />
                  <Path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
                </Svg>
              </View>
              <Text style={{ fontSize: 12, color: palette.textMuted }}>{copied ? 'Скопировано' : 'Ссылка'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
