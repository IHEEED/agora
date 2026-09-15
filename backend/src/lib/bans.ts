import { supabase } from '../config/supabase';

/**
 * Кто сейчас в бане — их записи прячем из ленты и поиска.
 *
 * Один запрос на всех (список общий), на каждый заход в ленту: банов единицы,
 * это дёшево. `banned_until > now` ловит и срочные баны, и вечные ('infinity'
 * больше любой даты), а истёкшие — нет: по окончании срока записи возвращаются
 * в ленту сами, как и право писать. null (не забанен) в сравнение не попадает.
 */
export async function bannedUserIds(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .gt('banned_until', new Date().toISOString());

  if (error || !data) return new Set();
  return new Set(data.map((row) => row.id as string));
}
