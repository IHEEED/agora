'use client';

import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

/**
 * Плавающее меню действий над сообщением — то, что открывается удержанием.
 *
 * Не шторка снизу: шторка уводит взгляд от сообщения, а действие относится
 * именно к нему. Здесь всё наоборот — фон размывается, само сообщение
 * остаётся видимым на своём месте, а рядом появляются реакции и список
 * действий. Так это устроено в мессенджерах, и так понятно, к чему меню.
 *
 * Положение считаем от кадра сообщения: снизу, если там есть место, иначе
 * сверху. Меню при этом не вылезает за края экрана — ширину и поля задаём
 * от него, а не от пузыря.
 */
export type MessageAction = {
  key: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

export function MessageActions({
  open,
  anchor,
  reactions,
  activeReaction,
  actions,
  onReact,
  onClose,
}: {
  open: boolean;
  /** Кадр пузыря, к которому привязано меню. */
  anchor: DOMRect | null;
  reactions: readonly string[];
  activeReaction?: string;
  actions: MessageAction[];
  onReact: (emoji: string) => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // document.body на сервере нет — портал ставим только на клиенте. Снимок,
  // а не setState в эффекте: у сервера и браузера они разные по построению.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel || !anchor) return;

    const gap = 10;
    const fitsBelow = window.innerHeight - anchor.bottom > panel.offsetHeight + gap + 16;
    panel.style.top = fitsBelow
      ? `${anchor.bottom + gap}px`
      : `${Math.max(16, anchor.top - panel.offsetHeight - gap)}px`;

    // По горизонтали держимся стороны сообщения, но в пределах экрана.
    const left = Math.min(
      Math.max(12, anchor.left),
      window.innerWidth - panel.offsetWidth - 12
    );
    panel.style.left = `${left}px`;
  }, [open, anchor]);

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-[70]"
        style={{
          // Размываем, а не гасим: сообщение под меню должно оставаться
          // читаемым — иначе непонятно, к чему относятся действия.
          backdropFilter: 'blur(calc(6px * var(--glass-strength)))',
          background: 'rgba(0, 0, 0, 0.28)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          visibility: open ? 'visible' : 'hidden',
          transition: 'opacity 0.2s ease, visibility 0.2s',
        }}
      />

      <div
        ref={panelRef}
        role="menu"
        aria-hidden={!open}
        className="fixed z-[71] flex w-[228px] flex-col gap-1.5"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1)' : 'scale(0.92)',
          transformOrigin: 'top left',
          pointerEvents: open ? 'auto' : 'none',
          visibility: open ? 'visible' : 'hidden',
          transition:
            'opacity 0.18s ease, transform 0.22s cubic-bezier(0.32, 0.72, 0, 1), visibility 0.22s',
        }}
      >
        <div
          className="glass flex items-center justify-between rounded-full px-1.5 py-1"
          style={{ boxShadow: 'var(--glass-shadow)' }}
        >
          {reactions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(emoji)}
              className="emoji flex h-9 w-9 items-center justify-center rounded-full text-[21px] transition-transform active:scale-90"
              style={{ background: activeReaction === emoji ? 'var(--accent-soft)' : 'transparent' }}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div
          className="glass flex flex-col overflow-hidden rounded-2xl py-1"
          style={{ boxShadow: 'var(--glass-shadow)' }}
        >
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onSelect}
              className="flex items-center gap-3 px-3.5 py-2.5 text-left text-[14.5px] transition-colors hover:bg-[var(--surface-2)]"
              style={{ color: action.danger ? 'var(--down)' : 'var(--text)' }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                {action.icon}
              </svg>
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}
