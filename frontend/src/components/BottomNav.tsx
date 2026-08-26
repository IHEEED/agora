'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CREATE_HREF, CreateIcon, MOBILE_SLOTS } from '@/components/navTabs';
import { OverlayLink } from '@/components/OverlayLink';
import { useNavHiddenRequest } from '@/lib/navVisibility';
import { useT } from '@/lib/i18n';
import { useUnreadMessages } from '@/lib/useUnreadNotifications';
import { setFoldOrigin } from '@/lib/foldOrigin';

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
  const unread = useUnreadMessages();
  const { t } = useT();
  const hiddenByPage = useNavHiddenRequest();
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
  // Просьбу спрятать бар снимает сам экран, когда уходит: она живёт в общем
  // хранилище, и сбрасывать её отсюда значило бы менять чужое состояние прямо
  // во время отрисовки. Здесь остаётся только своё — скрытие при листании.
  const [renderedPath, setRenderedPath] = useState(pathname);
  if (renderedPath !== pathname) {
    setRenderedPath(pathname);
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
        // max(), а не просто сумма.
        //
        // В Safari на iPhone env(safe-area-inset-bottom) равен нулю, пока внизу
        // стоит панель самого браузера: страница считает, что до кромки экрана
        // ещё далеко. Капсула вставала на десять пикселей от низа
        // layout-вьюпорта — то есть впритык к этой панели, а на части экранов и
        // под неё. Отсюда «стеклянного бара не появилось»: он был, только за
        // чужой панелью.
        //
        // Двадцать восемь пикселей — минимальный зазор, при котором капсула
        // видна целиком и в Safari, и в приложении с домашнего экрана. Там, где
        // отступ безопасной зоны настоящий (полноэкранный режим), выигрывает он.
        bottom: 'max(28px, calc(10px + env(safe-area-inset-bottom)))',
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
              <OverlayLink
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
              </OverlayLink>
            );
          }

          const active = pathname === slot.href;
          return (
            <Link
              key={slot.href}
              href={slot.href}
              aria-label={slot.label}
              aria-current={active ? 'page' : undefined}
              // Метка для складывания экрана обратно в кнопку: мессенджер
              // уходит в ту же точку, из которой открылся (см. useScreenLeave).
              // Раньше ею была кнопка в шапке, теперь — эта вкладка.
              {...(slot.href === '/messages' ? { 'data-messages-button': '' } : null)}
              onClick={(event) => {
                // Экран мессенджера разворачивается из той точки, по которой
                // нажали, и складывается обратно в неё же. Рамку запоминаем до
                // перехода: на монтировании экрана мерить уже поздно.
                //
                // Без этого разворот шёл из левого верхнего угла — оттуда, где
                // кнопка стояла раньше, когда мессенджер жил в шапке.
                if (slot.href === '/messages') {
                  setFoldOrigin(event.currentTarget.getBoundingClientRect());
                }
              }}
              ref={(node) => {
                slotRefs.current[index] = node;
              }}
              className="relative z-10 flex h-14 flex-1 items-center justify-center"
              style={{
                color: active ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              <slot.Icon active={active} size={26} />
              {/* Точка непрочитанных — на мессенджере. Без числа внутри:
                  на вкладке важно «есть или нет», а сколько именно и от кого —
                  видно на самом экране. */}
              {slot.href === '/messages' && unread > 0 && (
                <span
                  aria-hidden
                  className="absolute h-[9px] w-[9px] rounded-full"
                  style={{
                    // Привязка к самой иконке, а не к краю слота: слоты
                    // растягиваются по ширине бара, и точка уезжала бы от
                    // колокола тем дальше, чем шире экран.
                    top: 'calc(50% - 13px)',
                    left: 'calc(50% + 5px)',
                    background: 'var(--accent)',
                    boxShadow: '0 0 0 2px var(--tabbar-bg, var(--surface))',
                  }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
