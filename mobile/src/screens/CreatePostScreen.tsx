import { useEffect, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { uploadImage } from '../lib/uploadImage';
import { useSession } from '../lib/useSession';
import { Community, Post } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { useT } from '../lib/i18n';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CreatePost'>;

/** Куда уходит запись: от своего имени или в конкретный клуб. */
type Target = { kind: 'personal' } | { kind: 'community'; id: string; name: string };

/**
 * Новая запись — в два шага, как в вебе.
 *
 * Сначала «Куда опубликовать?»: от своего имени (пост живёт в профиле и ленте
 * подписчиков, community_id уходит null) или в клуб. Пришли со страницы клуба —
 * шаг выбора пропускаем. Потом сочинение: заголовок газетной антиквой и текст.
 */
export function CreatePostScreen({ navigation, route }: Props) {
  const palette = usePalette();
  const { t } = useT();
  const { session } = useSession();
  const preset = route.params?.communityId;
  // Пришли по «Написать вслед» — запись продолжает указанную; выбор клуба тогда
  // не нужен, продолжение живёт там же, где начало (как в вебе).
  const after = route.params?.after;

  const [step, setStep] = useState<'community' | 'compose'>(preset || after ? 'compose' : 'community');
  const [target, setTarget] = useState<Target | null>(preset ? { kind: 'community', id: preset, name: '' } : null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [poll, setPoll] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (preset) return;
    apiFetch<Community[]>('/communities').then(setCommunities).catch(() => {});
  }, [preset]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: step === 'community' ? t('Куда опубликовать?') : t('Новый пост') });
  }, [navigation, step]);

  function choose(next: Target) {
    setTarget(next);
    setStep('compose');
  }

  async function handleCreate() {
    if (!title.trim() && !body.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const pollOptions = poll ? poll.map((o) => o.trim()).filter(Boolean) : [];
      await apiFetch<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || body.trim().split('\n')[0].slice(0, 300),
          body: (title.trim() ? body : body.split('\n').slice(1).join('\n')).trim() || null,
          community_id: target?.kind === 'community' ? target.id : null,
          image_url: images[0] ?? null,
          image_urls: images,
          poll_options: pollOptions,
          post_as_community: target?.kind === 'community',
          continues_post_id: after ?? null,
        }),
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать');
    } finally {
      setSubmitting(false);
    }
  }

  async function pickImages(fromCamera = false) {
    const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError('Нет доступа — разрешите в настройках телефона.'); return; }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true, allowsMultipleSelection: true, selectionLimit: 4 });
    if (result.canceled) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(
        result.assets.filter((a) => a.base64).map((a) => uploadImage(a.base64!, a.mimeType ?? 'image/jpeg', 'posts'))
      );
      setImages((prev) => [...prev, ...urls].slice(0, 4));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить картинку');
    } finally {
      setUploading(false);
    }
  }

  function togglePoll() {
    setPoll((prev) => (prev ? null : ['', '']));
  }

  const emailHandle = session?.user.email?.split('@')[0] ?? '?';

  if (step === 'community') {
    const normalized = query.trim().toLowerCase();
    const visible = normalized
      ? communities.filter((c) => c.name.toLowerCase().includes(normalized) || c.description?.toLowerCase().includes(normalized))
      : communities;

    return (
      <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={{ fontSize: 14, color: palette.textMuted }}>Можно написать от себя или опубликовать в клубе.</Text>

        {/* От своего имени — полноправный выбор, поэтому первым. */}
        <Pressable
          onPress={() => choose({ kind: 'personal' })}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, backgroundColor: palette.surface }}
        >
          <Avatar name={emailHandle} size={48} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{t('От своего имени')}</Text>
            <Text style={{ fontSize: 13, color: palette.textMuted }}>Запись появится в вашем профиле и в ленте подписчиков</Text>
          </View>
        </Pressable>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
          <Text style={{ fontSize: 12.5, color: palette.textMuted }}>или в клубе</Text>
          <View style={{ flex: 1, height: 1, backgroundColor: palette.border }} />
        </View>

        <Text style={{ fontSize: 12.5, lineHeight: 18, color: palette.textMuted }}>
          Писать можно в любой клуб, где это разрешено его создателями. Быть админом для этого не нужно.
        </Text>

        {communities.length > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1, borderBottomColor: palette.border, paddingBottom: 8 }}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx="11" cy="11" r="6.5" />
              <Path d="m20 20-4.3-4.3" />
            </Svg>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('Поиск')}
              placeholderTextColor={palette.textMuted}
              style={{ flex: 1, fontSize: 15, color: palette.text, paddingVertical: 2 }}
            />
          </View>
        ) : null}

        {communities.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, padding: 16, backgroundColor: palette.surface }}>
            <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 18, color: palette.textMuted }}>
              Клубов пока нет, а запись всегда живёт в одном из них.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {visible.map((community) => (
              <Pressable
                key={community.id}
                onPress={() => choose({ kind: 'community', id: community.id, name: community.name })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 16, padding: 16, backgroundColor: palette.surface }}
              >
                <Avatar name={community.name} size={48} kind="community" />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>{community.name}</Text>
                  {community.description ? (
                    <Text numberOfLines={2} style={{ fontSize: 13, lineHeight: 17, color: palette.textMuted }}>{community.description}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
            {visible.length === 0 ? (
              <Text style={{ textAlign: 'center', paddingVertical: 24, color: palette.textMuted }}>Ничего не нашлось.</Text>
            ) : null}
          </View>
        )}
      </ScrollView>
    );
  }

  // Шаг сочинения.
  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
      {/* Пишем вслед — запись уйдёт под ту, которую продолжает (как в вебе). */}
      {after ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: `${palette.accent}1f` }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.accent} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M6 4v10a3 3 0 0 0 3 3h9" />
            <Path d="m14 13 4 4-4 4" />
          </Svg>
          <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 19, color: palette.text }}>
            Запись уйдёт <Text style={{ fontWeight: '700', color: palette.accent }}>вслед</Text> за предыдущей и появится под ней.
          </Text>
        </View>
      ) : null}

      {/* Куда уходит запись — строкой сверху, можно сменить назад. */}
      {!preset && !after ? (
        <Pressable onPress={() => setStep('community')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>
          <Avatar name={target?.kind === 'community' ? target.name || '?' : emailHandle} size={30} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>
            {target?.kind === 'community' ? target.name : t('От своего имени')}
          </Text>
          <Text style={{ fontSize: 13, color: palette.accent }}>{t('сменить')}</Text>
        </Pressable>
      ) : null}

      {target?.kind === 'community' ? (
        <Text style={{ fontSize: 12.5, color: palette.textMuted }}>
          {t('Вы пишете от имени клуба')} <Text style={{ color: palette.accent, fontWeight: '600' }}>{target.name || t('клуб')}</Text>
        </Text>
      ) : null}

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t('Заголовок')}
        placeholderTextColor={palette.textMuted}
        style={{ fontFamily: palette.displayFamily, fontSize: 21, lineHeight: 27, color: palette.text, paddingVertical: 4 }}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={t('Что у вас на уме?')}
        placeholderTextColor={palette.textMuted}
        multiline
        style={{ fontSize: 16, lineHeight: 23, color: palette.text, minHeight: 140, textAlignVertical: 'top' }}
      />

      {/* Превью прикреплённых картинок. */}
      {images.length > 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {images.map((uri) => (
            <View key={uri}>
              <Image source={{ uri }} style={{ width: 84, height: 84, borderRadius: 12 }} />
              <Pressable onPress={() => setImages((prev) => prev.filter((u) => u !== uri))} hitSlop={6} style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round"><Path d="M6 6l12 12M18 6 6 18" /></Svg>
              </Pressable>
            </View>
          ))}
          {uploading ? <View style={{ width: 84, height: 84, borderRadius: 12, backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={palette.accent} /></View> : null}
        </View>
      ) : null}

      {/* Опрос: варианты 2–6. */}
      {poll ? (
        <View style={{ gap: 8, borderRadius: 14, backgroundColor: palette.surface2, padding: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>Опрос</Text>
            <Pressable onPress={togglePoll}><Text style={{ fontSize: 13, color: palette.accent }}>Убрать</Text></Pressable>
          </View>
          {poll.map((option, index) => (
            <View key={index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                value={option}
                onChangeText={(v) => setPoll((prev) => prev!.map((o, i) => (i === index ? v : o)))}
                placeholder={`Вариант ${index + 1}`}
                placeholderTextColor={palette.textMuted}
                style={{ flex: 1, borderWidth: 1, borderColor: palette.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, color: palette.text, backgroundColor: palette.bg }}
              />
              {poll.length > 2 ? (
                <Pressable onPress={() => setPoll((prev) => prev!.filter((_, i) => i !== index))} hitSlop={6}>
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={2.2} strokeLinecap="round"><Path d="M6 6l12 12M18 6 6 18" /></Svg>
                </Pressable>
              ) : null}
            </View>
          ))}
          {poll.length < 6 ? (
            <Pressable onPress={() => setPoll((prev) => [...prev!, ''])}><Text style={{ fontSize: 13.5, color: palette.accent }}>+ Добавить вариант</Text></Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Панель вложений: картинка, камера, опрос. */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable onPress={() => pickImages(false)} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" /><Path d="m4 16 4.5-4.5 3 3L16 10l4 4" /><Circle cx="8" cy="9.5" r="1.4" fill={palette.textMuted} />
          </Svg>
        </Pressable>
        <Pressable onPress={() => pickImages(true)} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: palette.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><Circle cx="12" cy="13" r="3.2" />
          </Svg>
        </Pressable>
        <Pressable onPress={togglePoll} style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: poll ? `${palette.accent}22` : palette.surface2, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={poll ? palette.accent : palette.textMuted} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M7 20V10M12 20V4M17 20v-6" />
          </Svg>
        </Pressable>
      </View>

      {error ? <Text style={{ color: palette.down }}>{error}</Text> : null}

      <Pressable
        onPress={handleCreate}
        disabled={submitting || (!title.trim() && !body.trim())}
        style={{
          alignSelf: 'flex-start',
          backgroundColor: palette.accent,
          borderRadius: 999,
          paddingHorizontal: 22,
          paddingVertical: 12,
          opacity: submitting || (!title.trim() && !body.trim()) ? 0.4 : 1,
        }}
      >
        <Text style={{ color: palette.accentContrast, fontWeight: '600', fontSize: 15 }}>
          {submitting ? t('Секунду…') : t('Опубликовать')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
