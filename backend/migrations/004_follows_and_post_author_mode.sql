-- 004: подписки между людьми + режим авторства поста.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный:
-- повторный запуск ничего не сломает.

-- ── Подписки ────────────────────────────────────────────────────────────────
-- Кто на кого подписан. Пара уникальна, на себя подписаться нельзя.
create table if not exists public.follows (
  follower_id uuid not null references public.users (id) on delete cascade,
  following_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);

-- Лента «на кого я подписан» читает по follower_id, счётчик подписчиков
-- в профиле — по following_id. Нужны оба направления.
create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_following_idx on public.follows (following_id);

alter table public.follows enable row level security;

-- Кто на кого подписан — не тайна: счётчики видны всем.
drop policy if exists "follows are readable by everyone" on public.follows;
create policy "follows are readable by everyone"
  on public.follows for select
  using (true);

-- А вот подписываться и отписываться можно только за себя.
drop policy if exists "users manage their own follows" on public.follows;
create policy "users manage their own follows"
  on public.follows for insert
  with check (auth.uid() = follower_id);

drop policy if exists "users remove their own follows" on public.follows;
create policy "users remove their own follows"
  on public.follows for delete
  using (auth.uid() = follower_id);

-- ── Режим авторства ─────────────────────────────────────────────────────────
-- Пост и так всегда лежит в сообществе (community_id обязателен). Этот флаг
-- отвечает не за принадлежность, а за подпись: false — «имя человека»,
-- true — «имя человека → название сообщества».
alter table public.posts
  add column if not exists post_as_community boolean not null default false;

comment on column public.posts.post_as_community is
  'true — пост подписан сообществом (ник → стрелка → название), false — только ником автора.';
