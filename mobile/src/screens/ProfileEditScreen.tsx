import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { uploadImage } from '../lib/uploadImage';
import { useSession } from '../lib/useSession';
import { UserProfile } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ProfileEdit'>;

/**
 * Редактор профиля — лицо, обложка, имя и подпись, как в вебе.
 *
 * Картинки выбираются из галереи и уезжают в Storage; в профиль пишется их
 * адрес. Пустое поле означает «убрать»: стёр подпись — её не станет.
 */
export function ProfileEditScreen({ navigation }: Props) {
  const palette = usePalette();
  const { session } = useSession();
  const userId = session?.user.id;

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [initialUsername, setInitialUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'avatar' | 'cover'>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    apiFetch<UserProfile & { cover_url?: string | null }>(`/users/${userId}`)
      .then((profile) => {
        setDisplayName(profile.display_name ?? '');
        setBio(profile.bio ?? '');
        setUsername(profile.username ?? '');
        setInitialUsername(profile.username ?? '');
        setAvatarUrl(profile.avatar_url ?? null);
        setCoverUrl(profile.cover_url ?? null);
      })
      .catch(() => {});
  }, [userId]);

  async function pick(kind: 'avatar' | 'cover') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Нет доступа к галерее — разрешите в настройках телефона.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: kind === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.7,
      base64: true,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    setError(null);
    setBusy(kind);
    try {
      const asset = result.assets[0];
      const url = await uploadImage(asset.base64!, asset.mimeType ?? 'image/jpeg', kind === 'avatar' ? 'avatars' : 'covers');
      if (kind === 'avatar') setAvatarUrl(url);
      else setCoverUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить картинку');
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await apiFetch('/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: displayName.trim(), bio: bio.trim(), avatarUrl, coverUrl }),
      });

      // Ник — отдельной ручкой: у него своя уникальность и задержка (как в вебе).
      const nextUsername = username.trim();
      if (nextUsername && nextUsername !== initialUsername) {
        await apiFetch('/users/me/username', { method: 'PATCH', body: JSON.stringify({ username: nextUsername }) });
      }

      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  }

  const field = {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: palette.text,
    backgroundColor: palette.surface,
  } as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      {/* Обложка: тап меняет картинку. */}
      <Pressable onPress={() => pick('cover')} style={{ height: 150, backgroundColor: palette.surface2 }}>
        {coverUrl ? <Image source={{ uri: coverUrl }} style={{ width: '100%', height: '100%' }} /> : (
          <LinearGradient colors={[`${palette.accent}55`, `${palette.accent}00`]} style={{ flex: 1 }} />
        )}
        <View style={{ position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          {busy === 'cover' ? <ActivityIndicator size="small" color="#fff" /> : (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.1} strokeLinecap="round"><Path d="M12 6v12M6 12h12" /></Svg>
          )}
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#fff' }}>{coverUrl ? 'Сменить фон' : 'Добавить фон'}</Text>
        </View>
        {coverUrl ? (
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); setCoverUrl(null); }}
            style={{ position: 'absolute', top: 12, left: 12, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: 'rgba(0,0,0,0.4)' }}
          >
            <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#fff' }}>Убрать фон</Text>
          </Pressable>
        ) : null}
      </Pressable>

      {/* Аватар: тап меняет лицо. */}
      <Pressable onPress={() => pick('avatar')} style={{ marginTop: -44, marginLeft: 16, width: 88, height: 88 }}>
        <View style={{ borderWidth: 3, borderColor: palette.bg, borderRadius: 47, overflow: 'hidden' }}>
          <Avatar name={displayName || '?'} uri={avatarUrl} size={82} />
        </View>
        <View style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: palette.accent, borderWidth: 2, borderColor: palette.bg, alignItems: 'center', justifyContent: 'center' }}>
          {busy === 'avatar' ? <ActivityIndicator size="small" color={palette.accentContrast} /> : (
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={palette.accentContrast} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 20h9" /><Path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </Svg>
          )}
        </View>
      </Pressable>

      {/* Убрать фото — красным, без подтверждения: восстановить в два нажатия. */}
      {avatarUrl ? (
        <Pressable onPress={() => setAvatarUrl(null)} style={{ marginLeft: 16, marginTop: 8 }}>
          <Text style={{ fontSize: 12.5, color: palette.down }}>Убрать фото</Text>
        </Pressable>
      ) : null}

      <View style={{ padding: 20, gap: 10 }}>
        <Text style={{ fontSize: 13, color: palette.textMuted }}>Показываемое имя</Text>
        <TextInput value={displayName} onChangeText={setDisplayName} maxLength={40} placeholder="Как вас зовут" placeholderTextColor={palette.textMuted} style={field} />

        <Text style={{ fontSize: 13, color: palette.textMuted, marginTop: 6 }}>Подпись</Text>
        <TextInput value={bio} onChangeText={setBio} maxLength={160} multiline placeholder="Пара слов о себе" placeholderTextColor={palette.textMuted} style={{ ...field, minHeight: 90, textAlignVertical: 'top' }} />
        <Text style={{ fontSize: 12, color: palette.textMuted, textAlign: 'right' }}>{bio.length}/160</Text>

        <Text style={{ fontSize: 13, color: palette.textMuted, marginTop: 6 }}>Имя пользователя</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', ...field }}>
          <Text style={{ fontSize: 15, color: palette.textMuted }}>@</Text>
          <TextInput
            value={username}
            onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9._-]/g, ''))}
            maxLength={24}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="ник"
            placeholderTextColor={palette.textMuted}
            style={{ flex: 1, fontSize: 15, color: palette.text, padding: 0, marginLeft: 2 }}
          />
        </View>

        {error ? <Text style={{ color: palette.down }}>{error}</Text> : null}

        <Pressable onPress={save} disabled={saving} style={{ marginTop: 6, backgroundColor: palette.accent, borderRadius: 999, paddingVertical: 13, alignItems: 'center', opacity: saving ? 0.4 : 1 }}>
          <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 15 }}>{saving ? 'Секунду…' : 'Сохранить'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
