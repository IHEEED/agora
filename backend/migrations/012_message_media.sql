-- 012: фотографии и голосовые в переписке.
--
-- Выполнять в Supabase → SQL Editor целиком. Скрипт идемпотентный.
-- Требует выполненной 007 (таблица public.messages).

-- Снимок и голосовое — поля на самом сообщении, а не отдельная таблица
-- вложений. У вложения в переписке нет своей жизни: оно не переиспользуется,
-- не редактируется отдельно от реплики и всегда читается вместе с ней. Таблица
-- добавила бы join к каждому открытию чата ради данных, которые никогда не
-- нужны сами по себе.
alter table public.messages add column if not exists image_url text;
alter table public.messages add column if not exists audio_url text;

-- Длительность храним, а не вычисляем из файла.
--
-- Полоска голосового рисуется до того, как файл начнут загружать: иначе
-- сообщение приходит без длины и «прыгает», когда браузер дочитает метаданные.
-- Число секунд знает тот, кто записывал, — он и присылает.
alter table public.messages add column if not exists audio_seconds smallint;

-- Пустое сообщение больше не допускается: до сих пор тело было not null и это
-- держало форму само, но теперь реплика может состоять из одного снимка.
alter table public.messages alter column body drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_have_content'
  ) then
    alter table public.messages add constraint messages_have_content check (
      coalesce(nullif(btrim(body), ''), image_url, audio_url) is not null
    );
  end if;
end $$;
