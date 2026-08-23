-- 017. Облачко над аватаркой: короткая мысль на сутки.
--
-- Жанр между историей и статусом. От истории отличается тем, что не занимает
-- экран и не требует картинки: это одна строка, которую видно мимоходом, в
-- списке переписок, рядом с лицом. От статуса — тем, что кончается: статус
-- висит годами и перестаёт что-либо значить уже к третьему дню, а мысль на
-- сутки читают, пока она свежая.
--
-- Одна строка на человека, а не история записей: облачко не архив, предыдущее
-- никому не интересно. Отсюда первичный ключ по автору — новая мысль заменяет
-- прежнюю, и делается это обычным upsert без уборки за собой.
--
-- Требует выполненной 004 (public.users).

create table if not exists public.notes (
  author_id uuid primary key references public.users (id) on delete cascade,
  -- Шестьдесят знаков. Ограничение здесь редакторское, а не техническое: в
  -- облачко над аватаркой длинный текст не влезает физически, и разрешить его
  -- значило бы показывать обрезанным — то есть врать о том, что человек
  -- написал.
  body text not null check (length(trim(body)) between 1 and 60),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

-- Выдача читает чужие мысли пачкой по списку авторов и отсекает протухшие.
create index if not exists notes_expires_idx on public.notes (expires_at);

alter table public.notes enable row level security;

-- Читают все: облачко для того и написано, чтобы его видели. Пишет каждый
-- только своё.
drop policy if exists notes_read on public.notes;
create policy notes_read on public.notes for select using (true);

drop policy if exists notes_write on public.notes;
create policy notes_write on public.notes
  for all
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);
