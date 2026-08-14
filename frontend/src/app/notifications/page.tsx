'use client';

import Link from 'next/link';
import { SuggestedPeople } from '@/components/SuggestedPeople';
import { ScreenTitle } from '@/components/ScreenTitle';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { useApiData } from '@/lib/useApiData';
import { Community } from '@/lib/types';
import { useT } from '@/lib/i18n';

/**
 * Уведомления.
 *
 * Своих уведомлений пока нет — таблицы под события в базе не заведено, и
 * рисовать выдуманные «вам ответили» было бы враньём. Но пустой экран с одной
 * серой строкой выглядел сломанным: человек жал колокол и не понимал, открылось
 * ли вообще что-нибудь. Поэтому вкладка занята тем, что здесь уместно и
 * настоящее, — людьми и сообществами, на которые стоит подписаться.
 */
export default function NotificationsPage() {
  const { t } = useT();
  const communitiesResult = useApiData<Community[]>('/communities');
  const communities = (communitiesResult.data ?? []).slice(0, 5);

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-5 px-4 pb-12">
        <ScreenTitle>{t('notifications.title')}</ScreenTitle>

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

        {/* Список людей, а не карточек постов: лента постов здесь дублировала
            бы главный экран, а знакомства — то, чего на нём нет. */}
        {/* Лентой вбок, а не столбцом: список во всю высоту отжимал сообщества
            за нижнюю кромку, и вкладка снова выглядела состоящей из одного
            блока. */}
        <SuggestedPeople storageKey="parafraz-suggest-notifications" />

        {communities.length > 0 && (
          <section>
            <h2 className="mb-2 px-0.5 text-[14px] font-semibold text-[var(--text)]">
              {t('notifications.communities')}
            </h2>
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {communities.map((community) => (
                <Link
                  key={community.id}
                  href={`/c/${community.id}`}
                  className="flex items-center gap-3 py-3"
                >
                  <CommunityAvatar name={community.name} size={44} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-medium text-[var(--text)]">
                      {community.name}
                    </span>
                    {community.description && (
                      <span className="truncate text-[12.5px] text-[var(--text-muted)]">
                        {community.description}
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
