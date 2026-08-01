import { Router } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

// Поиск людей по имени пользователя — вкладка «Люди» в поиске.
// Почту наружу не отдаём: она не должна утекать по открытому поиску.
router.get('/', async (req, res) => {
  const query = String(req.query.q ?? '').trim();

  let request = supabase.from('users').select('id, username, karma').order('karma', { ascending: false }).limit(30);

  if (query) {
    request = request.ilike('username', `%${query}%`);
  }

  const { data, error } = await request;

  if (error) {
    console.error('users: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  res.json(data);
});

export default router;
