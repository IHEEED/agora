import { supabase } from '../config/supabase';

/**
 * Кого не показывать этому человеку.
 *
 * В набор входят обе стороны: и те, кого он заблокировал сам, и те, кто
 * заблокировал его. Односторонний вариант выглядит логичнее — «я его скрыл,
 * значит его и нет», — но тогда заблокировавший продолжает видеть в ленте
 * записи того, от кого он ушёл, стоит тому ответить в общем обсуждении.
 * Блокировка, которую видно только с одной стороны, это занавеска, а не стена.
 *
 * Один запрос вместо двух: PostgREST умеет `or`, и обе половины лежат в одной
 * таблице.
 */
export async function hiddenUserIds(userId: string | undefined): Promise<Set<string>> {
  if (!userId) return new Set();

  const { data, error } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

  if (error) {
    console.error('blocks: lookup failed', error);
    // Пустой набор означает «никого не прячем». Это осознанный выбор в пользу
    // работающей ленты: показать лишнее неприятно, отдать пустую ленту — сломано.
    return new Set();
  }

  const hidden = new Set<string>();
  for (const row of data) {
    const other = row.blocker_id === userId ? row.blocked_id : row.blocker_id;
    hidden.add(other as string);
  }
  return hidden;
}

/**
 * Стоит ли между этими двоими блокировка — в любую сторону.
 *
 * Спрашивается перед отправкой сообщения и перед подпиской, то есть на горячем
 * пути, поэтому проверка узкая: две конкретные пары, а не весь список.
 */
export async function isBlockedBetween(a: string, b: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('blocks')
    .select('blocker_id')
    .or(
      `and(blocker_id.eq.${a},blocked_id.eq.${b}),and(blocker_id.eq.${b},blocked_id.eq.${a})`
    )
    .limit(1);

  if (error) {
    console.error('blocks: pair lookup failed', error);
    return false;
  }

  return data.length > 0;
}
