'use client';

import { BellIcon } from '@/components/navTabs';

export default function NotificationsPage() {
  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--bg)]">
      <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-12">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Уведомления</h1>

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-16 text-center">
          <span style={{ color: 'var(--text-muted)' }}>
            <BellIcon active={false} size={44} />
          </span>
          <p className="text-[var(--text-muted)]">Уведомлений пока нет.</p>
        </div>
      </main>
    </div>
  );
}
