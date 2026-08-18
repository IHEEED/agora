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

/**
 * Общая доводка списка постов: голоса, комментарии, опросы, репосты и отметка
 * «я подписан на автора».
 *
 * Раньше каждый обработчик собирал это у себя, и списки разъехались: репосты
 * считались, но в ответ не попадали, а кнопка подписки в ленте всегда рисовала
 * плюс — даже у тех, на кого уже подписан.
 */
async function enrichPosts<T extends { id: string; author?: { id?: string | null } | null }>(
  posts: T[],
  userId?: string
) {
  const ids = posts.map((post) => post.id);
  const [{ scores, myVotes }, commentCounts, { polls, myPollVotes }, repostInfo, following] =
    await Promise.all([
      getVoteInfoByPostId(ids, userId),
      getCommentCountByPostId(ids),
      getPollsByPostId(ids, userId),
      getRepostInfoByPostId(ids, userId),
      followingSet(userId),
    ]);

  return posts.map((post) => ({
    ...post,
    author: post.author
      ? { ...post.author, isFollowing: following.has(String(post.author.id)) }
      : post.author,
    score: scores.get(post.id) ?? 0,
    myVote: myVotes.get(post.id) ?? null,
    commentCount: commentCounts.get(post.id) ?? 0,
    pollOptions: polls.get(post.id) ?? [],
    myPollVote: myPollVotes.get(post.id) ?? null,
    repostCount: repostInfo.counts.get(post.id) ?? 0,
    myRepost: repostInfo.mine.has(post.id),
  }));
}

/**
 * Собирает цепочки «вслед» и оставляет в списке только их начала.
 *
 * Продолжение — не отдельная запись в ленте, а часть той, за которой оно
 * написано: показать их как соседей значило бы разорвать одну мысль на куски и
 * разложить их по разным местам, между чужими постами.
 *
 * Цепочка идёт по ссылкам от начала: у каждой записи ровно одно продолжение
 * (за этим следит триггер в базе), поэтому обход линеен и не может закольцеваться
 * — но счётчик шагов всё равно ставим. Испорченные данные не должны вешать
 * сервер, а ссылка на предка технически возможна, пока её не запретили
 * ограничением.
 *
 * Записи, чьё начало не попало в выборку, остаются в списке сами по себе:
 * иначе продолжение, начало которого старше сотни последних постов, исчезло бы
 * из ленты вовсе.
 */
function foldChains<T extends { id: string; continues_post_id?: string | null }>(posts: T[]) {
  const byParent = new Map<string, T>();
  const present = new Set(posts.map((post) => post.id));

  for (const post of posts) {
    if (post.continues_post_id) byParent.set(post.continues_post_id, post);
  }

  const heads = posts.filter(
    (post) => !post.continues_post_id || !present.has(post.continues_post_id)
  );

  return heads.map((head) => {
    const chain: T[] = [];
    let cursor = byParent.get(head.id);
    let guard = 0;

    while (cursor && guard < 20) {
      chain.push(cursor);
      cursor = byParent.get(cursor.id);
      guard += 1;
    }

    return { ...head, chain };
  });
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

/**
 * Сколько репостов у каждого поста и есть ли среди них мой. Таблицы может ещё
 * не быть (миграция 006) — тогда возвращаем пустое, а не роняем всю ленту.
 */
async function getRepostInfoByPostId(postIds: string[], userId?: string) {
  const counts = new Map<string, number>();
  const mine = new Set<string>();
  if (postIds.length === 0) return { counts, mine };

  const { data, error } = await supabase
    .from('reposts')
    .select('post_id, user_id')
    .in('post_id', postIds);

  if (error || !data) return { counts, mine };

  data.forEach(({ post_id, user_id }) => {
    counts.set(post_id, (counts.get(post_id) ?? 0) + 1);
    if (userId && user_id === userId) mine.add(post_id);
  });

  return { counts, mine };
}

/** На кого подписан этот человек — чтобы кнопка у автора знала своё состояние. */
async function followingSet(userId?: string): Promise<Set<string>> {
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (error) return new Set();
  return new Set(data.map((row) => row.following_id as string));
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
  const {
    title,
    body,
    community_id,
    image_url,
    image_urls,
    poll_options,
    post_as_community,
    continues_post_id,
  } = req.body;
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
      // Колонку подставляем только когда снимков правда несколько. Она
      // появляется миграцией 011, и упоминать её в каждой вставке значило бы
      // сломать публикацию у всех, кто её ещё не выполнил: PostgREST отвергает
      // запрос с неизвестной колонкой целиком, даже со значением null. Тот же
      // приём, что и с continues_post_id ниже.
      ...(Array.isArray(image_urls) && image_urls.length > 1
        ? { image_urls: image_urls.filter((url: unknown) => typeof url === 'string') }
        : null),
      author_id,
      community_id: community,
      // Флаг отвечает только за подпись поста, не за принадлежность:
      // сообщество у записи есть в любом случае.
      post_as_community: Boolean(post_as_community),
      // Поле подставляем только когда пишут вслед. Колонка появляется
      // миграцией 010, и упоминать её в каждой вставке значило бы сломать
      // публикацию у всех, кто её не выполнил: PostgREST отвергает запрос с
      // неизвестной колонкой целиком, даже если значение в ней null.
      ...(continues_post_id ? { continues_post_id: String(continues_post_id) } : null),
    })
    .select('*, author:users!posts_author_id_fkey(id, username), community:communities(id, name)')
    .single();

  if (error) {
    console.error('posts: request failed', error);
    // Триггер posts_chain_guard (миграция 010) отвергает попытку продолжить
    // чужую запись или дописать вслед второй раз, и говорит об этом словами.
    // Пересказывать их своими значило бы потерять причину отказа.
    if (error.code === 'P0001') {
      return res.status(400).json({ error: error.message });
    }
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

router.post('/:id/repost', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('reposts')
    .upsert({ post_id: req.params.id, user_id: req.user!.id }, { onConflict: 'user_id,post_id' });

  if (error) {
    console.error('posts: repost failed', error);
    return res.status(500).json({ error: 'Не удалось сделать репост' });
  }

  res.status(204).send();
});

