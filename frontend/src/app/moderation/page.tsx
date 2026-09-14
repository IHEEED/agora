'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScreenTitle } from '@/components/ScreenTitle';
import { BackTitle } from '@/components/BackTitle';
import { apiFetch } from '@/lib/api';
import { invalidate, useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';

/**
 * Разбор жалоб.
 *
 * Отдельный экран, а не вкладка в настройках: у модератора это рабочее место, и
 * приходит он сюда за очередью, а не за переключателями.
 *
 * Экран закрыт ролью, но настоящая проверка — на сервере: /moderation отвечает
 * 404 всем, кто не модератор. Спрятанный пункт меню защищает ровно до тех пор,
 * пока никто не открыл вкладку «Сеть» в браузере.
 */

type Target =
  | { kind: 'post'; id: string; title: string | null; body: string | null }
  | { kind: 'comment'; id: string; body: string }
  | { kind: 'message'; id: string; body: string | null }
  | { kind: 'user'; id: string; username: string }
  | { kind: 'gone' };

type Author = {
  id: string;
  username?: string;
  banned_until?: string | null;
  verified_at?: string | null;
};

type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  resolution: string | null;
  reporter: { id: string; username: string } | null;
  target: Target;
  author: Author | null;
};

/** Строка журнала: одно действие модератора, каким оно осталось в логе. */
type ModAction = {
  id: string;
  action: string;
  reason: string | null;
  banned_until: string | null;
  created_at: string;
  moderator: { id: string; username: string } | null;
  // Цель могла быть удалена позже — тогда null (on delete set null).
  target: { id: string; username: string } | null;
};

const ACTION_LABEL: Record<string, string> = {
  ban: 'Бан',
  unban: 'Бан снят',
  delete_post: 'Запись удалена',
  delete_comment: 'Комментарий удалён',
  dismiss: 'Жалоба отклонена',
  warn: 'Предупреждение',
  verify: 'Галочка выдана',
  unverify: 'Галочка снята',
};

const REASON_LABEL: Record<string, string> = {
  spam: 'Спам',
  abuse: 'Оскорбления',
  false: 'Ложь',
  violence: 'Насилие',
  impersonation: 'Выдаёт себя за другого',
  threats: 'Угрозы',
  other: 'Прочее',
};

const DURATIONS: { key: string; label: string }[] = [
  { key: 'day', label: 'Сутки' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
  { key: 'forever', label: 'Навсегда' },
];

const TARGET_KIND: Record<string, string> = {
  post: 'Запись',
  comment: 'Комментарий',
  message: 'Сообщение',
  user: 'Человек',
  gone: 'Удалено',
};

function when(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days === 0) return 'сегодня';
  if (days === 1) return 'вчера';
  return `${days} дн. назад`;
}

