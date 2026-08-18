'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/BottomSheet';
import { useT } from '@/lib/i18n';

/**
 * Куда поделиться постом. Раньше кнопка молча копировала ссылку и подписывала
 * это строкой под постом — надпись жила в разметке, сдвигала соседей и висела
 * пару секунд. Теперь выбор в шторке, а результат виден по самой смене экрана.
 */
type Target = {
  id: string;
  label: string;
  color: string;
  /** Куда открыть. Для «скопировать» ссылки нет. */
  href?: (url: string, text: string) => string;
  icon: React.ReactNode;
};

const TARGETS: Target[] = [
  {
    id: 'telegram',
    label: 'Telegram',
    color: '#29a9eb',
    href: (url, text) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M21.7 3.6 2.9 10.9c-1 .4-1 1.8 0 2.1l4.7 1.5 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.6 3.4c.7.5 1.7.1 1.9-.8l3.1-15c.2-1-.8-1.8-1.8-1.4ZM8.9 14.1l9-5.6-7.4 6.7-.3 3-1.3-4.1Z" />
      </svg>
    ),
  },
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    color: '#25d366',
    href: (url, text) => `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.7-.1a12 12 0 0 1-6.8-6c-.5-.9-.8-1.8-.2-2.7.2-.4.5-.6.8-.7h.7c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.6l-.4.5c-.1.2-.3.3-.1.6a8.7 8.7 0 0 0 3.9 3.4c.3.1.5.1.7-.1l.8-1c.2-.2.3-.2.6-.1l1.9.9c.3.1.4.2.4.4 0 .2 0 .9-.2 1.4Z" />
      </svg>
    ),
  },
  {
    id: 'vk',
    label: 'VK',
    color: '#0077ff',
    href: (url) => `https://vk.com/share.php?url=${encodeURIComponent(url)}`,
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12.8 16.6c-5 0-8.2-3.5-8.3-9.3h2.6c.1 4.3 2 6.1 3.4 6.5V7.3h2.4v3.8c1.4-.2 2.9-1.8 3.4-3.8h2.4c-.4 2.4-2 4-3.1 4.7 1.1.6 3 2 3.7 4.6h-2.7c-.6-1.8-1.9-3.2-3.7-3.4v3.4h-.1Z" />
      </svg>
    ),
  },
  {
    id: 'x',
    label: 'X',
    color: '#111111',
    href: (url, text) => `https://x.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M17.5 3h3.1l-6.8 7.8L21.8 21h-6.2l-4.9-6.4L5 21H1.9l7.3-8.3L1.6 3h6.4l4.4 5.8L17.5 3Zm-1.1 16.1h1.7L7.7 4.8H5.9l10.5 14.3Z" />
      </svg>
    ),
  },
];

export function ShareSheet({
  open,
  onClose,
  url,
  text,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
  text: string;
}) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
        onClose();
      }, 900);
    } catch {
      // Буфер обмена требует защищённого контекста: по http его просто нет.
      onClose();
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={t('share.title')} height="42vh">
      <div className="grid grid-cols-4 gap-3 py-4">
        {TARGETS.map((target) => (
          <a
            key={target.id}
            href={target.href!(url, text)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onClose}
            className="flex flex-col items-center gap-2"
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full text-white"
              style={{ background: target.color }}
            >
              {target.icon}
            </span>
            <span className="text-[12px] text-[var(--text-muted)]">{target.label}</span>
          </a>
        ))}

        <button onClick={copy} className="flex flex-col items-center gap-2">
          <span
            className="flex h-14 w-14 items-center justify-center rounded-full"
            style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="11" height="11" rx="2.5" />
              <path d="M6 15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
            </svg>
          </span>
          <span className="text-[12px] text-[var(--text-muted)]">
            {copied ? t('action.linkCopied') : t('share.link')}
          </span>
        </button>
      </div>
    </BottomSheet>
  );
}
