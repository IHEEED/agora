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
