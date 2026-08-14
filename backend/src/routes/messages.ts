import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Личные сообщения.
 *
 * Диалога как сущности в базе нет — есть плоский список писем (миграция 007).
 * Список переписок собирается здесь, в памяти: у одного человека их десятки,
 * а не тысячи, и группировка по собеседнику обходится дешевле, чем отдельная
 * таблица, которую пришлось бы держать в согласии с сообщениями.
 */

type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

/** Сколько последних писем вообще смотрим, собирая список переписок. */
const THREAD_SCAN_LIMIT = 500;

/**
 * Пока миграция 007 не выполнена, таблицы нет. Postgres отвечает на это 42P01,
 * а PostgREST — своим PGRST205 «нет в кеше схемы»; в ответе Supabase приходит
 * второй. Отдать на это «не удалось загрузить» — значит отправить искать
 * поломку не туда: чинить нужно не приложение, а базу.
 */
function describeError(error: { code?: string; message?: string }, fallback: string): string {
  if (error.code === '42P01' || error.code === 'PGRST205') {
    return 'Личные сообщения ещё не включены в базе — выполните миграцию 007_messages.sql в Supabase → SQL Editor.';
  }
  return fallback;
}

/** Имена собеседников одним запросом — иначе по запросу на каждую переписку. */
async function usersByIds(ids: string[]) {
  const people = new Map<string, { id: string; username: string }>();
  if (ids.length === 0) return people;

  const { data } = await supabase.from('users').select('id, username').in('id', ids);
  data?.forEach((user) => people.set(user.id, user));
  return people;
}

/** Число непрочитанных — для точки на кнопке в шапке. */
router.get('/unread-count', requireAuth, async (req, res) => {
  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', req.user!.id)
    .is('read_at', null);

  // Таблицы может ещё не быть (миграция 007) — точка на кнопке не тот повод,
  // чтобы отдавать ошибку на каждый экран.
  if (error) return res.json({ count: 0 });

  res.json({ count: count ?? 0 });
});

/** Список переписок: последнее письмо с каждым собеседником. */
router.get('/threads', requireAuth, async (req, res) => {
  const me = req.user!.id;

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
    .order('created_at', { ascending: false })
    .limit(THREAD_SCAN_LIMIT);

  if (error) {
    console.error('messages: threads failed', error);
    return res.status(500).json({ error: describeError(error, 'Не удалось загрузить переписки') });
  }

  // Письма уже идут от новых к старым, поэтому первое встреченное письмо
  // с человеком и есть последнее в переписке.
  const threads = new Map<
    string,
    { userId: string; lastMessage: MessageRow; unread: number }
  >();

  for (const row of data as MessageRow[]) {
    const other = row.sender_id === me ? row.recipient_id : row.sender_id;
    const thread = threads.get(other);
    const unread = row.recipient_id === me && row.read_at === null ? 1 : 0;

    if (thread) {
      thread.unread += unread;
      continue;
    }
    threads.set(other, { userId: other, lastMessage: row, unread });
  }

  const people = await usersByIds([...threads.keys()]);

  res.json(
    [...threads.values()].map((thread) => ({
      user: people.get(thread.userId) ?? { id: thread.userId, username: '—' },
      unread: thread.unread,
      lastMessage: {
        body: thread.lastMessage.body,
        created_at: thread.lastMessage.created_at,
        mine: thread.lastMessage.sender_id === me,
      },
    }))
  );
});

router.post('/', requireAuth, async (req, res) => {
  const me = req.user!.id;
  const recipientId = String(req.body?.recipient_id ?? '');
  const body = String(req.body?.body ?? '').trim();

  if (!recipientId || recipientId === me) {
    return res.status(400).json({ error: 'Некому отправлять' });
  }
  if (!body) {
    return res.status(400).json({ error: 'Пустое сообщение отправить нельзя' });
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: me, recipient_id: recipientId, body })
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .single();

  if (error) {
    console.error('messages: send failed', error);
    return res.status(500).json({ error: describeError(error, 'Не удалось отправить сообщение') });
  }

  res.status(201).json(data);
});

/** Переписка с одним человеком, от старых к новым — в порядке чтения. */
router.get('/:userId', requireAuth, async (req, res) => {
  const me = req.user!.id;
  const other = String(req.params.userId);

  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(
      `and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`
    )
    .order('created_at', { ascending: true })
    .limit(300);

  if (error) {
    console.error('messages: thread failed', error);
    return res.status(500).json({ error: describeError(error, 'Не удалось загрузить переписку') });
  }

  res.json(data);
});

/** Отметить входящие в переписке прочитанными. */
router.post('/:userId/read', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', req.user!.id)
    .eq('sender_id', String(req.params.userId))
    .is('read_at', null);

  if (error) {
    console.error('messages: read failed', error);
    return res.status(500).json({ error: 'Не удалось отметить прочитанным' });
  }

  res.status(204).send();
});

export default router;
