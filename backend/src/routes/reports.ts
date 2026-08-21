import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth, requireNotBanned } from '../middleware/auth';

const router = Router();

/**
 * Причины — тот же короткий список, что в интерфейсе (PostMenuSheet).
 *
 * Проверяется здесь, а не только там: список причин отдаёт форму отчётности
 * модератора, и «прочее» из-за опечатки в клиенте испортило бы её молча.
 */
const REASONS = [
  'spam',
  'abuse',
  'false',
  'violence',
  // Эти две есть только в меню человека: подделаться и угрожать может человек,
  // а не запись. Список общий на оба меню, потому что очередь у модератора одна.
  'impersonation',
  'threats',
  'other',
] as const;
type Reason = (typeof REASONS)[number];

/** Ровно одна цель у жалобы — как проверяет и ограничение в базе. */
const TARGETS = {
  postId: 'post_id',
  commentId: 'comment_id',
  messageId: 'message_id',
  userId: 'target_user_id',
} as const;

router.post('/', requireAuth, requireNotBanned, async (req, res) => {
  const me = req.user!.id;
  const reason = String(req.body?.reason ?? '') as Reason;

  if (!REASONS.includes(reason)) {
    return res.status(400).json({ error: 'Неизвестная причина' });
  }

  const given = (Object.keys(TARGETS) as (keyof typeof TARGETS)[]).filter(
    (key) => typeof req.body?.[key] === 'string' && req.body[key]
  );

  if (given.length !== 1) {
    return res.status(400).json({ error: 'Нужна ровно одна цель жалобы' });
  }

  const column = TARGETS[given[0]];
  const targetId = String(req.body[given[0]]);

  if (column === 'target_user_id' && targetId === me) {
    return res.status(400).json({ error: 'Нельзя пожаловаться на себя' });
  }

  // Подробности не обязательны, но если их прислали — обрезаем: поле читает
  // человек, и простыня на десять экранов ему не помогает.
  const details = String(req.body?.details ?? '').trim().slice(0, 1000) || null;

  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: me, [column]: targetId, reason, details });

  if (error) {
    // 23505 — жалоба от этого человека на эту цель уже есть. Для него это не
    // ошибка: он нажал кнопку, жалоба лежит у модератора. Так и отвечаем, иначе
    // человек будет жать снова, решив, что не сработало.
    if (error.code === '23505') {
      return res.status(200).json({ ok: true, alreadyReported: true });
    }
    if (error.code === '23503') {
      return res.status(404).json({ error: 'Цель жалобы не найдена' });
    }
    console.error('reports: create failed', error);
    return res.status(500).json({ error: 'Не удалось отправить жалобу' });
  }

  res.status(201).json({ ok: true });
});

export default router;
