-- 024: галочка у ника.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
--
-- Зачем. В сети, где ник можно взять почти любой, единственная защита от
-- подделки — знать человека лично. Пока людей два десятка, этого хватает;
-- дальше появляется второй «kostya.linza» с точкой вместо дефиса, и отличить
-- его от первого нельзя ничем.
--
-- Галочка не про важность и не про славу. Она отвечает ровно на один вопрос:
-- «этот человек — тот, за кого себя выдаёт». Поэтому раздаёт её модератор, а
-- не приложение по какой-нибудь формуле: проверка — это чей-то поступок, а не
-- следствие числа подписчиков.

-- Дата, а не флаг. Знать, когда галочку выдали, нужно ровно тогда, когда
-- начинают спрашивать, кто и зачем: флаг на этот вопрос не отвечает.
alter table public.users add column if not exists verified_at timestamptz;
alter table public.users add column if not exists verified_by uuid references public.users (id);

-- Проверенных единицы, а спрашивают о них в каждой строке ленты.
create index if not exists users_verified_idx on public.users (id) where verified_at is not null;

comment on column public.users.verified_at is
  'Когда модератор подтвердил, что человек — тот, за кого себя выдаёт. Пусто — не подтверждён.';

-- ── Журнал ──────────────────────────────────────────────────────────────────
--
-- Выдача и снятие галочки записываются туда же, куда баны: это действие
-- модератора над чужим аккаунтом, и по нему потом спрашивают.
alter table public.moderation_actions drop constraint if exists moderation_action_valid;
alter table public.moderation_actions add constraint moderation_action_valid
  check (
    action in ('ban', 'unban', 'delete_post', 'delete_comment', 'dismiss', 'warn', 'verify', 'unverify')
  );
