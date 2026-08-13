'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CREATE_HREF, CreateIcon, MOBILE_SLOTS } from '@/components/navTabs';
import { useNavHiddenRequest } from '@/lib/navVisibility';
import { useT } from '@/lib/i18n';

/**
 * Нижняя навигация по образцу таб-бара iOS.
 *
 * Ключевое отличие от прежней плавающей «таблетки»: бар прижат к нижней кромке
 * во всю ширину, уходит под домашний индикатор и отделён от контента волосяной
 * линией. Активная вкладка не выделяется каплей — она просто окрашивается
 * акцентом, как в системе. Капля была приёмом Telegram и Android; на iOS её нет,
 * и именно она мешала бару читаться «системным».
 *
 * Под баром ничего не подмешивается: он единственная стеклянная поверхность
 * внизу, контент просто уезжает под него.
 */
export function BottomNav() {
  const pathname = usePathname();
  const { t } = useT();
  const [hiddenByPage, setHiddenByPage] = useNavHiddenRequest();
  const [hiddenByScroll, setHiddenByScroll] = useState(false);

  // Уход на другой экран снимает обе причины прятать бар. Правку делаем прямо
  // в рендере — это тот случай «состояние зависит от пропса», для которого
  // React рекомендует такой приём: лишнего кадра со старым значением не будет.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setHiddenByPage(false);
    setHiddenByScroll(false);
  }

  // Листаешь вниз — бар уезжает и не закрывает ленту, листаешь вверх — сразу
  // возвращается. Порог в 6px гасит дрожание от инерции, верхние 90px считаем
  // «шапкой»: там бар виден всегда.
  useEffect(() => {
    let lastY = window.scrollY;
    let frame = 0;

    function onScroll() {
      // Читаем позицию в кадре анимации: скролл сыплет событиями чаще, чем
      // браузер успевает перерисовывать.
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        const delta = y - lastY;
        if (Math.abs(delta) < 6) return;
        lastY = y;
        setHiddenByScroll(y > 90 && delta > 0);
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // На экранах ввода бар уезжает вниз, освобождая место клавиатуре.
  const hidden =
    pathname === '/search' || pathname === '/create' || hiddenByPage || hiddenByScroll;

  return (
    <nav
      className="ios-tabbar fixed inset-x-0 bottom-0 z-50 md:hidden"
      style={{
        transform: hidden ? 'translateY(100%)' : 'none',
        // Кривая iOS: быстрый старт, мягкая остановка, без пружины.
        transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
      }}
      aria-hidden={hidden}
    >
      <div
        className="flex items-stretch justify-between px-1"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MOBILE_SLOTS.map((slot) => {
          if (!slot) {
            return (
              <Link
                key="create"
                href={CREATE_HREF}
                aria-label={t('nav.create')}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 pb-1.5 pt-2"
                style={{ color: 'var(--accent)' }}
              >
                <CreateIcon size={26} />
                <span className="text-[10px] font-medium leading-none">{t('nav.create')}</span>
              </Link>
            );
          }

          const active = pathname === slot.href;
          return (
            <Link
              key={slot.href}
              href={slot.href}
              aria-label={slot.label}
              aria-current={active ? 'page' : undefined}
              ref={undefined}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 pb-1.5 pt-2"
              style={{
                // Активная вкладка берёт акцент целиком, спящая — приглушённый
                // серый. Никаких подложек: так устроен системный таб-бар.
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              <slot.Icon active={active} size={25} />
              <span className="text-[10px] font-medium leading-none">
                {t(slot.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
