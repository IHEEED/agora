'use client';

import { useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { useT } from '@/lib/i18n';

/**
 * Редактирование профиля.
 *
 * Полей под имя, описание и ссылку в таблице users нет — там только email,
 * username и karma. Поэтому значения пока хранятся на устройстве: экран
 * настоящий и рабочий, но за пределы браузера ничего не уходит. Когда появится
 * миграция с колонками, останется заменить чтение и запись на запросы к API.
 */
export const PROFILE_NAME_KEY = 'parafraz-profile-name';
export const PROFILE_BIO_KEY = 'parafraz-profile-bio';
export const PROFILE_USERNAME_KEY = 'parafraz-profile-username';
export const PROFILE_AVATAR_KEY = 'parafraz-profile-avatar';
export const PROFILE_AVATAR_ZOOM_KEY = 'parafraz-profile-avatar-zoom';
export const PROFILE_COVER_KEY = 'parafraz-profile-cover';

/** Событие, которым экран профиля узнаёт, что данные поменялись. */
export const PROFILE_CHANGED_EVENT = 'parafraz-profile-changed';

export function readProfileField(key: string, fallback = '') {
  if (typeof window === 'undefined') return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

export function ProfileEditSheet({
  open,
  onClose,
  defaultName,
  defaultBio,
  defaultUsername,
}: {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  defaultBio: string;
  defaultUsername: string;
}) {
  const { t } = useT();
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  function pickAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Читаем в data-URL, а не в objectURL. objectURL живёт до перезагрузки
    // страницы и в localStorage бесполезен — картинка «сбрасывалась» именно
    // поэтому. Бакета под аватары пока нет, так что храним само изображение.
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(String(reader.result));
    reader.readAsDataURL(file);
  }

  // Значения подтягиваем на открытии, а не при монтировании: шторка живёт
  // на странице постоянно, и подхватывать сохранённое надо каждый раз.
  // Правка прямо в рендере, а не в эффекте, — это тот случай «состояние
  // зависит от пропса», для которого React рекомендует такой приём: лишнего
  // кадра со старыми значениями в полях не будет.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(readProfileField(PROFILE_NAME_KEY, defaultName));
      setBio(readProfileField(PROFILE_BIO_KEY, defaultBio));
      setUsername(readProfileField(PROFILE_USERNAME_KEY, defaultUsername));
      setAvatarPreview(readProfileField(PROFILE_AVATAR_KEY) || null);
      setZoom(Number(readProfileField(PROFILE_AVATAR_ZOOM_KEY, '1')) || 1);
    }
  }

  function save() {
    window.localStorage.setItem(PROFILE_NAME_KEY, name.trim());
    window.localStorage.setItem(PROFILE_BIO_KEY, bio.trim());
    window.localStorage.setItem(PROFILE_USERNAME_KEY, username.trim());
    if (avatarPreview) {
      window.localStorage.setItem(PROFILE_AVATAR_KEY, avatarPreview);
      window.localStorage.setItem(PROFILE_AVATAR_ZOOM_KEY, String(zoom));
    }
    window.dispatchEvent(new CustomEvent(PROFILE_CHANGED_EVENT));
    onClose();
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('profile.edit')}
      height="76vh"
      footer={
        <button
          onClick={save}
          className="rounded-full bg-[var(--accent)] py-3 text-[15px] font-medium text-[var(--accent-contrast)]"
        >
          {t('profile.editSave')}
        </button>
      }
    >
      <div className="flex flex-col gap-4 py-3">
        {/* Аватар первым: это первое, что человек хочет поменять, зайдя сюда. */}
        <div className="flex flex-col items-center gap-2 pb-1">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="relative rounded-full"
            aria-label={t('profile.editAvatar')}
          >
            {avatarPreview ? (
              // Кадрирование делаем масштабом внутри круглой рамки: полноценный
              // редактор с перетаскиванием здесь избыточен, а «слишком мелко /
              // слишком крупно» — единственная реальная претензия к автокропу.
              <span className="block h-24 w-24 overflow-hidden rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- data-URL выбранного файла */}
                <img
                  src={avatarPreview}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                />
              </span>
            ) : (
              <DefaultAvatar name={defaultName} size={96} />
            )}
            <span
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2"
              style={{ background: 'var(--accent)', borderColor: 'var(--surface)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-contrast)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5a2 2 0 0 1 2-2h2l1.4-2h7.2L17 6.5h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                <circle cx="12" cy="12.5" r="3.4" />
              </svg>
            </span>
          </button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={pickAvatar}
            className="hidden"
          />
          <span className="text-[13px] font-medium" style={{ color: 'var(--accent)' }}>
            {t('profile.editAvatar')}
          </span>

          {avatarPreview && (
            <label className="flex w-full max-w-[220px] items-center gap-3">
              <span className="text-[12px] text-[var(--text-muted)]">{t('profile.editZoom')}</span>
              <input
                type="range"
                min={1}
                max={2.5}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[var(--accent)]"
              />
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-[var(--text-muted)]">{t('profile.editName')}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-[var(--text-muted)]">{t('profile.editBio')}</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={160}
            className="resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 text-[15px] leading-relaxed text-[var(--text)] outline-none focus:border-[var(--accent)]"
          />
          <span className="self-end text-[12px] text-[var(--text-muted)]">
            <span className="font-num">{bio.length}</span>/160
          </span>
        </label>

        {/* Юзернейм вместо ссылки: адрес профиля человеку нужнее, чем поле под
            внешний сайт, которого у большинства нет. */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-[var(--text-muted)]">{t('profile.editUsername')}</span>
          <div className="relative">
            <span
              className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[15px]"
              style={{ color: 'var(--text-muted)' }}
            >
              @
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
              maxLength={24}
              autoCapitalize="none"
              autoCorrect="off"
              className="w-full rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] py-3 pl-9 pr-4 text-[15px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
            />
          </div>
        </label>

        <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
          {t('profile.editLocalOnly')}
        </p>
      </div>
    </BottomSheet>
  );
}
