import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as Clipboard from 'expo-clipboard';
import { apiFetch } from '../lib/api';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

/**
 * Приглашение — один код и навсегда, как в вебе (InvitesPanel).
 *
 * Строкой в карточке аккаунта: розовая плитка, сам код моноширинным с
 * разрядкой, под ним пояснение, справа — «Ссылка»/«Скопировано». Списка
 * приведённых наружу нет: связь в базе остаётся модерации, но не превращается
 * в иерархию «я привёл десятерых».
 */
export function InvitesPanel({ first = false }: { first?: boolean }) {
  const palette = usePalette();
  const { t } = useT();
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<{ code: string }>('/invites/mine')
      .then((data) => setCode(data.code))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function copy() {
    if (!code) return;
    await Clipboard.setStringAsync(`${WEB_URL}/?code=${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <View>
      {!first ? <View style={{ height: 1, marginLeft: 16, backgroundColor: palette.border }} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 46, paddingHorizontal: 16, paddingVertical: 9 }}>
        <View style={{ width: 29, height: 29, borderRadius: 8, backgroundColor: '#ff2d55', alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Circle cx="9" cy="9" r="3.5" />
            <Path d="M3.5 19c0-3 2.5-4.5 5.5-4.5s5.5 1.5 5.5 4.5" />
            <Path d="M18 8v6M15 11h6" />
          </Svg>
        </View>

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 15, letterSpacing: 3, color: palette.text }}>
            {loading ? '••••••' : code ?? '—'}
          </Text>
          <Text style={{ fontSize: 12.5, lineHeight: 17, color: palette.textMuted }}>
            {t('Ваш код. Один на всех, кого позовёте')}
          </Text>
        </View>

        {code ? (
          <Pressable onPress={copy} style={{ borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7, backgroundColor: palette.surface2 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.text }}>{copied ? t('Скопировано') : t('Ссылка')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
