-- 005: посты без сообщества + ограничение на смену имени пользователя.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный:
-- повторный запуск ничего не сломает.

-- ── Личные посты ────────────────────────────────────────────────────────────
-- Пост больше не обязан лежать в сообществе: человек может писать от себя.
-- NULL в community_id и означает «личный пост», отдельного флага не нужно —
-- иначе появились бы противоречивые состояния вроде «личный, но в сообществе».
alter table public.posts
  alter column community_id drop not null;

comment on column public.posts.community_id is
  'NULL — личный пост, опубликован от имени автора. Иначе — сообщество, в котором он живёт.';

-- post_as_community имеет смысл только вместе с сообществом: подписать пост
-- сообществом, которого нет, невозможно. Запрещаем такую пару на уровне базы.
alter table public.posts
  drop constraint if exists posts_community_signature_valid;

alter table public.posts
  add constraint posts_community_signature_valid
  check (community_id is not null or post_as_community = false);

-- ── Смена имени пользователя ────────────────────────────────────────────────
-- Имя — то, по чему человека узнают: слишком частые смены ломают упоминания
-- и позволяют выдавать себя за другого, заняв освободившийся ник.
alter table public.users
  add column if not exists username_changed_at timestamptz;

comment on column public.users.username_changed_at is
  'Когда имя менялось в последний раз. NULL — не менялось ни разу.';
