export interface Author {
  /** Нужен, чтобы в ленте показать кнопку «Подписаться» на автора. */
  id?: string;
  username: string;
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
  /** Подставляет бэкенд по текущей сессии; без неё всегда false. */
  isFollowing?: boolean;
}

/** Одно письмо в переписке. */
export interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  /** Когда сообщение поправили. null — не правили. */
  edited_at?: string | null;
  reactions?: { emoji: string; userId: string }[];
}

/** Строка в списке переписок: собеседник и последнее письмо. */
export interface MessageThread {
  user: { id: string; username: string };
  unread: number;
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
