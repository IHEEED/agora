import { Router } from 'express';
import { supabase } from '../config/supabase';
import { invalidateUserState, requireAuth, requireModerator } from '../middleware/auth';

const router = Router();

/**
 * Разбор жалоб.
 *
 * Весь раздел закрыт requireModerator, и проверка эта серверная: спрятать пункт
 * меню в интерфейсе — не защита, адрес всё равно известен любому, кто открыл
 * вкладку «Сеть» в браузере.
 *
 * Отвечает раздел 404, а не 403: тому, кто постучался наугад, незачем узнавать,
 * что он постучался в правильную дверь.
 */
router.use(requireAuth, requireModerator);

/** Сколько жалоб отдавать за раз. Очередь листается, а не грузится целиком. */
const PAGE = 30;

/**
 * Кого и что показать модератору.
 *
 * Жалоба сама по себе — четыре идентификатора и слово «спам»; решать по ней
 * ничего нельзя. Поэтому к каждой цели подтягивается содержимое и автор, и
 * делается это пачками по типам, а не запросом на строку: тридцать жалоб иначе
 * превратились бы в тридцать походов в базу.
 */
type Enriched = Record<string, unknown>;

async function enrich(reports: Enriched[]): Promise<Enriched[]> {
  const ids = (key: string) =>
    [...new Set(reports.map((r) => r[key]).filter(Boolean))] as string[];

  const postIds = ids('post_id');
  const commentIds = ids('comment_id');
  const messageIds = ids('message_id');
  const userIds = ids('target_user_id');

  const [posts, comments, messages, users] = await Promise.all([
    postIds.length
      ? supabase.from('posts').select('id, title, body, author_id').in('id', postIds)
      : Promise.resolve({ data: [] as Enriched[] }),
    commentIds.length
      ? supabase.from('comments').select('id, body, author_id').in('id', commentIds)
      : Promise.resolve({ data: [] as Enriched[] }),
    messageIds.length
      ? supabase.from('messages').select('id, body, sender_id').in('id', messageIds)
      : Promise.resolve({ data: [] as Enriched[] }),
    userIds.length
      ? supabase.from('users').select('id, username').in('id', userIds)
      : Promise.resolve({ data: [] as Enriched[] }),
  ]);

  const byId = (rows: Enriched[] | null) =>
    new Map((rows ?? []).map((row) => [row.id as string, row]));

  const postMap = byId(posts.data);
  const commentMap = byId(comments.data);
  const messageMap = byId(messages.data);
  const userMap = byId(users.data);

  // Имена всех, кто попал под жалобу, — включая авторов записей и сообщений:
  // модератор банит человека, а не строку в таблице.
  const authorIds = [
    ...new Set(
      [
        ...[...postMap.values()].map((p) => p.author_id),
        ...[...commentMap.values()].map((c) => c.author_id),
        ...[...messageMap.values()].map((m) => m.sender_id),
      ].filter(Boolean) as string[]
    ),
  ];

  const authorMap = authorIds.length
    ? byId(
        (
          await supabase
            .from('users')
            .select('id, username, banned_until')
            .in('id', authorIds)
        ).data
      )
    : new Map();

  return reports.map((report) => {
    const post = report.post_id ? postMap.get(report.post_id as string) : undefined;
    const comment = report.comment_id ? commentMap.get(report.comment_id as string) : undefined;
    const message = report.message_id ? messageMap.get(report.message_id as string) : undefined;
    const user = report.target_user_id ? userMap.get(report.target_user_id as string) : undefined;

    const authorId =
      (post?.author_id as string) ??
      (comment?.author_id as string) ??
      (message?.sender_id as string) ??
      (report.target_user_id as string) ??
      null;

    return {
      ...report,
      target: post
        ? { kind: 'post', id: post.id, title: post.title, body: post.body }
        : comment
          ? { kind: 'comment', id: comment.id, body: comment.body }
          : message
            ? { kind: 'message', id: message.id, body: message.body }
            : user
              ? { kind: 'user', id: user.id, username: user.username }
              : // Цель удалили, пока жалоба лежала в очереди. Не молчим об этом:
                // модератору важно понимать, почему смотреть не на что.
                { kind: 'gone' },
      author: authorId ? (authorMap.get(authorId) ?? { id: authorId }) : null,
    };
  });
}

