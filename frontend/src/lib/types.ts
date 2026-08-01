export interface Author {
  username: string;
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
  /** Приходит только в общей ленте — там пост нужно подписать его сообществом. */
  community?: { id: string; name: string } | null;
  /** Пустой массив у постов без опроса. */
  pollOptions: PollOption[];
  myPollVote: string | null;
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
