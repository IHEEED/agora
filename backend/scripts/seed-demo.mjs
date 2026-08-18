/**
 * Демонстрационные записи: несколько снимков в одной и цепочка «вслед».
 *
 * Отдельный скрипт, а не создание через приложение, по одной причине: публикация
 * из интерфейса требует подтверждённого телефона, а для показа механики это
 * лишний шаг. Пишем сервисным ключом напрямую — тем же, которым ходит бэкенд.
 *
 * Запуск: node scripts/seed-demo.mjs
 * Удалить созданное: node scripts/seed-demo.mjs --clean
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/** Пометка в тексте, по которой скрипт узнаёт свои записи и умеет их убрать. */
const MARK = '[demo]';

const clean = process.argv.includes('--clean');

const { data: recent, error: readError } = await supabase
  .from('posts')
  .select('id, author_id, title, body, image_url')
  .order('created_at', { ascending: false })
  .limit(40);

if (readError) {
  console.error('Не удалось прочитать записи:', readError.message);
  process.exit(1);
}

if (clean) {
  const mine = recent.filter((post) => (post.body ?? '').includes(MARK));
  for (const post of mine) await supabase.from('posts').delete().eq('id', post.id);
  console.log(`Убрано демо-записей: ${mine.length}`);
  process.exit(0);
}

const author = recent[0]?.author_id;
if (!author) {
  console.error('В базе нет ни одной записи — не от чьего имени публиковать.');
  process.exit(1);
}

// Картинки берём из уже опубликованного: своих файлов у скрипта нет, а
// придумывать внешние адреса значит зависеть от чужого хостинга.
const images = [...new Set(recent.map((post) => post.image_url).filter(Boolean))];
if (images.length < 3) {
  console.error('Мало картинок в базе, чтобы показать карусель.');
  process.exit(1);
}

async function insert(row) {
  const { data, error } = await supabase.from('posts').insert(row).select('id, title').single();
  if (error) throw new Error(`${row.title}: ${error.message}`);
  return data;
}

const gallery = await insert({
  author_id: author,
  title: 'Пять кадров одного вечера',
  body: `Листается вбок: стрелками, точками внизу или пальцем. Любой кадр открывается во весь экран, и там листается тоже — свайпом, стрелками на клавиатуре, вниз закрывается. ${MARK}`,
  image_url: images[0],
  image_urls: images.slice(0, 5),
});
console.log('Галерея:', gallery.title, gallery.id);

const first = await insert({
  author_id: author,
  title: 'Почему у нас две стрелки, а не сердце',
  body: `Сердце говорит «мне нравится» и молчит обо всём остальном. Несогласие в такой системе выражается только уходом — человек закрывает запись и не возвращается, а автор видит ровно ноль. ${MARK}`,
  image_url: null,
});
console.log('Начало цепочки:', first.title, first.id);

const second = await insert({
  author_id: author,
  title: 'Продолжаю: минус — это не наказание',
  body: `Минус говорит «я прочитал и не согласен». Это участие, а не удар: запись с двадцатью плюсами и восемнадцатью минусами интереснее записи с пятью плюсами — значит, зацепило. ${MARK}`,
  image_url: images[1] ?? null,
  continues_post_id: first.id,
});
console.log('Вслед 2:', second.title, second.id);

const third = await insert({
  author_id: author,
  title: 'И последнее',
  body: `Цепочка идёт в одну линию: продолжить можно только свою запись и только один раз. За этим следит триггер в базе, а не вежливость интерфейса. ${MARK}`,
  image_url: null,
  continues_post_id: second.id,
});
console.log('Вслед 3:', third.title, third.id);

console.log('\nГотово. Убрать: node scripts/seed-demo.mjs --clean');
