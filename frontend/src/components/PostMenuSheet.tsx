'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';

/** Причины жалобы. Тот же короткий список, что у Reddit и Threads. */
const REPORT_REASONS = [
  'Спам или реклама',
  'Оскорбления и травля',
  'Ложная информация',
  'Жестокость или опасный контент',
  'Другое',
];

type Item = {
  key: string;
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * Меню поста — то, что прячется под тремя точками.
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
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  isMine: boolean;
  onDelete?: () => void;
}) {
  const [step, setStep] = useState<'menu' | 'report' | 'done'>('menu');
  const [copied, setCopied] = useState(false);

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

  return (
    <BottomSheet open={open} onClose={onClose} title={title} height="auto">
      {/* Запас снизу под домашний индикатор: у шторки нет подвала, и последний
          пункт иначе упирается в самую кромку экрана. */}
      {step === 'menu' && (
        <div
          className="flex flex-col py-1"
          style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
        >
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
      )}

      {step === 'report' && (
        <div
          className="flex flex-col py-1"
          style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
        >
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
      )}

      {step === 'done' && (
        <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12.5 4.5 4.5L19 7.5" />
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
      )}
    </BottomSheet>
  );
}
