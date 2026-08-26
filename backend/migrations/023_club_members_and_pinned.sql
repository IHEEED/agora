-- 023: подписка на клуб и закреплённая запись.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.

-- ── Подписка на клуб ────────────────────────────────────────────────────────
--
-- Подписок на клубы не было вовсе: человек заходил в клуб, читал и уходил, а
-- вернуться мог только вспомнив название. Подписка на людей при этом есть с
-- четвёртой миграции — то есть половина сети умела запоминать, а половина нет.
--
-- Отдельная таблица, а не массив в клубе: подписчиков считают, по ним строят
-- ленту, и хранить их списком внутри строки значило бы переписывать всю строку
-- на каждую подписку.
create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

-- Два направления, два вопроса: «мои клубы» и «сколько подписчиков у клуба».
create index if not exists community_members_user_idx
  on public.community_members (user_id);
create index if not exists community_members_community_idx
  on public.community_members (community_id);

alter table public.community_members enable row level security;

-- Кто в клубе — не тайна: счётчик виден всем.
drop policy if exists community_members_read on public.community_members;
create policy community_members_read on public.community_members
  for select using (true);

-- А вступать и выходить можно только за себя.
drop policy if exists community_members_own on public.community_members;
create policy community_members_own on public.community_members
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Закреплённая запись ─────────────────────────────────────────────────────
--
-- Одна запись наверху общей ленты у всех. Нужна редко и ненадолго: объявление
-- от тех, кто делает приложение, — «мы здесь, напишите, чего не хватает».
--
-- Колонка, а не отдельная таблица «объявления»: закреплённая запись — обычная
-- запись, её так же комментируют и поддерживают голосом. Отдельная сущность
-- означала бы второй вид записей со своими комментариями и своими правилами.
alter table public.posts add column if not exists pinned_global boolean not null default false;

-- Закреплённых единицы, а спрашивают о них на каждом открытии ленты.
create index if not exists posts_pinned_idx on public.posts (created_at desc)
  where pinned_global;

comment on column public.posts.pinned_global is
  'Показывать первой в общей ленте у всех. Снимается тем же update, что и ставится.';
