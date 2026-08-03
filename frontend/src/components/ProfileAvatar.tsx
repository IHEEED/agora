'use client';

import { SegmentRing, segmentsFor } from '@/components/SegmentRing';
import { DefaultAvatar } from '@/components/DefaultAvatar';

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
  photoZoom = 1,
}: {
  name: string;
  size?: number;
  muted?: boolean;
  /** Сколько дуг рисовать. По умолчанию выводится из имени. */
  segments?: number;
  /** Загруженное фото. Без него рисуется генерируемая аватарка. */
  photo?: string | null;
  photoZoom?: number;
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
          // eslint-disable-next-line @next/next/no-img-element -- data-URL из настроек профиля
          <img
            src={photo}
            alt=""
            className="h-full w-full object-cover"
            style={{ transform: `scale(${photoZoom})` }}
          />
        ) : (
          <DefaultAvatar name={name} size={size - inset * 2} />
        )}
      </div>
    </div>
  );
}
