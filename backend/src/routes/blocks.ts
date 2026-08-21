import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Блокировки.
 *
 * До этого чёрный список жил в localStorage браузера: заблокированный не знал,
 * что заблокирован, продолжал писать, и прятался он только у того, кто
 * блокировал, и только в этом браузере. Здесь он переезжает туда, где может
 * работать по-настоящему — то есть мешать писать, а не только читать.
 */

/** Кого я заблокировал. Только свой список: чужой — не моё дело. */
router.get('/', requireAuth, async (req, res) => {
  const me = req.user!.id;

  const { data, error } = await supabase
    .from('blocks')
    .select('blocked_id, created_at, blocked:users!blocks_blocked_id_fkey (id, username)')
    .eq('blocker_id', me)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('blocks: list failed', error);
    return res.status(500).json({ error: 'Не удалось загрузить список' });
  }

  res.json(data);
});

router.post('/:userId', requireAuth, async (req, res) => {
  const me = req.user!.id;
  const target = req.params.userId;

  if (target === me) {
    return res.status(400).json({ error: 'Нельзя заблокировать себя' });
  }

  const { error } = await supabase
    .from('blocks')
    .upsert({ blocker_id: me, blocked_id: target }, { onConflict: 'blocker_id,blocked_id' });

  if (error) {
    // 23503 — нет такого пользователя. Это не сбой сервера, а промах клиента.
    if (error.code === '23503') {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    console.error('blocks: create failed', error);
    return res.status(500).json({ error: 'Не удалось заблокировать' });
  }

  // Подписки в обе стороны рвёт триггер в базе, а не этот код: забыть его здесь
  // было бы легко, а расхождение осталось бы навсегда.
  res.status(201).json({ ok: true });
});

router.delete('/:userId', requireAuth, async (req, res) => {
  const me = req.user!.id;

  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', me)
    .eq('blocked_id', req.params.userId);

  if (error) {
    console.error('blocks: delete failed', error);
    return res.status(500).json({ error: 'Не удалось разблокировать' });
  }

  // Подписки назад не возвращаются: разблокировать — это перестать прятать, а
  // не восстановить отношения, которых человек лишил сам.
  res.json({ ok: true });
});

export default router;
