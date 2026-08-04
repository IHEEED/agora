'use client';

import { SegmentRing, segmentsFor } from '@/components/SegmentRing';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { DEFAULT_FIT, Fit } from '@/components/ImageFitter';

/**
 * Аватар в том же кольце из дуг, что и кружки сториз в ленте, только крупнее.
 * Раньше здесь был рваный многоугольник с зашитым сиреневым градиентом — он не
 * следовал за акцентом и не совпадал с обрамлением того же человека в ленте.
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
  /** Сколько дуг рисовать. По умолчанию выводится из имени. */
  segments?: number;
  /** Загруженное фото. Без него рисуется генерируемая аватарка. */
  photo?: string | null;
  /** Кадрирование, подобранное перетаскиванием в настройках профиля. */
  photoFit?: Fit;
}) {
  const inset = size * 0.083;

  return (
    <div className="relative flex-none" style={{ width: size, height: size }}>
      <SegmentRing
        size={size}
        segments={segments ?? segmentsFor(name)}
        viewed={muted}
        strokeWidth={size * 0.04}
        gap={size * 0.082}
      />
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
