'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Серая «i» рядом с кармой: коротко объясняет, откуда берётся число.
 *
 * Подсказка позиционируется от края экрана, а не от самой «i». Привязка к
 * кнопке уже дважды приводила к тому, что подсказка уезжала за кромку: стоит
 * знаку переехать в строке — и её край оказывается за пределами экрана.
 * Экран же на месте всегда, поэтому и считаем от него.
 */
export function InfluenceInfo() {
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
        onClick={() => setOpen((v) => !v)}
        aria-label="Что такое influence-очки"
        aria-expanded={open}
        className="influence-i flex items-center justify-center rounded-full border transition-transform active:scale-90"
        style={{ borderColor: 'var(--text-muted)', color: 'var(--text-muted)' }}
      >
        {/* Глиф вместо буквы: точка и штрих строго по центру круга,
            текстовая «i» из-за своих метрик всегда стоит криво. */}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" aria-hidden>
          <circle cx="4" cy="1.5" r="0.85" />
          <rect x="3.35" y="3.2" width="1.3" height="3.4" rx="0.65" />
        </svg>
      </button>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}

      <span
        ref={tipRef}
        role="tooltip"
        aria-hidden={!open}
        className="influence-tip fixed inset-x-3 z-50 mx-auto max-w-[340px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-[12.5px] font-normal leading-relaxed text-[var(--text-muted)] shadow-lg"
        data-open={open}
      >
        Influence-очки — сумма голосов за все ваши посты. Каждый голос «за»
        добавляет очко, «против» — отнимает. Чем полезнее ваши записи, тем их больше.
      </span>
    </span>
  );
}
