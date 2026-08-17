'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Знак «i» с всплывающим объяснением.
 *
 * Обобщён из InfluenceInfo: то же понадобилось «вслед», и второй копией это
 * разошлось бы на первой правке. Само объяснение приходит содержимым — здесь
 * только механика показа.
 *
 * Подсказка позиционируется от края экрана, а не от самого знака. Привязка к
 * кнопке уже дважды приводила к тому, что подсказка уезжала за кромку: стоит
 * знаку переехать в строке — и её край оказывается за пределами экрана. Экран
 * же на месте всегда, поэтому и считаем от него.
 */
export function HintDot({
  label,
  children,
}: {
  /** Что читает скринридер вместо картинки. */
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const button = buttonRef.current;
    const tip = tipRef.current;
    if (!open || !button || !tip) return;

    function place() {
      if (!button || !tip) return;
      const rect = button.getBoundingClientRect();
      // Ниже знака, если внизу есть место; иначе выше — подсказка не должна
      // упираться в нижнюю кромку.
      const below = window.innerHeight - rect.bottom > tip.offsetHeight + 24;
      tip.style.top = below ? `${rect.bottom + 8}px` : `${rect.top - tip.offsetHeight - 8}px`;
    }

    place();
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  return (
    <span className="inline-flex">
      <button
        ref={buttonRef}
        type="button"
        onClick={(event) => {
          // Знак часто стоит внутри кнопки или ссылки — нажатие по нему не
          // должно заодно срабатывать за них.
          event.preventDefault();
          event.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={label}
        aria-expanded={open}
        className="influence-i transition-transform active:scale-90"
        style={{ color: 'var(--text-muted)' }}
      >
        {/* Круг и глиф в одной системе координат: собранный из рамки и
            вложенной картинки знак почти никогда не совпадал центрами. */}
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
          <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.16" />
          <circle cx="8" cy="4.6" r="1.05" fill="currentColor" />
          <rect x="7.05" y="6.7" width="1.9" height="5" rx="0.95" fill="currentColor" />
        </svg>
      </button>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      <span
        ref={tipRef}
        role="tooltip"
        aria-hidden={!open}
        className="influence-tip fixed inset-x-3 z-50 mx-auto max-w-[340px] rounded-xl p-3 text-left text-[12.5px] font-normal leading-relaxed text-[var(--text-muted)]"
        style={{ background: 'var(--surface)', boxShadow: 'var(--float-shadow)' }}
        data-open={open}
      >
        {children}
      </span>
    </span>
  );
}
