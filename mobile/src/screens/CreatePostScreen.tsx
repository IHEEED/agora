import { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { Community, Post } from '../lib/types';
import { Avatar } from '../components/Avatar';
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
  const { session } = useSession();
  const preset = route.params.communityId;

  const [step, setStep] = useState<'community' | 'compose'>(preset ? 'compose' : 'community');
  const [target, setTarget] = useState<Target | null>(preset ? { kind: 'community', id: preset, name: '' } : null);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (preset) return;
    apiFetch<Community[]>('/communities').then(setCommunities).catch(() => {});
  }, [preset]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: step === 'community' ? 'Куда опубликовать?' : 'Новый пост' });
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
      await apiFetch<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || body.trim().split('\n')[0].slice(0, 300),
          body: (title.trim() ? body : body.split('\n').slice(1).join('\n')).trim() || null,
          community_id: target?.kind === 'community' ? target.id : null,
        }),
      });
      navigation.goBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать');
    } finally {
      setSubmitting(false);
    }
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
            <Text style={{ fontSize: 15, fontWeight: '600', color: palette.text }}>От своего имени</Text>
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
              placeholder="Поиск"
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
      {/* Куда уходит запись — строкой сверху, можно сменить назад. */}
      {!preset ? (
        <Pressable onPress={() => setStep('community')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start' }}>
          <Avatar name={target?.kind === 'community' ? target.name || '?' : emailHandle} size={30} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>
            {target?.kind === 'community' ? target.name : 'От своего имени'}
          </Text>
          <Text style={{ fontSize: 13, color: palette.accent }}>сменить</Text>
        </Pressable>
      ) : null}

      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Заголовок"
        placeholderTextColor={palette.textMuted}
        style={{ fontFamily: 'Georgia', fontSize: 21, lineHeight: 27, color: palette.text, paddingVertical: 4 }}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder="Что у вас на уме?"
        placeholderTextColor={palette.textMuted}
        multiline
        style={{ fontSize: 16, lineHeight: 23, color: palette.text, minHeight: 160, textAlignVertical: 'top' }}
      />

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
          {submitting ? 'Секунду…' : 'Опубликовать'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
