-- 015: блокировки, жалобы, роли и приглашения.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
--
-- Одна миграция на четыре сущности, а не четыре по одной, потому что они
-- держатся друг за друга: жалоба заканчивается баном, бан гасит приглашения
-- забаненного, право банить даёт роль. Разложить их по отдельным файлам значит
-- трижды переписать одни и те же внешние ключи.

-- ── Роль ────────────────────────────────────────────────────────────────────
--
-- Текстом с проверкой, а не enum: добавить значение в enum в Postgres можно
-- только отдельной командой вне транзакции, и миграция перестала бы быть одним
-- скриптом, который выполняют целиком.
alter table public.users add column if not exists role text not null default 'user';

alter table public.users drop constraint if exists users_role_valid;
alter table public.users add constraint users_role_valid
  check (role in ('user', 'moderator', 'admin'));

-- Очередь жалоб спрашивает «а этот вообще модератор?» на каждом запросе.
create index if not exists users_role_idx on public.users (role) where role <> 'user';

-- ── Бан ─────────────────────────────────────────────────────────────────────
--
-- Срок и вечность одним полем. Вечный бан — это banned_until = 'infinity',
-- настоящее значение timestamptz, а не выдумка: сравнение now() < banned_until
-- работает для него само собой. Отдельный флаг is_banned рядом со сроком
-- означал бы два источника правды, которые однажды разойдутся.
alter table public.users add column if not exists banned_until timestamptz;
alter table public.users add column if not exists ban_reason text;
alter table public.users add column if not exists banned_by uuid references public.users (id);
alter table public.users add column if not exists banned_at timestamptz;

-- Забаненных мало, а спрашивают о них на каждом входе: частичный индекс.
create index if not exists users_banned_idx on public.users (banned_until)
  where banned_until is not null;

-- ── Блокировки ──────────────────────────────────────────────────────────────
--
-- До сих пор чёрный список жил в localStorage браузера: заблокированный не
-- знал, что заблокирован, продолжал писать, и прятался он только у того, кто
-- блокировал, и только в этом браузере.
create table if not exists public.blocks (
  blocker_id uuid not null references public.users (id) on delete cascade,
  blocked_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

-- Два направления, два вопроса. «Кого я скрыл» — по blocker_id, при выдаче
-- ленты. «Кто скрыл меня» — по blocked_id, при попытке написать: блокировка
-- обязана работать в обе стороны, иначе она снова только занавеска.
create index if not exists blocks_blocker_idx on public.blocks (blocker_id);
create index if not exists blocks_blocked_idx on public.blocks (blocked_id);

-- Блокировка рвёт подписку в обе стороны. Иначе заблокированный остаётся в
-- подписчиках и продолжает получать записи в свою ленту — то есть ровно то,
-- от чего человек и защищался.
create or replace function public.unfollow_on_block()
returns trigger
language plpgsql
as $$
begin
  delete from public.follows
   where (follower_id = new.blocker_id and following_id = new.blocked_id)
      or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return null;
end;
$$;

drop trigger if exists blocks_unfollow on public.blocks;
create trigger blocks_unfollow
  after insert on public.blocks
  for each row execute function public.unfollow_on_block();

-- ── Жалобы ──────────────────────────────────────────────────────────────────
--
-- Цель — ровно одна из четырёх, как у голосов: отдельные колонки с проверкой
-- вместо пары «тип, идентификатор». Так за целостность отвечает внешний ключ,
-- а не приложение: удалили запись — жалоба на неё уходит следом сама.
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users (id) on delete cascade,

  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  message_id uuid references public.messages (id) on delete cascade,
  target_user_id uuid references public.users (id) on delete cascade,

  reason text not null,
  details text,

  status text not null default 'open',
  handled_by uuid references public.users (id),
  handled_at timestamptz,
  resolution text,

  created_at timestamptz not null default now(),

  constraint reports_status_valid check (status in ('open', 'resolved', 'dismissed')),
  constraint reports_one_target check (
    (post_id is not null)::int
    + (comment_id is not null)::int
    + (message_id is not null)::int
    + (target_user_id is not null)::int = 1
  )
);

-- Очередь модератора: открытые, старые сверху. Частичный индекс, потому что
-- разобранные жалобы копятся навсегда, а спрашивают всегда про открытые.
create index if not exists reports_open_idx on public.reports (created_at)
  where status = 'open';

-- Один человек — одна жалоба на одну цель. Без этого достаточно нажать кнопку
-- десять раз, чтобы цель уехала наверх очереди.
create unique index if not exists reports_once_per_post
  on public.reports (reporter_id, post_id) where post_id is not null;
create unique index if not exists reports_once_per_comment
  on public.reports (reporter_id, comment_id) where comment_id is not null;