router.delete('/:id/repost', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('reposts')
    .delete()
    .eq('post_id', req.params.id)
    .eq('user_id', req.user!.id);

  if (error) {
    console.error('posts: repost removal failed', error);
    return res.status(500).json({ error: 'Не удалось убрать репост' });
  }

  res.status(204).send();
});

// Репосты конкретного человека — вкладка «Репосты» в профиле.
router.get('/reposts/:userId', optionalAuth, async (req, res) => {
  const { data: rows, error } = await supabase
    .from('reposts')
    .select('post_id, created_at')
    .eq('user_id', req.params.userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('posts: reposts read failed', error);
    return res.json([]);
  }

  const ids = rows.map((row) => row.post_id);
  if (ids.length === 0) return res.json([]);

  const { data } = await supabase
    .from('posts')
    .select('*, author:users!posts_author_id_fkey(id, username), community:communities(id, name)')
    .in('id', ids);

  if (!data) return res.json([]);

  res.json(await enrichPosts(data, req.user?.id));
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
    .select('*, author:users!posts_author_id_fkey(id, username), community:communities(id, name)')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  // Цепочки сворачиваем после обогащения: продолжения тоже должны нести свои
  // голоса и счётчики — они полноценные записи, просто показанные внутри
  // начала.
  res.json(foldChains(sortPosts(await enrichPosts(data, req.user?.id), sort)));
});

router.get('/community/:communityId', optionalAuth, async (req, res) => {
  const { communityId } = req.params;
  const sort = parsePostSort(req.query.sort);

  const { data, error } = await supabase
    .from('posts')
    .select('*, author:users!posts_author_id_fkey(id, username), community:communities(id, name)')
    .eq('community_id', communityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  res.json(foldChains(sortPosts(await enrichPosts(data, req.user?.id), sort)));
});

// Лента конкретного автора — используется на странице профиля.
// Объявлена до '/:id', иначе 'user' будет принят за идентификатор поста.
router.get('/user/:userId', optionalAuth, async (req, res) => {
  const { userId } = req.params;
  const sort = parsePostSort(req.query.sort);

  const { data, error } = await supabase
    .from('posts')
    .select('*, author:users!posts_author_id_fkey(id, username), community:communities(id, name)')
    .eq('author_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('posts: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  res.json(foldChains(sortPosts(await enrichPosts(data, req.user?.id), sort)));
});

router.get('/:id', optionalAuth, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('posts')
    .select('*, author:users!posts_author_id_fkey(id, username), community:communities(id, name)')
    .eq('id', id)
    .single();

  if (error) return res.status(404).json({ error: 'post not found' });

  // Тем же путём, что и списки: страница поста показывает те же счётчики,
  // и собирать их здесь по-своему — верный способ снова разойтись.
  const [post] = await enrichPosts([data], req.user?.id);
  res.json(post);
});

/**
 * Удаление своей записи.
 *
 * Право проверяем здесь, а не полагаемся на политики: запросы идут сервисным
 * ключом, который RLS не касается, — без этой проверки удалить можно было бы
 * что угодно чужое.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase.from('posts').select('author_id').eq('id', id).single();

  if (error || !data) return res.status(404).json({ error: 'Запись не найдена' });
  if (data.author_id !== req.user!.id) {
    return res.status(403).json({ error: 'Удалить можно только свою запись' });
  }

  const { error: deleteError } = await supabase.from('posts').delete().eq('id', id);

  if (deleteError) {
    console.error('posts: delete failed', deleteError);
    return res.status(500).json({ error: 'Не удалось удалить запись' });
  }

  res.status(204).send();
});

export default router;
