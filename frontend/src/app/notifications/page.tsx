'use client';

import { useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import { SuggestedPeople } from '@/components/SuggestedPeople';
import { ScreenTitle } from '@/components/ScreenTitle';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { apiFetch } from '@/lib/api';
import { invalidate, useApiData } from '@/lib/useApiData';
import { useT, TranslationKey } from '@/lib/i18n';

/**
 * Уведомления.
 *
 * Вкладка наконец делает то, что обещает названием. Раньше здесь лежали
 * подсказки «кого почитать»: таблицы под события не было, и рисовать выдуманные
 * «вам ответили» значило бы врать. Теперь события настоящие, а подсказки
 * остались — но ниже и только тогда, когда событий нет: пустой экран с одной
 * серой строкой по-прежнему выглядит сломанным.
 */

type Actor = { id: string; username: string; avatar_url?: string | null };

type Notification = {
  id: string;
  kind: 'reply' | 'comment' | 'vote_post' | 'vote_comment' | 'follow' | 'repost';
  read_at: string | null;
  created_at: string;
  actor: Actor | null;
  post: { id: string; title: string } | null;
  comment: { id: string; body: string; post_id: string } | null;
};

/**
 * Что случилось — глаголом от третьего лица.
 *
 * Ответ и комментарий разведены намеренно: ответ адресован человеку лично, а
 * комментарий — записи, которую он мог написать полгода назад. «Вам ответили»
 * на второе обещало бы разговор, которого нет.
 */
const WHAT: Record<Notification['kind'], TranslationKey> = {
  reply: 'notify.reply',
  comment: 'notify.comment',
  // «Проголосовал за», а не «поддержал».
  //
  // Поддержка — это про согласие, а голос в приложении устроен иначе: минус
  // здесь тоже участие, и о нём приходит такое же уведомление. Слово
  // «поддержал» уже занято смыслом, которого у половины голосов нет.
  vote_post: 'notify.votePost',
  vote_comment: 'notify.voteComment',
  follow: 'notify.follow',
  repost: 'notify.repost',
};

/** Куда ведёт нажатие. Подписка — к человеку, остальное — к записи. */
function hrefFor(item: Notification): string {
  if (item.kind === 'follow') return item.actor ? `/u/${item.actor.id}` : '/';
  if (item.comment) return `/posts/${item.comment.post_id}`;
  if (item.post) return `/posts/${item.post.id}`;
  return '/';
}

/** Строчка контекста под именем: заголовок записи или текст комментария. */
function contextOf(item: Notification): string | null {
  if (item.kind === 'reply' || item.kind === 'comment') return item.comment?.body ?? null;
  return item.post?.title ?? null;
}

function when(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  return `${Math.floor(hours / 24)} дн`;
}

export default function NotificationsPage() {
  const { t } = useT();
  const { data, loading } = useApiData<{ notifications: Notification[] }>('/notifications');
  // Через useMemo, а не через ?? прямо в теле: пустой массив, созданный
  // заново на каждый рендер, гоняет эффект ниже вхолостую.
  const items = useMemo(() => data?.notifications ?? [], [data]);

  /**
   * Пометка прочитанным — один раз за открытие экрана.
   *
   * Уведомление не письмо: его не открывают, на него смотрят. Человек, зашедший
   * сюда, увидел всё, что было, и оставлять точку на колоколе значит требовать
   * от него ещё одного действия неизвестно зачем.
   *
   * Отсечка по времени самого свежего события, а не «все подряд»: пока экран
   * открыт, могут прийти новые, и помечать их прочитанными было бы враньём.
   */
  const marked = useRef<string | null>(null);

  useEffect(() => {
    const newest = items[0]?.created_at;
    if (!newest || marked.current === newest) return;
    if (!items.some((item) => item.read_at === null)) return;

    marked.current = newest;
    apiFetch('/notifications/read', {
      method: 'POST',
      body: JSON.stringify({ until: newest }),
    })
      .then(() => invalidate('/notifications'))
      // Молча: точка на колоколе не тот повод, чтобы показывать человеку ошибку
      // на экране, куда он зашёл почитать новости о себе.
      .catch(() => {});
  }, [items]);

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-5 px-4 pb-12">
        <ScreenTitle>{t('notifications.title')}</ScreenTitle>

        {loading && <p className="text-[14px] text-[var(--text-muted)]">Загрузка…</p>}

        {items.length > 0 && (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {items.map((item) => {
              const context = contextOf(item);
              const unread = item.read_at === null;

              return (
                <Link
                  key={item.id}
                  href={hrefFor(item)}
                  className="flex items-center gap-3 py-3 transition-colors"
                  // Непрочитанное подсвечено, а не помечено точкой сбоку: точка
                  // — ещё один мелкий предмет в строке, где и так лицо, имя,
                  // текст и время. Фон же читается боковым зрением.
                  style={unread ? { background: 'var(--accent-soft)' } : undefined}
                >
                  <ProfileAvatar
                    name={item.actor?.username ?? '?'}
                    size={40}
                    photo={item.actor?.avatar_url ?? null}
                  />

                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[14.5px] text-[var(--text)]">
                      <span className="font-medium">{item.actor?.username ?? 'кто-то'}</span>{' '}
                      {t(WHAT[item.kind])}
                    </span>
                    {context && (
                      <span className="truncate text-[13px] text-[var(--text-muted)]">
                        {context}
                      </span>
                    )}
                  </div>

                  <span className="flex-none text-[12.5px] text-[var(--text-muted)]">
                    {when(item.created_at)}
                  </span>
                </Link>
              );
            })}
          </div>
        )}

        {/* Подсказки остаются, но уходят вниз и показываются только на пустом
            экране: когда событий нет, вкладка не должна выглядеть сломанной, а
            когда есть — они здесь лишние. */}
        {!loading && items.length === 0 && (
          <>
            <div
              className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{ background: 'var(--surface-2)' }}
            >
              <span
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
              >
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2 7.5-2 7.5h16s-2-1.5-2-7.5" />
                  <path d="M13.7 20a2 2 0 0 1-3.4 0" />
                </svg>
              </span>
              <p className="text-[14px] leading-snug text-[var(--text-muted)]">
                {t('notifications.empty')}
              </p>
            </div>

            <SuggestedPeople />
          </>
        )}
      </main>
    </div>
  );
}
