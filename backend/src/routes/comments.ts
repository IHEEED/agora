import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

type CommentSort = 'best' | 'new';

function parseCommentSort(value: unknown): CommentSort {
  return value === 'new' ? value : 'best';
}

async function getVoteInfoByCommentId(commentIds: string[], userId?: string) {
  const scores = new Map<string, number>();
  const myVotes = new Map<string, 1 | -1>();
  if (commentIds.length === 0) return { scores, myVotes };

  const { data: votes, error } = await supabase
    .from('votes')
    .select('comment_id, value, user_id')
    .in('comment_id', commentIds);

  if (error || !votes) return { scores, myVotes };

  votes.forEach(({ comment_id, value, user_id }) => {
    if (!comment_id) return;
    scores.set(comment_id, (scores.get(comment_id) ?? 0) + value);
    if (userId && user_id === userId) {
      myVotes.set(comment_id, value);
    }
  });

  return { scores, myVotes };
}

router.post('/', requireAuth, async (req, res) => {
  const { post_id, parent_comment_id, body } = req.body;
  const author_id = req.user!.id;

  if (!post_id || !body) {
    return res.status(400).json({ error: 'post_id and body are required' });
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id, author_id, parent_comment_id: parent_comment_id ?? null, body })
    .select('*, author:users(username)')
    .single();

  if (error) {
    console.error('comments: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }
  res.status(201).json(data);
});

router.get('/post/:postId', optionalAuth, async (req, res) => {
  const { postId } = req.params;
  const sort = parseCommentSort(req.query.sort);

  const { data, error } = await supabase
    .from('comments')
    .select('*, author:users(username)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('comments: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  const { scores, myVotes } = await getVoteInfoByCommentId(
    data.map((comment) => comment.id),
    req.user?.id
  );

  type CommentRow = (typeof data)[number];
  type CommentNode = CommentRow & { score: number; myVote: 1 | -1 | null; replies: CommentNode[] };

  const byId = new Map<string, CommentNode>();
  data.forEach((comment) =>
    byId.set(comment.id, {
      ...comment,
      score: scores.get(comment.id) ?? 0,
      myVote: myVotes.get(comment.id) ?? null,
      replies: [],
    })
  );

  const roots: CommentNode[] = [];
  byId.forEach((comment) => {
    const parent = comment.parent_comment_id ? byId.get(comment.parent_comment_id) : undefined;
    if (parent) {
      parent.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  function sortTree(nodes: CommentNode[]): CommentNode[] {
    const sorted = [...nodes].sort((a, b) =>
      sort === 'new'
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : b.score - a.score
    );
    sorted.forEach((node) => {
      node.replies = sortTree(node.replies);
    });
    return sorted;
  }

  res.json(sortTree(roots));
});

export default router;
