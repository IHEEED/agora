'use client';

import { useState } from 'react';
import { CenterDialog } from '@/components/CenterDialog';
import { DEFAULT_FIT, Fit, ImageFitter } from '@/components/ImageFitter';
import { useT } from '@/lib/i18n';

/**
 * Отдельное окно подгонки картинки: выбрал файл — открылось окно, подвинул,
 * сохранил.
 *
 * Подгонять прямо в макете было неудобно: аватарка в профиле размером 88px,
 * и попасть в неё пальцем, а тем более разглядеть кадр, почти невозможно.
 * Здесь превью крупное и ничем не занято.
 */
export function ImageAdjustDialog({
  open,
  src,
  shape,
  initialFit,
  onCancel,
  onApply,
}: {
  open: boolean;
  src: string | null;
  /** Круг — для аватарки, полоса — для шапки: кадр должен совпадать с местом. */
  shape: 'circle' | 'cover';
  initialFit?: Fit;
  onCancel: () => void;
  onApply: (fit: Fit) => void;
}) {
  const { t } = useT();
  const [fit, setFit] = useState<Fit>(initialFit ?? DEFAULT_FIT);

  // Значения подтягиваем на открытии: окно живёт в разметке постоянно, и
  // подхватывать сохранённое надо каждый раз. Правка прямо в рендере — тот
  // случай «состояние зависит от пропса», для которого React это и допускает.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFit(initialFit ?? DEFAULT_FIT);
  }

  if (!src) return null;

  return (
    <CenterDialog open={open} onClose={onCancel} title={t('profile.adjustTitle')}>
      <div className="flex flex-col gap-4">
        <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">
          {t('profile.dragHint')}
        </p>

        <div className="flex justify-center">
          <ImageFitter
            src={src}
            fit={fit}
            onChange={setFit}
            className={
              shape === 'circle'
                ? 'h-56 w-56 overflow-hidden rounded-full'
                : 'h-40 w-full overflow-hidden rounded-2xl'
            }
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 rounded-full border border-[var(--border)] py-2.5 text-[15px] font-medium text-[var(--text)]"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onApply(fit)}
            className="flex-1 rounded-full py-2.5 text-[15px] font-medium"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            {t('profile.editSave')}
          </button>
        </div>
      </div>
    </CenterDialog>
  );
}
