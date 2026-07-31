'use client';

import { useState } from 'react';

/** Серая «i» рядом с кармой: коротко объясняет, откуда берётся число. */
export function InfluenceInfo() {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Что такое influence-очки"
        aria-expanded={open}
        className="influence-i flex items-center justify-center rounded-full border"
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

      {/* Прижата к правому краю: influence — крайняя метрика, по центру подсказка
          вылезала бы за пределы карточки. */}
      <span
        role="tooltip"
        aria-hidden={!open}
        className="influence-tip absolute right-0 top-full z-50 mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-[12.5px] font-normal leading-relaxed text-[var(--text-muted)] shadow-lg"
        data-open={open}
      >
        Influence-очки — сумма голосов за все ваши посты. Каждый голос «за»
        добавляет очко, «против» — отнимает. Чем полезнее ваши записи, тем их больше.
      </span>
    </span>
  );
}
