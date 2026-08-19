// Первым импортом, до всего остального: он настраивает пул соединений, и
// клиент Supabase должен создаваться уже с ним (см. config/http).
import { HTTP_CONNECTIONS } from './config/http';
import { supabase } from './config/supabase';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import communitiesRouter from './routes/communities';
import postsRouter from './routes/posts';
import commentsRouter from './routes/comments';
import votesRouter from './routes/votes';
import usersRouter from './routes/users';
import messagesRouter from './routes/messages';
import storiesRouter from './routes/stories';

dotenv.config();

const app = express();
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
      return callback(new Error(`CORS: origin ${origin} не разрешён`));
    },
  })
);
app.use(express.json());

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
