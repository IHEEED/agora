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
    author_id    UUID NOT NULL REFERENCES users(id),
    community_id UUID NOT NULL REFERENCES communities(id),
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

-- Индексы для быстрой выборки ленты и комментариев поста
CREATE INDEX idx_posts_community ON posts(community_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_votes_post ON votes(post_id);
CREATE INDEX idx_votes_comment ON votes(comment_id);

-- Примечание: karma в users обновляется кодом сервера при
-- создании/удалении/изменении голоса, а не триггером БД —
-- это проще для старта, при желании заменить на триггер позже.