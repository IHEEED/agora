import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requirePhoneVerified, optionalAuth } from '../middleware/auth';

const router = Router();

type PostSort = 'hot' | 'new' | 'top' | 'commented';

function parsePostSort(value: unknown): PostSort {
  return value === 'new' || value === 'top' || value === 'commented' ? value : 'hot';
}

// затухание по времени в духе Reddit: чем больше голосов, тем медленнее
// пост "тонет", но возраст в часах всегда постепенно перевешивает
function hotScore(score: number, createdAt: string): number {
  const order = Math.log10(Math.max(Math.abs(score), 1));
  const sign = score > 0 ? 1 : score < 0 ? -1 : 0;
  const ageHours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  return sign * order - ageHours / 12.5;
}

function sortPosts<T extends { created_at: string; score: number; commentCount: number }>(
  posts: T[],
  sort: PostSort
): T[] {
  const sorted = [...posts];

  switch (sort) {
    case 'new':
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      break;
    case 'top':
      sorted.sort((a, b) => b.score - a.score);
      break;
    case 'commented':
      sorted.sort((a, b) => b.commentCount - a.commentCount);
      break;
    case 'hot':
    default:
      sorted.sort((a, b) => hotScore(b.score, b.created_at) - hotScore(a.score, a.created_at));
      break;
  }

  return sorted;
}

async function getVoteInfoByPostId(postIds: string[], userId?: string) {
  const scores = new Map<string, number>();
  const myVotes = new Map<string, 1 | -1>();
  if (postIds.length === 0) return { scores, myVotes };

  const { data: votes, error } = await supabase
    .from('votes')
    .select('post_id, value, user_id')
    .in('post_id', postIds);

  if (error || !votes) return { scores, myVotes };

  votes.forEach(({ post_id, value, user_id }) => {
    if (!post_id) return;
    scores.set(post_id, (scores.get(post_id) ?? 0) + value);
    if (userId && user_id === userId) {
      myVotes.set(post_id, value);
    }
  });

  return { scores, myVotes };
}

async function getCommentCountByPostId(postIds: string[]) {
  const counts = new Map<string, number>();
  if (postIds.length === 0) return counts;

  const { data: comments, error } = await supabase.from('comments').select('post_id').in('post_id', postIds);

  if (error || !comments) return counts;

  comments.forEach(({ post_id }) => {
    counts.set(post_id, (counts.get(post_id) ?? 0) + 1);
  });

  return counts;
}

/**
 * Варианты опроса вместе с числом голосов и отметкой собственного выбора.
 * Посты без опроса получают пустой массив — фронт по нему и понимает,
 * что опрос рисовать не нужно.
 */
async function getPollsByPostId(postIds: string[], userId?: string) {
  const polls = new Map<string, { id: string; text: string; votes: number }[]>();
  const myPollVotes = new Map<string, string>();
  if (postIds.length === 0) return { polls, myPollVotes };

  const [{ data: options }, { data: votes }] = await Promise.all([
    supabase.from('poll_options').select('id, post_id, text, position').in('post_id', postIds),
    supabase.from('poll_votes').select('option_id, post_id, user_id').in('post_id', postIds),
  ]);

  if (!options) return { polls, myPollVotes };

  const votesByOption = new Map<string, number>();
  votes?.forEach(({ option_id, post_id, user_id }) => {
    votesByOption.set(option_id, (votesByOption.get(option_id) ?? 0) + 1);
    if (userId && user_id === userId) myPollVotes.set(post_id, option_id);
  });

  [...options]
    .sort((a, b) => a.position - b.position)
    .forEach(({ id, post_id, text }) => {
      const list = polls.get(post_id) ?? [];
      list.push({ id, text, votes: votesByOption.get(id) ?? 0 });
      polls.set(post_id, list);
    });

  return { polls, myPollVotes };
}

router.post('/', requireAuth, requirePhoneVerified, async (req, res) => {
  const { title, body, community_id, image_url, poll_options, post_as_community } = req.body;
  const author_id = req.user!.id;

  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  // community_id теперь необязателен: без него пост личный, от имени автора.
  // Подписать сообществом пост, который в нём не лежит, нельзя.
  const community = community_id || null;
  if (!community && post_as_community) {
    return res.status(400).json({ error: 'Личный пост нельзя подписать сообществом' });
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      title,
      body,
      image_url: image_url || null,
      author_id,
      community_id: community,
      // Флаг отвечает только за подпись поста, не за принадлежность:
      // сообщество у записи есть в любом случае.
      post_as_community: Boolean(post_as_community),
    })
    .select('*, author:users(id, username), community:communities(id, name)')
    .single();

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  // Опрос необязателен: пустые строки отбрасываем, меньше двух вариантов —
  // это уже не опрос, поэтому пост просто остаётся обычным.
  const options: string[] = Array.isArray(poll_options)
    ? poll_options.map((text: unknown) => String(text ?? '').trim()).filter(Boolean).slice(0, 6)
    : [];

  if (options.length >= 2) {
    const { error: pollError } = await supabase.from('poll_options').insert(
      options.map((text, position) => ({ post_id: data.id, text, position }))
    );
    if (pollError) {
      console.error('posts: failed to save poll', pollError);
    }
  }

  res.status(201).json(data);
});

