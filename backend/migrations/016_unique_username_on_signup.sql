-- 016: ник при регистрации не должен зависеть от везения.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
--
-- Что было. Триггер on_auth_user_created (см. schema.sql) брал ником часть
-- почты до собачки — и на этом останавливался. Значит `ivan@gmail.com` и
-- `ivan@yandex.ru` претендуют на одно имя, и второму регистрация отказывает
-- нарушением уникальности. Причём падает оно внутри auth.users, до нашего кода:
-- человек видит «не удалось создать аккаунт» и не понимает, при чём тут он.
--
-- Дело не только в тёзках. Часть почты до собачки может быть какой угодно:
-- `иван`, `a`, `very.long.address.that.goes.on+tag`, `ivan+parafraz`. Ник в
-- PARAFRAZ — 3–24 латинских буквы, цифры, точка, дефис и подчёркивание, и всё
-- остальное надо приводить к этому виду, а не надеяться.
--
-- Ник здесь временный: следом регистрация перезапишет его тем, что человек
-- выбрал сам (см. invites.ts). Но он обязан существовать и быть уникальным,
-- иначе перезаписывать будет нечего.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  attempt integer := 1;
  suffix text;
begin
  -- Всё лишнее выбрасываем, а не заменяем: `ivan+parafraz` становится
  -- `ivanparafraz`, и это ближе к тому, что человек считает своим именем, чем
  -- `ivan_parafraz` с придуманным разделителем.
  base := regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g');
  base := left(base, 24);

  -- Слишком коротким ник быть не может, а адрес вида `a@example.com` бывает.
  if length(base) < 3 then
    base := 'user' || base;
  end if;

  candidate := base;

  -- Тёзки: к первому свободному номеру. Точка перед номером — тот же
  -- разделитель, что уже принят в никах вроде `vera.hodova`.
  while exists (select 1 from public.users u where u.username = candidate) loop
    attempt := attempt + 1;
    suffix := attempt::text;

    -- Обрезаем основу, а не хвост: иначе номер не влезет в 24 знака и
    -- обрежется он сам, снова дав занятое имя.
    candidate := left(base, 23 - length(suffix)) || '.' || suffix;

    -- Сотня тёзок — уже не совпадение, а перебор имён. Дальше случайный
    -- хвост: он некрасив, но регистрацию не останавливает.
    if attempt > 100 then
      candidate := left(base, 16) || '.' || substr(md5(random()::text), 1, 6);
      exit;
    end if;
  end loop;

  insert into public.users (id, email, username)
  values (new.id, new.email, candidate);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
