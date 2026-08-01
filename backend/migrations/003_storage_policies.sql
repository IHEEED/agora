-- Права на бакет post-media.
--
-- Пометка «Public» у бакета открывает только чтение. Запись в storage.objects
-- всё равно закрыта Row Level Security, а браузер ходит туда с anon-ключом
-- от имени пользователя — отсюда «new row violates row-level security policy»
-- при попытке приложить картинку к посту. Серверный код этого не замечает:
-- он работает под service_role и RLS обходит.
--
-- Раскладываем файлы по папкам с id владельца (`<user_id>/<файл>`), поэтому
-- политики сверяют первый сегмент пути с id того, кто пришёл.
--
-- Выполнить один раз в Supabase → SQL Editor.

-- Загружать может любой вошедший пользователь, но только в свою папку.
DROP POLICY IF EXISTS "post_media_insert_own" ON storage.objects;
CREATE POLICY "post_media_insert_own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Читать картинки могут все — они висят в открытой ленте.
DROP POLICY IF EXISTS "post_media_read_all" ON storage.objects;
CREATE POLICY "post_media_read_all"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'post-media');

-- Заменять и удалять — только свои файлы.
DROP POLICY IF EXISTS "post_media_update_own" ON storage.objects;
CREATE POLICY "post_media_update_own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "post_media_delete_own" ON storage.objects;
CREATE POLICY "post_media_delete_own"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'post-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