// Голос в опросе. Отдельный от апвоутов: там оценка поста, здесь выбор варианта.
router.post('/:id/poll-vote', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { option_id } = req.body;
  const user_id = req.user!.id;

  if (!option_id) {
    return res.status(400).json({ error: 'option_id is required' });
  }

  // upsert по паре (user_id, post_id) — повторный выбор меняет голос,
  // а не добавляет второй.
  const { error } = await supabase
    .from('poll_votes')
    .upsert({ post_id: id, option_id, user_id }, { onConflict: 'user_id,post_id' });

  if (error) {
    console.error('posts: poll vote failed', error);
    return res.status(500).json({ error: 'Не удалось учесть голос' });
  }

  res.status(204).send();
});

// Снятие голоса в опросе — повторный клик по своему варианту.
router.delete('/:id/poll-vote', requireAuth, async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('poll_votes')
    .delete()
    .eq('post_id', id)
    .eq('user_id', req.user!.id);

  if (error) {
    console.error('posts: poll vote removal failed', error);
    return res.status(500).json({ error: 'Не удалось убрать голос' });
  }

  res.status(204).send();
});

router.post('/:id/view', async (req, res) => {
  const { id } = req.params;

  const { data: post, error: fetchError } = await supabase.from('posts').select('views').eq('id', id).single();

  if (fetchError || !post) {
    return res.status(404).json({ error: 'post not found' });
  }

  const { error: updateError } = await supabase
    .from('posts')
    .update({ views: post.views + 1 })
    .eq('id', id);

  if (updateError) {
    console.error('posts: failed to record view', updateError);
    return res.status(500).json({ error: 'Не удалось учесть просмотр' });
  }

  res.status(204).send();
});

// Общая лента — посты из всех сообществ. Это главный экран приложения.
router.get('/', optionalAuth, async (req, res) => {
  const sort = parsePostSort(req.query.sort);

  const { data, error } = await supabase
    .from('posts')
    .select('*, author:users(id, username), community:communities(id, name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  const postIds = data.map((post) => post.id);
  const [{ scores, myVotes }, commentCounts, { polls, myPollVotes }] = await Promise.all([
    getVoteInfoByPostId(postIds, req.user?.id),
    getCommentCountByPostId(postIds),
    getPollsByPostId(postIds, req.user?.id),
  ]);

  const enriched = data.map((post) => ({
    ...post,
    score: scores.get(post.id) ?? 0,
    myVote: myVotes.get(post.id) ?? null,
    commentCount: commentCounts.get(post.id) ?? 0,
    pollOptions: polls.get(post.id) ?? [],
    myPollVote: myPollVotes.get(post.id) ?? null,
  }));

  res.json(sortPosts(enriched, sort));
});

router.get('/community/:communityId', optionalAuth, async (req, res) => {
  const { communityId } = req.params;
  const sort = parsePostSort(req.query.sort);

  const { data, error } = await supabase
    .from('posts')
    .select('*, author:users(id, username), community:communities(id, name)')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  const postIds = data.map((post) => post.id);
  const [{ scores, myVotes }, commentCounts, { polls, myPollVotes }] = await Promise.all([
    getVoteInfoByPostId(postIds, req.user?.id),
    getCommentCountByPostId(postIds),
    getPollsByPostId(postIds, req.user?.id),
  ]);

  const enriched = data.map((post) => ({
    ...post,
    score: scores.get(post.id) ?? 0,
    myVote: myVotes.get(post.id) ?? null,
    commentCount: commentCounts.get(post.id) ?? 0,
    pollOptions: polls.get(post.id) ?? [],
    myPollVote: myPollVotes.get(post.id) ?? null,
  }));

  res.json(sortPosts(enriched, sort));
});

// Лента конкретного автора — используется на странице профиля.
// Объявлена до '/:id', иначе 'user' будет принят за идентификатор поста.
router.get('/user/:userId', optionalAuth, async (req, res) => {
  const { userId } = req.params;
  const sort = parsePostSort(req.query.sort);

  const { data, error } = await supabase
    .from('posts')
    .select('*, author:users(id, username), community:communities(id, name)')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  const postIds = data.map((post) => post.id);
  const [{ scores, myVotes }, commentCounts, { polls, myPollVotes }] = await Promise.all([
    getVoteInfoByPostId(postIds, req.user?.id),
    getCommentCountByPostId(postIds),
    getPollsByPostId(postIds, req.user?.id),
  ]);

  const enriched = data.map((post) => ({
    ...post,
    score: scores.get(post.id) ?? 0,
    myVote: myVotes.get(post.id) ?? null,
    commentCount: commentCounts.get(post.id) ?? 0,
    pollOptions: polls.get(post.id) ?? [],
    myPollVote: myPollVotes.get(post.id) ?? null,
  }));

  res.json(sortPosts(enriched, sort));
});

router.get('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('posts')
    .select('*, author:users(id, username), community:communities(id, name)')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'post not found' });

  const [{ scores, myVotes }, commentCounts, { polls, myPollVotes }] = await Promise.all([
    getVoteInfoByPostId([data.id], req.user?.id),
    getCommentCountByPostId([data.id]),
    getPollsByPostId([data.id], req.user?.id),
  ]);

  res.json({
    ...data,
    score: scores.get(data.id) ?? 0,
    myVote: myVotes.get(data.id) ?? null,
    commentCount: commentCounts.get(data.id) ?? 0,
    pollOptions: polls.get(data.id) ?? [],
    myPollVote: myPollVotes.get(data.id) ?? null,
  });
});

export default router;
