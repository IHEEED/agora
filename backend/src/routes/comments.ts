import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireNotBanned, requirePhoneVerified, optionalAuth } from '../middleware/auth';
import { isBlockedBetween } from '../lib/blocks';
import { requireUuidParams } from '../lib/uuid';
import { LIMITS, optionalUuid, requiredText, requiredUuid } from '../lib/validate';
import { limitComments } from '../middleware/rateLimit';
import { userEmbed } from '../config/schema';

/**
 * Строка комментария в выдаче.
 *
 * Нужна с тех пор, как список полей строится на ходу (см. config/schema):
 * библиотека выводит тип из литерала, а здесь шаблон. Перечислены только те
 * поля, которые читает сборка дерева; остальное приезжает звёздочкой и уходит
 * в ответ как есть.
 */
type CommentRow = {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  created_at: string;
  author?: { id?: string | null; username?: string; avatar_url?: string | null; verified_at?: string | null } | null;
  [key: string]: unknown;
};

const router = Router();
requireUuidParams(router, 'id', 'userId', 'postId');

/**
 * Удалённый комментарий, на который успели ответить, — пустое место в ветке.
 *
 * Ни текста, ни автора наружу: удалить — значит перестать быть автором
 * сказанного. А место остаётся ради ответов, иначе они повисли бы без того,
 * на что отвечали. Маскируем на сервере, а не в интерфейсе: скрытое только
 * разметкой читается из ответа API любым, кто откроет вкладку «Сеть».
 */
function masked(comment: CommentRow): CommentRow {
  if (!comment.deleted_at) return comment;
  return {
    ...comment,
    body: '',
    author_id: null,
    author: { id: null, username: '', avatar_url: null, verified_at: null },
  };
}

/** Колонок из миграции 030 ещё нет. */
function columnMissing(error: { code?: string; message?: string }): boolean {
  return error.code === '42703' || error.code === 'PGRST204' || /deleted_at|edited_at/.test(error.message ?? '');
}

type CommentSort = 'best' | 'new';

function parseCommentSort(value: unknown): CommentSort {
  return value === 'new' ? value : 'best';
}

async function getVoteInfoByCommentId(commentIds: string[], userId?: string) {
  const scores = new Map<string, number>();
  const myVotes = new Map<string, 1 | -1>();
  if (commentIds.length === 0) return { scores, myVotes };

  const { data: votes, error } = await supabase
    .from('votes')
    .select('comment_id, value, user_id')
    .in('comment_id', commentIds);

  if (error || !votes) return { scores, myVotes };

  votes.forEach(({ comment_id, value, user_id }) => {
    if (!comment_id) return;
    scores.set(comment_id, (scores.get(comment_id) ?? 0) + value);
    if (userId && user_id === userId) {
      myVotes.set(comment_id, value);
    }
  });

  return { scores, myVotes };
}

