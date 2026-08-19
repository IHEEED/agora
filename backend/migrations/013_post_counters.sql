-- 013: счётчики записи колонками, а не пересчётом на каждый запрос.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
--
-- Зачем. Лента собирается шестью запросами: сами записи, потом голоса,
-- комментарии, репосты, опросы и подписки — каждый тянет все строки по списку
-- записей, чтобы сложить их в памяти Node. На тридцати записях это пять лишних
-- походов в базу, и с ростом числа голосов каждый становится тяжелее: считать
-- сумму по десяти тысячам строк ради тридцати чисел.
--
-- Счётчик рядом с записью читается вместе с ней и не стоит ничего. Плата —
-- обязанность держать его в согласии с правдой, и делают это триггеры, а не
-- приложение: запросы идут сервисным ключом, RLS его не касается, и любая
-- забытая ветка кода разошлась бы с базой навсегда.

alter table public.posts add column if not exists score integer not null default 0;
alter table public.posts add column if not exists comment_count integer not null default 0;
alter table public.posts add column if not exists repost_count integer not null default 0;

-- ─── Пересчёт того, что уже накопилось ──────────────────────────────────────
--
-- Один раз, при выполнении миграции. Дальше значения ведут триггеры.
update public.posts p
   set score = coalesce((select sum(v.value) from public.votes v where v.post_id = p.id), 0);

update public.posts p
   set comment_count = coalesce((select count(*) from public.comments c where c.post_id = p.id), 0);

update public.posts p
   set repost_count = coalesce((select count(*) from public.reposts r where r.post_id = p.id), 0);

-- ─── Голоса ─────────────────────────────────────────────────────────────────
--
-- Считаем разницей, а не пересчётом суммы: пересчёт при каждом голосе вернул бы
-- ту самую тяжёлую операцию, от которой мы уходим, только внутрь транзакции.
create or replace function public.bump_post_score()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and new.post_id is not null then
    update public.posts set score = score + new.value where id = new.post_id;
  elsif tg_op = 'DELETE' and old.post_id is not null then
    update public.posts set score = score - old.value where id = old.post_id;
  elsif tg_op = 'UPDATE' and new.post_id is not null then
    -- Смена «за» на «против» — это дельта в два голоса, а не в один.
    update public.posts set score = score - old.value + new.value where id = new.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists votes_post_score on public.votes;
create trigger votes_post_score
  after insert or update or delete on public.votes
  for each row execute function public.bump_post_score();

-- ─── Комментарии ────────────────────────────────────────────────────────────
create or replace function public.bump_post_comments()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
  else
    update public.posts set comment_count = greatest(0, comment_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists comments_post_count on public.comments;
create trigger comments_post_count
  after insert or delete on public.comments
  for each row execute function public.bump_post_comments();

-- ─── Репосты ────────────────────────────────────────────────────────────────
--
-- Прямо, без обёртки. Здесь стоял блок do $$ ... $$, который через execute
-- создавал функцию с телом в $body$ — три уровня dollar-кавычек друг в друге —
-- ради одной проверки: таблица reposts появляется миграцией 006, и без неё
-- создание триггера упало бы. Блок молча не создал ни функцию, ни триггер, и
-- репосты остались на нуле, пока голоса и комментарии считались.
--
-- Без обёртки скрипт на отсутствующей таблице честно упадёт с понятным
-- сообщением. Это лучше умалчивания: выполнить сначала 006 занимает минуту, а
-- разошедшийся счётчик не показывает себя никак.
create or replace function public.bump_post_reposts()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set repost_count = repost_count + 1 where id = new.post_id;
  else
    update public.posts set repost_count = greatest(0, repost_count - 1) where id = old.post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists reposts_post_count on public.reposts;
create trigger reposts_post_count
  after insert or delete on public.reposts
  for each row execute function public.bump_post_reposts();

-- Сортировка ленты идёт по этим полям — индексы под неё.
create index if not exists posts_score_idx on public.posts (score desc);
create index if not exists posts_comment_count_idx on public.posts (comment_count desc);
