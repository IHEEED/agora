'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { MessageThread, UserSummary } from '@/lib/types';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { BottomSheet } from '@/components/BottomSheet';
import { SkeletonList, SkeletonRow } from '@/components/Skeleton';
import { formatCompactAge } from '@/lib/formatDate';
import { useBlockedUsers } from '@/lib/blockedUsers';
import { useScreenLeave } from '@/lib/useScreenLeave';
import { holdBackdrop, releaseBackdrop } from '@/lib/screenBackdrop';
import { useT } from '@/lib/i18n';

/**
 * Список переписок.
 *
 * Отдельного экрана «новое сообщение» нет: написать можно из профиля человека
 * и отсюда — по кнопке, которая открывает шторку со знакомыми. Заводить под
 * это ещё один экран значило бы разложить одно действие по трём.
 */
export default function MessagesPage() {
  const { t } = useT();
  const [picking, setPicking] = useState(false);
  // Разворачивается из кнопки в шапке и складывается обратно в неё — так же,
  // как поиск. У мессенджера есть своя кнопка, и связь «нажал вот это — выросло
  // вот это» показать стоит: раздел открывается не из бара, и вернуться иначе
  // нечем, кроме той же кнопки.
  const { goBack, style: leaveStyle, swipeHandlers } = useScreenLeave('[data-messages-button]');

  // Снимок ленты держится под мессенджером всё время, пока он открыт, и
  // снимается, когда уходим (см. screenBackdrop). Проверка маршрута нужна из-за
  // двойного прогона эффектов в разработке — иначе первый же cleanup убрал бы
  // снимок сразу после открытия.
  useEffect(
    () => () => {
      // startsWith, а не строгое равенство. Уходя в переписку, список отдаёт
      // снимок ей: чат тянется пальцем поверх него. Строгая проверка снимала
      // снимок ровно в тот момент, когда он и нужен, — и за чатом снова
      // оказывалась пустота.
      if (!window.location.pathname.startsWith('/messages')) releaseBackdrop();
    },
    []
  );

  const threadsResult = useApiData<MessageThread[]>('/messages/threads');
  // Переписки с заблокированными убираем из списка: смысл блокировки в том,
  // чтобы человек не попадался на глаза, а строка в мессенджере — ровно то
  // место, где он попадается чаще всего.
  const blocked = useBlockedUsers();
  const threads = (threadsResult.data ?? []).filter(
    (thread) => !blocked.includes(thread.user.id)
  );

  // Кому писать: свои подписки — те, с кем связь уже есть. Список тянем
  // только когда шторку открыли.
  const peopleResult = useApiData<UserSummary[]>(picking ? '/users' : null);

  return (
    <div className="flex flex-1 flex-col items-center" style={leaveStyle} {...swipeHandlers}>
      <main className="below-header flex w-full max-w-2xl flex-col gap-2.5 px-2.5 pb-10">
        <div className="flex items-center gap-2 px-2">
          {/* Стрелка слева от заголовка. Мессенджер открывается из шапки, а не
              из нижнего бара, поэтому вкладки, к которой можно вернуться
              нажатием, у него нет — выйти было нечем, кроме системного жеста. */}
          <button
            onClick={goBack}
            aria-label={t('common.back')}
            className="-ml-2 flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--text)] transition-transform active:scale-90"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>

          {/* «Сообщения» — это то, что внутри переписок, а заголовок называет
              сам раздел. Мессенджер и есть раздел. */}
          <h1 className="display-type min-w-0 flex-1 truncate text-[26px] text-[var(--text)]">
            {t('messenger.title')}
            <span style={{ color: 'var(--accent)' }}>.</span>
          </h1>
          <button
            type="button"
            onClick={() => setPicking(true)}
            aria-label="Написать"
            className="flex h-10 w-10 items-center justify-center rounded-full transition-transform active:scale-95"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
              <path d="M14.5 7.5 16.5 9.5" />
            </svg>
          </button>
        </div>

        {threadsResult.error && (
          <p className="px-2 text-[14px]" style={{ color: 'var(--down)' }}>
            {threadsResult.error}
          </p>
        )}

        {/* Строки, а не карточки: список переписок читают сверху вниз одним
            движением глаз, и обойма вокруг каждой строки только сбивает ритм.
            Разделяет их волосяная черта под текстом, начинающаяся за аватаром —
            так же, как в любом мессенджере. */}
        <section className="message-list flex flex-col">
          {threads.map((thread) => (
            <Link
              key={thread.user.id}
              href={`/messages/${thread.user.id}`}
              // Замораживаем список: чат тянется пальцем вправо, и за ним должен
              // быть виден он, а не пустой фон (см. screenBackdrop).
              onClick={() => holdBackdrop()}
              // Подсветка нажатия скруглена и вписана в строку. Прежде она
              // заливала прямоугольник во всю ширину экрана до самых углов —
              // среди сплошь скруглённого интерфейса это читалось не откликом
              // на касание, а выделением текста мышью.
              className="flex items-center gap-3 rounded-2xl px-2 py-3 transition-colors active:bg-[var(--surface-2)]"
            >
              <DefaultAvatar name={thread.user.username} size={48} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--text)]">
                    {thread.user.username}
                  </span>
                  <span className="flex-none text-[12px] text-[var(--text-muted)]">
                    {formatCompactAge(thread.lastMessage.created_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <p
                    className="min-w-0 flex-1 truncate text-[13.5px]"
                    style={{
                      color: thread.unread > 0 ? 'var(--text)' : 'var(--text-muted)',
                    }}
                  >
                    {/* Своё письмо помечаем, иначе непонятно, чья это реплика
                        и ждут ли ответа от тебя. */}
                    {thread.lastMessage.mine && 'Вы: '}
                    {thread.lastMessage.body}
                  </p>
                  {thread.unread > 0 && (
                    <span
                      className="font-num flex h-5 min-w-5 flex-none items-center justify-center rounded-full px-1.5 text-[11px] font-semibold"
                      style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
                    >
                      {thread.unread}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {!threadsResult.loading && threads.length === 0 && (
            <p className="py-12 text-center text-[14.5px] leading-relaxed text-[var(--text-muted)]">
              Переписок пока нет.
              <br />
              Напишите первому — кнопка справа сверху.
            </p>
          )}
        </section>
      </main>

      <BottomSheet open={picking} onClose={() => setPicking(false)} title="Кому написать">
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {(peopleResult.data ?? []).map((person) => (
            <Link
              key={person.id}
              href={`/messages/${person.id}`}
              onClick={() => {
                holdBackdrop();
                setPicking(false);
              }}
              className="flex items-center gap-3 py-3"
            >
              <DefaultAvatar name={person.username} size={44} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--text)]">
                {person.username}
              </span>
            </Link>
          ))}
          {peopleResult.loading && (
            <SkeletonList count={5}>
              <SkeletonRow />
            </SkeletonList>
          )}
        </div>
      </BottomSheet>
    </div>
  );
}
