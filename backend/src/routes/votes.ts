import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';
import { isBlockedBetween } from '../lib/blocks';
import { optionalUuid } from '../lib/validate';

const router = Router();

const GENERIC_VOTE_ERROR = 'Голос не сохранился — попробуйте ещё раз';

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
  const post_id = optionalUuid(req.body?.post_id, 'Запись') ?? undefined;
  const comment_id = optionalUuid(req.body?.comment_id, 'Комментарий') ?? undefined;
  const value = req.body?.value;
  const user_id = req.user!.id;

  if (value !== 1 && value !== -1) {
    return res.status(400).json({ error: 'Некорректный голос' });
  }
  if ((!post_id && !comment_id) || (post_id && comment_id)) {
    return res.status(400).json({ error: 'Нужна ровно одна цель голоса' });
  }

  const { data: target, error: targetError } = await getTargetAuthor(post_id, comment_id);
  if (targetError || !target) {
    return res.status(404).json({ error: post_id ? 'Такой записи больше нет' : 'Такого комментария больше нет' });
  }

  // Минус через блокировку — тот же разговор, от которого человек закрылся.
  if (target.author_id !== user_id && (await isBlockedBetween(user_id, target.author_id))) {
    return res.status(403).json({ error: 'BLOCKED' });
  }

  const { data: existing, error: existingError } = await findExistingVote(user_id, post_id, comment_id);
  if (existingError) {
    console.error('votes: failed to look up existing vote', existingError);
    return res.status(500).json({ error: GENERIC_VOTE_ERROR });
  }

  if (existing && existing.value === value) {
    return res.json(existing);
  }

  // upsert вместо insert — при переключении голоса (1 -> -1 или обратно)
  // строка уже существует, INSERT упал бы на UNIQUE(user_id, post_id/comment_id).
  // ON CONFLICT атомарно обновляет value, без гонки между SELECT выше и записью.
  const conflictTarget = post_id ? 'user_id,post_id' : 'user_id,comment_id';

  const { data: saved, error: upsertError } = await supabase
    .from('votes')
    .upsert(
      { user_id, post_id: post_id ?? null, comment_id: comment_id ?? null, value },
      { onConflict: conflictTarget }
    )
    .select()
    .single();

  if (upsertError) {
    console.error('votes: failed to save vote', upsertError);
    return res.status(500).json({ error: GENERIC_VOTE_ERROR });
  }

  // Голос за своё засчитывается в счёт записи, но не в карму: карма — это то,
  // что о тебе думают другие. Прогон нашёл, что из 21 голоса в базе 15 были
  // авторскими, и влияние у всех было накручено самими авторами (пересчёт —
  // миграция 030).
  if (target.author_id !== user_id) {
    const delta = existing ? value - existing.value : value;
    await adjustKarma(target.author_id, delta);
  }

  res.status(existing ? 200 : 201).json(saved);
});

router.delete('/', requireAuth, async (req, res) => {
  const post_id = optionalUuid(req.body?.post_id, 'Запись') ?? undefined;
  const comment_id = optionalUuid(req.body?.comment_id, 'Комментарий') ?? undefined;
  const user_id = req.user!.id;

  if ((!post_id && !comment_id) || (post_id && comment_id)) {
    return res.status(400).json({ error: 'Нужна ровно одна цель голоса' });
  }

  const { data: existing, error: existingError } = await findExistingVote(user_id, post_id, comment_id);
  if (existingError) {
    console.error('votes: failed to look up existing vote', existingError);
    return res.status(500).json({ error: GENERIC_VOTE_ERROR });
  }
  if (!existing) return res.status(404).json({ error: 'Голос не нашёлся' });

  const { error: deleteError } = await supabase.from('votes').delete().eq('id', existing.id);
  if (deleteError) {
    console.error('votes: failed to delete vote', deleteError);
    return res.status(500).json({ error: GENERIC_VOTE_ERROR });
  }

  const { data: target } = await getTargetAuthor(post_id, comment_id);
  // Свой голос карму не трогал — значит, и снимать с неё нечего.
  if (target && target.author_id !== user_id) {
    await adjustKarma(target.author_id, -existing.value);
  }

  res.status(204).send();
});

export default router;
