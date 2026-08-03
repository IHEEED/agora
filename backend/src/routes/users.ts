import { Router } from 'express';
import { supabase } from '../config/supabase';
import { optionalAuth, requireAuth } from '../middleware/auth';

const router = Router();

/** На кого подписан этот человек. Пустой набор, если он не залогинен. */
async function followingIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (error) {
    console.error('users: following lookup failed', error);
    return new Set();
  }

  return new Set(data.map((row) => row.following_id as string));
}

/**
 * Кого предложить в друзья: люди с наибольшим influence, на которых человек
 * ещё не подписан и которые не он сам. Настоящих рекомендаций (по общим
 * подпискам и сообществам) пока нет — до них нужен граф связей.
 */
router.get('/suggestions', optionalAuth, async (req, res) => {
  const me = req.user?.id;

  const { data, error } = await supabase
    .from('users')
    .select('id, username, karma')
    .order('karma', { ascending: false })
    .limit(30);

  if (error) {
    console.error('users: suggestions failed', error);
    return res.status(500).json({ error: 'Не удалось загрузить рекомендации' });
  }

  const following = await followingIds(me);
  const suggestions = data
    .filter((user) => user.id !== me && !following.has(user.id))
    .slice(0, 10);

  res.json(suggestions);
});

/**
 * Как часто можно менять имя. Четырнадцать дней — компромисс: опечатку в нике
 * исправить успеваешь, а быстро перебирать чужие освободившиеся имена уже нет.
 * Столько же держит Instagram; у Telegram ограничения нет вовсе, и там ником
 * регулярно пользуются для выдачи себя за другого.
 */
const USERNAME_COOLDOWN_DAYS = 14;

router.patch('/me/username', requireAuth, async (req, res) => {
  const username = String(req.body?.username ?? '').trim();

  if (!/^[a-zA-Z0-9._-]{3,24}$/.test(username)) {
    return res.status(400).json({
      error: 'Имя может состоять из 3–24 латинских букв, цифр, точки, дефиса и подчёркивания',
    });
  }

  const { data: me, error: readError } = await supabase
    .from('users')
    .select('username, username_changed_at')
    .eq('id', req.user!.id)
    .single();

  if (readError || !me) {
    console.error('users: username read failed', readError);
    return res.status(500).json({ error: 'Не удалось прочитать профиль' });
  }

  if (me.username === username) {
    return res.status(204).send();
  }

  if (me.username_changed_at) {
    const elapsedDays =
      (Date.now() - new Date(me.username_changed_at).getTime()) / (1000 * 60 * 60 * 24);
    if (elapsedDays < USERNAME_COOLDOWN_DAYS) {
      const left = Math.ceil(USERNAME_COOLDOWN_DAYS - elapsedDays);
      return res.status(429).json({
        error: `Имя можно менять раз в ${USERNAME_COOLDOWN_DAYS} дней. Попробуйте через ${left} дн.`,
      });
    }
  }

  const { error } = await supabase
    .from('users')
    .update({ username, username_changed_at: new Date().toISOString() })
    .eq('id', req.user!.id);

  if (error) {
    // 23505 — нарушение уникальности: ник уже занят кем-то другим.
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Это имя уже занято' });
    }
    console.error('users: username update failed', error);
    return res.status(500).json({ error: 'Не удалось изменить имя' });
  }

  res.status(204).send();
});

router.post('/:id/follow', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (id === req.user!.id) {
    return res.status(400).json({ error: 'Нельзя подписаться на себя' });
  }

  const { error } = await supabase
    .from('follows')
    .upsert({ follower_id: req.user!.id, following_id: id }, { onConflict: 'follower_id,following_id' });

  if (error) {
    console.error('users: follow failed', error);
    return res.status(500).json({ error: 'Не удалось подписаться' });
  }

  res.status(204).send();
});

router.delete('/:id/follow', requireAuth, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', req.user!.id)
    .eq('following_id', id);

  if (error) {
    console.error('users: unfollow failed', error);
    return res.status(500).json({ error: 'Не удалось отписаться' });
  }

  res.status(204).send();
});

// Поиск людей по имени пользователя — вкладка «Люди» в поиске.
// Почту наружу не отдаём: она не должна утекать по открытому поиску.
router.get('/', optionalAuth, async (req, res) => {
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

  // Кнопка «Подписаться» должна сразу знать своё состояние, иначе она мигает
  // с «подписаться» на «вы подписаны» через кадр после загрузки списка.
  const following = await followingIds(req.user?.id);
  res.json(data.map((user) => ({ ...user, isFollowing: following.has(user.id) })));
});

export default router;
