import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

async function getTargetAuthor(postId?: string, commentId?: string) {
  const table = postId ? 'posts' : 'comments';
  const id = postId ?? commentId;

  const { data, error } = await supabase
    .from(table)
    .select('id, author_id')
    .eq('id', id)
    .single();

  return { data, error };
}

async function adjustKarma(userId: string, delta: number) {
  if (delta === 0) return;

  const { data: user } = await supabase
    .from('users')
    .select('karma')
    .eq('id', userId)
    .single();

  if (!user) return;

  await supabase
    .from('users')
    .update({ karma: user.karma + delta })
    .eq('id', userId);
}

async function findExistingVote(userId: string, postId?: string, commentId?: string) {
  const query = supabase.from('votes').select('*').eq('user_id', userId);
  return postId ? query.eq('post_id', postId).maybeSingle() : query.eq('comment_id', commentId).maybeSingle();
}

router.post('/', requireAuth, async (req, res) => {
  const { post_id, comment_id, value } = req.body;
  const user_id = req.user!.id;

  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: 'value (1 or -1) is required' });
  }
  if ((!post_id && !comment_id) || (post_id && comment_id)) {
    return res.status(400).json({ error: 'provide exactly one of post_id or comment_id' });
  }

  const { data: target, error: targetError } = await getTargetAuthor(post_id, comment_id);
  if (targetError || !target) {
    return res.status(404).json({ error: `${post_id ? 'post' : 'comment'} not found` });
  }

  const { data: existing, error: existingError } = await findExistingVote(user_id, post_id, comment_id);
  if (existingError) return res.status(500).json({ error: existingError.message });

  if (existing) {
    if (existing.value === value) {
      return res.json(existing);
    }

    const { data: updated, error: updateError } = await supabase
      .from('votes')
      .update({ value })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) return res.status(500).json({ error: updateError.message });

    await adjustKarma(target.author_id, value - existing.value);
    return res.json(updated);
  }

  const { data: created, error: insertError } = await supabase
    .from('votes')
    .insert({ user_id, post_id: post_id ?? null, comment_id: comment_id ?? null, value })
    .select()
    .single();

  if (insertError) return res.status(500).json({ error: insertError.message });

  await adjustKarma(target.author_id, value);
  res.status(201).json(created);
});

router.delete('/', requireAuth, async (req, res) => {
  const { post_id, comment_id } = req.body;
  const user_id = req.user!.id;

  if ((!post_id && !comment_id) || (post_id && comment_id)) {
    return res.status(400).json({ error: 'exactly one of post_id or comment_id is required' });
  }

  const { data: existing, error: existingError } = await findExistingVote(user_id, post_id, comment_id);
  if (existingError) return res.status(500).json({ error: existingError.message });
  if (!existing) return res.status(404).json({ error: 'vote not found' });

  const { error: deleteError } = await supabase.from('votes').delete().eq('id', existing.id);
  if (deleteError) return res.status(500).json({ error: deleteError.message });

  const { data: target } = await getTargetAuthor(post_id, comment_id);
  if (target) {
    await adjustKarma(target.author_id, -existing.value);
  }

  res.status(204).send();
});

export default router;
