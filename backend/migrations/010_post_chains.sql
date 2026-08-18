-- 010: «вслед» — записи, продолжающие предыдущую запись того же автора.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.

-- На какую запись эта отвечает продолжением.
--
-- Ссылка на предыдущую, а не номер в цепочке и не общий идентификатор ветки.
-- С номером пришлось бы перенумеровывать хвост при удалении середины; с общим
-- идентификатором — держать его в согласии у всех записей цепочки. Ссылка на
-- предшественника не требует ни того, ни другого: цепочка собирается проходом
-- по ссылкам, а удаление середины сшивает её через on delete set null, оставляя
-- обе половины отдельными записями.
alter table public.posts
  add column if not exists continues_post_id uuid
  references public.posts (id) on delete set null;

-- Продолжение ищут по предшественнику: «что было написано вслед за этим».
create index if not exists posts_continues_idx
  on public.posts (continues_post_id)
  where continues_post_id is not null;

-- Продолжать можно только свою запись, и только одной.
--
-- Первое — правило приличия: цепочка это одна мысль одного человека, а не
-- способ дописать за другого. Второе — про форму: если вслед одной записи
-- можно написать две, цепочка перестаёт быть цепочкой и становится деревом,
-- которое нечем показать в ленте.
--
-- Оба условия проверяются здесь, а не только в приложении: запросы идут
-- сервисным ключом, RLS его не касается, и единственное место, где правило
-- нельзя обойти, — сама таблица.
create or replace function public.check_post_chain()
returns trigger
language plpgsql
as $$
declare
  parent_author uuid;
  existing uuid;
begin
  if new.continues_post_id is null then
    return new;
  end if;

  select author_id into parent_author
  from public.posts
  where id = new.continues_post_id;

  if parent_author is null then
    raise exception 'Запись, которую продолжают, не найдена';
  end if;

  if parent_author <> new.author_id then
    raise exception 'Продолжить можно только свою запись';
  end if;

  select id into existing
  from public.posts
  where continues_post_id = new.continues_post_id
    and id <> new.id
  limit 1;

  if existing is not null then
    raise exception 'У этой записи уже есть продолжение';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_chain_guard on public.posts;
create trigger posts_chain_guard
  before insert or update of continues_post_id on public.posts
  for each row execute function public.check_post_chain();
