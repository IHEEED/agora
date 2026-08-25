-- 022: профиль переезжает из браузера в базу.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
--
-- Имя, подпись и кадрирование картинок жили в localStorage. Это значит, что
-- профиля у человека было столько, сколько устройств: на телефоне одно имя, на
-- ноутбуке другое, на сайте третье — и все три он считал своим единственным.
-- Хуже того, собеседник не видел ни одного из них: ему доставался только ник.
--
-- Аватарка переехала раньше (017), но одна: без имени и подписи она осталась
-- половиной решения, а расхождение — на месте.
--
-- Ник (`username`) сюда не входит: он и так в базе с самого начала, уникален и
-- меняется отдельной ручкой с задержкой в две недели. В localStorage лежала его
-- копия, и вот она-то и расходилась с настоящим.

-- Имя, которое человек показывает. Ник остаётся адресом, имя — подписью.
alter table public.users add column if not exists display_name text;
alter table public.users add column if not exists bio text;

alter table public.users drop constraint if exists users_display_name_sane;
alter table public.users add constraint users_display_name_sane
  check (display_name is null or length(display_name) <= 40);

alter table public.users drop constraint if exists users_bio_sane;
alter table public.users add constraint users_bio_sane
  check (bio is null or length(bio) <= 160);

-- Обложка профиля — та же история, что с аватаркой: ссылка на файл в Storage.
alter table public.users add column if not exists cover_url text;

/**
 * Кадрирование.
 *
 * Человек двигает и увеличивает картинку в рамке, и результат — три числа:
 * масштаб и положение в процентах. Хранить их рядом с адресом обязательно:
 * без них собеседник увидит ту же картинку, но обрезанную по-другому, то есть
 * чужое лицо не по центру.
 *
 * jsonb, а не три колонки на каждую картинку: это один неделимый снимок
 * настройки, который читают и пишут целиком, и раскладывать его по шести
 * колонкам значит завести шесть мест, где можно ошибиться.
 */
alter table public.users add column if not exists avatar_fit jsonb;
alter table public.users add column if not exists cover_fit jsonb;

comment on column public.users.display_name is
  'Показываемое имя. Пусто — показываем username.';
comment on column public.users.avatar_fit is
  'Кадрирование аватарки: { zoom, x, y }. Пусто — картинка по центру без увеличения.';
