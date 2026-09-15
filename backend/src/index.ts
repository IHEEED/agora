// Ещё до пула — мониторинг: init должен успеть обернуть http и отказы до того,
// как что-либо ими воспользуется (тихий no-op без SENTRY_DSN, см. instrument).
import { Sentry, sentryEnabled } from './instrument';
// Первым рабочим импортом: он настраивает пул соединений, и клиент Supabase
// должен создаваться уже с ним (см. config/http).
import { HTTP_CONNECTIONS } from './config/http';
import { supabase } from './config/supabase';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import dotenv from 'dotenv';
import communitiesRouter from './routes/communities';
import postsRouter from './routes/posts';
import commentsRouter from './routes/comments';
import votesRouter from './routes/votes';
import usersRouter from './routes/users';
import messagesRouter from './routes/messages';
import storiesRouter from './routes/stories';
import { probeSchema } from './config/schema';
import { BadInput } from './lib/validate';
import notesRouter from './routes/notes';
import blocksRouter from './routes/blocks';
import reportsRouter from './routes/reports';
import moderationRouter from './routes/moderation';
import invitesRouter from './routes/invites';
import notificationsRouter from './routes/notifications';
import telegramRouter, { setupTelegramWebhook } from './routes/telegram';

dotenv.config();

const app = express();

/**
 * Один прокси впереди.
 *
 * На Railway (как на любом хостинге) запрос приходит не от человека, а от
 * их балансировщика, и настоящий адрес лежит в заголовке X-Forwarded-For.
 * Без этой строки счётчик частоты видел бы один-единственный адрес — прокси —
 * и, посчитав всех за одного, запер бы сразу всех.
 *
 * Единица, а не `true`: доверять всей цепочке заголовков значит верить и тому,
 * что подставил сам клиент, — то есть отдать обход ограничения любому, кто
 * умеет слать заголовки. Доверяем ровно одному звену, тому, что наше.
 */
app.set('trust proxy', 1);

/**
 * Заголовки безопасности.
 *
 * contentSecurityPolicy выключен намеренно: политику содержимого задаёт тот,
 * кто отдаёт страницы, а здесь только JSON — заголовок, ограничивающий
 * источники скриптов в ответе без единого скрипта, ничего не защищает, зато
 * ломает панель, если её однажды повесят на этот же домен.
 *
 * crossOriginResourcePolicy тоже: он по умолчанию режет обращения с чужого
 * домена, а фронтенд у нас как раз на чужом (Vercel), и CORS уже разбирает,
 * кому можно.
 */
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  })
);

/**
 * Сжатие ответов.
 *
 * Лента — это JSON с текстами записей, и он жмётся вчетверо-впятеро. На
 * домашнем вайфае разницы не видно, на мобильном интернете это разница между
 * «открылось» и «крутится».
 *
 * Порог в килобайт: ответы мельче него от сжатия не выигрывают — заголовки и
 * работа процессора съедают выгоду, — а /health на каждом опросе хостинга
 * незачем жать вовсе.
 */
app.use(compression({ threshold: 1024 }));
const port = process.env.PORT || 4000;

/**
 * Кому разрешено обращаться к API.
 *
 * Список складывается из зашитых адресов разработки и переменной CORS_ORIGINS —
 * через запятую. Держать боевые домены в коде значит выпускать новую версию
 * из-за смены адреса фронтенда, а на хостинге это ещё и единственный способ
 * добавить домен, не имея под рукой репозитория.
 */
const allowedOrigins = [
  'http://localhost:3000',
  'https://agora-vert-nine.vercel.app',
  ...(process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
];

/**
 * В разработке дополнительно пускаем адреса из локальной сети: чтобы открыть
 * приложение с телефона, он обращается не к localhost (это был бы он сам),
 * а к адресу компьютера вида 192.168.x.x. Список статикой не задать — адрес
 * выдаёт роутер и он меняется, поэтому проверяем по маске частных диапазонов.
 *
 * В продакшене это выключено: там оба конца живут на своих доменах.
 */
const PRIVATE_NETWORK_ORIGIN = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/;

app.use(
  cors({
    origin(origin, callback) {
      // Без Origin приходят curl и запросы того же источника — их не режем.
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production' && PRIVATE_NETWORK_ORIGIN.test(origin)) {
        return callback(null, true);
      }
      /**
       * Отказ, а не ошибка.
       *
       * Здесь бросалось исключение, и express отвечал пятисоткой. На своей
       * машине это незаметно: чужих origin просто не бывает. В интернете они
       * идут постоянно — сканеры, чужие страницы с нашим адресом, старые
       * закладки, — и каждый такой запрос писался бы в логи как сбой сервера.
       * Настоящие ошибки в этом шуме уже не найти.
       *
       * false означает «не выдавать разрешающий заголовок». Браузер сам не
       * пустит такой ответ в чужую страницу — это и есть работа CORS, — а сервер
       * при этом остаётся исправным, потому что он и есть исправный.
       */
      return callback(null, false);
    },
  })
);
/**
 * Потолок на размер тела запроса.
 *
 * По умолчанию express берёт сто килобайт, и это молчаливое согласие принять
 * сто килобайт от кого угодно. Записи и реплики укладываются в единицы, а
 * картинки идут мимо нас — прямо в Storage. Так что двадцать пять с запасом.
 */
app.use(express.json({ limit: '256kb' }));

