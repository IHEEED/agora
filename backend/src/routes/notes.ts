import { Router } from 'express';
import { supabase } from '../config/supabase';
import { optionalAuth, requireAuth } from '../middleware/auth';

/**
 * Облачко над аватаркой: одна мысль на сутки.
 *
 * Жанр между историей и статусом. От истории отличается тем, что не занимает
 * экран и не требует картинки: одна строка, которую видно мимоходом — в списке
 * переписок, рядом с лицом. От статуса — тем, что кончается: статус висит
 * годами и перестаёт что-либо значить уже к третьему дню.
 *
 * Одна строка на человека: облачко не архив, и предыдущая мысль никому не
 * интересна. Поэтому запись — это upsert, а не вставка.
 */
const router = Router();

/** Больше в облачко не влезает — то же число стоит ограничением в схеме. */
const MAX_LENGTH = 60;

/**
 * Ответ, когда таблицы ещё нет.
 *
 * Миграции здесь выполняются руками, и облачко — не тот повод, чтобы ронять
 * список переписок. Пустой список означает «ни у кого ничего не написано», и
 * это ровно то, что видно до выполнения миграции.
 */
function tableMissing(error: { message?: string; code?: string }): boolean {
  return (
    error.code === '42P01' ||
    error.code === 'PGRST205' ||
    (/notes/i.test(error.message ?? '') && /does not exist|schema cache/i.test(error.message ?? ''))
  );
}

/**
 * Чужие мысли пачкой.
 *
 * Список авторов приходит в запросе, а не собирается здесь: кому показывать
 * облачка, решает экран — в списке переписок это собеседники, в другом месте
 * могут быть подписки. Складывать эту логику сюда значило бы зашить в маршрут
 * знание о том, кто его зовёт.
 */
router.get('/', optionalAuth, async (req, res) => {
  const ids = String(req.query.ids ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 100);

  if (ids.length === 0) return res.json([]);

  const { data, error } = await supabase
    .from('notes')
    .select('author_id, body, created_at')
    .in('author_id', ids)
    .gt('expires_at', new Date().toISOString());

  if (error) {
    if (tableMissing(error)) return res.json([]);
    console.error('notes: request failed', error);
    return res.status(500).json({ error: 'Не удалось загрузить' });
  }

  res.json(data);
});

/** Написать своё. Пустая строка — то же, что стереть. */
router.put('/', requireAuth, async (req, res) => {
  const me = req.user!.id;
  const body = String(req.body?.body ?? '').trim().slice(0, MAX_LENGTH);

  if (!body) {
    const { error } = await supabase.from('notes').delete().eq('author_id', me);
    if (error && !tableMissing(error)) {
      console.error('notes: clear failed', error);
      return res.status(500).json({ error: 'Не удалось стереть' });
    }
    return res.json({ body: null });
  }

  const now = new Date();
  const { error } = await supabase.from('notes').upsert(
    {
      author_id: me,
      body,
      created_at: now.toISOString(),
      // Срок отсчитываем от новой мысли, а не оставляем прежний: иначе
      // написанное только что исчезало бы через минуту, если предыдущее
      // висело почти сутки.
      expires_at: new Date(now.getTime() + 24 * 60 * 60_000).toISOString(),
    },
    { onConflict: 'author_id' }
  );

  if (error) {
    if (tableMissing(error)) {
      return res.status(503).json({ error: 'Облачка ещё не включены — нужна миграция 017' });
    }
    console.error('notes: save failed', error);
    return res.status(500).json({ error: 'Не удалось сохранить' });
  }

  res.json({ body });
});

export default router;
