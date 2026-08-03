'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CREATE_HREF, CreateIcon, MOBILE_SLOTS } from '@/components/navTabs';
import { useNavHiddenRequest } from '@/lib/navVisibility';

export function BottomNav() {
  const pathname = usePathname();
  const pillRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const [blob, setBlob] = useState<{ x: number; width: number; height: number } | null>(null);
  const [hiddenByPage, setHiddenByPage] = useNavHiddenRequest();
  const [hiddenByScroll, setHiddenByScroll] = useState(false);

  const activeSlot = MOBILE_SLOTS.findIndex((slot) => slot !== null && slot.href === pathname);

  useLayoutEffect(() => {
    function measure() {
      const element = activeSlot >= 0 ? slotRefs.current[activeSlot] : null;
      const pill = pillRef.current;
      if (!element || !pill) {
        setBlob(null);
        return;
      }
      // Капля занимает слот целиком по ширине и почти всю высоту панели,
      // оставляя лишь узкий зазор до её краёв.
      setBlob({
        x: element.offsetLeft,
        width: element.offsetWidth,
        height: pill.clientHeight - 10,
      });
    }

    measure();

    // Слоты тянутся вместе с шириной экрана — пересчитываем каплю на ресайз.
    const observer = new ResizeObserver(measure);
    if (pillRef.current) observer.observe(pillRef.current);
    return () => observer.disconnect();
  }, [activeSlot]);

  // Уход на другой экран снимает обе причины прятать бар: иначе он остался бы
  // внизу после перехода из сообществ с открытым поиском или из глубины ленты.
  // Правку делаем прямо в рендере, а не в эффекте, — это тот самый случай
  // «состояние зависит от пропса», для которого React рекомендует такой приём:
  // лишнего кадра со старым значением не будет.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
    setHiddenByPage(false);
    setHiddenByScroll(false);
  }

  // Листаешь вниз — бар уезжает и не закрывает ленту, листаешь вверх — сразу
  // возвращается. Порог в 6px гасит дрожание от инерции и трекпада, а верхние
  // 90px считаем «шапкой»: там бар виден всегда.
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
    <>
      {/* Отдельной полосы размытия под баром больше нет. Она была подложкой,
          которую бар втягивал своим backdrop-filter, — отсюда градиент темноты
          прямо на панели. На iOS таб-бар тоже единственная стеклянная
          поверхность внизу: под ним ничего не подмешивается, контент просто
          уезжает под него. */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-3 md:hidden"
        style={{
          transform: hidden ? 'translateY(140%)' : 'none',
          opacity: hidden ? 0 : 1,
          // Резче и с лёгким «доводом» в конце: прежние 0.32s читались вязко.
          transition:
            'transform 0.19s cubic-bezier(0.22, 1.2, 0.36, 1), opacity 0.13s ease',
        }}
        aria-hidden={hidden}
      >
        <div
          ref={pillRef}
          className="liquid-glass relative flex w-full max-w-[420px] items-center justify-between rounded-full border px-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
          style={{ pointerEvents: hidden ? 'none' : 'auto' }}
        >
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
                aria-label="Создать"
                ref={(node) => {
                  slotRefs.current[index] = node;
                }}
                className="relative flex h-14 flex-1 items-center justify-center"
                style={{ color: 'var(--accent)' }}
              >
                <CreateIcon />
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
              className="relative flex h-14 flex-1 items-center justify-center"
              style={{
                // Неактивные иконки подмешивают акцент к приглушённому цвету,
                // активная берёт его целиком — бар перекрашивается вместе с темой.
                color: active
                  ? 'var(--accent)'
                  : 'color-mix(in srgb, var(--accent) 42%, var(--text-muted))',
                transition: 'color 0.15s ease',
              }}
            >
              <slot.Icon active={active} />
            </Link>
          );
        })}
        </div>
      </nav>
    </>
  );
}
