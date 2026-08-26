/**
 * Приветственная запись, закреплённая у всех.
 *
 * Первое, что видит пришедший по приглашению, — лента незнакомых людей. Даже
 * если она хорошая, непонятно, что здесь делать и кому говорить, если что-то
 * не работает. Закреплённая запись отвечает на оба вопроса разом и заодно
 * превращает обратную связь в разговор на виду: жалобы в комментариях читают
 * все, а не только тот, кому написали в личку.
 *
 * Снимать закреп — тем же скриптом с --unpin. Запись при этом остаётся: она
 * обычная, с комментариями и голосами, и удалять её вместе с закрепом значило
 * бы стереть весь разговор, который в ней завёлся.
 *
 * Запуск:  node scripts/pin-welcome.mjs
 * Снять:   node scripts/pin-welcome.mjs --unpin
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const TITLE = 'Добро пожаловать в Parafraz!';

const BODY = [
  'Всем спасибо за использование новой социальной сети, надеемся, Вас она заинтересовала!',
  '',
  'Помогите Parafraz развиться, напишите в комментариях Ваши пожелания о том, какие бы функции Вы бы хотели здесь видеть.',
  '',
  'Также просим Вас оставлять здесь найденные Вами баги, которые стоит бы починить.',
  '',
  'Помните, чтобы Вас услышали, достаточно всего пары фраз))',
].join('\n');

const unpin = process.argv.includes('--unpin');

if (unpin) {
  const { error } = await sb.from('posts').update({ pinned_global: false }).eq('pinned_global', true);
  if (error) {
    console.error('Не смог снять закреп:', error.message);
    process.exit(1);
  }
  console.log('Закреп снят. Сама запись осталась в ленте.');
  process.exit(0);
}

// ─── От чьего имени ─────────────────────────────────────────────────────────
//
// От админа. Объявление «от разработчиков» и должно быть подписано тем, к кому
// после него придут с вопросами.
const { data: admins, error: adminError } = await sb
  .from('users')
  .select('id, username')
  .eq('role', 'admin')
  .order('created_at')
  .limit(1);

if (adminError || !admins?.length) {
  console.error('Не нашёл ни одного админа. Выдайте кому-нибудь роль и повторите.');
  process.exit(1);
}

const author = admins[0];

// ─── Куда ───────────────────────────────────────────────────────────────────
//
// Запись обязана лежать в каком-то клубе: так устроена схема, и это правильно —
// у записи без клуба нет места, куда вернуться из ленты.
const { data: communities, error: communityError } = await sb
  .from('communities')
  .select('id, name')
  .order('created_at')
  .limit(1);

if (communityError || !communities?.length) {
  console.error('Клубов нет — создайте хотя бы один и повторите.');
  process.exit(1);
}

const community = communities[0];

// Повторный запуск не должен плодить одинаковые объявления: если запись с этим
// заголовком уже есть, просто закрепляем её заново.
const { data: existing } = await sb
  .from('posts')
  .select('id')
  .eq('title', TITLE)
  .eq('author_id', author.id)
  .limit(1);

// Закреп у нас один: прежний снимаем, иначе наверху ленты соберётся стопка.
await sb.from('posts').update({ pinned_global: false }).eq('pinned_global', true);

if (existing?.length) {
  const { error } = await sb
    .from('posts')
    .update({ pinned_global: true, body: BODY })
    .eq('id', existing[0].id);

  if (error) {
    console.error('Не смог обновить:', error.message);
    process.exit(1);
  }

  console.log(`Запись уже была — обновил текст и закрепил заново (${existing[0].id}).`);
  process.exit(0);
}

const { data: created, error } = await sb
  .from('posts')
  .insert({
    title: TITLE,
    body: BODY,
    author_id: author.id,
    community_id: community.id,
    pinned_global: true,
  })
  .select('id')
  .single();

if (error) {
  console.error('Не смог создать:', error.message);
  process.exit(1);
}

console.log(`Готово: запись ${created.id} закреплена от имени ${author.username} в клубе «${community.name}».`);
console.log('Снять: node scripts/pin-welcome.mjs --unpin');
