-- 011: несколько снимков в записи и истории отдельной сущностью.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
-- Требует выполненных 001 (posts.image_url) и 004 (users).

-- ─── Несколько снимков в одной записи ───────────────────────────────────────
--
-- Массив, а не отдельная таблица post_images. Таблица понадобилась бы, если бы
-- у снимка была своя жизнь: подпись, автор, порядок, который меняют после
-- публикации. Ничего этого нет — снимки принадлежат записи целиком, читаются
-- всегда вместе с ней и всегда в одном и том же порядке. Отдельная таблица
-- добавила бы join к каждому запросу ленты ради данных, которые никогда не
-- нужны отдельно.
alter table public.posts add column if not exists image_urls text[];

-- Переносим то, что уже опубликовано, чтобы старые записи не остались без
-- снимка. Единственный снимок становится массивом из одного элемента.
update public.posts
   set image_urls = array[image_url]
 where image_url is not null
   and image_urls is null;

-- image_url оставляем и держим в согласии с массивом: на него смотрят
-- предпросмотр ссылки, письма и мобильный клиент, который обновляется
-- отдельно от веба. Первый снимок — обложка записи.
create or replace function public.sync_post_cover()
returns trigger
language plpgsql
as $$
begin
  if new.image_urls is not null and array_length(new.image_urls, 1) > 0 then
    new.image_url := new.image_urls[1];
  elsif new.image_url is not null and new.image_urls is null then
    new.image_urls := array[new.image_url];
  end if;
  return new;
end;
$$;

drop trigger if exists posts_cover_sync on public.posts;
create trigger posts_cover_sync
  before insert or update of image_urls, image_url on public.posts
  for each row execute function public.sync_post_cover();

-- ─── Истории ────────────────────────────────────────────────────────────────
--
-- Своя таблица, а не выборка из записей. До сих пор кружки наверху ленты
-- показывали последние записи автора — заглушка, которая врала: история и
-- запись живут по разным правилам. Запись остаётся навсегда и обсуждается;
-- история исчезает через сутки и обсуждению не подлежит. Одно нельзя выдать
-- за другое, не сломав ожидания от обоих.
--
-- post_id — репост записи в историю: показать её тем, кто не долистал. Тогда
-- own-поля пустые, а содержимое берётся из записи. Ссылка, а не копия: правка
-- записи должна быть видна и в истории, а удаление — уносить историю с собой.
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.users (id) on delete cascade,
  post_id uuid references public.posts (id) on delete cascade,
  body text,
  image_url text,
  created_at timestamptz not null default now(),
  -- Сутки — не техническое ограничение, а суть жанра: истории смотрят, потому
  -- что они кончатся. Срок хранится полем, а не вычисляется из created_at,
  -- чтобы его можно было изменить для отдельной истории, не переписывая
  -- запросы.
  expires_at timestamptz not null default now() + interval '24 hours',
  -- Пустая история — ошибка приложения, а не допустимое состояние.
  constraint stories_have_content check (
    post_id is not null or body is not null or image_url is not null
  )
);

-- Лента историй собирается по авторам и отсекается по сроку — оба поля в одном
-- индексе, потому что в запросе они идут вместе.
create index if not exists stories_author_idx
  on public.stories (author_id, created_at desc);

create index if not exists stories_expires_idx
  on public.stories (expires_at);

-- Кто что посмотрел. Пара, а не счётчик: кружок должен погаснуть у того, кто
-- посмотрел, и остаться ярким у остальных — по счётчику этого не узнать.
create table if not exists public.story_views (
  story_id uuid not null references public.stories (id) on delete cascade,
  viewer_id uuid not null references public.users (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index if not exists story_views_viewer_idx
  on public.story_views (viewer_id);

-- Просроченные истории убираем при каждой записи новой: отдельного планировщика
-- в проекте нет, а держать их вечно — значит отдавать клиенту мусор, который он
-- всё равно отфильтрует. Триггер после вставки дешевле любого расписания:
-- историй в сутки единицы, и чистка идёт по индексу.
create or replace function public.purge_expired_stories()
returns trigger
language plpgsql
as $$
begin
  delete from public.stories where expires_at < now();
  return null;
end;
$$;

drop trigger if exists stories_purge on public.stories;
create trigger stories_purge
  after insert on public.stories
  for each statement execute function public.purge_expired_stories();