/** Как показать срок бана: вечный отдельно, прочие — датой окончания. */
function banTerm(until: string | null): string | null {
  if (!until) return null;
  if (until === 'infinity' || until.startsWith('infinity')) return 'навсегда';
  const date = new Date(until);
  if (Number.isNaN(date.getTime())) return null;
  return `до ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;
}

/** Одна строка журнала: что сделали, с кем и когда. */
function ActionRow({ action }: { action: ModAction }) {
  const label = ACTION_LABEL[action.action] ?? action.action;
  const term = action.action === 'ban' ? banTerm(action.banned_until) : null;
  return (
    <article className="glass flex flex-col gap-1.5 rounded-2xl p-4">
      <header className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
        <span
          className="rounded-full px-2.5 py-1 text-[12px] font-medium"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {label}
        </span>
        {term && <span>· {term}</span>}
        <span>·</span>
        <span>{when(action.created_at)}</span>
      </header>

      <p className="text-[13.5px] text-[var(--text)]">
        {/* Цель могла быть удалена позже — тогда её имени в логе уже нет. */}
        {action.target ? (
          <Link href={`/u/${action.target.id}`} className="text-[var(--accent)]">
            {action.target.username}
          </Link>
        ) : (
          <span className="text-[var(--text-muted)]">— цель не сохранилась</span>
        )}
        {action.moderator && (
          <span className="text-[var(--text-muted)]"> · модератор {action.moderator.username}</span>
        )}
      </p>

      {action.reason && (
        <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">{action.reason}</p>
      )}
    </article>
  );
}

/** Текст того, на что пожаловались. Пустой у жалобы на человека целиком. */
function targetText(target: Target): string | null {
  if (target.kind === 'post') return [target.title, target.body].filter(Boolean).join(' — ');
  if (target.kind === 'comment' || target.kind === 'message') return target.body;
  return null;
}

function ReportCard({ report, onDone }: { report: Report; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [banOpen, setBanOpen] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const text = targetText(report.target);
  const authorName = report.author?.username ?? report.author?.id ?? '—';
  const canDelete = report.target.kind !== 'user' && report.target.kind !== 'gone';

  async function act(run: () => Promise<unknown>) {
    setBusy(true);
    setFailed(null);
    try {
      await run();
      onDone();
    } catch (error) {
      setFailed(error instanceof Error ? error.message : 'Не получилось');
      setBusy(false);
    }
  }

  const close = (dismiss: boolean, resolution?: string) =>
    apiFetch(`/moderation/reports/${report.id}/close`, {
      method: 'POST',
      body: JSON.stringify({ dismiss, resolution }),
    });

  return (
    <article className="glass flex flex-col gap-3 rounded-2xl p-4">
      <header className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
        <span
          className="rounded-full px-2.5 py-1 text-[12px] font-medium"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          {REASON_LABEL[report.reason] ?? report.reason}
        </span>
        <span>{TARGET_KIND[report.target.kind]}</span>
        <span>·</span>
        <span>{when(report.created_at)}</span>
        {report.reporter && (
          <>
            <span>·</span>
            <span>от {report.reporter.username}</span>
          </>
        )}
      </header>

      {/* Содержимое цитатой, а не пересказом: решение принимают по тому, что
          человек действительно написал. */}
      {text ? (
        <blockquote
          className="max-h-40 overflow-y-auto rounded-xl px-3.5 py-3 text-[14px] leading-relaxed text-[var(--text)]"
          style={{ background: 'var(--surface-2)' }}
        >
          {text}
        </blockquote>
      ) : (
        <p className="text-[13.5px] text-[var(--text-muted)]">
          {report.target.kind === 'gone'
            ? 'Цель уже удалена — смотреть не на что.'
            : 'Жалоба на человека целиком, а не на отдельную запись.'}
        </p>
      )}

      {report.details && (
        <p className="text-[13px] leading-relaxed text-[var(--text-muted)]">{report.details}</p>
      )}

      {report.author?.id && (
        <p className="text-[13px] text-[var(--text-muted)]">
          Автор:{' '}
          <Link href={`/u/${report.author.id}`} className="text-[var(--accent)]">
            {authorName}
          </Link>
          {report.author.verified_at && ' · подтверждён'}
          {report.author.banned_until && ' · уже забанен'}
        </p>
      )}

      {failed && (
        <p className="text-[13px]" style={{ color: 'var(--down)' }}>
          {failed}
        </p>
      )}

      {banOpen ? (
        // Срок выбирают на месте, а не в отдельном окне: решение принято, и
        // лишний экран между «забанить» и «на сколько» только мешает.
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((duration) => (
            <button
              key={duration.key}
              type="button"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await apiFetch('/moderation/ban', {
                    method: 'POST',
                    body: JSON.stringify({
                      userId: report.author?.id,
                      duration: duration.key,
                      reason: REASON_LABEL[report.reason] ?? report.reason,
                      reportId: report.id,
                    }),
                  });
                  await close(false, `Бан: ${duration.label.toLowerCase()}`);
                })
              }
              className="rounded-full px-3.5 py-2 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--down-soft, var(--surface-2))', color: 'var(--down)' }}
            >
              {duration.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setBanOpen(false)}
            className="rounded-full px-3.5 py-2 text-[13px] text-[var(--text-muted)]"
          >
            Отмена
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act(() => close(true, 'Нарушения нет'))}
            className="rounded-full px-3.5 py-2 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            Нарушения нет
          </button>

          {canDelete && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  await apiFetch(`/moderation/reports/${report.id}/delete-target`, {
                    method: 'POST',
                  });
                  await close(false, 'Удалено');
                })
              }
              className="rounded-full px-3.5 py-2 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
            >
              Удалить
            </button>
          )}

          {/* Галочка — здесь же, где бан.
              Разбирая жалобу, модератор чаще всего впервые смотрит на этого
              человека внимательно, и это ровно тот момент, когда решается «он
              вообще тот, за кого себя выдаёт». Отдельный экран поиска людей
              ради одной кнопки означал бы, что подтверждать никто не будет. */}
          {report.author?.id && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                act(() =>
                  apiFetch('/moderation/verify', {
                    method: 'POST',
                    body: JSON.stringify({
                      userId: report.author?.id,
                      verified: !report.author?.verified_at,
                    }),
                  })
                )
              }
              className="rounded-full px-3.5 py-2 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--surface-2)', color: 'var(--accent)' }}
            >
              {report.author.verified_at ? 'Снять галочку' : 'Подтвердить'}
            </button>
          )}

          {report.author?.id && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setBanOpen(true)}
              className="rounded-full px-3.5 py-2 text-[13px] font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              Забанить
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export default function ModerationPage() {
  const { me, loading: meLoading } = useMe();
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed' | 'log'>('open');

  const isLog = status === 'log';
  // Жалобы и журнал — разные источники; тянем тот, что соответствует вкладке.
  const reportPath = me?.isModerator && !isLog ? `/moderation/reports?status=${status}` : null;
  const logPath = me?.isModerator && isLog ? '/moderation/actions' : null;
  const { data, loading: reportsLoading } = useApiData<{ reports: Report[] }>(reportPath);
  const { data: logData, loading: logLoading } = useApiData<{ actions: ModAction[] }>(logPath);
  const reports = data?.reports ?? [];
  const actions = logData?.actions ?? [];
  const loading = isLog ? logLoading : reportsLoading;

  if (meLoading) return null;

  if (!me?.isModerator) {
    // Ровно то же, что сказал бы сервер: раздела не существует. Объяснять
    // «вам сюда нельзя» значит подтверждать, что раздел есть.
    return (
      <div className="flex flex-1 flex-col items-center">
        <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-12">
          <ScreenTitle>Страница не найдена</ScreenTitle>
          <Link href="/" className="text-[14px] text-[var(--accent)]">
            На главную
          </Link>
        </main>
      </div>
    );
  }

  const tabs: { key: typeof status; label: string }[] = [
    { key: 'open', label: 'В очереди' },
    { key: 'resolved', label: 'Разобранные' },
    { key: 'dismissed', label: 'Отклонённые' },
    { key: 'log', label: 'Журнал' },
  ];

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-5 px-4 pb-12">
        <BackTitle>Модерация</BackTitle>

        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatus(tab.key)}
              className="rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors"
              style={
                status === tab.key
                  ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                  : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-[14px] text-[var(--text-muted)]">Загрузка…</p>}

        {!loading && (isLog ? actions.length === 0 : reports.length === 0) && (
          <p className="text-[14px] text-[var(--text-muted)]">
            {isLog
              ? 'В журнале пока пусто — действий модерации ещё не было.'
              : status === 'open'
                ? 'Очередь пуста — разбирать нечего.'
                : 'Здесь пока пусто.'}
          </p>
        )}

        {isLog
          ? actions.map((action) => <ActionRow key={action.id} action={action} />)
          : reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onDone={() => invalidate('/moderation')}
              />
            ))}
      </main>
    </div>
  );
}
