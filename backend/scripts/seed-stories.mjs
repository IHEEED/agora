/**
 * Демонстрационные истории.
 *
 * Пока лента историй пуста, весь верх экрана и просмотрщик не на чем
 * проверить: ни кружки, ни перелистывание кадров, ни жест закрытия. А жесты —
 * ровно то, что нельзя проверить запросом к серверу, только пальцем.
 *
 * Поэтому истории раздаются людям из seed-people.mjs, и у нескольких их по
 * многу: одна история не покажет ни полосок прогресса сверху, ни переходов
 * между кадрами, ни того, как выглядит длинная лента кружков с прокруткой.
 *
 * Сроки жизни разные намеренно. Всё созданное одной секундой выстраивается в
 * ленте случайным образом и не даёт увидеть порядок «свежие слева».
 *
 * Запуск:  node scripts/seed-stories.mjs
 * Убрать:  node scripts/seed-stories.mjs --clean
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/** Тот же домен, по которому seed-people.mjs узнаёт своих. */
const DOMAIN = 'parafraz.local';

/**
 * Кадры по авторам.
 *
 * У первых двоих по четыре и три кадра — на них проверяются полоски прогресса
 * и переход по нажатию в правую треть. У остальных по одному: так выглядит
 * обычная лента, где длинные истории редкость.
 */
const STORIES = {
  'vera.hodova': [
    'Утро начинается не с кофе, а с того, что кто-то опять переписал главный экран',
    'Три часа думала над одним абзацем. Оставила первый вариант',
    'Кажется, я поняла, зачем нужны цепочки',
    'Всё, ушла читать',
  ],
  'kostya.linza': [
    'Наборная касса на чердаке у деда. Пахнет свинцом и керосином',
    'Антиква в заголовках — не украшение, а темп чтения',
    'Завтра покажу, что получилось',
  ],
  'nastya.grif': ['Минусы теперь отдельно, и это меняет разговор целиком'],
  'pavel.osen': ['В клубе про архитектуру опять спор о слоях. Иду смотреть'],
  'lida.marsh': ['Тёмная тема по умолчанию — всё-таки да или всё-таки нет?'],
  'artem.dvor': ['Проверяю, дошла ли история. Если видите — дошла'],
  'sonya.pilot': ['Разбор помог. Переписала всё заново, стало короче вдвое'],
  'grisha.nott': ['Созвон перенесли. Освободился вечер'],
};

const clean = process.argv.includes('--clean');

/** Люди из seed-people.mjs. По ним же убираем: чужих историй не трогаем. */
async function demoPeople() {
  const { data, error } = await sb
    .from('users')
    .select('id, username, email')
    .like('email', `%@${DOMAIN}`);

  if (error) throw new Error(`не прочитать людей: ${error.message}`);
  return new Map(data.map((user) => [user.username, user.id]));
}

async function main() {
  const people = await demoPeople();

  if (people.size === 0) {
    console.log('Демонстрационных людей нет. Сначала: node scripts/seed-people.mjs');
    return;
  }

  if (clean) {
    const { error } = await sb.from('stories').delete().in('author_id', [...people.values()]);
    if (error) throw new Error(`не убрать: ${error.message}`);
    console.log(`Истории демонстрационных людей удалены (${people.size} авторов).`);
    return;
  }

  // Сначала убираем свои прошлые: повторный запуск не должен множить кадры.
  await sb.from('stories').delete().in('author_id', [...people.values()]);

  const rows = [];
  let minutesAgo = 0;

  for (const [username, frames] of Object.entries(STORIES)) {
    const authorId = people.get(username);
    if (!authorId) {
      console.log(`  пропускаю ${username} — такого человека нет`);
      continue;
    }

    for (const body of frames) {
      minutesAgo += 7;
      const created = new Date(Date.now() - minutesAgo * 60_000);

      rows.push({
        author_id: authorId,
        body,
        created_at: created.toISOString(),
        // Сутки от момента создания, как и в обычной жизни истории: иначе
        // самая старая исчезнет раньше, чем до неё дойдут смотреть.
        expires_at: new Date(created.getTime() + 24 * 3600_000).toISOString(),
      });
    }
  }

  const { error } = await sb.from('stories').insert(rows);
  if (error) throw new Error(`не вставить: ${error.message}`);

  console.log(`Готово: ${rows.length} историй у ${Object.keys(STORIES).length} человек.`);
  console.log('Убрать: node scripts/seed-stories.mjs --clean');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
