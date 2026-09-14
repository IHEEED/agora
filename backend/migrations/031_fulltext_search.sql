-- 031: полнотекстовый поиск по записям и клубам.
--
-- Раньше поиск шёл подстрокой (ilike) — без морфологии («стол» не находил
-- «столы») и без индекса, то есть последовательным перебором. Теперь у записей
-- и клубов есть генерируемая tsvector-колонка с русской конфигурацией и GIN-
-- индекс: поиск идёт по индексу и понимает словоформы.
--
-- Конфигурацию задаём явно ('russian'::regconfig) — в этой форме to_tsvector
-- IMMUTABLE, и её можно класть в generated-колонку. Однословный to_tsvector(body)
-- зависит от настройки соединения (STABLE) и в generated-колонку не годится.
--
-- Латиница в 'russian'-конфигурации обрабатывается как есть (без стемминга) —
-- этого достаточно: контент в основном русский, а точные латинские слова
-- по-прежнему находятся.

alter table public.posts
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('russian'::regconfig, coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored;

create index if not exists posts_search_idx
  on public.posts using gin (search_vector);

alter table public.communities
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('russian'::regconfig, coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored;

create index if not exists communities_search_idx
  on public.communities using gin (search_vector);
