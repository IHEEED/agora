export interface Author {
  /** Нужен, чтобы в ленте показать кнопку «Подписаться» на автора. */
  id?: string;
  username: string;
  /** Адрес аватарки. Пусто — показываем силуэт по умолчанию. */
  avatar_url?: string | null;
  /** Подставляет бэкенд по текущей сессии — чтобы кнопка не мигала плюсом. */
  isFollowing?: boolean;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  creator: Author;
}

export interface PollOption {
  id: string;
  text: string;
  votes: number;
}

/** Человек в результатах поиска — почту наружу бэкенд не отдаёт. */
export interface UserSummary {
  id: string;
  username: string;
  karma: number;
  /** Адрес аватарки. Пусто — показываем силуэт по умолчанию. */
  avatar_url?: string | null;
  /** Подставляет бэкенд по текущей сессии; без неё всегда false. */
  isFollowing?: boolean;
}

/** Одно письмо в переписке. */
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  /** У реплики из одного вложения текста нет. */
  body: string | null;
  created_at: string;
  read_at: string | null;
  /** Когда сообщение поправили. null — не правили. */
  edited_at?: string | null;
  reactions?: { emoji: string; userId: string }[];
  /** На какое сообщение это ответ. Появляется миграцией 009. */
  reply_to_id?: string | null;
  /** Оригинал ответа, собранный сервером из той же переписки. */
  replyTo?: { id: string; body: string | null; mine: boolean } | null;
  /** Когда сообщение закрепили. null — не закреплено. */
  pinned_at?: string | null;
  /** Снимок в реплике. Появляется миграцией 012. */
  image_url?: string | null;
  /** Голосовое. Длительность присылает тот, кто записывал (см. миграцию 012). */
  audio_url?: string | null;
  audio_seconds?: number | null;
}

/** Строка в списке переписок: собеседник и последнее письмо. */
export interface MessageThread {
  user: { id: string; username: string; avatar_url?: string | null };
  unread: number;
  /** Закреплён ли у меня. Настройка личная — собеседник о ней не знает. */
  pinned?: boolean;
  /** Приглушены ли уведомления по этой переписке. Тоже только у меня. */
  muted?: boolean;
  lastMessage: { body: string; created_at: string; mine: boolean };
}

/** Профиль со счётчиками — то, что показывает шапка профиля. */
export interface UserProfile extends UserSummary {
  followers: number;
  following: number;
  created_at?: string;
}

export interface Post {
  id: string;
  /** Какую запись эта продолжает. Появляется миграцией 010. */
  continues_post_id?: string | null;
  /**
   * Записи, написанные вслед за этой, по порядку. Собирает сервер: в ленту
   * попадает только начало цепочки, продолжения показываются внутри него.
   */
  chain?: Post[];
  title: string;
  body: string | null;
  author_id: string;
  community_id: string;
  created_at: string;
  score: number;
  myVote: 1 | -1 | null;
  commentCount: number;
  author: Author;
  views: number;
  image_url: string | null;
  /**
   * Все снимки записи. Появляется миграцией 011; у записей, опубликованных до
   * неё, здесь пусто, а обложка лежит в image_url — поэтому читать надо через
   * postImages(), а не напрямую.
   */
  image_urls?: string[] | null;
  community?: { id: string; name: string } | null;
  /**
   * true — пост подписан сообществом: ник автора, стрелка, название сообщества
   * акцентным цветом. false — только ник. За принадлежность отвечает
   * community_id, он есть всегда; это поле только про подпись.
   */
  post_as_community?: boolean;
  /** Пустой массив у постов без опроса. */
  pollOptions: PollOption[];
  myPollVote: string | null;
  repostCount?: number;
  myRepost?: boolean;
}

export type PostSort = 'hot' | 'new' | 'top' | 'commented';
export type CommentSort = 'best' | 'new';

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_comment_id: string | null;
  body: string;
  created_at: string;
  score: number;
  myVote: 1 | -1 | null;
  replies: Comment[];
  author: Author;
}

/** Комментарий в списке «Мои комментарии»: несёт ссылку на свой пост. */
export interface CommentWithPost extends Comment {
  post: { id: string; title: string } | null;
}

/**
 * Снимки записи в правильном порядке.
 *
 * Двух источников не избежать: image_urls появился миграцией 011, а записи до
 * неё несут только обложку в image_url. Собирать их по месту значило бы
 * повторять эту оговорку в ленте, в профиле, в историях и в просмотрщике — и
 * однажды где-нибудь забыть.
 */
export function postImages(post: Pick<Post, 'image_url' | 'image_urls'>): string[] {
  if (post.image_urls && post.image_urls.length > 0) return post.image_urls;
  return post.image_url ? [post.image_url] : [];
}

/** Одна история. Содержимое уже развёрнуто бэкендом — своё или из записи. */
export type StoryItem = {
  id: string;
  created_at: string;
  seen: boolean;
  title: string | null;
  body: string | null;
  images: string[];
  postId: string | null;
};

/** Истории одного автора: кружок в ленте — это он. */
export type StoryGroup = {
  author: UserSummary;
  items: StoryItem[];
  unseen: number;
};
