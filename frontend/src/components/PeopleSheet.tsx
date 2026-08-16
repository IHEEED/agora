'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { UserSummary } from '@/lib/types';
import { BottomSheet } from '@/components/BottomSheet';
import { AvatarFollow } from '@/components/AvatarFollow';

/**
 * Список людей в шторке: подписчики, подписки, участники сообщества.
 *
 * Запрос уходит только когда шторку открыли: подписки есть у каждого профиля,
 * и тянуть их за всех сразу — впустую греть сеть ради экрана, куда заходят
 * заметно реже, чем в сам профиль.
 */
export function PeopleSheet({
  open,
  onClose,
  title,
  endpoint,
  emptyText,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Путь вида `/users/{id}/followers`. null — пока нечего запрашивать. */
  endpoint: string | null;
  emptyText: string;
}) {
  // Ответ храним вместе с адресом, по которому он пришёл. Иначе при смене
  // вкладки в шторке на миг оставался прошлый список, а сбросить его отдельным
  // setState нельзя — это состояние выводится из пропса, а не живёт само.
  const [loaded, setLoaded] = useState<{ endpoint: string; list: UserSummary[] } | null>(null);
  const [failed, setFailed] = useState<{ endpoint: string; message: string } | null>(null);

  const people = loaded?.endpoint === endpoint ? loaded.list : null;
  const error = failed?.endpoint === endpoint ? failed.message : null;

  useEffect(() => {
    if (!open || !endpoint) return;

    let cancelled = false;
    apiFetch<UserSummary[]>(endpoint)
      .then((list) => {
        if (!cancelled) setLoaded({ endpoint, list });
      })
      .catch((err) => {
        if (cancelled) return;
        setFailed({
          endpoint,
          message: err instanceof Error ? err.message : 'Не удалось загрузить список',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [open, endpoint]);

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {error && (
        <p className="py-3 text-[13px]" style={{ color: 'var(--down)' }}>
          {error}
        </p>
      )}

      {!error && people === null && <p className="py-6 text-[var(--text-muted)]">Загрузка…</p>}

      {!error && people?.length === 0 && (
        <p className="py-12 text-center text-[var(--text-muted)]">{emptyText}</p>
      )}

      <div className="flex flex-col divide-y divide-[var(--border)]">
        {people?.map((person) => (
          <div key={person.id} className="flex items-center gap-3 py-3">
            {/* Значок подписки вне ссылки: он живёт на аватарке, но нажатие на
                него не должно уводить в профиль. */}
            <AvatarFollow
              userId={person.id}
              username={person.username}
              initiallyFollowing={person.isFollowing}
              size={46}
            />
            <Link
              href={`/u/${person.id}`}
              onClick={onClose}
              className="flex min-w-0 flex-1 flex-col"
            >
              <span className="truncate text-[15px] font-medium text-[var(--text)]">
                {person.username}
              </span>
              <span className="text-[12.5px] text-[var(--text-muted)]">
                <span className="font-num">{person.karma}</span> influence
              </span>
            </Link>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
