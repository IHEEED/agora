'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ScreenTitle } from '@/components/ScreenTitle';
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

type Report = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  resolution: string | null;
  reporter: { id: string; username: string } | null;
  target: Target;
  author: { id: string; username?: string; banned_until?: string | null } | null;
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
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');

  const path = me?.isModerator ? `/moderation/reports?status=${status}` : null;
  const { data, loading } = useApiData<{ reports: Report[] }>(path);
  const reports = data?.reports ?? [];

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
  ];

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-5 px-4 pb-12">
        <ScreenTitle>Модерация</ScreenTitle>

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

        {!loading && reports.length === 0 && (
          <p className="text-[14px] text-[var(--text-muted)]">
            {status === 'open' ? 'Очередь пуста — разбирать нечего.' : 'Здесь пока пусто.'}
          </p>
        )}

        {reports.map((report) => (
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
