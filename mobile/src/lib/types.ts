export type BadgeType = 'verified' | 'developer';

export interface Author {
  id?: string;
  username: string;
  /** Показываемое имя, если задано. */
  display_name?: string | null;
  /** Адрес лица. Пусто — рисуем кружок с буквой. */
  avatar_url?: string | null;
  /** Дата подтверждения подлинности. Пусто — галочки нет. */
  verified_at?: string | null;
  /** Подписан ли я на автора — для кнопки в ленте. */
  isFollowing?: boolean;
  /** Старое поле, бэкенд его больше не шлёт; оставлено для совместимости. */
  badge?: BadgeType | null;
}

export interface Community {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  creator: Author;
  badge: BadgeType | null;
  isSubscribed: boolean | null;
  subscriberCount: number;
}

export interface Post {
  id: string;
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
  /** Показывать первой в ленте у всех (миграция 023). */
  pinned_global?: boolean;
  community?: { id: string; name: string } | null;
  /** Обложка (до миграции 011) и список картинок (после). Читать через postImages(). */
  image_url?: string | null;
  image_urls?: string[] | null;
  /** Запись опубликована от имени сообщества — стрелка и название акцентом. */
  post_as_community?: boolean;
  /** Продолжения записи («Вслед · N из M»), рисуются внутри начала цепочки. */
  chain?: Post[];
  /** Репосты: сколько всего и репостнул ли я. */
  repostCount?: number;
  myRepost?: boolean;
}

/** Картинки записи из двух источников: image_urls (после 011) или обложка image_url. */
export function postImages(post: Pick<Post, 'image_url' | 'image_urls'>): string[] {
  if (post.image_urls && post.image_urls.length > 0) return post.image_urls;
  return post.image_url ? [post.image_url] : [];
}

export type PostSort = 'hot' | 'new' | 'top' | 'commented' | 'viewed';
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

/**
 * Собеседник в списке переписок и в самой переписке.
 *
 * Форма ровно та, что отдаёт бэкенд (routes/messages.ts): ник, лицо и, если
 * человек подтверждён, дата галочки. display_name — показываемое имя, если
 * задано.
 */
export interface ChatUser {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  verified_at?: string | null;
}

/** Одна строка в списке переписок. */
export interface Thread {
  user: ChatUser;
  unread: number;
  pinned: boolean;
  muted: boolean;
  lastMessage: {
    body: string;
    created_at: string;
    mine: boolean;
  };
}

/** Комментарий вместе с записью, под которой оставлен — для вкладки профиля. */
export interface CommentWithPost extends Comment {
  post: { id: string; title: string } | null;
}

/** Профиль человека — то, что отдаёт /users/:id. */
export interface UserProfile {
  id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  verified_at?: string | null;
  bio?: string | null;
  karma: number;
  followers: number;
  following: number;
  /** Подписан ли я на этого человека — для кнопки на чужом профиле. */
  isFollowing?: boolean;
}

/** Одно письмо внутри переписки. */
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  image_url?: string | null;
  created_at: string;
  read_at?: string | null;
  edited_at?: string | null;
  forwardedFrom?: { id: string; username: string } | null;
}
