-- 007: личные сообщения.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.

-- Переписка хранится плоским списком сообщений, без отдельной таблицы диалогов.
-- Диалог здесь — это всегда двое, и он однозначно задаётся парой участников;
-- отдельная строка под него ничего не добавляла бы, зато её пришлось бы
-- заводить перед первым сообщением и держать в согласии с ним.
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.users (id) on delete cascade,
  recipient_id uuid not null references public.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  -- Когда получатель открыл переписку. null — ещё не читал.
  read_at timestamptz,
  constraint messages_not_self check (sender_id <> recipient_id)
);

-- Переписку читают в обе стороны: «мои письма ему» и «его письма мне».
-- Поэтому индекса по одной колонке мало — нужны оба направления.
create index if not exists messages_sender_idx
  on public.messages (sender_id, created_at desc);
create index if not exists messages_recipient_idx
  on public.messages (recipient_id, created_at desc);

-- Счётчик непрочитанных на кнопке в шапке спрашивается часто и всегда
-- одинаково: «мои входящие без отметки о прочтении».
create index if not exists messages_unread_idx
  on public.messages (recipient_id)
  where read_at is null;

alter table public.messages enable row level security;

-- Личное остаётся личным: строку видят только двое.
drop policy if exists "participants read their messages" on public.messages;
create policy "participants read their messages"
  on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "users send their own messages" on public.messages;
create policy "users send their own messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

-- Обновление разрешено только получателю и только ради отметки о прочтении:
-- отправитель не должен уметь править отправленное задним числом.
drop policy if exists "recipient marks messages read" on public.messages;
create policy "recipient marks messages read"
  on public.messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);
