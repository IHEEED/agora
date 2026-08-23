'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n';

/**
 * Серая «i» рядом с кармой: коротко объясняет, откуда берётся число.
 *
 * Подсказка позиционируется от края экрана, а не от самой «i». Привязка к
 * кнопке уже дважды приводила к тому, что подсказка уезжала за кромку: стоит
 * знаку переехать в строке — и её край оказывается за пределами экрана.
 * Экран же на месте всегда, поэтому и считаем от него.
 */
export function InfluenceInfo() {
  const { t } = useT();
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
        aria-label={t('influence.what')}
        aria-expanded={open}
        className="influence-i transition-transform active:scale-90"
        style={{ color: 'var(--text-muted)' }}
      >
        {/* Знак рисуется одной картинкой, а не кружком-обводкой с глифом внутри.
            Прежний вариант собирался из двух независимых частей: рамки
            размером 14×14, которую браузер округлял до целых пикселей, и
            вложенной svg 8×8 со своей сеткой. Их центры почти никогда не
            совпадали — оттого «i» и стояла криво, а тонкая рамка на дробном
            пикселе размывалась в серое кольцо.

            Здесь круг и глиф лежат в одной системе координат, поэтому
            выравнивание точное при любом кегле. Круг залит, а не обведён:
            заливка не зависит от плотности пикселей и остаётся ровной. */}
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
        className="influence-tip fixed inset-x-3 z-50 mx-auto max-w-[340px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-[12.5px] font-normal leading-relaxed text-[var(--text-muted)] shadow-lg"
        data-open={open}
      >
        {t('influence.explain')}
      </span>
    </span>
  );
}
