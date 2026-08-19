-- 014: досыл к 013 — триггер счётчика репостов.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
--
-- Что случилось. В 013 этот триггер лежал внутри блока do $$ ... $$, который
-- через execute создавал функцию с телом в $body$ — три уровня dollar-кавычек,
-- вложенных друг в друга. Задумано это было ради одной проверки: таблица
-- reposts появляется миграцией 006, и у того, кто её не выполнил, создание
-- триггера упало бы. На деле блок молча не создал ни функцию, ни триггер:
-- голоса и комментарии считались, репосты стояли на нуле.
--
-- Проверено опытом: вставка репоста не двигала repost_count.
--
-- Здесь то же самое написано прямо. Если таблицы reposts нет, скрипт честно
-- упадёт на первой же строке с понятным сообщением — и это лучше, чем
-- умалчивание: выполнить сначала 006 и вернуться сюда занимает минуту, а
-- расхождение счётчика с правдой не показывает себя вообще никак.

create or replace function public.bump_post_reposts()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set repost_count = repost_count + 1 where id = new.post_id;
  else
    -- greatest, а не просто минус один: если счётчик уже разошёлся с правдой,
    -- уводить его в отрицательные значения незачем.
    update public.posts set repost_count = greatest(0, repost_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists reposts_post_count on public.reposts;
create trigger reposts_post_count
  after insert or delete on public.reposts
  for each row execute function public.bump_post_reposts();

-- Пересчитываем накопившееся: пока триггера не было, счётчик отставал.
update public.posts p
   set repost_count = coalesce((select count(*) from public.reposts r where r.post_id = p.id), 0);
