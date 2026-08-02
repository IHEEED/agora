'use client';

import { BellIcon } from '@/components/navTabs';
import { useT } from '@/lib/i18n';

export default function NotificationsPage() {
  const { t } = useT();

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-12">
        <h1 className="font-pixel text-[32px] text-[var(--text)]">{t('notifications.title')}</h1>

        <div className="glass flex flex-col items-center gap-3 rounded-2xl px-4 py-16 text-center">
          <span style={{ color: 'var(--text-muted)' }}>
            <BellIcon active={false} size={44} />
          </span>
          <p className="text-[var(--text-muted)]">{t('notifications.empty')}</p>
        </div>
      </main>
    </div>
  );
}
