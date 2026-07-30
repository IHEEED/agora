'use client';

import { useSession } from '@/lib/useSession';
import Link from 'next/link';

export default function NotificationsPage() {
  const { session, loading } = useSession();

  return (
    <div className="flex flex-1 flex-col items-center bg-[var(--bg)]">
      <main className="flex w-full max-w-2xl flex-col gap-4 py-12 px-4">
        <h1 className="text-2xl font-semibold text-[var(--text)]">Уведомления</h1>

        {!loading && !session && (
          <p className="text-[var(--text-muted)]">
            Чтобы видеть уведомления, нужно{' '}
            <Link href="/login" className="font-medium" style={{ color: 'var(--accent)' }}>
              войти
            </Link>
            .
          </p>
        )}

        {!loading && session && (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-16 text-center">
            <span className="text-2xl">🔔</span>
            <p className="text-[var(--text-muted)]">Уведомлений пока нет.</p>
          </div>
        )}
      </main>
    </div>
  );
}
