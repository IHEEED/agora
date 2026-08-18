'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { holdBackdrop } from '@/lib/screenBackdrop';
import { BottomSheet } from '@/components/BottomSheet';

/** Причины жалобы. Тот же короткий список, что у Reddit и Threads. */
const REPORT_REASONS = [
  'Спам или реклама',
  'Оскорбления и травля',
  'Ложная информация',
  'Жестокость или опасный контент',
  'Другое',
];

type Step = 'menu' | 'report' | 'done';

const STEPS: readonly Step[] = ['menu', 'report', 'done'];

type Item = {
  key: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * Меню записи — то, что прячется под тремя точками.
 *
 * Шаги не подменяются рывком: все три лежат друг на друге, уходящий сдвигается
 * влево и гаснет, приходящий приезжает справа, а высота шторки едет за ними.
 * Высоту правим прямо в разметке из layout-эффекта, а не состоянием: это
 * измерение, а не данные, и лишний проход рендера ему ни к чему.
 *
 * Жалоба никуда не уходит: таблицы под неё нет, и делать вид, что письмо
 * улетело модератору, было бы враньём. Поэтому выбранная причина
 * подтверждается прямо здесь, а отправка появится вместе с бэкендом.
 */
export function PostMenuSheet({
  open,
  onClose,
  url,
  isMine,
  onDelete,
  continueHref,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  isMine: boolean;
  onDelete?: () => void;
  /**
   * Куда вести за продолжением записи. Задан только у своих записей, у которых
   * продолжения ещё нет: цепочка — одна мысль одного человека, и ветвиться ей
   * нечем (за этим следит и триггер в базе).
   */
  continueHref?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('menu');
  const [copied, setCopied] = useState(false);

  const stackRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Record<Step, HTMLDivElement | null>>({
    menu: null,
    report: null,
    done: null,
  });

  // Шаг сбрасываем на открытии, а не в эффекте: состояние выводится из пропса,
  // и лишнего кадра со старым шагом так не будет.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStep('menu');
      setCopied(false);
    }
  }

  useLayoutEffect(() => {
    const stack = stackRef.current;
    const active = stepRefs.current[step];
    if (!stack || !active) return;

    stack.style.height = `${active.offsetHeight}px`;
  }, [step, open, copied, isMine]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const items: Item[] = [
    {
      key: 'copy',
      label: copied ? 'Ссылка скопирована' : 'Скопировать ссылку',
      icon: (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2.5" />
          <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
        </>
      ),
      onSelect: copyLink,
    },
    {
      key: 'report',
      label: 'Пожаловаться',
      icon: (
        <>
          <path d="M5 21V4.5h9l-.8 3.2H19l-1 4.6H6" />
          <path d="M5 4.5h.01" />
        </>
      ),
      danger: true,
      onSelect: () => setStep('report'),
    },
  ];

  if (continueHref) {
    // Первым пунктом: из всего меню это единственное действие, которое
    // что-то создаёт, а не сообщает о записи.
    items.unshift({
      key: 'continue',
      label: 'Написать вслед',
      icon: (
        <>
          <path d="M6 4v10a3 3 0 0 0 3 3h9" />
          <path d="m14 13 4 4-4 4" />
        </>
      ),
      onSelect: () => {
        onClose();
        // Замораживаем ленту: «новая запись» — отдельный маршрут, и без снимка
        // её шторка выехала бы поверх пустоты (см. screenBackdrop).
        holdBackdrop();
        router.push(continueHref);
      },
    });
  }

  if (isMine && onDelete) {
    items.push({
      key: 'delete',
      label: 'Удалить запись',
      icon: (
        <>
          <path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2h9.4L17.5 7" />
          <path d="M10.5 11v5M13.5 11v5" />
        </>
      ),
      danger: true,
      onSelect: () => {
        onDelete();
        onClose();
      },
    });
  }

  const title = step === 'menu' ? 'Запись' : step === 'report' ? 'Что не так?' : 'Жалоба принята';

  /** Оформление одного шага: активный в кадре, соседние разъехались по краям. */
  function stepStyle(name: Step): React.CSSProperties {
    const order = STEPS.indexOf(name) - STEPS.indexOf(step);
    return {
      position: 'absolute',
      insetInline: 0,
      top: 0,
      opacity: order === 0 ? 1 : 0,
      transform: order === 0 ? 'none' : `translateX(${order > 0 ? 28 : -28}px)`,
      pointerEvents: order === 0 ? 'auto' : 'none',
      transition: 'opacity 0.24s ease, transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
    };
  }

  // Запас снизу под домашний индикатор: у шторки нет подвала, и последний
  // пункт иначе упирается в самую кромку экрана.
  const padBottom = { paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' };

  return (
    <BottomSheet open={open} onClose={onClose} title={title} height="auto">
      <div
        ref={stackRef}
        className="relative"
        style={{ transition: 'height 0.3s cubic-bezier(0.32, 0.72, 0, 1)' }}
      >
        <div
          ref={(node) => {
            stepRefs.current.menu = node;
          }}
          style={stepStyle('menu')}
        >
          <div className="flex flex-col py-1" style={padBottom}>
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onSelect}
                className="flex items-center gap-3 rounded-xl px-1 py-3.5 text-left transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: item.danger ? 'var(--down)' : 'var(--text)' }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  {item.icon}
                </svg>
                <span className="text-[15px]">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          ref={(node) => {
            stepRefs.current.report = node;
          }}
          style={stepStyle('report')}
        >
          <div className="flex flex-col py-1" style={padBottom}>
            {REPORT_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => setStep('done')}
                className="rounded-xl px-1 py-3.5 text-left text-[15px] text-[var(--text)] transition-colors hover:bg-[var(--surface-2)]"
              >
                {reason}
              </button>
            ))}
          </div>
        </div>

        <div
          ref={(node) => {
            stepRefs.current.done = node;
          }}
          style={stepStyle('done')}
        >
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center" style={padBottom}>
            {/* Галочка не появляется готовой: кружок вырастает, а сама линия
                прочерчивается — иначе экран подтверждения возникает рывком
                там, где только что был список. Рисуем её лишь на своём шаге,
                чтобы анимация не отыграла заранее, пока шаг за кадром. */}
            <span
              className={`flex h-14 w-14 items-center justify-center rounded-full ${
                step === 'done' ? 'check-pop' : ''
              }`}
              style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <path className={step === 'done' ? 'check-draw' : ''} d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            </span>
            <p className="text-[14.5px] leading-relaxed text-[var(--text-muted)]">
              Спасибо, мы посмотрим. Отправка модераторам появится вместе с их
              разделом — сейчас жалоба дальше этого экрана не уходит.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-5 py-2.5 text-[14px] font-medium"
              style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
            >
              Понятно
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
