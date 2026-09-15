import crypto from 'crypto';
import { Router } from 'express';
import { supabase } from '../config/supabase';
import { requireAuth } from '../middleware/auth';

/**
 * Подтверждение телефона через Telegram-бота — вместо платного SMS-провайдера.
 *
 * Бот тут — не отдельная программа, а этот роут: Telegram шлёт события на
 * /telegram/webhook, а мы отвечаем обычными запросами в Bot API. Человек
 * открывает бота по ссылке с одноразовым токеном, жмёт «Поделиться номером» —
 * Telegram отдаёт боту номер, привязанный к его аккаунту (проверенный самим
 * Telegram, не введённый руками). Мы ставим этот номер пользователю с
 * phone_confirm, и весь существующий гейт (phone_confirmed_at) снимается сам.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? 'ParafrazLegitBot';

/**
 * Секрет вебхука — из токена бота, а не отдельной переменной: детерминированный
 * (переживает рестарт), но снаружи неизвестен без токена. Telegram присылает его
 * заголовком X-Telegram-Bot-Api-Secret-Token на каждом вызове, мы сверяем.
 */
const WEBHOOK_SECRET = TOKEN
  ? crypto.createHash('sha256').update(TOKEN).digest('hex').slice(0, 40)
  : '';

/** Одноразовая заявка на подтверждение. Живёт в памяти: токены короткие, и
 *  рестарт просто попросит человека начать заново (заявок единицы). */
type Pending = {
  userId: string; // наш (Supabase) пользователь, начавший подтверждение
  status: 'pending' | 'done' | 'error';
  message?: string; // текст ошибки для клиента (например «номер уже занят»)
  createdAt: number;
};
const byToken = new Map<string, Pending>();
const chatToToken = new Map<number, string>(); // telegram user id → его текущий токен
const TTL_MS = 10 * 60_000;

function sweep() {
  const now = Date.now();
  for (const [token, rec] of byToken) {
    if (now - rec.createdAt > TTL_MS) byToken.delete(token);
  }
}

/** Вызов метода Bot API. */
async function tg(method: string, body: unknown): Promise<{ ok?: boolean; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json().catch(() => ({})) as Promise<{ ok?: boolean; description?: string }>;
}

const router = Router();

/** Начать подтверждение: выдаём токен и ссылку на бота. */
router.post('/start', requireAuth, (req, res) => {
  if (!TOKEN) {
    return res.status(503).json({ error: 'Подтверждение через Telegram пока не настроено' });
  }
  sweep();
  const token = crypto.randomBytes(24).toString('base64url'); // только [A-Za-z0-9_-], как любит /start
  byToken.set(token, { userId: req.user!.id, status: 'pending', createdAt: Date.now() });
  res.json({ token, url: `https://t.me/${BOT_USERNAME}?start=${token}` });
});

/** Опрос состояния заявки — приложение ждёт, пока человек поделится номером. */
router.get('/status', requireAuth, async (req, res) => {
  const token = String(req.query.token ?? '');
  const rec = byToken.get(token);
  // Чужой токен — не показываем: заявка принадлежит тому, кто её начал.
  if (rec && rec.userId !== req.user!.id) return res.json({ status: 'expired' });
  if (rec?.status === 'done') return res.json({ status: 'done' });
  if (rec?.status === 'error') return res.json({ status: 'error', message: rec.message });

  // Источник правды — реальное подтверждение в Supabase. Так статус переживает
  // потерю in-memory заявки (рестарт/несколько инстансов Railway): даже если
  // запись в памяти исчезла, подтверждённый номер вернёт 'done'.
  const { data } = await supabase.auth.admin.getUserById(req.user!.id);
  if (data.user?.phone_confirmed_at) return res.json({ status: 'done' });
  return res.json({ status: rec ? 'pending' : 'expired' });
});

/**
 * Не привязан ли этот номер уже к другому аккаунту.
 *
 * Один номер — один аккаунт: иначе с одного телефона плодят учётки. Малые
 * объёмы, поэтому сканируем одну страницу списка; для тысяч пользователей
 * понадобится индекс/RPC. На сбое чтения не блокируем — лучше пропустить, чем
 * запереть человека из-за случайной ошибки.
 */
