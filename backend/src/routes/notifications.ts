import { Router } from 'express';
import { supabase } from '../config/supabase';
import { userEmbed } from '../config/schema';
import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Уведомления.
 *
 * До этого вкладка «Уведомления» показывала подсказки «кого почитать» — то есть
 * врала названием. Человек отвечал на записи, получал голоса и подписчиков и не
 * узнавал об этом никогда, если сам не шёл проверять.
 *
 * События рождаются триггерами в базе (миграция 020), а не этим кодом. Здесь
 * только чтение и пометка прочитанным: приложение не должно уметь выдумывать
 * уведомления, иначе однажды выдумает.
 */

type NotificationRow = {
  id: string;
  kind: string;
  post_id: string | null;
  comment_id: string | null;
  read_at: string | null;
  created_at: string;
  actor: { id: string; username: string; avatar_url?: string | null } | null;
  post: { id: string; title: string } | null;
  comment: { id: string; body: string; post_id: string } | null;
};

/** Сколько отдавать за раз. Дальше — курсором по времени. */
const PAGE = 30;

/**
 * Пока миграция 020 не выполнена, таблицы нет. Ронять из-за этого колокол на
 * каждом экране — то же самое, что ронять шапку из-за непрочитанных сообщений:
 * возможности ещё нет, но всё остальное работает.
 */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (/notifications/i.test(error.message ?? '') &&
      /does not exist|schema cache/i.test(error.message ?? ''))
  );
}

/** Число непрочитанных — для точки на колоколе. */
router.get('/unread-count', requireAuth, async (req, res) => {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', req.user!.id)
    .is('read_at', null);

  if (error) {
    if (isMissingTable(error)) return res.json({ count: 0 });
    console.error('notifications: count failed', error);
    return res.json({ count: 0 });
  }

  res.json({ count: count ?? 0 });
});

/**
 * Лента событий.
 *
 * Курсором по времени, а не смещением: пока человек читает первую страницу,
 * приходят новые события, и со смещением часть ленты проехала бы мимо него.
 */
router.get('/', requireAuth, async (req, res) => {
  const before = typeof req.query.before === 'string' ? req.query.before : null;

  let query = supabase
    .from('notifications')
    // Одной строкой без переносов: PostgREST разбирает список полей и на
    // многострочном шаблоне спотыкается уже на этапе вывода типов.
    .select(
      `id, kind, post_id, comment_id, read_at, created_at, ${userEmbed('actor', 'notifications_actor_id_fkey')}, post:posts(id, title), comment:comments(id, body, post_id)`
    )
    .eq('recipient_id', req.user!.id)
    .order('created_at', { ascending: false })
    .limit(PAGE);

  if (before) query = query.lt('created_at', before);

  // .returns в самом конце: он завершает построение запроса, и любой фильтр
  // после него библиотека уже не принимает.
  const { data, error } = await query.returns<NotificationRow[]>();

  if (error) {
    if (isMissingTable(error)) return res.json({ notifications: [], nextCursor: null });
    console.error('notifications: list failed', error);
    return res.status(500).json({ error: 'Не удалось загрузить уведомления' });
  }

  res.json({
    notifications: data,
    nextCursor: data.length === PAGE ? data[data.length - 1].created_at : null,
  });
});

/**
 * Прочитано.
 *
 * Всё разом, а не по одному. Уведомление — это не письмо: его не «открывают»,
 * на него смотрят. Человек, зашедший на вкладку, увидел всё, что там было, и
 * оставлять точку на колоколе после этого значит требовать от него ещё одного
 * действия неизвестно зачем.
 *
 * Отсечка по времени, а не «все подряд»: пока экран открыт, могут прийти новые,
 * и пометить их прочитанными было бы враньём.
 */
router.post('/read', requireAuth, async (req, res) => {
  const until = typeof req.body?.until === 'string' ? req.body.until : new Date().toISOString();

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', req.user!.id)
    .is('read_at', null)
    .lte('created_at', until);

  if (error) {
    if (isMissingTable(error)) return res.json({ ok: true });
    console.error('notifications: mark read failed', error);
    return res.status(500).json({ error: 'Не удалось отметить прочитанным' });
  }

  res.json({ ok: true });
});

export default router;
