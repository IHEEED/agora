import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Post, postImages } from '../lib/types';
import { apiFetch } from '../lib/api';
import { useSession } from '../lib/useSession';
import { formatCompactAge } from '../lib/formatDate';
import { Avatar } from './Avatar';
import { AvatarFollow } from './AvatarFollow';
import { VerifiedMark } from './VerifiedMark';
import { VoteBlock } from './VoteBlock';
import { PostMenuSheet } from './PostMenuSheet';
import { ImageViewer } from './ImageViewer';
import { StoryComposer } from './StoryComposer';
import { ShareSheet } from './ShareSheet';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';
import {
  ChevronIcon,
  CommentIcon,
  MoreIcon,
  PinIcon,
  RepostIcon,
  ShareIcon,
  ViewIcon,
} from './icons';
import { usePalette } from '../theme';
import type { RootStackParamList } from '../navigation/types';

/** Просмотры коротко: 1200 → «1,2К». */
function compactViews(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const k = value / 1000;
    return `${k < 10 ? k.toFixed(1).replace('.', ',').replace(',0', '') : Math.round(k)}К`;
  }
  return `${(value / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')}М`;
}

/**
 * Карточка записи — один в один с вебом.
 *
 * Ни рамки, ни фона: пост отделяется от соседа полоской, которую рисует список.
 * Сверху — автор с лицом, ником, галочкой-розеткой и возрастом; заголовок
 * газетной антиквой (на iOS это Georgia, тот же откат, что в вебе); при наличии
 * картинок — прокручиваемая строка; цепочка продолжений внутри начала; внизу —
 * две группы действий: слева голос и обсуждение, справа просмотры, репост и
 * «поделиться». Все значки — те же контуры SVG, что в вебе.
 */
