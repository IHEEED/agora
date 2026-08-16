'use client';

import { DefaultAvatar } from '@/components/DefaultAvatar';
import { FollowButton } from '@/components/FollowButton';

/**
 * Аватарка со значком подписки в углу — приём из Threads.
 *
 * Раньше кнопка стояла отдельной строкой: в карточке рекомендаций она
 * занимала всю ширину под именем, в списках — правый край строки. И там и там
 * она читалась наравне с самим человеком, хотя относится к нему, а не стоит
 * рядом. Пришитая к аватарке, она перестаёт быть самостоятельным элементом
 * списка: видно лицо, имя и маленький плюс на лице — ровно то, что нужно.
 *
 * Размер значка считается от аватарки, а не задаётся числом на каждом месте
 * вызова: на 44 и на 56 пикселях один и тот же кружок выглядит по-разному.
 */
export function AvatarFollow({
  userId,
  username,
  initiallyFollowing = false,
  size = 48,
}: {
  userId: string;
  username: string;
  initiallyFollowing?: boolean;
  size?: number;
}) {
  return (
    <span className="relative flex-none" style={{ width: size, height: size }}>
      <DefaultAvatar name={username} size={size} />
      <FollowButton
        userId={userId}
        initiallyFollowing={initiallyFollowing}
        corner
        // Примерно треть аватарки, но не мельче 22 пикселей: ниже этого в
        // значок уже не попасть пальцем.
        cornerSize={Math.max(22, Math.round(size * 0.36))}
      />
    </span>
  );
}
