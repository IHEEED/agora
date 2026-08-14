-- 008: правка сообщений и реакции на них.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
-- Требует выполненной миграции 007 (таблица public.messages).

-- Отметка о правке. Отдельная колонка, а не флаг: важно не только то, что
-- сообщение правили, но и когда — в переписке это меняет смысл прочитанного.
alter table public.messages add column if not exists edited_at timestamptz;

-- Реакции. Одна на человека и сообщение: первичный ключ по паре не даёт
-- накидать десяток сердец с одного аккаунта, а повторное нажатие на тот же
-- знак снимает реакцию — так это устроено в мессенджерах.
create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

-- Реакции читаются пачкой по всем сообщениям открытой переписки.
create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

-- Видит реакции тот, кто видит саму переписку.
drop policy if exists "participants read reactions" on public.message_reactions;
create policy "participants read reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1
      from public.messages m
      where m.id = message_id
        and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    )
  );

drop policy if exists "users manage their own reactions" on public.message_reactions;
create policy "users manage their own reactions"
  on public.message_reactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
