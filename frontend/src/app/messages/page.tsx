'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import Link from 'next/link';
import { useApiData } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { MessageThread, UserSummary } from '@/lib/types';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { BottomSheet } from '@/components/BottomSheet';
import { ThreadRow } from '@/components/ThreadRow';
import { ThoughtCloud } from '@/components/ThoughtCloud';
import { CenterDialog } from '@/components/CenterDialog';
import { SkeletonList, SkeletonRow } from '@/components/Skeleton';
import { useBlockedUsers } from '@/lib/blockedUsers';
import { useScreenLeave } from '@/lib/useScreenLeave';
import { holdBackdrop } from '@/lib/screenBackdrop';
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
  const { session } = useSession();
  const [picking, setPicking] = useState(false);
  /** Переписка, по которой открыто меню действий. */
  const [menuFor, setMenuFor] = useState<MessageThread | null>(null);
  /** Переписка, удаление которой переспрашиваем. */
  const [confirmDelete, setConfirmDelete] = useState<MessageThread | null>(null);
  /** Своя мысль на сутки. Правится прямо в облачке над своей аватаркой. */
  const [myNote, setMyNote] = useState<string | null>(null);
  // Разворачивается из кнопки в шапке и складывается обратно в неё — так же,
  // как поиск. У мессенджера есть своя кнопка, и связь «нажал вот это — выросло
  // вот это» показать стоит: раздел открывается не из бара, и вернуться иначе
  // нечем, кроме той же кнопки.
  const { goBack, style: leaveStyle, swipeHandlers } = useScreenLeave('[data-messages-button]');

  const threadsResult = useApiData<MessageThread[]>('/messages/threads');
  // Переписки с заблокированными убираем из списка: смысл блокировки в том,
  // чтобы человек не попадался на глаза, а строка в мессенджере — ровно то
  // место, где он попадается чаще всего.
  const blocked = useBlockedUsers();
  const threads = (threadsResult.data ?? []).filter(
    (thread) => !blocked.includes(thread.user.id)
  );

  /**
   * Настройки переписок правим у себя, а не ждём сервер.
   *
   * Закрепление — это перестановка строки в списке, и увидеть её человек должен
   * в тот момент, когда отпустил палец. Ждать ответа значило бы держать список
   * неподвижным полсекунды после жеста, который выглядел завершённым.
   *
   * Ошибку не откатываем и не показываем: настройка личная и ни на что, кроме
   * порядка строк, не влияет. Следующая загрузка списка приведёт его в согласие
   * с сервером — а до тех пор пусть будет так, как человек попросил.
   */
  /**
   * Мысли собеседников — одним запросом на весь список.
   *
   * Адрес собирается из идентификаторов, поэтому кеш useApiData сам различает
   * разные наборы людей: сменился состав переписок — сменился ключ, приедут
   * свежие облачка. Запрашивать их по одному на строку значило бы двадцать
   * запросов на открытие экрана.
   */
  const me = session?.user.id;
  // Себя добавляем в тот же запрос: своё облачко надо показать при открытии,
  // а не только после того, как его напишут. Отдельный запрос ради одной
  // строки был бы вторым обращением к тому же маршруту.
  const noteIds = [...threads.map((thread) => thread.user.id), me]
    .filter(Boolean)
    .sort()
    .join(',');
  const notesResult = useApiData<{ author_id: string; body: string }[]>(
    noteIds ? `/notes?ids=${noteIds}` : null
  );
  const notes = new Map((notesResult.data ?? []).map((note) => [note.author_id, note.body]));

  // Своё облачко: пока его не трогали, показываем то, что приехало с сервера.
  // Сравнение в отрисовке, а не эффект, — иначе после загрузки был бы кадр с
  // пустым облачком поверх уже приехавшей мысли.
  const loadedNote = me ? (notes.get(me) ?? null) : null;
  const [lastLoadedNote, setLastLoadedNote] = useState(loadedNote);
  if (lastLoadedNote !== loadedNote) {
    setLastLoadedNote(loadedNote);
    setMyNote(loadedNote);
  }

  function patchThread(peerId: string, patch: { pinned?: boolean; muted?: boolean }) {
    threadsResult.mutate((prev) =>
      (prev ?? []).map((thread) =>
        thread.user.id === peerId ? { ...thread, ...patch } : thread
      )
    );
    apiFetch(`/messages/prefs/${peerId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).catch(() => undefined);
  }

  async function removeThread(peerId: string) {
    threadsResult.mutate((prev) => (prev ?? []).filter((thread) => thread.user.id !== peerId));
    setConfirmDelete(null);
    setMenuFor(null);
    try {
      await apiFetch(`/messages/thread/${peerId}`, { method: 'DELETE' });
    } catch {
      // Не получилось — вернём при следующей загрузке. Показывать ошибку по
      // строке, которая уже уехала с экрана, некуда.
    }
  }

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

        {/* Своё облачко — над своим лицом, первой строкой.
            Здесь же, где чужие, и по той же причине: мысль на сутки живёт в
            списке переписок, а не в профиле. Отдельного экрана ей не надо —
            всё, что с ней делают, это пишут одну строку и стирают. */}
        <div className="mb-1 mt-6 flex justify-center">
          <span className="relative">
            <DefaultAvatar
              name={(session?.user.email ?? '?').split('@')[0]}
              size={44}
            />
            <ThoughtCloud text={myNote} mine onChange={setMyNote} />
          </span>
        </div>

        {/* Строки, а не карточки: список переписок читают сверху вниз одним
            движением глаз, и обойма вокруг каждой строки только сбивает ритм.
            Разделяет их волосяная черта под текстом, начинающаяся за аватаром —
            так же, как в любом мессенджере. */}
        <section className="message-list flex flex-col">
          {threads.map((thread) => (
            <ThreadRow
              key={thread.user.id}
              thread={thread}
              onPin={() => patchThread(thread.user.id, { pinned: !thread.pinned })}
              onMute={() => patchThread(thread.user.id, { muted: !thread.muted })}
              note={notes.get(thread.user.id)}
              onMenu={() => setMenuFor(thread)}
            />
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
              <DefaultAvatar name={person.username} size={44} src={person.avatar_url} />
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

      {/* Меню действий по переписке — то, что открывается удержанием.
          Шторкой, а не плавающим меню у строки: действий четыре, они разной
          цены, и разложенные в столбик они читаются списком решений, а не
          россыпью значков. У сообщения меню плавающее по другой причине — там
          важно видеть само сообщение, а здесь строка ничего не добавляет. */}
      <BottomSheet
        open={menuFor !== null}
        onClose={() => setMenuFor(null)}
        title={menuFor?.user.username ?? ''}
        height="auto"
      >
        <div
          className="flex flex-col py-1"
          style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
        >
          {menuFor &&
            [
              {
                key: 'pin',
                label: menuFor.pinned ? 'Открепить' : 'Закрепить',
                run: () => patchThread(menuFor.user.id, { pinned: !menuFor.pinned }),
              },
              {
                key: 'read',
                label: 'Отметить прочитанным',
                // Нечего отмечать — нечего и предлагать: пункт, который ничего
                // не делает, читается сломанным.
                hidden: menuFor.unread === 0,
                run: () => {
                  threadsResult.mutate((prev) =>
                    (prev ?? []).map((thread) =>
                      thread.user.id === menuFor.user.id ? { ...thread, unread: 0 } : thread
                    )
                  );
                  apiFetch(`/messages/${menuFor.user.id}/read`, { method: 'POST' }).catch(
                    () => undefined
                  );
                },
              },
              {
                key: 'mute',
                label: menuFor.muted ? 'Вернуть звук' : 'Приглушить',
                run: () => patchThread(menuFor.user.id, { muted: !menuFor.muted }),
              },
              {
                key: 'delete',
                label: 'Удалить переписку',
                danger: true,
                // Не выполняем, а переспрашиваем: письма уходят у обоих, и
                // отменить это нечем.
                run: () => setConfirmDelete(menuFor),
              },
            ]
              .filter((row) => !row.hidden)
              .map((row) => (
                <button
                  key={row.key}
                  type="button"
                  onClick={() => {
                    row.run();
                    if (row.key !== 'delete') setMenuFor(null);
                  }}
                  className="rounded-xl px-1 py-3.5 text-left text-[15px] transition-colors hover:bg-[var(--surface-2)]"
                  style={{ color: row.danger ? 'var(--down)' : 'var(--text)' }}
                >
                  {row.label}
                </button>
              ))}
        </div>
      </BottomSheet>

      {/* Удаление переспрашивает, и в вопросе сказано главное: письма уходят у
          обоих. Своей копии переписки в схеме нет — письмо одно на двоих, — и
          умолчать об этом значило бы дать человеку удалить чужое, думая, что
          он прибирается у себя. */}
      <CenterDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Удалить переписку?"
      >
        <p className="mb-5 text-[14px] leading-relaxed text-[var(--text-muted)]">
          Все письма с {confirmDelete?.user.username} исчезнут у обоих. Вернуть их будет нечем.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setConfirmDelete(null)}
            className="flex-1 rounded-full py-3 text-[15px] font-semibold transition-transform active:scale-[0.98]"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => confirmDelete && void removeThread(confirmDelete.user.id)}
            className="flex-1 rounded-full py-3 text-[15px] font-semibold transition-transform active:scale-[0.98]"
            style={{
              background: 'color-mix(in srgb, var(--down) 14%, transparent)',
              color: 'var(--down)',
            }}
          >
            Удалить
          </button>
        </div>
      </CenterDialog>
    </div>
  );
}
