-- 006: репосты.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.

-- Кто какой пост репостнул. Пара уникальна: повторное нажатие снимает репост,
-- а не добавляет второй — счётчик иначе накручивался бы одним человеком.
create table if not exists public.reposts (
  user_id uuid not null references public.users (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- Вкладка «Репосты» в профиле читает по user_id, счётчик под постом —
-- по post_id. Нужны оба направления.
create index if not exists reposts_user_idx on public.reposts (user_id);
create index if not exists reposts_post_idx on public.reposts (post_id);

alter table public.reposts enable row level security;

-- Кто репостнул — видно всем: это публичное действие.
drop policy if exists "reposts are readable by everyone" on public.reposts;
create policy "reposts are readable by everyone"
  on public.reposts for select
  using (true);

drop policy if exists "users create their own reposts" on public.reposts;
create policy "users create their own reposts"
  on public.reposts for insert
  with check (auth.uid() = user_id);

drop policy if exists "users remove their own reposts" on public.reposts;
create policy "users remove their own reposts"
  on public.reposts for delete
  using (auth.uid() = user_id);
