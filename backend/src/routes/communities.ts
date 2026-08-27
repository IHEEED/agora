import { Router } from 'express';
import { supabase } from '../config/supabase';
import { optionalAuth, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', optionalAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('communities')
    .select(
      // Имя связи обязательно.
      //
      // С миграции 023 между клубом и людьми две дороги: создатель
      // (communities.created_by) и участники (community_members). PostgREST
      // отказывается выбирать сам и роняет запрос целиком — ошибка PGRST201, а
      // на экране «не удалось выполнить запрос». Причём сломалось это не в тот
      // день, когда писали этот запрос, а в тот, когда завели подписку на клуб:
      // добавленная связь ломает существующую выборку, ничего о ней не зная.
      '*, creator:users!communities_created_by_fkey(username)'
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('communities: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  res.json(await withMembership(data, req.user?.id));
});

/**
 * Дописать к клубам число подписчиков и признак «я подписан».
 *
 * Двумя запросами на весь список, а не по запросу на клуб: клубов на экране
 * десяток, и тридцать походов в базу ради двух чисел — ровно то, из-за чего
 * лента когда-то открывалась семь секунд.
 *
 * Пока миграция 023 не выполнена, таблицы нет. Клубы от этого не должны
 * пропадать с экрана: отдаём их без счётчиков.
 */
async function withMembership<T extends { id: string }>(
  communities: T[],
  userId: string | undefined
) {
  const ids = communities.map((community) => community.id);
  if (ids.length === 0) return communities;

  const [all, mine] = await Promise.all([
    supabase.from('community_members').select('community_id').in('community_id', ids),
    userId
      ? supabase
          .from('community_members')
          .select('community_id')
          .eq('user_id', userId)
          .in('community_id', ids)
      : Promise.resolve({ data: [] as { community_id: string }[], error: null }),
  ]);

  if (all.error) return communities;

  const counts = new Map<string, number>();
  for (const row of all.data ?? []) {
    counts.set(row.community_id, (counts.get(row.community_id) ?? 0) + 1);
  }

  const joined = new Set((mine.data ?? []).map((row) => row.community_id));

  return communities.map((community) => ({
    ...community,
    members: counts.get(community.id) ?? 0,
    isMember: joined.has(community.id),
  }));
}

router.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  const created_by = req.user!.id;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const { data, error } = await supabase
    .from('communities')
    .insert({ name, description, created_by })
    .select(
      // Имя связи обязательно.
      //
      // С миграции 023 между клубом и людьми две дороги: создатель
      // (communities.created_by) и участники (community_members). PostgREST
      // отказывается выбирать сам и роняет запрос целиком — ошибка PGRST201, а
      // на экране «не удалось выполнить запрос». Причём сломалось это не в тот
      // день, когда писали этот запрос, а в тот, когда завели подписку на клуб:
      // добавленная связь ломает существующую выборку, ничего о ней не зная.
      '*, creator:users!communities_created_by_fkey(username)'
    )
    .single();

  if (error) {
    console.error('communities: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }
  res.status(201).json(data);
});

/**
 * Вступить в клуб и выйти.
 *
 * Подписок на клубы не было вовсе: человек заходил, читал и уходил, а вернуться
 * мог только вспомнив название. При том что подписка на людей есть с четвёртой
 * миграции — половина сети умела запоминать, половина нет.
 */
router.post('/:id/join', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('community_members')
    // upsert, а не insert: повторное нажатие по уже нажатой кнопке — это
    // рассинхрон интерфейса с сервером, а не ошибка человека.
    .upsert(
      { community_id: req.params.id, user_id: req.user!.id },
      { onConflict: 'community_id,user_id' }
    );

  if (error) {
    if (error.code === '23503') return res.status(404).json({ error: 'Клуб не найден' });
    console.error('communities: join failed', error);
    return res.status(500).json({ error: 'Не удалось вступить' });
  }

  res.status(201).json({ ok: true });
});

router.delete('/:id/join', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('community_members')
    .delete()
    .eq('community_id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) {
    console.error('communities: leave failed', error);
    return res.status(500).json({ error: 'Не удалось выйти' });
  }

  res.json({ ok: true });
});

export default router;
