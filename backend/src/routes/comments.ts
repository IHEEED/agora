import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const { post_id, parent_comment_id, body } = req.body;
  const author_id = req.user!.id;

  if (!post_id || !body) {
    return res.status(400).json({ error: 'post_id and body are required' });
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id, author_id, parent_comment_id: parent_comment_id ?? null, body })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/post/:postId', async (req, res) => {
  const { postId } = req.params;

  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  type CommentRow = (typeof data)[number];
  type CommentNode = CommentRow & { replies: CommentNode[] };

  const byId = new Map<string, CommentNode>();
  data.forEach((comment) => byId.set(comment.id, { ...comment, replies: [] }));

  const roots: CommentNode[] = [];
  byId.forEach((comment) => {
    const parent = comment.parent_comment_id ? byId.get(comment.parent_comment_id) : undefined;
    if (parent) {
      parent.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  res.json(roots);
});

export default router;
