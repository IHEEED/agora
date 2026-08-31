-- 029: сколько людей подтвердили номер телефона.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
--
-- Подтверждение телефона живёт не в public.users, а в auth.users — это ведёт
-- Supabase Auth, и колонка там называется phone_confirmed_at. Обычным запросом
-- PostgREST до неё не дотянуться: схема auth наружу не отдаётся, и правильно —
-- в ней пароли и токены.
--
-- Поэтому считаем функцией с security definer: она выполняется с правами
-- владельца и видит auth.users, а наружу отдаёт единственное число. Ничего,
-- кроме количества, за её пределы не выходит.
create or replace function public.count_phone_verified()
returns integer
language sql
security definer
set search_path = auth, public
as $function$
  select count(*)::int from auth.users where phone_confirmed_at is not null;
$function$;
