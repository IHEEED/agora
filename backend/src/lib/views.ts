/**
 * Засчитывать ли просмотр.
 *
 * Просмотр — анонимный POST, и прогон накрутил двадцать просмотров двадцатью
 * запросами без входа. Клиент свои повторы уже гасит сам (markPostViewed), но
 * клиенту, который гасить не хочет, это не мешает.
 *
 * Помним пару «зритель — запись» шесть часов. Зритель — токен, если он есть,
 * иначе адрес. Одного токена мало: поддельных токенов можно наделать сколько
 * угодно, а проверять каждый в Supabase ради счётчика просмотров — поход в
 * сеть на каждую пролистанную карточку. Поэтому второй потолок — не больше
 * двадцати разных зрителей с одного адреса на одну запись за то же окно.
 *
 * Двадцать, а не один: за одним адресом мобильного оператора сидят тысячи
 * абонентов, и считать их всех одним зрителем значило бы занижать просмотры
 * ровно у тех записей, которые читают с телефона.
 *
 * Память процесса, а не база. Перезапуск сервера обнуляет окно — это цена
 * отказа от записи в базу на каждый просмотр, и для счётчика она приемлема.
 */
const WINDOW_MS = 6 * 60 * 60_000;
const VIEWERS_PER_ADDRESS = 20;
/** Потолок памяти: около двухсот тысяч пар — несколько десятков мегабайт. */
const MAX_ENTRIES = 200_000;

const seen = new Map<string, number>();
const perAddress = new Map<string, { count: number; since: number }>();

function prune(now: number) {
  for (const [key, at] of seen) if (now - at >= WINDOW_MS) seen.delete(key);
  for (const [key, entry] of perAddress) if (now - entry.since >= WINDOW_MS) perAddress.delete(key);
}

export function countView(address: string, viewer: string, postId: string): boolean {
  const now = Date.now();
  if (seen.size + perAddress.size > MAX_ENTRIES) prune(now);

  const viewerKey = `${viewer}|${postId}`;
  const last = seen.get(viewerKey);
  if (last !== undefined && now - last < WINDOW_MS) return false;

  const addressKey = `${address}|${postId}`;
  const entry = perAddress.get(addressKey);
  const fresh = !entry || now - entry.since >= WINDOW_MS;
  if (!fresh && entry.count >= VIEWERS_PER_ADDRESS) return false;

  seen.set(viewerKey, now);
  perAddress.set(addressKey, fresh ? { count: 1, since: now } : { count: entry.count + 1, since: entry.since });
  return true;
}
