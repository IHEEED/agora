-- 020: уведомления.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
--
-- Последний из четырёх блокеров. Уведомлений не было как сущности: вкладка
-- «Уведомления» показывала подсказки «кого почитать» и врала названием. Человек
-- отвечал на записи, получал голоса и подписчиков — и не узнавал об этом
-- никогда, если сам не пошёл проверять.
--
-- Событие рождается триггером в базе, а не кодом приложения. Причина та же, что
-- у счётчиков записи: запросы идут сервисным ключом, RLS их не касается, и одна
-- забытая ветка кода означала бы навсегда пропавшее уведомление. Триггер же
-- срабатывает на любую вставку, откуда бы она ни пришла — хоть из панели
-- Supabase руками.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),

  -- Кому. Читается на каждом опросе — по нему и главный индекс.
  recipient_id uuid not null references public.users (id) on delete cascade,
  -- Кто это сделал. Своих действий человек не получает (см. триггеры).
  actor_id uuid references public.users (id) on delete cascade,

  kind text not null,

  -- Куда вести по нажатию. Ровно как у жалоб: отдельные колонки с внешними
  -- ключами вместо пары «тип, идентификатор» — за целостность отвечает база,
  -- и удалённая запись уносит уведомления о себе сама.
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,

  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_kind_valid check (
    kind in ('reply', 'comment', 'vote_post', 'vote_comment', 'follow', 'repost')
  ),
  -- Уведомление о себе — это не уведомление.
  constraint notifications_not_self check (actor_id is null or actor_id <> recipient_id)
);

-- Лента уведомлений: свои, свежие сверху.
create index if not exists notifications_recipient_idx
  on public.notifications (recipient_id, created_at desc);

-- Счётчик на колоколе спрашивают чаще всего остального, и всегда про
-- непрочитанные. Частичный индекс: прочитанные копятся навсегда, а в этот
-- вопрос не попадают.
create index if not exists notifications_unread_idx
  on public.notifications (recipient_id)
  where read_at is null;

/**
 * Одно событие на пару «кто — что — кому».
 *
 * Без этого человек, снявший и поставивший голос десять раз, отправит десять
 * уведомлений. Уникальность частичная — по каждому виду свой набор колонок,
 * потому что null в обычном уникальном индексе не сравнивается сам с собой.
 */
create unique index if not exists notifications_once_per_post_vote
  on public.notifications (recipient_id, actor_id, post_id)
  where kind = 'vote_post';

create unique index if not exists notifications_once_per_comment_vote
  on public.notifications (recipient_id, actor_id, comment_id)
  where kind = 'vote_comment';

create unique index if not exists notifications_once_per_follow
  on public.notifications (recipient_id, actor_id)
  where kind = 'follow';

create unique index if not exists notifications_once_per_repost
  on public.notifications (recipient_id, actor_id, post_id)
  where kind = 'repost';

alter table public.notifications enable row level security;

-- Свои уведомления человек видит и помечает прочитанными; чужие не существуют
-- для него вовсе.
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications
  for select using (auth.uid() = recipient_id);

drop policy if exists notifications_mark_read on public.notifications;
create policy notifications_mark_read on public.notifications
  for update using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- ── Ответы ──────────────────────────────────────────────────────────────────
--
-- Два разных события, а не одно. Ответ на комментарий адресован человеку лично
-- — он писал реплику и ждёт продолжения разговора. Комментарий под записью
-- адресован записи, и автор её мог написать полгода назад. Смешивать их в одно
-- «вам ответили» значит обещать разговор там, где его нет.
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $function$
declare
  parent_author uuid;
  post_author uuid;
begin
  if new.parent_comment_id is not null then
    select author_id into parent_author from public.comments where id = new.parent_comment_id;

    if parent_author is not null and parent_author <> new.author_id then
      insert into public.notifications (recipient_id, actor_id, kind, post_id, comment_id)
      values (parent_author, new.author_id, 'reply', new.post_id, new.id);
    end if;
  end if;

  select author_id into post_author from public.posts where id = new.post_id;

  -- Автору записи — только если он не тот же, кому уже ушёл ответ: иначе
  -- человек, ответивший в своей же ветке, получит два уведомления об одном.
  if post_author is not null
     and post_author <> new.author_id
     and (parent_author is null or post_author <> parent_author) then
    insert into public.notifications (recipient_id, actor_id, kind, post_id, comment_id)
    values (post_author, new.author_id, 'comment', new.post_id, new.id);
  end if;

  return null;
end;
$function$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- ── Голоса ──────────────────────────────────────────────────────────────────
--
-- Только «за». Уведомление о минусе — это сообщение «кому-то не понравилось»,
-- которое нельзя ни исправить, ни ответить на него; оно портит настроение и не
-- даёт ничего взамен. Ни одна сеть, дожившая до размера, их не шлёт.
create or replace function public.notify_on_vote()
returns trigger
language plpgsql
security definer set search_path = public
as $function$
declare
  target_author uuid;
begin
  if new.value <> 1 then return null; end if;

  if new.post_id is not null then
    select author_id into target_author from public.posts where id = new.post_id;
    if target_author is not null and target_author <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, kind, post_id)
      values (target_author, new.user_id, 'vote_post', new.post_id)
      -- Снял и поставил заново — уведомление то же самое, а не новое.
      on conflict do nothing;
    end if;
  elsif new.comment_id is not null then
    select author_id into target_author from public.comments where id = new.comment_id;
    if target_author is not null and target_author <> new.user_id then
      insert into public.notifications (recipient_id, actor_id, kind, comment_id)
      values (target_author, new.user_id, 'vote_comment', new.comment_id)
      on conflict do nothing;
    end if;
  end if;

  return null;
end;
$function$;

drop trigger if exists votes_notify on public.votes;
create trigger votes_notify
  after insert or update on public.votes
  for each row execute function public.notify_on_vote();

-- ── Подписки ────────────────────────────────────────────────────────────────
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer set search_path = public
as $function$
begin
  insert into public.notifications (recipient_id, actor_id, kind)
  values (new.following_id, new.follower_id, 'follow')
  -- Отписался и подписался снова — не повод уведомлять дважды.
  on conflict do nothing;
  return null;
end;
$function$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ── Репосты ─────────────────────────────────────────────────────────────────
create or replace function public.notify_on_repost()
returns trigger
language plpgsql
security definer set search_path = public
as $function$
declare
  post_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;

  if post_author is not null and post_author <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, kind, post_id)
    values (post_author, new.user_id, 'repost', new.post_id)
    on conflict do nothing;
  end if;

  return null;
end;
$function$;

drop trigger if exists reposts_notify on public.reposts;
create trigger reposts_notify
  after insert on public.reposts
  for each row execute function public.notify_on_repost();

-- ── Блокировка гасит уведомления ────────────────────────────────────────────
--
-- Заблокированный не должен доставать человека даже через колокол. Триггер
-- убирает уже накопленные события от него в обе стороны — так же, как
-- блокировка рвёт подписки (миграция 015).
create or replace function public.clear_notifications_on_block()
returns trigger
language plpgsql
as $function$
begin
  delete from public.notifications
   where (recipient_id = new.blocker_id and actor_id = new.blocked_id)
      or (recipient_id = new.blocked_id and actor_id = new.blocker_id);
  return null;
end;
$function$;

drop trigger if exists blocks_clear_notifications on public.blocks;
create trigger blocks_clear_notifications
  after insert on public.blocks
  for each row execute function public.clear_notifications_on_block();
