'use client';

import { useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { DEFAULT_FIT, Fit } from '@/components/ImageFitter';
import { ImageAdjustDialog } from '@/components/ImageAdjustDialog';
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
export const PROFILE_AVATAR_FIT_KEY = 'parafraz-profile-avatar-fit';
export const PROFILE_COVER_KEY = 'parafraz-profile-cover';
export const PROFILE_COVER_FIT_KEY = 'parafraz-profile-cover-fit';

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
  const [avatarFit, setAvatarFit] = useState<Fit>(DEFAULT_FIT);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  // Картинка, которую сейчас подгоняют в отдельном окне. Пока не подтвердили —
  // в профиль она не попадает.
  const [pendingAvatar, setPendingAvatar] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);

  // Обложка редактируется здесь же. Раньше кнопки её замены висели поверх
  // самой обложки и закрывали ровно то, ради чего её ставят; правильное место
  // для них — экран редактирования, вместе с аватаром и именем.
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [coverFit, setCoverFit] = useState<Fit>(DEFAULT_FIT);
  const [pendingCover, setPendingCover] = useState<string | null>(null);
  const [adjustingCover, setAdjustingCover] = useState(false);

  /** Файл читаем в data-URL и сразу отдаём в окно подгонки. */
  function pickImage(
    event: React.ChangeEvent<HTMLInputElement>,
    onReady: (dataUrl: string) => void
  ) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Читаем в data-URL, а не в objectURL. objectURL живёт до перезагрузки
    // страницы и в localStorage бесполезен — картинка «сбрасывалась» именно
    // поэтому. Бакета под аватары пока нет, так что храним само изображение.
    const reader = new FileReader();
    reader.onload = () => onReady(String(reader.result));
    reader.readAsDataURL(file);
    // Сбрасываем значение: иначе повторный выбор того же файла не вызовет change.
    event.target.value = '';
  }

  function pickAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    // Кадрировать миниатюру в 96px пальцем невозможно, а в окне превью крупное.
    pickImage(event, (dataUrl) => {
      setPendingAvatar(dataUrl);
      setAdjusting(true);
    });
  }

  function pickCover(event: React.ChangeEvent<HTMLInputElement>) {
    pickImage(event, (dataUrl) => {
      setPendingCover(dataUrl);
      setAdjustingCover(true);
    });
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
      setCover(readProfileField(PROFILE_COVER_KEY) || null);
      try {
        setAvatarFit({ ...DEFAULT_FIT, ...JSON.parse(readProfileField(PROFILE_AVATAR_FIT_KEY, '{}')) });
      } catch {
        setAvatarFit(DEFAULT_FIT);
      }
      try {
        setCoverFit({ ...DEFAULT_FIT, ...JSON.parse(readProfileField(PROFILE_COVER_FIT_KEY, '{}')) });
      } catch {
        setCoverFit(DEFAULT_FIT);
      }
    }
  }

  function save() {
    window.localStorage.setItem(PROFILE_NAME_KEY, name.trim());
    window.localStorage.setItem(PROFILE_BIO_KEY, bio.trim());
    window.localStorage.setItem(PROFILE_USERNAME_KEY, username.trim());
    if (avatarPreview) {
      window.localStorage.setItem(PROFILE_AVATAR_KEY, avatarPreview);
      window.localStorage.setItem(PROFILE_AVATAR_FIT_KEY, JSON.stringify(avatarFit));
    }
    if (cover) {
      window.localStorage.setItem(PROFILE_COVER_KEY, cover);
      window.localStorage.setItem(PROFILE_COVER_FIT_KEY, JSON.stringify(coverFit));
    } else {
      window.localStorage.removeItem(PROFILE_COVER_KEY);
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
        {/* Обложка полосой над аватаром — ровно так, как она стоит в профиле,
            поэтому понятно, что именно меняешь. */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="profile-cover flex h-[104px] w-full items-center justify-center rounded-2xl"
            style={
              cover
                ? {
                    backgroundImage: `url(${cover})`,
                    backgroundSize: `${coverFit.zoom * 100}%`,
                    backgroundPosition: `${coverFit.x}% ${coverFit.y}%`,
                    backgroundRepeat: 'no-repeat',
                  }
                : undefined
            }
          >
            <span
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium backdrop-blur-md"
              style={{ background: 'color-mix(in srgb, #000000 38%, transparent)', color: '#ffffff' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8.5a2 2 0 0 1 2-2h2l1.4-2h7.2L17 6.5h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
                <circle cx="12" cy="12.5" r="3.4" />
              </svg>
              {cover ? t('profile.changeCover') : t('profile.addCover')}
            </span>
          </button>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={pickCover}
            className="hidden"
          />

          {cover && (
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => {
                  setPendingCover(cover);
                  setAdjustingCover(true);
                }}
                className="text-[12.5px] text-[var(--text-muted)] underline-offset-2 hover:underline"
              >
                {t('profile.adjustTitle')}
              </button>
              <button
                type="button"
                onClick={() => setCover(null)}
                className="text-[12.5px] text-[var(--text-muted)] underline-offset-2 hover:underline"
              >
                {t('profile.removeCover')}
              </button>
            </div>
          )}
        </div>

        {/* Аватар первым: это первое, что человек хочет поменять, зайдя сюда. */}
        <div className="flex flex-col items-center gap-2 pb-1">
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            className="relative rounded-full"
            aria-label={t('profile.editAvatar')}
          >
            {avatarPreview ? (
              // Здесь только показываем результат. Подгоняют его в отдельном
              // окне — попасть пальцем в круг 96px и разглядеть в нём кадр
              // всё равно не выходит.
              <span
                className="block h-24 w-24 overflow-hidden rounded-full"
                style={{
                  backgroundImage: `url(${avatarPreview})`,
                  backgroundSize: `${avatarFit.zoom * 100}%`,
                  backgroundPosition: `${avatarFit.x}% ${avatarFit.y}%`,
                  backgroundRepeat: 'no-repeat',
                }}
              />
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

          {/* Уже поставленное фото можно переподогнать, не выбирая файл заново. */}
          {avatarPreview && (
            <button
              type="button"
              onClick={() => {
                setPendingAvatar(avatarPreview);
                setAdjusting(true);
              }}
              className="text-[12.5px] text-[var(--text-muted)] underline-offset-2 hover:underline"
            >
              {t('profile.adjustTitle')}
            </button>
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

      <ImageAdjustDialog
        open={adjusting}
        src={pendingAvatar}
        shape="circle"
        initialFit={avatarFit}
        onCancel={() => setAdjusting(false)}
        onApply={(fit) => {
          setAvatarPreview(pendingAvatar);
          setAvatarFit(fit);
          setAdjusting(false);
        }}
      />

      <ImageAdjustDialog
        open={adjustingCover}
        src={pendingCover}
        shape="cover"
        initialFit={coverFit}
        onCancel={() => setAdjustingCover(false)}
        onApply={(fit) => {
          setCover(pendingCover);
          setCoverFit(fit);
          setAdjustingCover(false);
        }}
      />
    </BottomSheet>
  );
}
