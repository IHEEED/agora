'use client';

import { useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { StoryEditor } from '@/components/StoryEditor';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { invalidate } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { haptic } from '@/lib/haptics';

/**
 * Новая история — с нуля, а не из записи.
 *
 * Кружок «Ваша история» с плюсом стоял в полосе с самого начала и не делал
 * ничего: это был обычный div без обработчика. Обещание кнопки без кнопки —
 * худший вид пустоты, потому что человек считает сломанным себя.
 *
 * Сервер умел такую историю всегда: `post_id` в нём необязателен, достаточно
 * подписи или снимка (см. routes/stories.ts). Не хватало ровно экрана.
 *
 * От StoryComposer отличается происхождением. Тот берёт готовую запись и
 * спрашивает, что к ней приписать; здесь ничего готового нет, и снимок надо
 * сначала выбрать и обрезать. Сводить их в один компонент значило бы получить
 * форму, половина которой всегда выключена.
 */

const MEDIA_BUCKET = 'post-media';

/** Столько же, сколько влезает в кадр истории, не превращаясь в стену текста. */
const MAX_LENGTH = 280;

export function NewStorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useSession();
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<{ preview: string; url: string | null } | null>(null);
  const [cropping, setCropping] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Сброс при открытии. Сравнением в отрисовке, а не эффектом: иначе первый
  // кадр нового захода показывает прошлую подпись.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setBody('');
      setPhoto(null);
      setError(null);
    }
  }

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Сбрасываем поле сразу: без этого повторный выбор того же файла не даёт
    // события change, и снимок «не выбирается» со второго раза.
    event.target.value = '';
    if (!file) return;
    setError(null);
    setCropping(URL.createObjectURL(file));
  }

  /**
   * Готовая картинка из конструктора: снимок с уже впечатанными подписями.
   *
   * Подписи впечатаны, а не описаны отдельно, намеренно — иначе каждый
   * смотрящий пересобирал бы историю у себя, и она выглядела бы у всех
   * по-разному: другой шрифт, другой перенос, другая ширина.
   */
  async function upload(blob: Blob) {
    const source = cropping;
    setCropping(null);
    const preview = URL.createObjectURL(blob);
    setPhoto({ preview, url: null });
    if (source) URL.revokeObjectURL(source);

    const path = `${session?.user.id ?? 'anon'}/story-${Date.now()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, blob, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      URL.revokeObjectURL(preview);
      setPhoto(null);
      return;
    }

    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    setPhoto({ preview, url: data.publicUrl });
  }

  const ready = Boolean(body.trim() || photo?.url);

  async function publish() {
    if (!ready || sending) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch('/stories', {
        method: 'POST',
        body: JSON.stringify({
          body: body.trim() || null,
          image_url: photo?.url ?? null,
        }),
      });
      // Полоса обязана показать новый кружок сразу: история живёт сутки, и
      // «опубликовал, но не вижу» — повод отправить её второй раз.
      invalidate('/stories');
      haptic();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} title="Новая история" height="auto">
        <div
          className="flex flex-col gap-3"
          style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}
        >
          {photo ? (
            <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: '9 / 16', maxHeight: '46dvh' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.preview}
                alt=""
                className="h-full w-full object-cover"
                style={{ opacity: photo.url ? 1 : 0.5 }}
              />
              {!photo.url && (
                <span className="absolute inset-0 flex items-center justify-center text-[13px] font-medium text-white">
                  Загружаем…
                </span>
              )}
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(photo.preview);
                  setPhoto(null);
                }}
                aria-label="Убрать снимок"
                className="material-media absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed transition-colors active:bg-[var(--surface-2)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4.5" width="18" height="15" rx="3" />
                <circle cx="8.5" cy="10" r="1.6" />
                <path d="m4 17 5-4.5 4.5 4 3-2.5L20 18" />
              </svg>
              <span className="text-[13.5px]">Выбрать снимок</span>
            </button>
          )}

          <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />

          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value.slice(0, MAX_LENGTH))}
            placeholder="Что рассказать…"
            rows={2}
            className="w-full resize-none rounded-2xl px-4 py-3 text-[15px] outline-none"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          />

          {error && (
            <p className="px-1 text-[13px] leading-snug" style={{ color: 'var(--down)' }}>
              {error}
            </p>
          )}

          <p className="px-1 text-[12.5px] text-[var(--text-muted)]">
            История видна сутки, потом исчезает сама.
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-full py-3 text-[15px] font-semibold transition-transform active:scale-[0.98]"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => void publish()}
              // Пока снимок едет, публиковать нечего: история ушла бы без него.
              disabled={!ready || sending || (photo !== null && photo.url === null)}
              className="flex-1 rounded-full py-3 text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-40"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              {sending ? 'Публикую…' : 'В историю'}
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* Полноэкранный конструктор вместо обрезки.
          Историю смотрят во весь экран, и собирать её надо в том же кадре:
          подпись, поставленная в углу маленького превью, на настоящем экране
          оказалась бы в другом месте. */}
      <StoryEditor
        open={cropping !== null}
        src={cropping}
        onCancel={() => {
          if (cropping) URL.revokeObjectURL(cropping);
          setCropping(null);
        }}
        onApply={(blob) => void upload(blob)}
      />
    </>
  );
}
