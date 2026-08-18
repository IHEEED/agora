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
  // PGRST204 — «в схеме нет такой колонки». Единственное, чего может не хватать
  // сверх 007, — поля из 009: ответы и закрепление. Отправлять человека чинить
  // приложение вместо базы здесь так же бессмысленно, как и выше.
  if (error.code === 'PGRST204') {
    return 'Ответы и закреплённые сообщения ещё не включены в базе — выполните миграцию 009_message_replies_and_pins.sql в Supabase → SQL Editor.';
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
  const replyToId = req.body?.reply_to_id ? String(req.body.reply_to_id) : null;

  if (!recipientId || recipientId === me) {
    return res.status(400).json({ error: 'Некому отправлять' });
  }
  if (!body) {
    return res.status(400).json({ error: 'Пустое сообщение отправить нельзя' });
  }

  const { data, error } = await supabase
    .from('messages')
    // reply_to_id подставляем только когда отвечают. Колонка появляется
    // миграцией 009, и упоминать её в каждой вставке значило бы сломать
    // отправку вообще у всех, кто выполнил только 007: PostgREST отвергает
    // запрос с неизвестной колонкой целиком, даже если значение в ней null.
    .insert({
      sender_id: me,
      recipient_id: recipientId,
      body,
      ...(replyToId ? { reply_to_id: replyToId } : null),
    })
    // Звёздочка, а не перечисление колонок: edited_at появляется миграцией 008, и
    // явное имя ломало бы переписку у тех, кто выполнил только 007.
    .select('*')
    .single();

  if (error) {
    console.error('messages: send failed', error);
    return res.status(500).json({ error: describeError(error, 'Не удалось отправить сообщение') });
  }

  res.status(201).json(data);
});

/**
 * Закрепить или открепить сообщение.
 *
 * Закрепление общее на переписку, а не личное: в разговоре двоих «важное»
 * важно обоим. Поэтому закрепить можно и чужую реплику — достаточно быть
 * участником переписки, что и проверяем.
 */
router.put('/:id/pin', requireAuth, async (req, res) => {
  const me = req.user!.id;
  const id = String(req.params.id);
  const pinned = Boolean(req.body?.pinned);

  const { data: message } = await supabase
    .from('messages')
    .select('sender_id, recipient_id')
    .eq('id', id)
    .maybeSingle();

  if (!message) return res.status(404).json({ error: 'Сообщение не найдено' });
  if (message.sender_id !== me && message.recipient_id !== me) {
    return res.status(403).json({ error: 'Это не ваша переписка' });
  }

  const { error } = await supabase
    .from('messages')
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq('id', id);

  if (error) {
    console.error('messages: pin failed', error);
    return res.status(500).json({ error: describeError(error, 'Не удалось закрепить сообщение') });
  }

  res.status(204).send();
});

/** Реакции на пачку сообщений — одним запросом, а не по одному на сообщение. */
async function reactionsByMessageId(ids: string[]) {
  const map = new Map<string, { emoji: string; userId: string }[]>();
  if (ids.length === 0) return map;

  // Таблицы может ещё не быть (миграция 008) — переписка важнее реакций,
  // поэтому на ошибке просто отдаём пустое.
  const { data, error } = await supabase
    .from('message_reactions')
    .select('message_id, user_id, emoji')
    .in('message_id', ids);

  if (error || !data) return map;

  for (const row of data) {
    const list = map.get(row.message_id) ?? [];
    list.push({ emoji: row.emoji as string, userId: row.user_id as string });
    map.set(row.message_id, list);
  }
  return map;
}

