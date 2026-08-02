'use client';

import { useEffect, useRef, useState, SubmitEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { Community, Post } from '@/lib/types';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { useT } from '@/lib/i18n';

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
  const { t } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Два шага: сначала выбор сообщества, потом сам текст.
  const [step, setStep] = useState<'community' | 'compose'>('community');
  const [communityQuery, setCommunityQuery] = useState('');
  // id выбранной карточки на время ухода экрана — она подсвечивается,
  // пока остальные гаснут, поэтому нажатие не выглядит проглоченным.
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const stepTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimeout.current) clearTimeout(stepTimeout.current);
    };
  }, []);

  function pickCommunity(id: string) {
    if (leavingTo) return;
    setLeavingTo(id);
    // Экран выбора успевает погаснуть до подмены — без паузы шаги менялись
    // встык, одним кадром, и переход выглядел рубленым.
    stepTimeout.current = setTimeout(() => {
      setCommunityId(id);
      setStep('compose');
      setLeavingTo(null);
    }, 190);
  }
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
      .then(setCommunities)
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
  const chosenCommunity = communities.find((c) => c.id === communityId);

  // Шаг 1 — куда публиковать. Отдельным экраном, как в Reddit: выбор сообщества
  // задаёт контекст всему посту, и решать его на бегу в выпадашке неудобно.
  if (step === 'community') {
    const normalized = communityQuery.trim().toLowerCase();
    const visible = normalized
      ? communities.filter(
          (c) =>
            c.name.toLowerCase().includes(normalized) ||
            c.description?.toLowerCase().includes(normalized)
        )
      : communities;

    return (
      <div className="flex flex-1 flex-col items-center">
        <main
          className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-8"
          style={{
            opacity: leavingTo ? 0 : 1,
            transform: leavingTo ? 'translateY(-10px) scale(0.985)' : 'none',
            transition: 'opacity 0.19s ease, transform 0.19s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          <div className="flex flex-col gap-1">
            <h1 className="font-pixel text-[30px] text-[var(--text)]">{t('create.pickCommunity')}</h1>
            <p className="text-[14px] text-[var(--text-muted)]">
              {t('create.pickHint')}
            </p>
          </div>

          {/* Поиск выше списка: сообществ со временем станет много, и листать
              их до нужного ради одного поста — самый частый путь. */}
          {communities.length > 0 && (
            <div className="relative">
              {/* z-10: поле ниже стеклянное, его backdrop-filter размывает
                  всё, что нарисовано под ним, включая эту лупу. */}
              <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted)]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m20 20-4.3-4.3" />
                </svg>
              </span>
              <input
                type="search"
                enterKeyHint="search"
                placeholder={t('communities.search')}
                value={communityQuery}
                onChange={(e) => setCommunityQuery(e.target.value)}
                className="glass w-full rounded-full py-2.5 pl-10 pr-4 text-[15px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>
          )}

          {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

          {communities.length === 0 ? (
            <div className="glass flex flex-col items-center gap-3 rounded-2xl p-6 text-center">
              <p className="text-[14px] text-[var(--text-muted)]">
                Сначала нужно создать сообщество — пост всегда публикуется в одном из них.
              </p>
              <Link
                href="/communities"
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)]"
              >
                К сообществам
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visible.map((community) => {
                const chosen = leavingTo === community.id;
                return (
                  <button
                    key={community.id}
                    onClick={() => pickCommunity(community.id)}
                    className="glass glass-sheen flex items-center gap-3.5 rounded-2xl p-4 text-left"
                    style={{
                      // Выбранная карточка на миг подаётся вперёд и загорается
                      // акцентом, остальные просто уходят вместе с экраном.
                      transform: chosen ? 'scale(1.015)' : 'none',
                      borderColor: chosen ? 'var(--accent)' : undefined,
                      boxShadow: chosen ? '0 0 0 1px var(--accent)' : undefined,
                      transition: 'transform 0.19s cubic-bezier(0.32, 1.3, 0.5, 1), box-shadow 0.19s ease',
                    }}
                  >
                    <CommunityAvatar name={community.name} size={48} />
                    <div className="relative flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium text-[var(--text)]">{community.name}</span>
                      {community.description && (
                        <span className="line-clamp-2 text-[13px] text-[var(--text-muted)]">
                          {community.description}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {visible.length === 0 && (
                <p className="glass rounded-2xl p-6 text-center text-[var(--text-muted)]">
                  {t('communities.nothing')}
                </p>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      {/* step-enter: второй шаг въезжает снизу, подхватывая уход первого —
          иначе подмена экрана происходит за один кадр и выглядит рубленой. */}
      <form
        onSubmit={handleSubmit}
        className="step-enter below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-8"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep('community')}
            className="flex items-center gap-2 rounded-full px-2 py-1.5 text-[15px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            {chosenCommunity?.name ?? 'Назад'}
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-[15px] font-medium text-[var(--accent-contrast)] transition-opacity disabled:opacity-40"
          >
            {submitting ? t('create.publishing') : t('create.publish')}
          </button>
        </div>

        <input
          autoFocus
          required
          placeholder={t('create.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[17px] font-medium text-[var(--text)] outline-none focus:border-[var(--accent)]"
        />

        <textarea
          rows={7}
          placeholder={t('create.bodyPlaceholder')}
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
              <span className="text-[14px] font-medium text-[var(--text)]">{t('create.poll')}</span>
              <button
                type="button"
                onClick={() => setPollOptions(null)}
                className="text-[13px] text-[var(--text-muted)] hover:underline"
              >
                {t('create.pollRemove')}
              </button>
            </div>

            {pollOptions.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={option}
                  placeholder={`${t('create.pollOption')} ${index + 1}`}
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
                {t('create.pollAdd')}
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
            aria-label={t('create.image')}
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
            aria-label={t('create.camera')}
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
            aria-label={t('create.poll')}
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
