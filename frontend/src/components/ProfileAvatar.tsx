'use client';

import { SegmentRing } from '@/components/SegmentRing';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { DEFAULT_FIT, Fit } from '@/components/ImageFitter';

/**
 * Аватар, при наличии историй — в том же кольце из дуг, что и кружки сториз в
 * ленте. Кольцо рисуется, только когда передано число дуг (реальные истории):
 * без него это просто лицо. Раньше кольцо стояло всегда и врало о непросмотренных
 * историях там, где их нет.
 */
export function ProfileAvatar({
  name,
  size = 96,
  muted = false,
  segments,
  photo,
  photoFit,
}: {
  name: string;
  size?: number;
  muted?: boolean;
  /** Сколько дуг рисовать. Не задано — историй нет, кольца тоже. */
  segments?: number;
  /** Загруженное фото. Без него рисуется генерируемая аватарка. */
  photo?: string | null;
  /** Кадрирование, подобранное перетаскиванием в настройках профиля. */
  photoFit?: Fit;
}) {
  const hasRing = segments !== undefined && segments > 0;
  const inset = hasRing ? size * 0.083 : 0;

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      {hasRing && (
        <SegmentRing
          size={size}
          segments={segments}
          viewed={muted}
          strokeWidth={size * 0.04}
          gap={size * 0.082}
        />
      )}
      <div className="absolute overflow-hidden rounded-full" style={{ inset }}>
        {photo ? (
          // Показываем ровно тот кадр, что подобрали перетаскиванием:
          // те же background-size и background-position, что в редакторе.
          <span
            className="block h-full w-full"
            style={{
              backgroundImage: `url(${photo})`,
              backgroundSize: `${(photoFit ?? DEFAULT_FIT).zoom * 100}%`,
              backgroundPosition: `${(photoFit ?? DEFAULT_FIT).x}% ${(photoFit ?? DEFAULT_FIT).y}%`,
              backgroundRepeat: 'no-repeat',
            }}
          />
        ) : (
          <DefaultAvatar name={name} size={size - inset * 2} />
        )}
      </div>
    </div>
  );
}