/**
 * Общий потолок частоты.
 *
 * Против скриптов, которые обходят ленту по кругу и жгут квоту в Supabase.
 * Ограничения на создание содержимого живут отдельно, на самих маршрутах (см.
 * middleware/rateLimit): там свой счётчик у каждого действия.
 *
 * Ключ — токен, если он есть, и адрес, только если его нет. Мобильные
 * операторы сажают за один внешний адрес тысячи абонентов: открытый чат
 * спрашивает сервер каждые шесть секунд, и двадцати соседям по вышке хватило
 * бы, чтобы по адресу упереться в потолок всем разом. Токен у каждого свой.
 *
 * Сам токен здесь не проверяется — это делает requireAuth дальше. Поддельный
 * токен счётчик не обманет: у каждого поддельного свой ключ, но все они
 * разобьются о requireAuth, не дойдя до базы.
 */
const commonLimit = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const auth = req.headers.authorization;
    return auth?.startsWith('Bearer ') ? `t:${auth.slice(7)}` : `ip:${ipKeyGenerator(req.ip ?? '')}`;
  },
  // Проверку живости не считаем: её дёргает хостинг, а не человек, и упереться
  // в свой же счётчик означало бы перезапуск здорового сервера.
  skip: (req) => req.path === '/health',
  message: { error: 'RATE_LIMITED' },
});

app.use(commonLimit);

app.get('/', (_req, res) => {
  res.json({ message: 'API is running' });
});

/**
 * Проверка живости для хостинга.
 *
 * Отдельно от корня и намеренно без обращения к базе. Хостинг спрашивает этот
 * адрес каждые несколько секунд, чтобы понять, жив ли процесс; сходи он при
 * этом в Supabase — получилась бы постоянная нагрузка на базу ради вопроса о
 * состоянии процесса, а недоступность базы убивала бы работающий сервер.
 *
 * Здоровье приложения и здоровье базы — разные вещи, и путать их в одной
 * проверке значит перезапускать одно из-за другого.
 */
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: Math.round(process.uptime()) });
});

app.use('/communities', communitiesRouter);
app.use('/posts', postsRouter);
app.use('/comments', commentsRouter);
app.use('/votes', votesRouter);
app.use('/users', usersRouter);
app.use('/messages', messagesRouter);
app.use('/stories', storiesRouter);
app.use('/notes', notesRouter);
app.use('/blocks', blocksRouter);
app.use('/reports', reportsRouter);
app.use('/moderation', moderationRouter);
app.use('/invites', invitesRouter);
app.use('/notifications', notificationsRouter);
app.use('/telegram', telegramRouter);

/**
 * Последний рубеж: то, что обработчики бросили, а не вернули.
 *
 * BadInput — отказ по содержимому запроса (lib/validate). Его текст написан
 * для человека и уходит как есть, с кодом 400. Слишком большое или битое тело
 * express.json тоже бросает сюда — и это ошибка клиента, а не сервера.
 *
 * Всё прочее — настоящий сбой: пишем в журнал целиком, а наружу отдаём общий
 * текст. Внутренности базы в ответе помогают только тому, кто ищет, куда
 * постучаться.
 */
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof BadInput) {
    res.status(400).json({ error: err.message });
    return;
  }
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.too.large') {
    res.status(413).json({ error: 'Слишком большой запрос' });
    return;
  }
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Некорректный запрос' });
    return;
  }
  console.error('unhandled', err);
  // Настоящий сбой — в мониторинг (если включён). BadInput и ошибки клиента
  // выше уже вернулись и сюда не доходят: шлём только то, за что отвечаем сами.
  if (sentryEnabled) Sentry.captureException(err);
  res.status(500).json({ error: 'Не удалось выполнить запрос, попробуйте ещё раз' });
});

/**
 * Слушаем на всех интерфейсах, а не только на localhost.
 *
 * В контейнере localhost — это сам контейнер, и хостинг до такого сервера не
 * дозвонится: проверка живости не проходит, деплой откатывается, а в логах при
 * этом «Server running». Тот же адрес нужен и для телефона в домашней сети.
 */
app.listen(Number(port), '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);

  /**
   * Спрашиваем базу, что в ней есть из необязательного.
   *
   * Миграции выполняются руками, и между выкладкой кода и выполнением миграции
   * всегда есть промежуток. Обычно новая возможность просто не работает — но
   * запрос к PostgREST со ссылкой на несуществующую колонку падает целиком,
   * унося с собой всё, что этим запросом бралось. Один раз спросив, дальше
   * строим выборки по факту (см. config/schema).
   */
  void probeSchema();

  // Вешаем вебхук Telegram-бота (подтверждение телефона). Без токена — no-op.
  void setupTelegramWebhook();

  /**
   * Греем соединение до Supabase сразу, не дожидаясь первого посетителя.
   *
   * Первое обращение платит за DNS, TCP и TLS — по замерам от двух до
   * двенадцати секунд, и достаётся этот счёт тому, кто открыл приложение
   * первым. Дальше соединение живёт в пуле и запросы идут за сотни
   * миллисекунд (см. config/http).
   *
   * Ответ не нужен и ошибка не важна: единственная задача запроса — открыть
   * соединение. Поэтому и таблица взята самая маленькая, с limit 1.
   */
  void (async () => {
    try {
      // Столько запросов разом, сколько соединений в пуле: каждый занимает своё
      // и заставляет его открыться. По одному греется только первое, а большой
      // пул с одним тёплым соединением хуже маленького — остальные девять
      // заплатят за TLS уже при живых посетителях.
      await Promise.all(
        Array.from({ length: HTTP_CONNECTIONS }, () =>
          supabase.from('users').select('id').limit(1)
        )
      );
      console.log(`Supabase: прогрето соединений — ${HTTP_CONNECTIONS}`);
    } catch {
      // Не важно: соединения открылись даже если запросы не удались.
    }
  })();
});
