'use client';

import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '@/lib/haptics';

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
    const margin = 16;
    const below = window.innerHeight - anchor.bottom - gap - margin;
    const above = anchor.top - gap - margin;

    /**
     * Меню не наезжает на сообщение — никогда.
     *
     * Раньше сторона выбиралась по принципу «влезает снизу или нет», а если не
     * влезало ни снизу, ни сверху, верх прижимался к шестнадцати пикселям от
     * кромки — и меню наползало на пузырь. Хуже того, пузырь на время меню
     * поднимается над затемнением (z-index 72), так что меню уходило под него:
     * получалось, что открытое меню наполовину спрятано за тем, к чему оно
     * относится.
     *
     * Теперь выбираем ту сторону, где места больше, и ограничиваем высоту этим
     * местом. Не поместившееся прокручивается внутри — список действий длинный
     * только у своих сообщений, где есть и правка, и удаление.
     */
    const openDown = below >= above;
    const room = Math.max(140, openDown ? below : above);
    panel.style.maxHeight = `${room}px`;

    const height = Math.min(panel.scrollHeight, room);
    panel.style.top = openDown
      ? `${anchor.bottom + gap}px`
      : `${anchor.top - gap - height}px`;
    // Растёт меню от того края, к которому прижато, — иначе появление идёт
    // в сторону сообщения и на кадр перекрывает его.
    panel.style.transformOrigin = openDown ? 'top left' : 'bottom left';

    // По горизонтали держимся стороны сообщения, но в пределах экрана.
    const left = Math.min(
      Math.max(12, anchor.left),
      window.innerWidth - panel.offsetWidth - 12
    );
    panel.style.left = `${left}px`;
  }, [open, anchor]);

  // Толчок на появление — как у шторок. Меню вызывают удержанием, и отклик
  // здесь заодно говорит «удержание засчитано», а не «палец соскользнул».
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) haptic('open');
  }

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-[70]"
        style={{
          // Размываем легко: тяжёлый blur лагает при exit-анимации.
          // Контрастный фон уже достаточно выделяет меню.
          backdropFilter: 'blur(calc(3px * var(--glass-strength)))',
          background: 'rgba(0, 0, 0, 0.22)',
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
        className="no-scrollbar fixed z-[71] flex w-[228px] flex-col gap-1.5 overflow-y-auto"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? 'scale(1)' : 'scale(0.92)',
          pointerEvents: open ? 'auto' : 'none',
          visibility: open ? 'visible' : 'hidden',
          transition:
            'opacity 0.18s ease, transform 0.22s cubic-bezier(0.32, 0.72, 0, 1), visibility 0.22s',
        }}
      >
        {/* Реакций два десятка, и в один ряд они не встают. Сетка по шесть в
            строку с прокруткой по высоте: первая строка — самые ходовые, они
            видны сразу, остальные догоняются пролистыванием, не занимая
            полэкрана. */}
        <div
          className="glass no-scrollbar overflow-y-auto rounded-3xl px-1.5 py-1.5"
          style={{ boxShadow: 'var(--glass-shadow)', maxHeight: 132 }}
        >
          <div className="grid grid-cols-6 gap-0.5">
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
