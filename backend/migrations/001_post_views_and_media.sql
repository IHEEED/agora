-- Догоняем схему до того, что уже ожидает код.
--
-- views     — счётчик просмотров. Роут POST /posts/:id/view читает эту колонку
--             с самого начала, но в базе её не было: запрос падал с 500.
-- image_url — картинка поста. Карточка умеет её рисовать, экран создания поста
--             умеет загружать файл в Storage; не хватало только места под ссылку.
--
-- Выполнить один раз в Supabase → SQL Editor.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS views INTEGER NOT NULL DEFAULT 0;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_url TEXT;
