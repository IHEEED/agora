import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const { title, body, community_id } = req.body;
  const author_id = req.user!.id;

  if (!title || !community_id) {
    return res.status(400).json({ error: 'title and community_id are required' });
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ title, body, author_id, community_id })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.get('/community/:communityId', async (req, res) => {
  const { communityId } = req.params;

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'post not found' });
  res.json(data);
});

export default router;
