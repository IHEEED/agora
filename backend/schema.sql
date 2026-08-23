-- ============================================================
-- Схема БД для соцсети — Фаза 0, финальная версия для 5 таблиц
-- PostgreSQL (Supabase)
-- ============================================================

-- Пользователи (профиль поверх Supabase Auth)
-- id совпадает с id из auth.users — своего пароля не храним,
-- за это целиком отвечает Supabase Auth.
CREATE TABLE users (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT NOT NULL UNIQUE,
    username   TEXT NOT NULL UNIQUE,
    karma      INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Сообщества (аналог сабреддитов)
CREATE TABLE communities (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    description TEXT,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Посты
CREATE TABLE posts (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title        TEXT NOT NULL,
    body         TEXT,
    image_url    TEXT,
    author_id    UUID NOT NULL REFERENCES users(id),
    community_id UUID NOT NULL REFERENCES communities(id),
    views        INTEGER NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Комментарии, вложенность через parent_comment_id
CREATE TABLE comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id           UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    author_id         UUID NOT NULL REFERENCES users(id),
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    body              TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Голоса: за пост ИЛИ за комментарий, никогда за оба сразу
CREATE TABLE votes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id),
    post_id    UUID REFERENCES posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    value      SMALLINT NOT NULL CHECK (value IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- ровно одно из двух полей должно быть заполнено
    CHECK (
        (post_id IS NOT NULL AND comment_id IS NULL)
        OR
        (post_id IS NULL AND comment_id IS NOT NULL)
    ),

    -- один пользователь — один голос за конкретный пост
    UNIQUE (user_id, post_id),
    -- один пользователь — один голос за конкретный комментарий
    UNIQUE (user_id, comment_id)
);

-- Опрос внутри поста: варианты ответа и голоса за них.
-- post_id продублирован в poll_votes намеренно — только так база сама
-- запрещает выбрать два варианта в одном опросе.
CREATE TABLE poll_options (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id  UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    text     TEXT NOT NULL,
    position SMALLINT NOT NULL
);

CREATE TABLE poll_votes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id  UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- один пользователь — один голос в конкретном опросе
    UNIQUE (user_id, post_id)
);

-- Индексы для быстрой выборки ленты и комментариев поста
CREATE INDEX idx_posts_community ON posts(community_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_votes_post ON votes(post_id);
CREATE INDEX idx_votes_comment ON votes(comment_id);
CREATE INDEX idx_poll_options_post ON poll_options(post_id);
CREATE INDEX idx_poll_votes_post ON poll_votes(post_id);
CREATE INDEX idx_poll_votes_option ON poll_votes(option_id);

-- Примечание: karma в users обновляется кодом сервера при
-- создании/удалении/изменении голоса, а не триггером БД —
-- это проще для старта, при желании заменить на триггер позже.

-- ============================================================
-- Триггер: автосоздание строки в public.users при регистрации
-- через Supabase Auth. Уже создан и проверен напрямую в Supabase
-- SQL Editor — здесь только для документации схемы.
--
-- ВНИМАНИЕ: рабочая версия функции живёт в migrations/016, а не здесь.
-- Ниже — первая, которая брала ником часть почты до собачки и потому
-- отказывала тёзкам: ivan@gmail.com и ivan@yandex.ru просят одно имя.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, username)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();