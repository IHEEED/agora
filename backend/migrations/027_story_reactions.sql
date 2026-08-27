-- 027: стрелка на истории.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
--
-- ── Зачем отдельно от голосов ───────────────────────────────────────────────
--
-- Стрелка внизу кадра работала только у историй, сделанных из записи: голос шёл
-- записи, а у истории, заведённой с нуля, голосовать было не за что — и стрелка
-- у неё просто не рисовалась. Половина историй оставалась без единственного
-- способа ответить одним движением.
--
-- Своя таблица, а не запись голоса в общий votes. Голос в приложении — это
-- участие в разговоре: он двусторонний, влияет на influence автора и на порядок
-- в ленте. Стрелка на истории не делает ничего из этого. Она живёт сутки и
-- исчезает вместе с кадром, она односторонняя, и превращать её в influence
-- значило бы дать способ набирать вес постингом историй вместо мыслей.
--
-- Отсюда и форма: пара «история — человек» и ничего больше. Ни значения, ни
-- веса, ни отмены знаком минус — только «отметил» или «нет».
--
-- Требует выполненной 011 (public.stories).

create table if not exists public.story_reactions (
  story_id uuid not null references public.stories (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Один человек отмечает кадр один раз. Повторное нажатие снимает отметку,
  -- то есть удаляет строку, а не добавляет вторую.
  primary key (story_id, user_id)
);

-- Выдача спрашивает две вещи и обе по истории: сколько всего и отметил ли я.
create index if not exists story_reactions_story_idx
  on public.story_reactions (story_id);

alter table public.story_reactions enable row level security;

-- Счётчик виден всем: он и есть смысл отметки.
drop policy if exists story_reactions_read on public.story_reactions;
create policy story_reactions_read on public.story_reactions
  for select using (true);

-- Ставит и снимает каждый только за себя.
drop policy if exists story_reactions_own on public.story_reactions;
create policy story_reactions_own on public.story_reactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Денормализованный счётчик ───────────────────────────────────────────────
--
-- Истории смотрят подряд, по кадру в секунду, и считать реакции запросом на
-- каждый кадр значит бить в базу десять раз за десять секунд. Счётчик колонкой
-- и триггер дельтой — тот же приём, что у записей (миграция 013).
alter table public.stories add column if not exists reactions integer not null default 0;

create or replace function public.bump_story_reactions()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.stories set reactions = reactions + 1 where id = new.story_id;
  elsif tg_op = 'DELETE' then
    -- greatest на случай рассинхрона: счётчик не должен уходить в минус, даже
    -- если строку удалили в обход триггера.
    update public.stories
       set reactions = greatest(reactions - 1, 0)
     where id = old.story_id;
  end if;
  return null;
end;
$$;

drop trigger if exists story_reactions_count on public.story_reactions;
create trigger story_reactions_count
  after insert or delete on public.story_reactions
  for each row execute function public.bump_story_reactions();

-- Приводим счётчик в согласие с тем, что уже есть: таблица новая, но запустить
-- скрипт могут и повторно, после того как реакции появятся.
update public.stories s
   set reactions = (select count(*) from public.story_reactions r where r.story_id = s.id);
