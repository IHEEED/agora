import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, optionalAuth } from '../middleware/auth';

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

router.post('/', requireAuth, async (req, res) => {
  const { title, body, community_id } = req.body;
  const author_id = req.user!.id;

  if (!title || !community_id) {
    return res.status(400).json({ error: 'title and community_id are required' });
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ title, body, author_id, community_id })
    .select('*, author:users(username)')
    .single();

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }
  res.status(201).json(data);
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

router.get('/community/:communityId', optionalAuth, async (req, res) => {
  const { communityId } = req.params;
  const sort = parsePostSort(req.query.sort);

  const { data, error } = await supabase
    .from('posts')
    .select('*, author:users(username)')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  const postIds = data.map((post) => post.id);
  const [{ scores, myVotes }, commentCounts] = await Promise.all([
    getVoteInfoByPostId(postIds, req.user?.id),
    getCommentCountByPostId(postIds),
  ]);

  const enriched = data.map((post) => ({
    ...post,
    score: scores.get(post.id) ?? 0,
    myVote: myVotes.get(post.id) ?? null,
    commentCount: commentCounts.get(post.id) ?? 0,
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
    .select('*, author:users(username)')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  const postIds = data.map((post) => post.id);
  const [{ scores, myVotes }, commentCounts] = await Promise.all([
    getVoteInfoByPostId(postIds, req.user?.id),
    getCommentCountByPostId(postIds),
  ]);

  const enriched = data.map((post) => ({
    ...post,
    score: scores.get(post.id) ?? 0,
    myVote: myVotes.get(post.id) ?? null,
    commentCount: commentCounts.get(post.id) ?? 0,
  }));

  res.json(sortPosts(enriched, sort));
});

router.get('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('posts')
    .select('*, author:users(username)')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'post not found' });

  const [{ scores, myVotes }, commentCounts] = await Promise.all([
    getVoteInfoByPostId([data.id], req.user?.id),
    getCommentCountByPostId([data.id]),
  ]);

  res.json({
    ...data,
    score: scores.get(data.id) ?? 0,
    myVote: myVotes.get(data.id) ?? null,
    commentCount: commentCounts.get(data.id) ?? 0,
  });
});

export default router;
