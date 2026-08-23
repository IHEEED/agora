/**
 * Болванки историй и лица демонстрационным людям.
 *
 * Полоса историй — первое, что видно в ленте, и с одним-двумя кружками про неё
 * ничего не понять: ни как ведёт себя прокрутка, ни где ломается длинный ник,
 * ни что происходит с кольцом у просмотренных. Ошибки такого рода видны только
 * на количестве, поэтому десять.
 *
 * Картинки берутся с picsum.photos по фиксированному номеру: адрес с номером
 * всегда отдаёт один и тот же снимок, то есть после перезапуска полоса
 * выглядит так же. Со случайными адресами каждый заход давал бы новую
 * картинку, и «поменялось ли что-то после правки» стало бы невозможно понять.
 *
 * Запуск:  node scripts/seed-stories.mjs
 * Убрать:  node scripts/seed-stories.mjs --clean
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/** По этому домену скрипт отличает демонстрационных людей от настоящих. */
const DOMAIN = 'parafraz.local';

/**
 * Кадр на человека: номер снимка и подпись.
 *
 * Подписи разной длины намеренно — от двух слов до трёх строк. Ровные тексты
 * ничего не проверяют, а вся работа вёрстки историй начинается там, где текст
 * не помещается.
 */
const STORIES = [
  { user: 'vera.hodova',  photo: 1015, body: 'Дочитала ту цепочку про шрифты. Третья часть — золото.' },
  { user: 'kostya.linza', photo: 1025, body: 'Рабочее место на сегодня' },
  { user: 'nastya.grif',  photo: 1039, body: null },
  { user: 'pavel.osen',   photo: 1043, body: 'Спор в клубе про архитектуру идёт четвёртый день и, кажется, все уже забыли, с чего начали, но остановиться никто не может' },
  { user: 'lida.marsh',   photo: 1050, body: 'Тёмная тема победила' },
  { user: 'artem.dvor',   photo: 1057, body: 'Ок, у меня истории работают' },
  { user: 'sonya.pilot',  photo: 1069, body: 'Вид из окна, который я обещала' },
  { user: 'grisha.nott',  photo: 1074, body: null },
  { user: 'marina.set',   photo: 1080, body: 'Читаю вторую подряд цепочку и понимаю, что формат работает: одна мысль, три захода, и никакой каши' },
  { user: 'timur.rekt',   photo: 1084, body: 'Взял на себя, как и договаривались' },
];

/**
 * Лица. Тот же приём с фиксированным номером, только квадрат 200 на 200:
 * аватарка нигде не показывается крупнее, а лишние килобайты на каждой
 * карточке ленты складываются в заметные.
 */
const avatarFor = (seed) => `https://picsum.photos/seed/${seed}/200/200`;

const clean = process.argv.includes('--clean');

const { data: people, error } = await sb
  .from('users')
  .select('id, username, email')
  .like('email', `%@${DOMAIN}`);

if (error) {
  console.error('Не смог прочитать пользователей:', error.message);
  process.exit(1);
}

if (!people?.length) {
  console.error('Демонстрационных людей нет. Сначала: node scripts/seed-people.mjs');
  process.exit(1);
}

const byName = new Map(people.map((p) => [p.username, p]));

if (clean) {
  const ids = people.map((p) => p.id);
  const { error: storyError } = await sb.from('stories').delete().in('author_id', ids);
  if (storyError) console.error('истории:', storyError.message);
  const { error: faceError } = await sb.from('users').update({ avatar_url: null }).in('id', ids);
  if (faceError) console.error('аватарки:', faceError.message);
  console.log(`Убрано: истории и лица у ${ids.length} демонстрационных людей`);
  process.exit(0);
}

// ─── Лица ───────────────────────────────────────────────────────────────────
for (const person of people) {
  const { error: faceError } = await sb
    .from('users')
    .update({ avatar_url: avatarFor(person.username) })
    .eq('id', person.id);

  if (faceError) {
    // Колонки может не быть, если 015 ещё не выполнена. Говорим об этом один
    // раз и понятно, а не двадцатью одинаковыми строками подряд.
    if (/avatar_url/.test(faceError.message)) {
      console.error('Нет колонки users.avatar_url — выполните миграцию 015 и повторите.');
      break;
    }
    console.error(`${person.username}: ${faceError.message}`);
  }
}

// ─── Истории ────────────────────────────────────────────────────────────────
//
// Время расставляем назад от текущего момента: полоса сортируется по свежести,
// и при одинаковых отметках порядок кружков менялся бы от захода к заходу.
let minutesAgo = 12;
let made = 0;

for (const item of STORIES) {
  const person = byName.get(item.user);
  if (!person) continue;

  const { data: already } = await sb
    .from('stories')
    .select('id')
    .eq('author_id', person.id)
    .gt('expires_at', new Date().toISOString())
    .limit(1);
  if (already?.length) continue;

  const createdAt = new Date(Date.now() - minutesAgo * 60_000);
  const { error: insertError } = await sb.from('stories').insert({
    author_id: person.id,
    body: item.body,
    image_url: `https://picsum.photos/id/${item.photo}/900/1600`,
    created_at: createdAt.toISOString(),
    // Сутки от момента съёмки, а не от «сейчас»: иначе самая старая история
    // висела бы дольше самой свежей.
    expires_at: new Date(createdAt.getTime() + 24 * 60 * 60_000).toISOString(),
  });

  if (insertError) {
    console.error(`${item.user}: ${insertError.message}`);
    continue;
  }

  made += 1;
  minutesAgo += 37;
  console.log('история', item.user);
}

console.log(`\nГотово: историй ${made}, лиц ${people.length}.`);
console.log('Убрать: node scripts/seed-stories.mjs --clean');
