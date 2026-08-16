'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CREATE_HREF, CreateIcon, TABS } from '@/components/navTabs';
import { useT } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

/**
 * Замена нижнего бара на широких экранах — вертикальная панель слева.
 *
 * Кнопки подписаны. Раньше здесь были одни знаки: на телефоне это оправдано —
 * вкладок пять, они всегда на одном месте, и порядок запоминается за день. На
 * широком экране панель уезжает к левому краю, вне поля зрения, и каждый заход
 * начинается с разгадывания: колокол — это уведомления или что-то про звук,
 * два силуэта — люди или клубы.
 *
 * Подпись под знаком снимает вопрос и ничего не стоит: место слева есть.
 * Панель ради этого шире — 92 вместо 80 пикселей: столько нужно, чтобы самое
 * длинное слово («Уведомления») встало целиком. Отступ контента считается
 * от того же числа в layout (md:pl-20 → md:pl-[92px]).
 */
export function DesktopSidebar() {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <nav className="glass fixed inset-y-0 left-0 z-40 hidden w-[92px] flex-col items-center gap-2 border-y-0 border-l-0 py-6 md:flex">
      <Link
        href={CREATE_HREF}
        aria-label={t('nav.create')}
        className="mb-4 flex w-[76px] flex-col items-center gap-1 rounded-2xl py-2 transition-colors"
        style={{ color: 'var(--accent)' }}
      >
        <CreateIcon size={24} />
        <span className="text-[9.5px] font-medium leading-none">{t('nav.create')}</span>
      </Link>

      <div className="flex flex-col gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? 'page' : undefined}
              className="flex w-[76px] flex-col items-center gap-1 rounded-2xl py-2 transition-colors"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
                background: active ? 'var(--accent-soft)' : 'transparent',
              }}
            >
              <tab.Icon active={active} size={24} />
              {/* Подпись переводится вместе со всем остальным: label в TABS —
                  для aria и служебных мест, на экран идёт ключ. */}
              {/* Без truncate: обрезать подпись, ради которой панель и
                  расширяли, бессмысленно. Кегль подобран по самому длинному
                  слову — «Уведомления» встаёт в ячейку целиком. */}
              <span className="text-center text-[9.5px] font-medium leading-none">
                {t(tab.labelKey as TranslationKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