// Плоский список комментариев автора — для вкладки «Мои комментарии».
// Объявлен до остальных путей с параметром, чтобы 'user' не был принят за id.
router.get('/user/:userId', optionalAuth, async (req, res) => {
  const { userId } = req.params;

  const { data, error } = await supabase
    .from('comments')
    .select(`*, ${userEmbed('author')}, post:posts(id, title)`)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .returns<CommentRow[]>();

  if (error) {
    console.error('comments: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  const { scores, myVotes } = await getVoteInfoByCommentId(
    data.map((comment) => comment.id),
    req.user?.id
  );

  res.json(
    // Во вкладке «Комментарии» профиля удалённым не место: там нет ветки, ради
    // которой стоило бы держать пустое место.
    data.filter((comment) => !comment.deleted_at).map((comment) => ({
      ...comment,
      score: scores.get(comment.id) ?? 0,
      myVote: myVotes.get(comment.id) ?? null,
      replies: [],
    }))
  );
});

router.post('/', requireAuth, requireNotBanned, requirePhoneVerified, limitComments, async (req, res) => {
  const post_id = requiredUuid(req.body?.post_id, 'Запись');
  const parent_comment_id = optionalUuid(req.body?.parent_comment_id, 'Ответ');
  const body = requiredText(req.body?.body, LIMITS.comment, 'Комментарий');
  const author_id = req.user!.id;

  const { data: post } = await supabase.from('posts').select('author_id').eq('id', post_id).maybeSingle();
  if (!post) return res.status(404).json({ error: 'Такой записи больше нет' });

  let parentAuthor: string | null = null;
  if (parent_comment_id) {
    const { data: parent } = await supabase
      .from('comments')
      .select('post_id, author_id')
      .eq('id', parent_comment_id)
      .maybeSingle();
    // Ответ живёт в той же записи, что и то, на что отвечают. Иначе в дереве
    // одной записи он висел бы без родителя, а в другой — без себя.
    if (!parent || parent.post_id !== post_id) {
      return res.status(400).json({ error: 'Отвечать можно только на комментарий этой записи' });
    }
    parentAuthor = parent.author_id;
  }

  // Блокировка — стена в обе стороны (lib/blocks): ни под записью того, кто
  // закрылся, ни в ответ ему. Отказ один на оба направления, чтобы не
  // сообщать, кто кого заблокировал.
  for (const other of [post.author_id, parentAuthor]) {
    if (other && other !== author_id && (await isBlockedBetween(author_id, other))) {
      return res.status(403).json({ error: 'BLOCKED' });
    }
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id, author_id, parent_comment_id: parent_comment_id ?? null, body })
    .select(`*, ${userEmbed('author')}`)
    .single<CommentRow>();

  if (error) {
    console.error('comments: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }
  res.status(201).json(data);
});

router.get('/post/:postId', optionalAuth, async (req, res) => {
  const { postId } = req.params;
  const sort = parseCommentSort(req.query.sort);

  const { data, error } = await supabase
    .from('comments')
    .select(`*, ${userEmbed('author')}`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .returns<CommentRow[]>();

  if (error) {
    console.error('comments: request failed', error);
    return res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
  }

  const { scores, myVotes } = await getVoteInfoByCommentId(
    data.map((comment) => comment.id),
    req.user?.id
  );

  type CommentNode = CommentRow & { score: number; myVote: 1 | -1 | null; replies: CommentNode[] };

  const byId = new Map<string, CommentNode>();
  data.forEach((comment) =>
    byId.set(comment.id, {
      ...masked(comment),
      score: scores.get(comment.id) ?? 0,
      myVote: myVotes.get(comment.id) ?? null,
      replies: [],
    })
  );

  const roots: CommentNode[] = [];
  byId.forEach((comment) => {
    const parent = comment.parent_comment_id ? byId.get(comment.parent_comment_id) : undefined;
    if (parent) {
      parent.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  function sortTree(nodes: CommentNode[]): CommentNode[] {
    const sorted = [...nodes].sort((a, b) =>
      sort === 'new'
        ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        : b.score - a.score
    );
    sorted.forEach((node) => {
      node.replies = sortTree(node.replies);
    });
    return sorted;
  }

  res.json(sortTree(roots));
});

/**
 * Удалить свой комментарий.
 *
 * Без ответов — удаляем совсем. С ответами так нельзя: связь в базе каскадная,
 * и вместе со своим комментарием человек стёр бы чужие ответы на него. Такой
 * комментарий остаётся пустым местом в ветке (см. masked).
 *
 * Чужой и несуществующий отвечают одинаково — 404: удалить нечего, и знать,
 * существует ли чужой комментарий с этим id, спрашивающему незачем.
 */
router.delete('/:id', requireAuth, async (req, res) => {
  const me = req.user!.id;

  const { data: comment } = await supabase
    .from('comments')
    .select('id, author_id')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!comment || comment.author_id !== me) {
    return res.status(404).json({ error: 'Такого комментария больше нет' });
  }

  const { count, error: countError } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('parent_comment_id', comment.id);
  if (countError) {
    console.error('comments: reply count failed', countError);
    return res.status(500).json({ error: 'Комментарий не удалился — попробуйте ещё раз' });
  }

  if (!count) {
    const { error } = await supabase.from('comments').delete().eq('id', comment.id);
    if (error) {
      console.error('comments: delete failed', error);
      return res.status(500).json({ error: 'Комментарий не удалился — попробуйте ещё раз' });
    }
    return res.status(204).send();
  }

  const { error } = await supabase
    .from('comments')
    .update({ body: '', deleted_at: new Date().toISOString() })
    .eq('id', comment.id);
  if (error) {
    if (columnMissing(error)) {
      return res.status(503).json({ error: 'Комментарий с ответами пока нельзя удалить' });
    }
    console.error('comments: soft delete failed', error);
    return res.status(500).json({ error: 'Комментарий не удалился — попробуйте ещё раз' });
  }

  res.status(204).send();
});

/**
 * Исправить свой комментарий.
 *
 * С пометкой «изменено»: на комментарий могли уже ответить, и ответ на слова,
 * которых больше нет, без пометки выглядит ответом невпопад. Удалённый не
 * правится — возвращать текст на пустое место значит отменять удаление в обход.
 */
router.patch('/:id', requireAuth, requireNotBanned, limitComments, async (req, res) => {
  const body = requiredText(req.body?.body, LIMITS.comment, 'Комментарий');

  const { data, error } = await supabase
    .from('comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .eq('author_id', req.user!.id)
    .is('deleted_at', null)
    .select('id, body, edited_at');

  if (error) {
    if (columnMissing(error)) {
      return res.status(503).json({ error: 'Правка комментариев пока недоступна' });
    }
    console.error('comments: edit failed', error);
    return res.status(500).json({ error: 'Правка не сохранилась — попробуйте ещё раз' });
  }
  if (!data.length) return res.status(404).json({ error: 'Такого комментария больше нет' });

  res.json(data[0]);
});

export default router;
