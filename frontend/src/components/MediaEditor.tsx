'use client';

import { useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { DEFAULT_FIT, Fit, ImageFitter } from '@/components/ImageFitter';
import { cropImage } from '@/lib/cropImage';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';

/**
 * Подгонка снимка перед отправкой.
 *
 * До этого выбранный файл уходил как есть. Для аватарки подгонка была
 * (ImageAdjustDialog), а для записей и переписок — нет, хотя нужнее она именно
 * здесь: аватарку человек ставит раз в полгода, а снимки шлёт каждый день, и
 * каждый второй приезжает с телефона перевёрнутым, с лишним небом сверху или с
 * половиной чужого локтя сбоку.
 *
 * Отличие от аватарки не в оформлении, а по существу. Там подгонка — это пара
 * чисел, которые применяются при показе: аватарка своя, показывается в одном
 * месте, и пересчитать её можно когда угодно. Здесь снимок видят все, у каждого
 * своя ширина экрана, и подгонять его при показе нечем. Значит резать надо один
 * раз, здесь, и отправлять уже готовое (см. lib/cropImage).
 *
 * Заодно и сжимаем. Снимок с телефона — три-шесть мегабайт, а в ленте он
 * занимает от силы девятьсот пикселей; за разницу платит трафиком тот, кто
 * листает.
 */

/**
 * Рамки.
 *
 * Четыре, а не список из десяти: выбор из десяти пропорций — это работа, а
 * человек хотел отправить фотографию. Квадрат и 4:5 — то, что берут для ленты
 * (4:5 занимает больше высоты экрана и потому заметнее), 16:9 — для того, что
 * снято поперёк, «как есть» — для тех, кто не хочет ничего решать.
 */
const SHAPES = [
  { id: 'free', label: 'Как есть', ratio: 0 },
  { id: 'square', label: 'Квадрат', ratio: 1 },
  { id: 'portrait', label: '4:5', ratio: 4 / 5 },
  { id: 'wide', label: '16:9', ratio: 16 / 9 },
] as const;

type ShapeId = (typeof SHAPES)[number]['id'];

export function MediaEditor({
  open,
  src,
  onCancel,
  onApply,
}: {
  open: boolean;
  /** Адрес выбранного файла — обычно blob:. */
  src: string | null;
  onCancel: () => void;
  /** Готовый файл: уже обрезанный и сжатый. */
  onApply: (blob: Blob) => void;
}) {
  const { t } = useT();
  const [fit, setFit] = useState<Fit>(DEFAULT_FIT);
  const [shape, setShape] = useState<ShapeId>('free');
  const [busy, setBusy] = useState(false);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Сброс при новом файле. Прямо в отрисовке, а не эффектом: это тот случай
  // «состояние зависит от пропса», и эффект дал бы кадр, в котором новая
  // картинка показана с положением от предыдущей.
  const [lastSrc, setLastSrc] = useState(src);
  if (lastSrc !== src) {
    setLastSrc(src);
    setFit(DEFAULT_FIT);
    setShape('free');
    setNatural(null);
  }

  // «Как есть» — пропорции самого снимка, а не кадра на экране. Пока размеры
  // неизвестны, считаем квадратом: это ровно один кадр до загрузки.
  const ratio =
    SHAPES.find((item) => item.id === shape)!.ratio ||
    (natural ? natural.width / natural.height : 1);

  async function apply() {
    const box = boxRef.current;
    if (!src || !box || busy) return;
    setBusy(true);
    try {
      const rect = box.getBoundingClientRect();
      const blob = await cropImage(src, fit, { width: rect.width, height: rect.height }, ratio);
      haptic();
      onApply(blob);
    } catch {
      // Не вышло — отправляем как есть. Потерять снимок из-за неудавшейся
      // обрезки хуже, чем отправить его неподрезанным.
      const original = await fetch(src).then((response) => response.blob());
      onApply(original);
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={onCancel} title={t('crop.title')} height="auto">
      <div
        className="flex flex-col gap-3"
        style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))' }}
      >
        {src && (
          <>
            {/* Скрытая копия — только чтобы узнать настоящие размеры файла.
                Пропорции «как есть» берутся из них, и без этого рамка по
                умолчанию оказалась бы квадратной для любого снимка. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              hidden
              onLoad={(event) =>
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
            />

            <ImageFitter
              src={src}
              fit={fit}
              onChange={setFit}
              className="w-full overflow-hidden rounded-2xl"
              style={{
                aspectRatio: String(ratio),
                background: 'var(--surface-2)',
              }}
            >
              {/* Кадр обязан быть измерим снаружи: обрезка считается по той же
                  коробке, в которой крутили, и любое расхождение между ними —
                  это расхождение между увиденным и отправленным. */}
              <div ref={boxRef} className="h-full w-full" />
            </ImageFitter>

            <div className="flex gap-1.5">
              {SHAPES.map((item) => {
                const on = shape === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      haptic();
                      setShape(item.id);
                      // Рамка сменилась — картинку возвращаем в середину.
                      // Прежнее положение было выбрано под другую форму, и
                      // после смены оно почти всегда оказывается мимо.
                      setFit(DEFAULT_FIT);
                    }}
                    className="flex-1 whitespace-nowrap rounded-full py-2 text-[13px] font-medium transition-colors"
                    style={
                      on
                        ? { background: 'var(--accent)', color: 'var(--accent-contrast)' }
                        : { background: 'var(--surface-2)', color: 'var(--text-muted)' }
                    }
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            <p className="px-1 text-[12.5px] leading-snug text-[var(--text-muted)]">
              {t('crop.hint')}
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-full py-3 text-[15px] font-semibold transition-transform active:scale-[0.98]"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void apply()}
                disabled={busy}
                className="flex-1 rounded-full py-3 text-[15px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                {busy ? t('crop.working') : t('crop.done')}
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
