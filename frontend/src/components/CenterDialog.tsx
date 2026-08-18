'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/**
 * Окно по центру экрана с размытым фоном.
 *
 * Не всё уместно выдвигать снизу: шторка — это «продолжение экрана», её тянут
 * и закрывают жестом. Подтверждение телефона прерывает то, что человек делал,
 * и требует ответа — такому уместнее окно по центру, которое видно целиком и
 * которое не спутать с очередной панелью.
 */
export function CenterDialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // document.body на сервере нет — портал ставим только на клиенте.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Открытое состояние включаем через кадр после того, как окно попало в
  // разметку. Без этого окно, которое монтируется уже открытым (а так и
  // происходит, когда его вызывают сразу после выбора файла), приезжает на
  // место в том же кадре — анимации нечего проигрывать, и оно просто возникает.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(open));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-5"
      style={{
        // Размываем именно фон, а не просто затемняем: под окном остаётся
        // видно, откуда пришёл человек, но читать это уже не тянет.
        backdropFilter: `blur(calc(14px * var(--glass-strength)))`,
        background: 'rgba(0, 0, 0, 0.42)',
        opacity: shown ? 1 : 0,
        pointerEvents: open ? 'auto' : 'none',
        // Пока окно уезжает, оно ещё должно быть видно — прячем только когда
        // и запрос закрыт, и анимация ухода отыграла.
        visibility: open || shown ? 'visible' : 'hidden',
        transition: 'opacity 0.24s ease, visibility 0.24s',
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-sm rounded-3xl p-6"
        style={{
          // Короткий подъём с лёгким увеличением — окно «приходит», а не
          // возникает. Масштаб начинается не с нуля: рост из точки читается
          // мультяшно.
          transform: shown ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(12px)',
          opacity: shown ? 1 : 0,
          transition:
            'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
          boxShadow: 'var(--glass-shadow)',
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-semibold text-[var(--text)]">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="-mr-1 -mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  );
}