/** Очередь: открытые жалобы, самые старые сверху — кто ждёт дольше, тот первый. */
router.get('/reports', async (req, res) => {
  const status = String(req.query.status ?? 'open');
  if (!['open', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ error: 'Неизвестное состояние' });
  }

  // Курсором по времени, а не смещением: пока модератор читает первую страницу,
  // приходят новые жалобы, и со смещением часть очереди проехала бы мимо него.
  const before = typeof req.query.before === 'string' ? req.query.before : null;
  const ascending = status === 'open';

  let query = supabase
    .from('reports')
    .select('*, reporter:users!reports_reporter_id_fkey (id, username)')
    .eq('status', status)
    .order('created_at', { ascending })
    .limit(PAGE);

  if (before) {
    query = ascending ? query.gt('created_at', before) : query.lt('created_at', before);
  }

  const { data, error } = await query;

  if (error) {
    console.error('moderation: queue failed', error);
    return res.status(500).json({ error: 'Не удалось загрузить очередь' });
  }

  res.json({
    reports: await enrich(data as Enriched[]),
    nextCursor: data.length === PAGE ? data[data.length - 1].created_at : null,
  });
});

/** Сколько ждёт разбора — для значка на разделе. */
router.get('/summary', async (_req, res) => {
  const { count, error } = await supabase
    .from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'open');

  if (error) {
    console.error('moderation: summary failed', error);
    return res.status(500).json({ error: 'Не удалось посчитать жалобы' });
  }

  res.json({ open: count ?? 0 });
});

/**
 * Сроки бана.
 *
 * Вечный — это 'infinity', настоящее значение timestamptz: сравнение со
 * временем работает для него само, и отдельный флаг «навсегда», который однажды
 * разойдётся со сроком, не нужен.
 */
const BAN_DURATIONS: Record<string, string> = {
  day: '1 day',
  week: '7 days',
  month: '30 days',
};

function bannedUntil(duration: string): string | null {
  if (duration === 'forever') return 'infinity';
  const interval = BAN_DURATIONS[duration];
  if (!interval) return null;
  const days = Number(interval.split(' ')[0]);
  return new Date(Date.now() + days * 86_400_000).toISOString();
}

async function log(entry: Record<string, unknown>) {
  const { error } = await supabase.from('moderation_actions').insert(entry);
  if (error) console.error('moderation: log failed', error);
}

/** Забанить. Отдельно от разбора жалобы: банят и по своей инициативе тоже. */
router.post('/ban', async (req, res) => {
  const moderator = req.user!.id;
  const targetId = String(req.body?.userId ?? '');
  const duration = String(req.body?.duration ?? '');
  const reason = String(req.body?.reason ?? '').trim().slice(0, 500) || null;

  const until = bannedUntil(duration);
  if (!targetId || !until) {
    return res.status(400).json({ error: 'Нужны пользователь и срок' });
  }

  if (targetId === moderator) {
    return res.status(400).json({ error: 'Нельзя забанить себя' });
  }

  // Модератора не банит другой модератор: разбирайтесь между собой, а роль
  // снимает админ. Иначе двое в плохой день выключают друг друга по очереди.
  const { data: target, error: lookupError } = await supabase
    .from('users')
    .select('id, role')
    .eq('id', targetId)
    .maybeSingle();

  if (lookupError) {
    console.error('moderation: ban lookup failed', lookupError);
    return res.status(500).json({ error: 'Не удалось забанить' });
  }
  if (!target) {
    return res.status(404).json({ error: 'Пользователь не найден' });
  }
  if (target.role !== 'user' && req.user!.role !== 'admin') {
    return res.status(403).json({ error: 'Модератора банит только админ' });
  }

  const { error } = await supabase
    .from('users')
    .update({
      banned_until: until,
      ban_reason: reason,
      banned_by: moderator,
      banned_at: new Date().toISOString(),
      // Запас приглашений обнуляется вместе с баном: иначе забаненный
      // раздаёт коды и возвращается новыми аккаунтами.
      invites_left: 0,
    })
    .eq('id', targetId);

  if (error) {
    console.error('moderation: ban failed', error);
    return res.status(500).json({ error: 'Не удалось забанить' });
  }

  invalidateUserState(targetId);
  await log({
    moderator_id: moderator,
    target_user_id: targetId,
    report_id: req.body?.reportId ?? null,
    action: 'ban',
    reason,
    banned_until: until,
  });

  res.json({ ok: true, bannedUntil: until });
});

