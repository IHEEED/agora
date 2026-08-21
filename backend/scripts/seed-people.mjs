/**
 * Демонстрационные люди и переписки.
 *
 * Без них половину интерфейса не на чем посмотреть: рекомендации показывают
 * двоих, мессенджер — одну строку, а как выглядит список из десяти диалогов и
 * лента подсказок, приходится воображать. Воображать интерфейс нельзя: ошибки
 * вроде разъезжающихся ников и налезающих меток видны только на количестве.
 *
 * Аккаунты создаются через административный интерфейс Supabase: строка в
 * public.users ссылается на auth.users, и вставить её саму по себе нельзя.
 * Почта у всех в домене parafraz.local — он не существует, письма никуда не
 * уйдут, а по нему же скрипт узнаёт своих при уборке.
 *
 * Запуск:  node scripts/seed-people.mjs
 * Убрать:  node scripts/seed-people.mjs --clean
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

/** По этому домену скрипт отличает своих от настоящих. */
const DOMAIN = 'parafraz.local';

const PEOPLE = [
  { username: 'vera.hodova', hello: 'Слушай, а «вслед» — это же ровно то, чего мне не хватало в тредах.' },
  { username: 'kostya.linza', hello: 'Кинул тебе запись про шрифты, глянь на досуге' },
  { username: 'nastya.grif', hello: 'Ты видел, что минусы теперь показывают отдельно? Наконец-то' },
  { username: 'pavel.osen', hello: 'Го в клуб про архитектуру, там движ' },
  { username: 'lida.marsh', hello: 'Не могу решить, оставлять ли тёмную тему по умолчанию' },
  { username: 'artem.dvor', hello: 'Слушай, у тебя истории отваливаются или только у меня?' },
  { username: 'sonya.pilot', hello: 'Спасибо за разбор, реально помогло' },
  { username: 'grisha.nott', hello: 'Давай созвон на неделе' },
  { username: 'marina.set', hello: 'Прочитала твою цепочку целиком. Согласна с третьей частью' },
  { username: 'timur.rekt', hello: 'Ок, понял, беру на себя' },
];

/** Переписки заводим не со всеми: список из десяти диалогов подряд — не жизнь. */
const CHATS = [
  ['vera.hodova', ['Слушай, а «вслед» — это же ровно то, чего мне не хватало в тредах.',
                   'Одна мысль в три захода и без каши в ленте', 'Как до этого никто не додумался']],
  ['kostya.linza', ['Кинул тебе запись про шрифты, глянь на досуге', 'Там про антикву в интерфейсах']],
  ['nastya.grif', ['Ты видел, что минусы теперь показывают отдельно?', 'Наконец-то видно, что запись спорная, а не мёртвая']],
  ['artem.dvor', ['Слушай, у тебя истории отваливаются или только у меня?']],
  ['sonya.pilot', ['Спасибо за разбор, реально помогло']],
  ['marina.set', ['Прочитала твою цепочку целиком', 'Согласна с третьей частью, про то что минус это участие']],
];

const clean = process.argv.includes('--clean');

/**
 * Переписки заводим со всеми настоящими пользователями, а не с первым попавшимся.
 *
 * Первая версия брала одного — и им оказался не тот, под кем открыто приложение:
 * скрипт отработал, отчитался, а в мессенджере было пусто. Пока аккаунтов
 * несколько, «настоящий» — понятие без единственного числа.
 */
const { data: realUsers } = await sb
  .from('users')
  .select('id, username, email')
  .not('email', 'like', `%@${DOMAIN}`);

if (!realUsers?.length) {
  console.error('Не нашёл ни одного настоящего пользователя — не от чьего лица заводить переписки.');
  process.exit(1);
}

const { data: existing } = await sb
  .from('users')
  .select('id, username, email')
  .like('email', `%@${DOMAIN}`);

if (clean) {
  for (const person of existing ?? []) {
    // Сообщения уйдут каскадом вместе с пользователем, если внешние ключи это
    // разрешают; если нет — убираем сами, чтобы не остались висеть ничьи.
    await sb.from('messages').delete().or(`sender_id.eq.${person.id},recipient_id.eq.${person.id}`);
    await sb.auth.admin.deleteUser(person.id).catch(() => undefined);
    await sb.from('users').delete().eq('id', person.id);
  }
  console.log(`Убрано демонстрационных людей: ${existing?.length ?? 0}`);
  process.exit(0);
}

const byName = new Map((existing ?? []).map((p) => [p.username, p]));

for (const person of PEOPLE) {
  if (byName.has(person.username)) continue;

  const email = `${person.username}@${DOMAIN}`;
  const { data: created, error } = await sb.auth.admin.createUser({
    email,
    // Пароль случайный и никому не сообщается: входить под этими аккаунтами
    // не нужно, они существуют только чтобы их было видно в списках.
    password: `demo-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    email_confirm: true,
  });

  if (error) {
    console.error(`${person.username}: ${error.message}`);
    continue;
  }

  // Профиль может создаваться триггером на auth.users. Если создался — дополним
  // ник, если нет — заведём строку сами.
  const { error: upsertError } = await sb
    .from('users')
    .upsert({ id: created.user.id, email, username: person.username }, { onConflict: 'id' });

  if (upsertError) {
    console.error(`${person.username}: профиль — ${upsertError.message}`);
    continue;
  }

  byName.set(person.username, { id: created.user.id, username: person.username, email });
  console.log('завёл', person.username);
}

// ─── Переписки ──────────────────────────────────────────────────────────────
//
// Время расставляем назад от сейчас: список переписок сортируется по последнему
// письму, и одинаковые отметки времени дали бы случайный порядок при каждом
// открытии.
for (const real of realUsers) {
  let minutesAgo = 5;

  for (const [username, lines] of CHATS) {
    const person = byName.get(username);
    if (!person) continue;

    const { data: already } = await sb
      .from('messages')
      .select('id')
      .or(`and(sender_id.eq.${person.id},recipient_id.eq.${real.id}),` +
          `and(sender_id.eq.${real.id},recipient_id.eq.${person.id})`)
      .limit(1);
    if (already?.length) continue;

    for (const [index, line] of lines.entries()) {
      await sb.from('messages').insert({
        sender_id: person.id,
        recipient_id: real.id,
        body: line,
        created_at: new Date(Date.now() - (minutesAgo + lines.length - index) * 60_000).toISOString(),
      });
    }
    console.log(`${real.username} ← ${username}: ${lines.length} реплик`);
    minutesAgo += 90;
  }
}

console.log('\nГотово. Убрать: node scripts/seed-people.mjs --clean');
