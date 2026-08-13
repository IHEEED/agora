'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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

  // Капля повторяет геометрию активного слота, поэтому её приходится измерять:
  // слоты тянутся вместе с шириной экрана, и заранее её не посчитать.
  const pillRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [blob, setBlob] = useState<{ x: number; width: number; height: number } | null>(null);

  const activeSlot = MOBILE_SLOTS.findIndex((slot) => slot !== null && slot.href === pathname);

  useLayoutEffect(() => {
    function measure() {
      const element = activeSlot >= 0 ? slotRefs.current[activeSlot] : null;
      const pill = pillRef.current;
      if (!element || !pill) {
        setBlob(null);
        return;
      }
      setBlob({
        x: element.offsetLeft,
        width: element.offsetWidth,
        height: pill.clientHeight - 12,
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    if (pillRef.current) observer.observe(pillRef.current);
    return () => observer.disconnect();
  }, [activeSlot]);

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
    // Внешний контейнер — плавающая капсула, а не полоса во всю ширину.
    // Позиционирование и отступы держим здесь, материал — в .ios-tabbar.
    <nav
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-3 md:hidden"
      style={{
        bottom: 'calc(10px + env(safe-area-inset-bottom))',
        transform: hidden ? 'translateY(calc(100% + 24px))' : 'none',
        opacity: hidden ? 0 : 1,
        transition:
          'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
      }}
      aria-hidden={hidden}
    >
      <div
        ref={pillRef}
        className="ios-tabbar pointer-events-auto relative flex w-full max-w-[440px] items-center justify-between px-2"
      >
        {/* Капля под активной вкладкой. Ездит трансформацией, а не сменой
            позиции: браузер считает её на видеокарте, и переезд идёт ровно. */}
        {blob && (
          <span
            aria-hidden
            className="nav-blob"
            style={{
              transform: `translate(${blob.x}px, -50%)`,
              width: blob.width,
              height: blob.height,
            }}
          />
        )}

        {MOBILE_SLOTS.map((slot, index) => {
          if (!slot) {
            return (
              <Link
                key="create"
                href={CREATE_HREF}
                aria-label={t('nav.create')}
                ref={(node) => {
                  slotRefs.current[index] = node;
                }}
                className="relative z-10 flex h-14 flex-1 items-center justify-center"
                style={{ color: 'var(--accent)' }}
              >
                <CreateIcon size={27} />
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
              ref={(node) => {
                slotRefs.current[index] = node;
              }}
              className="relative z-10 flex h-14 flex-1 items-center justify-center"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              <slot.Icon active={active} size={26} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