create unique index if not exists reports_once_per_message
  on public.reports (reporter_id, message_id) where message_id is not null;
create unique index if not exists reports_once_per_user
  on public.reports (reporter_id, target_user_id) where target_user_id is not null;

-- ── Что сделал модератор ────────────────────────────────────────────────────
--
-- Отдельный журнал, а не поля в users. Бан снимается и накладывается снова,
-- users помнит только последний; журнал помнит все, и по нему видно, кто из
-- модераторов раздаёт вечные баны за опечатки.
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references public.users (id),
  target_user_id uuid references public.users (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  action text not null,
  reason text,
  banned_until timestamptz,
  created_at timestamptz not null default now(),
  constraint moderation_action_valid check (
    action in ('ban', 'unban', 'delete_post', 'delete_comment', 'dismiss', 'warn')
  )
);

create index if not exists moderation_actions_target_idx
  on public.moderation_actions (target_user_id, created_at desc);

-- ── Приглашения ─────────────────────────────────────────────────────────────
--
-- Регистрации не было вовсе: аккаунт заводили руками в панели Supabase.
-- Теперь у каждого свой запас кодов — сеть растёт сама, но след остаётся, и
-- видно, кто привёл того, из-за кого пришлось разбирать жалобы.
alter table public.users add column if not exists invites_left integer not null default 5;
alter table public.users add column if not exists invited_by uuid references public.users (id);

alter table public.users drop constraint if exists users_invites_left_sane;
alter table public.users add constraint users_invites_left_sane
  check (invites_left >= 0 and invites_left <= 100);

-- Код читают вслух и переписывают с экрана, поэтому алфавит без 0/O и 1/I/L:
-- это не украшение, а разница между «код не подошёл» и работающей регистрацией.
create or replace function public.generate_invite_code()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  -- Не `code`: так зовётся колонка в invites, и в запросе ниже Postgres не смог
  -- бы отличить переменную от неё — «column reference is ambiguous» прямо на
  -- вставке. Псевдоним таблицы по той же причине не `i`: это имя занимает
  -- счётчик цикла.
  candidate text;
begin
  loop
    candidate := '';
    for position in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (
      select 1 from public.invites existing where existing.code = candidate
    );
  end loop;
  return candidate;
end;
$$;

create table if not exists public.invites (
  code text primary key default public.generate_invite_code(),
  issued_by uuid not null references public.users (id) on delete cascade,
  used_by uuid references public.users (id) on delete set null,
  used_at timestamptz,
  expires_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  -- Использован — значит известно кем и когда. Половины не бывает.
  constraint invites_used_together check ((used_by is null) = (used_at is null))
);

create index if not exists invites_issuer_idx on public.invites (issued_by, created_at desc);

-- Запас возвращается, если приглашение истекло неиспользованным — но не тогда,
-- когда по нему пришёл человек. Списание при выдаче, а не при использовании:
-- иначе один код можно раздать сотне людей и запас не тронется.
create or replace function public.spend_invite_on_issue()
returns trigger
language plpgsql
as $$
begin
  update public.users
     set invites_left = invites_left - 1
   where id = new.issued_by
     and invites_left > 0;

  if not found then
    raise exception 'NO_INVITES_LEFT';
  end if;

  return new;
end;
$$;

drop trigger if exists invites_spend on public.invites;
create trigger invites_spend
  before insert on public.invites
  for each row execute function public.spend_invite_on_issue();

-- ── RLS ─────────────────────────────────────────────────────────────────────
--
-- Бэкенд ходит сервисным ключом, и его RLS не касается; политики здесь для
-- того, чего он не покрывает — прямых обращений с ключом anon, если они
-- когда-нибудь появятся. Правило простое: модерация наружу не видна вовсе.
alter table public.blocks enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.invites enable row level security;

-- Свой чёрный список человек видит и ведёт сам. Чужой — не его дело: узнать,
-- кто тебя заблокировал, нельзя, иначе блокировка становится сообщением.
drop policy if exists "users read their own blocks" on public.blocks;
create policy "users read their own blocks"
  on public.blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "users create their own blocks" on public.blocks;
create policy "users create their own blocks"
  on public.blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "users remove their own blocks" on public.blocks;
create policy "users remove their own blocks"
  on public.blocks for delete
  using (auth.uid() = blocker_id);

-- Жалобу видит тот, кто её подал. Разбор — дело сервера под сервисным ключом.
drop policy if exists "reporters read their own reports" on public.reports;
create policy "reporters read their own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- Свои выданные коды видно, чтобы было что переслать другу.
drop policy if exists "issuers read their own invites" on public.invites;
create policy "issuers read their own invites"
  on public.invites for select
  using (auth.uid() = issued_by);
