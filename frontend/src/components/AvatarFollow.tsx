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
        // Меньше трети аватарки. Значок — пометка на лице, а не вторая кнопка
        // рядом с ним: на 36% он спорил с самой аватаркой за внимание и в ленте
        // читался раньше, чем ник. Ниже 18 не опускаемся — туда уже не попасть
        // пальцем; область нажатия при этом шире самого кружка (см. FollowButton).
        cornerSize={Math.max(18, Math.round(size * 0.3))}
      />
    </span>
  );
}
