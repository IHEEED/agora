-- 018. Личные настройки переписки: закрепить, приглушить.
--
-- Настройки именно личные, а не общие на диалог. Закрепление — это порядок в
-- вашем списке, и второй человек о нём знать не должен: узнать, что вас
-- закрепили, — почти то же, что прочитать чужую записную книжку. То же со
-- звуком: приглушают не разговор, а уведомления у себя.
--
-- Отсюда ключ из двух колонок: чей список и про кого строка. Одна и та же пара
-- людей даёт две независимые строки, и это не дублирование, а ровно то, что
-- нужно.
--
-- Отдельной таблицей, а не колонками в messages: настройка относится к
-- собеседнику, а не к письму, и в messages её пришлось бы дублировать в каждой
-- строке переписки и держать в согласии триггером.
--
-- Требует выполненных 004 (public.users) и 007 (public.messages).

create table if not exists public.chat_prefs (
  -- Чей список настраиваем.
  owner_id uuid not null references public.users (id) on delete cascade,
  -- Про кого строка.
  peer_id uuid not null references public.users (id) on delete cascade,
  -- Момент закрепления, а не флажок: закреплённых бывает несколько, и порядок
  -- между ними должен быть осмысленным. По времени — последний закреплённый
  -- сверху, как в Telegram. Пусто — не закреплён.
  pinned_at timestamptz,
  muted boolean not null default false,
  primary key (owner_id, peer_id),
  -- Закрепить самого себя нельзя: переписки с собой в приложении нет.
  constraint chat_prefs_not_self check (owner_id <> peer_id)
);

-- Список переписок читается целиком по владельцу и сортируется по закреплению.
create index if not exists chat_prefs_owner_idx
  on public.chat_prefs (owner_id, pinned_at desc nulls last);

alter table public.chat_prefs enable row level security;

-- Своими настройками распоряжается только их владелец. Читать чужие нельзя
-- вовсе: в этом и смысл того, что настройка личная.
drop policy if exists chat_prefs_own on public.chat_prefs;
create policy chat_prefs_own on public.chat_prefs
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);