async function phoneTakenByOther(phone: string, selfId: string): Promise<boolean> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return false;
  return data.users.some(
    (u) => u.id !== selfId && String(u.phone ?? '').replace(/\D/g, '') === phone && Boolean(u.phone_confirmed_at)
  );
}

/** Вебхук бота: сюда Telegram шлёт /start и присланный контакт. */
router.post('/webhook', async (req, res) => {
  if (!TOKEN || req.header('X-Telegram-Bot-Api-Secret-Token') !== WEBHOOK_SECRET) {
    return res.status(401).end();
  }

  const message = req.body?.message;
  const chatId: number | undefined = message?.chat?.id;
  const fromId: number | undefined = message?.from?.id;
  if (!message || chatId === undefined || fromId === undefined) return res.status(200).end();

  // /start <token> — показываем кнопку «Поделиться номером».
  const text: string = typeof message.text === 'string' ? message.text : '';
  if (text.startsWith('/start')) {
    const token = text.split(/\s+/)[1]?.trim();
    const rec = token ? byToken.get(token) : undefined;
    if (!rec || rec.status !== 'pending') {
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Ссылка устарела. Вернитесь в приложение и начните подтверждение заново.',
      });
      return res.status(200).end();
    }
    chatToToken.set(fromId, token!);
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Подтвердите номер, привязанный к вашему Telegram — нажмите кнопку ниже.',
      reply_markup: {
        keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    });
    return res.status(200).end();
  }

  // Пришёл контакт.
  const contact = message.contact;
  if (contact) {
    const token = chatToToken.get(fromId);
    const rec = token ? byToken.get(token) : undefined;
    if (!rec || rec.status !== 'pending') {
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Начните заново из приложения.',
        reply_markup: { remove_keyboard: true },
      });
      return res.status(200).end();
    }
    // Свой номер, а не чужая визитка из адресной книги.
    if (contact.user_id !== fromId) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Поделитесь своим номером кнопкой ниже, а не контактом из списка.',
      });
      return res.status(200).end();
    }

    const phone = String(contact.phone_number ?? '').replace(/\D/g, '');

    // Один номер — один аккаунт.
    if (await phoneTakenByOther(phone, rec.userId)) {
      rec.status = 'error';
      rec.message = 'Этот номер уже привязан к другому аккаунту.';
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Этот номер уже привязан к другому аккаунту — им нельзя подтвердить второй.',
        reply_markup: { remove_keyboard: true },
      });
      return res.status(200).end();
    }

    const { error } = await supabase.auth.admin.updateUserById(rec.userId, { phone, phone_confirm: true });
    if (error) {
      rec.status = 'error';
      rec.message = 'Не получилось подтвердить — попробуйте ещё раз.';
      console.error('telegram: updateUserById failed', error);
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Не получилось подтвердить — попробуйте ещё раз из приложения.',
        reply_markup: { remove_keyboard: true },
      });
      return res.status(200).end();
    }

    rec.status = 'done';
    chatToToken.delete(fromId);
    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Готово ✅ Вернитесь в приложение.',
      reply_markup: { remove_keyboard: true },
    });
    return res.status(200).end();
  }

  return res.status(200).end();
});

/**
 * Повесить вебхук при старте сервера. Публичный адрес берём из PUBLIC_BASE_URL
 * или из авто-переменной Railway. Без токена/адреса — просто предупреждаем,
 * подтверждение через Telegram остаётся выключенным (гейт работает по-старому).
 */
export async function setupTelegramWebhook(): Promise<void> {
  if (!TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN не задан — подтверждение через Telegram выключено.');
    return;
  }
  const base =
    process.env.PUBLIC_BASE_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null);
  if (!base) {
    console.warn('PUBLIC_BASE_URL/RAILWAY_PUBLIC_DOMAIN не заданы — вебхук Telegram не установлен.');
    return;
  }
  const url = `${base.replace(/\/$/, '')}/telegram/webhook`;
  const result = await tg('setWebhook', {
    url,
    secret_token: WEBHOOK_SECRET,
    allowed_updates: ['message'],
  });
  console.log('Telegram webhook:', result.ok ? `установлен на ${url}` : JSON.stringify(result));
}

export default router;
