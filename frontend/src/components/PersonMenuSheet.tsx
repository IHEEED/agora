'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { setBlocked, useIsBlocked } from '@/lib/blockedUsers';
import { TranslationKey, useT } from '@/lib/i18n';

/** Причины жалобы. Тот же короткий список, что и у записи. */
const REPORT_REASONS: TranslationKey[] = [
  'reason.spam',
  'reason.abuse',
  'reason.impersonation',
  'reason.threats',
  'reason.other',
];

type Step = 'menu' | 'report' | 'done' | 'clear';

const STEPS: readonly Step[] = ['menu', 'report', 'done', 'clear'];

type Item = {
  key: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * Меню человека — то, что прячется под тремя точками в чужом профиле и в
 * переписке с ним.
 *
 * Один компонент на оба места: набор действий над человеком не зависит от
 * того, с какого экрана его открыли, и две копии этого списка разошлись бы на
 * первой же правке. Отличие ровно одно — очистить переписку предлагается
 * только там, где она есть.
 *
 * Шаги устроены как у меню записи: лежат друг на друге, уходящий сдвигается
 * влево и гаснет, приходящий приезжает справа, высота шторки едет за ними.
 */
export function PersonMenuSheet({
  open,
  onClose,
  userId,
  username,
  url,
  onClearChat,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  url: string;
  /** Есть только в переписке. Без него пункт очистки не показывается. */
  onClearChat?: () => Promise<void> | void;
}) {
  const { t } = useT();
  const [step, setStep] = useState<Step>('menu');
  const [copied, setCopied] = useState(false);
  const blocked = useIsBlocked(userId);

  const stackRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<Record<Step, HTMLDivElement | null>>({
    menu: null,
    report: null,
    done: null,
    clear: null,
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
  }, [step, open, copied, blocked]);

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
      label: copied ? t('action.linkCopied') : t('action.copyLink'),
      icon: (
        <>
          <rect x="9" y="9" width="11" height="11" rx="2.5" />
          <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
        </>
      ),
      onSelect: copyLink,
    },
    {
      key: 'block',
      label: blocked ? t('person.unblock') : t('person.block'),
      hint: blocked
        ? 'Записи снова появятся в ленте'
        : 'Записи и переписка скроются на этом устройстве',
      icon: blocked ? (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m8.5 12 2.5 2.5 4.5-5" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="8.5" />
          <path d="m6 6 12 12" />
        </>
      ),
      danger: !blocked,
      onSelect: () => {
        setBlocked(userId, !blocked);
        onClose();
      },
    },
    {
      key: 'report',
      label: t('action.report'),
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

  if (onClearChat) {
    items.push({
      key: 'clear',
      label: 'Очистить переписку',
      hint: 'Удалятся только ваши сообщения',
      icon: (
        <>
          <path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2h9.4L17.5 7" />
          <path d="M10.5 11v5M13.5 11v5" />
        </>
      ),
      danger: true,
      onSelect: () => setStep('clear'),
    });
  }

  const title =
    step === 'menu'
      ? username
      : step === 'report'
        ? 'Что не так?'
        : step === 'clear'
          ? 'Очистить переписку?'
          : 'Жалоба принята';

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
      transition: 'opacity 0.24s ease, transform 0.3s var(--enter-ease)',
    };
  }

  // Запас снизу под домашний индикатор: у шторки нет подвала, и последний
  // пункт иначе упирается в самую кромку экрана.
  const padBottom = { paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' };

  return (
    <BottomSheet open={open} onClose={onClose} title={title} height="auto">
      <div ref={stackRef} className="relative" style={{ transition: 'height 0.3s var(--enter-ease)' }}>
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
                className="flex items-center gap-3 rounded-xl px-1 py-3 text-left transition-colors hover:bg-[var(--surface-2)]"
                style={{ color: item.danger ? 'var(--down)' : 'var(--text)' }}
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  {item.icon}
                </svg>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px]">{item.label}</span>
                  {item.hint && (
                    <span className="text-[12.5px] text-[var(--text-muted)]">{item.hint}</span>
                  )}
                </span>
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
                {t(reason)}
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

        {/* Подтверждение очистки. Отдельным шагом, а не системным confirm():
            удаление необратимо, и спрашивать о нём нужно теми же словами и в
            том же окне, где его выбрали. */}
        <div
          ref={(node) => {
            stepRefs.current.clear = node;
          }}
          style={stepStyle('clear')}
        >
          <div className="flex flex-col gap-4 px-1 py-4" style={padBottom}>
            <p className="text-[14.5px] leading-relaxed text-[var(--text-muted)]">
              Ваши сообщения в этой переписке будут удалены без возможности
              вернуть. Реплики собеседника останутся: они принадлежат ему, и
              стереть их у него нельзя.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('menu')}
                className="flex-1 rounded-full py-3 text-[15px] font-medium transition-transform active:scale-[0.98]"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={async () => {
                  await onClearChat?.();
                  onClose();
                }}
                className="flex-1 rounded-full py-3 text-[15px] font-semibold transition-transform active:scale-[0.98]"
                style={{
                  background: 'color-mix(in srgb, var(--down) 16%, transparent)',
                  color: 'var(--down)',
                }}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
