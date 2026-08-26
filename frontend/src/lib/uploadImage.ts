'use client';

import { supabase } from './supabase';

/** Тот же бакет, что у картинок записей и вложений в переписке. */
const BUCKET = 'post-media';

/**
 * Положить картинку в хранилище и получить её адрес.
 *
 * Профиль до этого хранил картинки прямо в браузере, строкой data:. Для одного
 * устройства это работало, но в базу такую строку класть нельзя: аватарка
 * едет вместе с каждым автором в ленте, и сотня килобайт в каждой строке
 * превратила бы выдачу тридцати записей в мегабайты.
 *
 * Поэтому файл уезжает в Storage, а в базе остаётся адрес — несколько десятков
 * знаков.
 */
export async function uploadImage(dataUrl: string, prefix: string): Promise<string> {
  // Уже адрес, а не картинка: значит её загрузили в прошлый раз и трогать
  // нечего. Проверка тут, а не по местам вызова, — сохранение профиля не
  // обязано различать «поменяли лицо» и «поменяли только подпись».
  if (!dataUrl.startsWith('data:')) return dataUrl;

  const blob = await (await fetch(dataUrl)).blob();
  const extension = blob.type.split('/')[1]?.split('+')[0] || 'jpg';
  const path = `${prefix}/${crypto.randomUUID()}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { cacheControl: '3600', upsert: false });

  if (error) {
    throw new Error(
      error.message.includes('row-level security')
        ? `Supabase не разрешает запись в «${BUCKET}» — нужны политики (миграция 003).`
        : error.message
    );
  }

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
