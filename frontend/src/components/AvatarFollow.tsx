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
  avatar,
}: {
  userId: string;
  username: string;
  /** Лицо человека. Нет — показываем силуэт. */
  avatar?: string | null;
  initiallyFollowing?: boolean;
  size?: number;
}) {
  return (
    <span className="relative flex-none" style={{ width: size, height: size }}>
      <DefaultAvatar name={username} size={size} src={avatar} />
      <FollowButton
        userId={userId}
        initiallyFollowing={initiallyFollowing}
        corner
        // Четверть аватарки. Значок — пометка на лице, а не вторая кнопка
        // рядом с ним: на трети он всё ещё читался раньше ника. Ниже
        // шестнадцати не опускаемся, а область нажатия расширена до сорока
        // четырёх пикселей невидимым полем (см. .corner-hit в globals.css) —
        // мелкий значок должен быть мелким на вид, но не на ощупь.
        cornerSize={Math.max(16, Math.round(size * 0.26))}
      />
    </span>
  );
}