router.post('/unban', async (req, res) => {
  const moderator = req.user!.id;
  const targetId = String(req.body?.userId ?? '');

  if (!targetId) return res.status(400).json({ error: 'Нужен пользователь' });

  const { error } = await supabase
    .from('users')
    .update({ banned_until: null, ban_reason: null, banned_by: null, banned_at: null })
    .eq('id', targetId);

  if (error) {
    console.error('moderation: unban failed', error);
    return res.status(500).json({ error: 'Не удалось снять бан' });
  }

  invalidateUserState(targetId);
  await log({ moderator_id: moderator, target_user_id: targetId, action: 'unban' });

  res.json({ ok: true });
});

/** Жалоба разобрана: отклонить или закрыть с решением. */
router.post('/reports/:id/close', async (req, res) => {
  const moderator = req.user!.id;
  const dismissed = Boolean(req.body?.dismiss);
  const resolution = String(req.body?.resolution ?? '').trim().slice(0, 500) || null;

  const { data, error } = await supabase
    .from('reports')
    .update({
      status: dismissed ? 'dismissed' : 'resolved',
      handled_by: moderator,
      handled_at: new Date().toISOString(),
      resolution,
    })
    .eq('id', req.params.id)
    // Только открытую: двое модераторов, взявших одну жалобу, не должны
    // переписывать решение друг друга молча.
    .eq('status', 'open')
    .select('id');

  if (error) {
    console.error('moderation: close failed', error);
    return res.status(500).json({ error: 'Не удалось закрыть жалобу' });
  }

  if (!data.length) {
    return res.status(409).json({ error: 'Жалоба уже разобрана' });
  }

  if (dismissed) {
    await log({
      moderator_id: moderator,
      report_id: req.params.id,
      action: 'dismiss',
      reason: resolution,
    });
  }

  res.json({ ok: true });
});

/** Удалить то, на что пожаловались. */
router.post('/reports/:id/delete-target', async (req, res) => {
  const moderator = req.user!.id;

  const { data: report, error: readError } = await supabase
    .from('reports')
    .select('id, post_id, comment_id, message_id')
    .eq('id', req.params.id)
    .maybeSingle();

  if (readError) {
    console.error('moderation: target read failed', readError);
    return res.status(500).json({ error: 'Не удалось прочитать жалобу' });
  }
  if (!report) return res.status(404).json({ error: 'Жалоба не найдена' });

  const [table, id, action] = report.post_id
    ? (['posts', report.post_id, 'delete_post'] as const)
    : report.comment_id
      ? (['comments', report.comment_id, 'delete_comment'] as const)
      : report.message_id
        ? (['messages', report.message_id, 'delete_comment'] as const)
        : ([null, null, null] as const);

  if (!table) {
    return res.status(400).json({ error: 'У этой жалобы нечего удалять' });
  }

  const { error } = await supabase.from(table).delete().eq('id', id);

  if (error) {
    console.error('moderation: delete failed', error);
    return res.status(500).json({ error: 'Не удалось удалить' });
  }

  await log({ moderator_id: moderator, report_id: report.id, action });

  res.json({ ok: true });
});

/** История по человеку: за что его уже наказывали. */
router.get('/users/:id/history', async (req, res) => {
  const { data, error } = await supabase
    .from('moderation_actions')
    .select('*, moderator:users!moderation_actions_moderator_id_fkey (id, username)')
    .eq('target_user_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('moderation: history failed', error);
    return res.status(500).json({ error: 'Не удалось загрузить историю' });
  }

  res.json(data);
});

export default router;
