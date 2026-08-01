'use client';

import { useEffect, useRef, useState, SubmitEvent } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { Community, Post } from '@/lib/types';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';

/** Бакет в Supabase Storage, куда складываются картинки постов. */
const MEDIA_BUCKET = 'post-media';

/**
 * Storage отвечает короткими техническими фразами — переводим их в то,
 * что человеку понятно и что подсказывает, где именно чинить.
 */
function describeUploadError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('row-level security') || lower.includes('unauthorized')) {
    return `Supabase не разрешает запись в «${MEDIA_BUCKET}». Пометка Public открывает только чтение — нужны политики на запись (миграция 003_storage_policies.sql).`;
  }
  if (lower.includes('not found')) {
    return `В Supabase не создан бакет «${MEDIA_BUCKET}» — без него картинки загружать некуда.`;
  }
  if (lower.includes('exceeded') || lower.includes('too large')) {
    return 'Файл слишком большой для загрузки.';
  }
  return message;
}

export default function CreatePostPage() {
  const router = useRouter();
  const { session } = useSession();
  const { requestVerification } = usePhoneGate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // null — опроса нет. Массив появляется по кнопке и стартует с двух пустых строк.
  const [pollOptions, setPollOptions] = useState<string[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch<Community[]>('/communities')
      .then((loaded) => {
        setCommunities(loaded);
        if (loaded.length > 0) setCommunityId(loaded[0].id);
      })
      .catch((err) => setError(err.message));
  }, []);

  // Локальный превью-URL живёт до размонтирования — иначе утечёт объект.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setPreview(URL.createObjectURL(file));

    const extension = file.name.split('.').pop() ?? 'bin';
    const path = `${session?.user.id ?? 'anon'}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      setUploading(false);
      setPreview(null);
      setImageUrl(null);
      setError(describeUploadError(uploadError.message));
      return;
    }

    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  }

  function removeImage() {
    setImageUrl(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const post = await apiFetch<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          community_id: communityId,
          image_url: imageUrl,
          poll_options: pollOptions?.map((option) => option.trim()).filter(Boolean) ?? [],
        }),
      });
      router.push(`/posts/${post.id}`);
    } catch (err) {
      if (isPhoneNotVerifiedError(err)) {
        requestVerification();
        return;
      }
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать пост');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = title.trim() && communityId && !submitting && !uploading;

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--bg)]">
      <form
        onSubmit={handleSubmit}
        className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-8"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-full px-3 py-1.5 text-[15px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Отмена
          </button>
          <h1 className="whitespace-nowrap text-[17px] font-semibold text-[var(--text)]">
            Новый пост
          </h1>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-[15px] font-medium text-[var(--accent-contrast)] transition-opacity disabled:opacity-40"
          >
            {submitting ? 'Публикуем…' : 'Опубликовать'}
          </button>
        </div>

        {communities.length === 0 ? (
          <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-[14px] text-[var(--text-muted)]">
            Сначала нужно создать сообщество — пост всегда публикуется в одном из них.
          </p>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-[var(--text-muted)]">Сообщество</span>
            <select
              value={communityId}
              onChange={(e) => setCommunityId(e.target.value)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            >
              {communities.map((community) => (
                <option key={community.id} value={community.id}>
                  {community.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <input
          autoFocus
          required
          placeholder="Заголовок"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[17px] font-medium text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />

        <textarea
          rows={7}
          placeholder="Расскажите подробнее…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />

        {(preview || imageUrl) && (
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- превью локального файла и произвольный Storage-домен */}
            <img
              src={preview ?? imageUrl ?? ''}
              alt=""
              className="max-h-80 w-full object-cover"
              style={{ opacity: uploading ? 0.5 : 1 }}
            />
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center text-[14px] font-medium text-[var(--text)]">
                Загружаем…
              </span>
            )}
            <button
              type="button"
              onClick={removeImage}
              aria-label="Убрать изображение"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}

        {pollOptions && (
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-[var(--text)]">Опрос</span>
              <button
                type="button"
                onClick={() => setPollOptions(null)}
                className="text-[13px] text-[var(--text-muted)] hover:underline"
              >
                Убрать
              </button>
            </div>

            {pollOptions.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={option}
                  placeholder={`Вариант ${index + 1}`}
                  onChange={(e) =>
                    setPollOptions((prev) =>
                      prev!.map((value, i) => (i === index ? e.target.value : value))
                    )
                  }
                  className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                />
                {pollOptions.length > 2 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions((prev) => prev!.filter((_, i) => i !== index))}
                    aria-label={`Убрать вариант ${index + 1}`}
                    className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}

            {pollOptions.length < 6 && (
              <button
                type="button"
                onClick={() => setPollOptions((prev) => [...prev!, ''])}
                className="self-start text-[13px] font-medium"
                style={{ color: 'var(--accent)' }}
              >
                + Добавить вариант
              </button>
            )}
          </div>
        )}

        {/* Панель вложений: только иконки, подписи убраны — они и так узнаваемы. */}
        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
            id="post-media"
          />
          <label
            htmlFor="post-media"
            aria-label="Добавить изображение"
            title="Изображение"
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="15" rx="3" />
              <circle cx="8.5" cy="10" r="1.6" />
              <path d="m4 17 5-4.5 4.5 4 3-2.5L20 18" />
            </svg>
          </label>

          {/* capture просит систему открыть камеру, а не галерею. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
            id="post-camera"
          />
          <label
            htmlFor="post-camera"
            aria-label="Снять на камеру"
            title="Камера"
            className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-[var(--border)] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5a2 2 0 0 1 2-2h2l1.4-2h7.2L17 6.5h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <circle cx="12" cy="12.5" r="3.4" />
            </svg>
          </label>

          <button
            type="button"
            onClick={() => setPollOptions((prev) => (prev ? null : ['', '']))}
            aria-label="Добавить опрос"
            aria-pressed={Boolean(pollOptions)}
            title="Опрос"
            className="flex h-12 w-12 items-center justify-center rounded-full border transition-colors"
            style={{
              borderColor: pollOptions ? 'var(--accent)' : 'var(--border)',
              color: pollOptions ? 'var(--accent)' : 'var(--text)',
              background: pollOptions ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="4" rx="2" />
              <rect x="3" y="12" width="12" height="4" rx="2" />
              <rect x="3" y="19" width="7" height="1.2" rx="0.6" />
            </svg>
          </button>
        </div>

        {error && <p className="text-[14px]" style={{ color: 'var(--down)' }}>{error}</p>}
      </form>
    </div>
  );
}