export function PostCard({
  post,
  /**
   * Открывать ли карточку в отдельный экран поста. В ленте — да, весь пост
   * ведёт вглубь и в строке действий есть кнопка комментариев. На самом экране
   * поста — нет: карточка уже открыта, а комментарии идут ниже своим блоком,
   * поэтому кнопку и переход убираем (как linkToDetail в вебе).
   */
  linkToDetail = true,
}: {
  post: Post;
  linkToDetail?: boolean;
}) {
  const palette = usePalette();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { session } = useSession();

  const [reposted, setReposted] = useState(Boolean(post.myRepost));
  const [repostCount, setRepostCount] = useState(post.repostCount ?? 0);
  const [commentCount] = useState(post.commentCount);
  const [menuOpen, setMenuOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [removed, setRemoved] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  // Мягкое появление карточки: проявляется и чуть поднимается при монтировании.
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, [enter]);

  const images = postImages(post);
  const hasChain = (post.chain?.length ?? 0) > 0;
  const isMine = Boolean(post.author.id) && post.author.id === session?.user.id;

  /** Перейти в профиль автора, если у записи известен его id. */
  function openAuthor() {
    if (post.author.id) navigation.navigate('User', { userId: post.author.id });
  }

  if (removed) return null;

  async function handleRepost() {
    const next = !reposted;
    setReposted(next);
    setRepostCount((count) => (next ? count + 1 : count - 1));
    // Один оборот стрелок — репост уносит запись дальше, движение это и
    // показывает. Крутим при любом переключении, и при откате тоже.
    spin.setValue(0);
    Animated.timing(spin, { toValue: 1, duration: 420, useNativeDriver: true }).start();
    try {
      await apiFetch(`/posts/${post.id}/repost`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      setReposted(!next);
      setRepostCount((count) => (next ? count - 1 : count + 1));
    }
  }

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
    <Pressable
      onPress={linkToDetail ? () => navigation.navigate('Post', { postId: post.id }) : undefined}
      style={{
        flexDirection: 'column',
        gap: 8,
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderBottomWidth: linkToDetail ? 1 : 0,
        borderBottomColor: palette.border,
        backgroundColor: palette.bg,
      }}
    >
      {post.pinned_global ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <PinIcon size={14} color={palette.accent} />
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: palette.accent }}>Закреплено</Text>
        </View>
      ) : null}

      {/* Автор: лицо, ник, галочка, возраст. Три точки справа. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        {post.author.id && !isMine ? (
          // Значок подписки на самой аватарке — приём из Threads, как в вебе:
          // видно лицо, имя и маленький плюс/минус на лице.
          <AvatarFollow
            userId={post.author.id}
            username={post.author.username}
            avatar={post.author.avatar_url}
            initiallyFollowing={post.author.isFollowing}
            size={38}
          />
        ) : (
          <Pressable onPress={openAuthor}>
            <Avatar name={post.author.username} uri={post.author.avatar_url} size={38} />
          </Pressable>
        )}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Pressable onPress={openAuthor} style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '600', color: palette.text }}>
              {post.author.username}
            </Text>
          </Pressable>
          <VerifiedMark verified={post.author.verified_at} size={17} />
          <Text style={{ fontSize: 13, color: palette.textMuted }}>
            {formatCompactAge(post.created_at)}
          </Text>
          {post.post_as_community && post.community ? (
            <>
              <ChevronIcon size={14} color={palette.textMuted} />
              <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 14, fontWeight: '600', color: palette.accent }}>
                {post.community.name}
              </Text>
            </>
          ) : null}
        </View>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: -8 }}>
          <MoreIcon size={18} color={palette.control} />
        </Pressable>
      </View>

      <PostMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        postId={post.id}
        isMine={isMine}
        onDeleted={() => setRemoved(true)}
        onStory={() => setStoryOpen(true)}
      />

      {/* Репост записи в свою историю — как в вебе. */}
      <StoryComposer
        draft={storyOpen ? { postId: post.id, title: post.title, body: post.body, image: images[0] ?? null } : null}
        onClose={() => setStoryOpen(false)}
      />

      {/* Поделиться — шторка с мессенджерами и ссылкой, как в вебе. */}
      <ShareSheet open={shareOpen} onClose={() => setShareOpen(false)} url={`${WEB_URL}/posts/${post.id}`} text={post.title} />

      {/* Заголовок антиквой, тело обычной гарнитурой. */}
      <View style={{ gap: 6 }}>
        <Text style={{ fontFamily: palette.displayFamily, fontWeight: '700', fontSize: 16, color: palette.text, lineHeight: 22 }}>
          {post.title}
        </Text>
        {post.body ? (
          <Text style={{ fontSize: 13.5, color: palette.text, lineHeight: 22 }} numberOfLines={8}>
            {post.body}
          </Text>
        ) : null}
      </View>

      {hasChain ? <ChainTail chain={post.chain!} total={post.chain!.length + 1} /> : null}

      {images.length > 0 ? <ImageStrip images={images} /> : null}

      {/* Строка действий: слева голоса и комментарии, справа просмотры, репост,
          поделиться. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -4 }}>
          <VoteBlock id={post.id} score={post.score} myVote={post.myVote} />
          {linkToDetail ? (
            // Комментарии открываются шторкой-модалкой поверх ленты (как в
            // вебе через CommentSheet), а не переходом на отдельный экран: так
            // не теряется место, до которого дочитали.
            <Pressable
              onPress={() => navigation.navigate('Comments', { postId: post.id })}
              hitSlop={4}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10 }}
            >
              <CommentIcon size={22} color={palette.control} />
              <Text style={{ fontSize: 15, color: palette.control }}>{commentCount}</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: -4 }}>
          {post.views > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 10 }}>
              <ViewIcon size={17} color={palette.textMuted} />
              <Text style={{ fontSize: 13, color: palette.textMuted }}>{compactViews(post.views)}</Text>
            </View>
          ) : null}
          <Pressable onPress={handleRepost} hitSlop={4} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 10 }}>
            <Animated.View
              style={{
                transform: [
                  { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                ],
              }}
            >
              <RepostIcon size={22} color={reposted ? palette.repost : palette.control} />
            </Animated.View>
            <Text style={{ fontSize: 15, color: reposted ? palette.repost : palette.control }}>{repostCount}</Text>
          </Pressable>
          <Pressable
            onPress={() => setShareOpen(true)}
            hitSlop={4}
            style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
          >
            <ShareIcon size={22} color={palette.control} />
          </Pressable>
        </View>
      </View>
    </Pressable>
    </Animated.View>
  );
}

/**
 * Прокручиваемая строка снимков — как в вебе. Одно движение — один кадр;
 * счётчик «2/5» и точки внизу показывают, где мы в альбоме.
 */
function ImageStrip({ images }: { images: string[] }) {
  const width = Dimensions.get('window').width - 32;
  const [shown, setShown] = useState(0);
  // Какой кадр открыт во весь экран. −1 — закрыто.
  const [viewing, setViewing] = useState(-1);

  return (
    <View style={{ borderRadius: 16, overflow: 'hidden' }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setShown(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {images.map((src, index) => (
          <Pressable key={`${src}-${index}`} onPress={() => setViewing(index)}>
            <Image source={{ uri: src }} style={{ width, height: 340 }} resizeMode="cover" />
          </Pressable>
        ))}
      </ScrollView>

      <ImageViewer images={images} index={viewing} onClose={() => setViewing(-1)} />

      {images.length > 1 ? (
        <>
          <View style={{ position: 'absolute', right: 12, top: 12, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: 'rgba(0,0,0,0.45)' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: '#fff' }}>{shown + 1}/{images.length}</Text>
          </View>
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 10, flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
            {images.map((src, index) => (
              <View
                key={`dot-${src}-${index}`}
                style={{
                  height: 6,
                  width: index === shown ? 16 : 6,
                  borderRadius: 999,
                  backgroundColor: index === shown ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
                }}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

/**
 * Продолжения записи — «Вслед · N из M». Рисуются внутри начала цепочки, слева
 * волосяная линия принадлежности, как у ветки ответов в комментариях.
 */
function ChainTail({ chain, total }: { chain: Post[]; total: number }) {
  const palette = usePalette();
  return (
    <View style={{ marginTop: 4, paddingLeft: 19, gap: 12, position: 'relative' }}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: -4,
          bottom: 8,
          width: 1.5,
          borderRadius: 999,
          backgroundColor: palette.border,
        }}
      />
      {chain.map((part, index) => (
        <View key={part.id} style={{ gap: 4 }}>
          <Text style={{ fontSize: 11.5, fontWeight: '600', color: palette.textMuted }}>
            Вслед · {index + 2} из {total}
          </Text>
          <Text style={{ fontFamily: palette.displayFamily, fontWeight: '700', fontSize: 15, color: palette.text, lineHeight: 20 }}>
            {part.title}
          </Text>
          {part.body ? (
            <Text style={{ fontSize: 13.5, color: palette.text, lineHeight: 22 }}>{part.body}</Text>
          ) : null}
          {part.image_url ? (
            <Image source={{ uri: part.image_url }} style={{ width: '100%', height: 220, borderRadius: 12, marginTop: 2 }} resizeMode="cover" />
          ) : null}
        </View>
      ))}
    </View>
  );
}
