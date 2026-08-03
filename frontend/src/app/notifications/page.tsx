'use client';

import { SuggestedPeople } from '@/components/SuggestedPeople';
import { ScreenTitle } from '@/components/ScreenTitle';
import { useT } from '@/lib/i18n';

export default function NotificationsPage() {
  const { t } = useT();

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-5 px-4 pb-12">
        <ScreenTitle>{t('notifications.title')}</ScreenTitle>

        {/* Простой строкой, а не карточкой: обойма со стеклом и скруглением
            читалась кнопкой, на которую хочется нажать, — а нажимать нечего. */}
        <p className="px-0.5 text-[14px] text-[var(--text-muted)]">
          {t('notifications.empty')}
        </p>

        {/* Список людей, а не карточек постов: лента постов здесь дублировала
            бы главный экран, а знакомства — то, чего на нём нет. */}
        <SuggestedPeople storageKey="parafraz-suggest-notifications" layout="list" />
      </main>
    </div>
  );
}
