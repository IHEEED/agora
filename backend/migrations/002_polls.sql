-- Опросы в постах: варианты ответа и голоса за них.
--
-- Голос за вариант отличается от апвоута поста, поэтому таблица отдельная.
-- post_id продублирован в poll_votes намеренно: только так база может сама
-- запретить второй голос в одном опросе (UNIQUE по паре пользователь+пост),
-- не давая пользователю отметить сразу два варианта.
--
-- Выполнить один раз в Supabase → SQL Editor.

CREATE TABLE IF NOT EXISTS poll_options (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id  UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    text     TEXT NOT NULL,
    position SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS poll_votes (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    option_id  UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- один пользователь — один голос в конкретном опросе
    UNIQUE (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_options_post ON poll_options(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_post ON poll_votes(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);
