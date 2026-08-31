import { supabase } from './supabase';

/** Тот же бакет, что у картинок записей и вложений — как в вебе. */
const BUCKET = 'post-media';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Base64 → байты, без зависимости от atob (в Hermes его может не быть). */
function decodeBase64(input: string): Uint8Array {
  const clean = input.replace(/[^A-Za-z0-9+/]/g, '');
  const length = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(length);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]);
    const d = B64.indexOf(clean[i + 3]);
    bytes[p++] = (a << 2) | (b >> 4);
    if (c !== -1) bytes[p++] = ((b & 15) << 4) | (c >> 2);
    if (d !== -1) bytes[p++] = ((c & 3) << 6) | d;
  }
  return bytes;
}

/**
 * Положить картинку из галереи в Storage и вернуть её адрес.
 *
 * expo-image-picker отдаёт кадр в base64; кладём байты в тот же бакет, что и
 * веб, и возвращаем публичный адрес — в базу профиля уезжает он, а не сама
 * картинка. Требует политик на бакет (миграция 003), как и веб.
 */
export async function uploadImage(base64: string, contentType: string, prefix: string): Promise<string> {
  const bytes = decodeBase64(base64);
  const extension = contentType.split('/')[1]?.split('+')[0] || 'jpg';
  const path = `${prefix}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
  if (error) {
    throw new Error(
      error.message.includes('row-level security')
        ? `Supabase не разрешает запись в «${BUCKET}» — нужны политики (миграция 003).`
        : error.message
    );
  }

  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