/** Переписка с одним человеком, от старых к новым — в порядке чтения. */
router.get('/:userId', requireAuth, async (req, res) => {
  const me = req.user!.id;
  const other = String(req.params.userId);

  const { data, error } = await supabase
    .from('messages')
    // Звёздочка, а не перечисление колонок: edited_at появляется миграцией 008, и
    // явное имя ломало бы переписку у тех, кто выполнил только 007.
    .select('*')
    .or(
      `and(sender_id.eq.${me},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${me})`
    )
    .order('created_at', { ascending: true })
    .limit(300);

  if (error) {
    console.error('messages: thread failed', error);
    return res.status(500).json({ error: describeError(error, 'Не удалось загрузить переписку') });
  }

  const reactions = await reactionsByMessageId(data.map((row) => row.id));

  // Цитата над ответом собирается из самой переписки, а не отдельным запросом:
  // отвечают почти всегда на то, что рядом, и оригинал уже в этой же выборке.
  // Отдельный запрос понадобился бы ради редкого случая, когда ответили на
  // реплику старше трёхсот сообщений, — там цитата просто не покажется.
  // Пока миграции 009 нет, колонки reply_to_id в ответе просто не будет —
  // цитат не появится, но переписка откроется как раньше.
  const byId = new Map(data.map((row) => [row.id, row]));

  res.json(
    data.map((message) => {
      const original = message.reply_to_id ? byId.get(message.reply_to_id) : undefined;
      return {
        ...message,
        reactions: reactions.get(message.id) ?? [],
        replyTo: original
          ? {
              id: original.id,
              body: original.body,
              mine: original.sender_id === me,
            }
          : null,
      };
    })
  );
});

/** Правка своего сообщения. Чужое править нельзя — проверяем на сервере. */
router.patch('/:id', requireAuth, async (req, res) => {
  const body = String(req.body?.body ?? '').trim();
  if (!body) return res.status(400).json({ error: 'Пустое сообщение отправить нельзя' });

  const { data, error } = await supabase
    .from('messages')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', String(req.params.id))
    // Запросы идут сервисным ключом, RLS его не касается: без этого условия
    // можно было бы переписать чужую реплику.
    .eq('sender_id', req.user!.id)
    // Звёздочка, а не перечисление колонок: edited_at появляется миграцией 008, и
    // явное имя ломало бы переписку у тех, кто выполнил только 007.
    .select('*')
    .single();

  if (error || !data) {
    return res.status(403).json({ error: 'Править можно только свои сообщения' });
  }

  res.json(data);
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', String(req.params.id))
    .eq('sender_id', req.user!.id);

  if (error) {
    console.error('messages: delete failed', error);
    return res.status(500).json({ error: 'Не удалось удалить сообщение' });
  }

  res.status(204).send();
});

/**
 * Реакция на сообщение. Тот же знак повторно — снимает её: отдельной кнопки
 * «убрать реакцию» нет ни в одном мессенджере, снимают тем же нажатием.
 */
router.put('/:id/reaction', requireAuth, async (req, res) => {
  const me = req.user!.id;
  const id = String(req.params.id);
  const emoji = String(req.body?.emoji ?? '');

  const { data: current } = await supabase
    .from('message_reactions')
    .select('emoji')
    .eq('message_id', id)
    .eq('user_id', me)
    .maybeSingle();

  if (current?.emoji === emoji) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', id)
      .eq('user_id', me);

    if (error) {
      console.error('messages: reaction remove failed', error);
      return res.status(500).json({ error: describeError(error, 'Не удалось убрать реакцию') });
    }
    return res.status(204).send();
  }

  const { error } = await supabase
    .from('message_reactions')
    .upsert({ message_id: id, user_id: me, emoji }, { onConflict: 'message_id,user_id' });

  if (error) {
    console.error('messages: reaction failed', error);
    return res.status(500).json({ error: describeError(error, 'Не удалось поставить реакцию') });
  }

  res.status(204).send();
});

/**
 * Удалить переписку целиком.
 *
 * Удаляем только свои письма: чужие реплики принадлежат тому, кто их написал,
 * и стереть их у собеседника из своего интерфейса нельзя. Для того, кто нажал,
 * это выглядит как «переписка очищена» — его половина разговора исчезла, а
 * входящие остаются, пока он их не удалит по одному. Так же ведёт себя почта.
 *
 * Объявлено до '/:userId/read', чтобы 'thread' не был принят за идентификатор.
 */
router.delete('/thread/:userId', requireAuth, async (req, res) => {
  const me = req.user!.id;
  const other = String(req.params.userId);

  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('sender_id', me)
    .eq('recipient_id', other);

  if (error) {
    console.error('messages: thread delete failed', error);
    return res.status(500).json({ error: describeError(error, 'Не удалось удалить переписку') });
  }

  res.status(204).send();
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
