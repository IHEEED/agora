import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', async (_req, res) => {
  const { data, error } = await supabase
    .from('communities')
    .select('*, creator:users(username)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('communities: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }
  res.json(data);
});

router.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  const created_by = req.user!.id;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const { data, error } = await supabase
    .from('communities')
    .insert({ name, description, created_by })
    .select('*, creator:users(username)')
    .single();

  if (error) {
    console.error('communities: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }
  res.status(201).json(data);
});

export default router;
