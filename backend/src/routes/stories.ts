import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, optionalAuth } from '../middleware/auth';

const router = Router();

/**
 * Истории.
 *
 * До этой таблицы кружки наверху ленты показывали последние записи автора —
 * заглушка, которая врала: история и запись живут по разным правилам. Запись
 * остаётся навсегда и обсуждается; история исчезает через сутки, и обсуждать
 * её негде. Выдать одно за другое, не сломав ожидания от обоих, нельзя.
 *
 * Историей можно сделать свою запись — тогда содержимое берётся из неё по
 * ссылке, а не копией: правка записи должна быть видна и в истории, а удаление
 * — уносить историю с собой.
 */

/**
 * Пока миграция 011 не выполнена, таблицы нет. Postgres отвечает 42P01,
 * PostgREST — своим PGRST205 «нет в кеше схемы». Ни то ни другое не повод
 * ронять ленту: истории не обязательная часть экрана, и без них он работает.
 */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    /stories/i.test(error.message ?? '') && /does not exist|schema cache/i.test(error.message ?? '')
  );
}

type StoryRow = {
  id: string;
  author_id: string;
  post_id: string | null;
  body: string | null;
  image_url: string | null;
  created_at: string;
  expires_at: string;
  author: { id: string; username: string } | null;
  post: {
    id: string;
    title: string;
    body: string | null;
    image_url: string | null;
    image_urls: string[] | null;
  } | null;
};

const SELECT =
  '*, author:users!stories_author_id_fkey(id, username, avatar_url), post:posts(id, title, body, image_url, image_urls)';

/**
 * Активные истории, сгруппированные по авторам.
 *
 * Группируем здесь, а не на клиенте: порядок авторов должен быть один и тот же
 * у всех экранов, а решается он по времени самой свежей истории — на клиенте
 * это пришлось бы повторять в каждом месте, где кружки показывают.
 */
router.get('/', optionalAuth, async (req, res) => {
  const viewer = req.user?.id ?? null;

  const { data, error } = await supabase
    .from('stories')
    .select(SELECT)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return res.json([]);
    console.error('stories: request failed', error);
    return res.status(500).json({ error: error.message });
  }

  const rows = (data ?? []) as unknown as StoryRow[];

  // Что из этого зритель уже видел. Одним запросом на все истории разом:
  // спрашивать по одной значило бы столько запросов, сколько кружков.
  const seen = new Set<string>();
  if (viewer && rows.length > 0) {
    const { data: views } = await supabase
      .from('story_views')
      .select('story_id')
      .eq('viewer_id', viewer)
      .in(
        'story_id',
        rows.map((row) => row.id)
      );
    for (const view of views ?? []) seen.add(view.story_id as string);
  }

  const byAuthor = new Map<
    string,
    { author: { id: string; username: string }; items: unknown[]; unseen: number }
  >();

  for (const row of rows) {
    const author = row.author ?? { id: row.author_id, username: '' };
    const group = byAuthor.get(author.id) ?? { author, items: [], unseen: 0 };
    group.items.push({
      id: row.id,
      created_at: row.created_at,
      seen: seen.has(row.id),
      // Содержимое: своё либо взятое из записи. Разворачиваем здесь, чтобы
      // клиент не знал про две формы одной и той же истории.
      title: row.post?.title ?? null,
      body: row.body ?? row.post?.body ?? null,
      images: row.image_url
        ? [row.image_url]
        : (row.post?.image_urls ?? (row.post?.image_url ? [row.post.image_url] : [])),
      postId: row.post_id,
    });
    if (!seen.has(row.id)) group.unseen += 1;
    byAuthor.set(author.id, group);
  }

  // Непросмотренные вперёд: кружок с новым — единственная причина сюда
  // смотреть, и заставлять искать его среди погасших незачем.
  const groups = [...byAuthor.values()].sort((a, b) => {
    if (Boolean(a.unseen) !== Boolean(b.unseen)) return a.unseen ? -1 : 1;
    return 0;
  });

  res.json(groups);
});

/** Своя история: из записи или собственным содержимым. */
router.post('/', requireAuth, async (req, res) => {
  const { post_id, body, image_url } = req.body ?? {};
  const author_id = req.user!.id;

  if (!post_id && !body && !image_url) {
    return res.status(400).json({ error: 'Историю не из чего собрать' });
  }

  // Репостить в историю можно только свою запись. Чужая в кружке под твоим
  // именем — это уже не «показать своё», а присвоить.
  if (post_id) {
    const { data: post } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', post_id)
      .single();
    if (!post) return res.status(404).json({ error: 'Запись не найдена' });
    if (post.author_id !== author_id) {
      return res.status(403).json({ error: 'В историю можно отправить только свою запись' });
    }
  }

  const { data, error } = await supabase
    .from('stories')
    .insert({
      author_id,
      post_id: post_id ?? null,
      body: body ?? null,
      image_url: image_url ?? null,
    })
    .select(SELECT)
    .single();

  if (error) {
    if (isMissingTable(error)) {
      return res.status(503).json({ error: 'Истории ещё не включены: нужна миграция 011' });
    }
    console.error('stories: create failed', error);
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data);
});

/** Отметить просмотренной. Повторный вызов не ошибка — гасим конфликт. */
router.post('/:id/seen', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('story_views')
    .upsert(
      { story_id: req.params.id, viewer_id: req.user!.id },
      { onConflict: 'story_id,viewer_id', ignoreDuplicates: true }
    );

  if (error && !isMissingTable(error)) {
    console.error('stories: seen failed', error);
    return res.status(500).json({ error: error.message });
  }
  res.status(204).end();
});

/** Убрать свою историю раньше срока. */
router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', req.params.id)
    .eq('author_id', req.user!.id);

  if (error) {
    console.error('stories: delete failed', error);
    return res.status(500).json({ error: error.message });
  }
  res.status(204).end();
});

export default router;
