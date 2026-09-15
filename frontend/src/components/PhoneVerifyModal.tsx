'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { CenterDialog } from '@/components/CenterDialog';

/**
 * Подтверждение телефона через Telegram-бота (вместо SMS).
 *
 * Открываем бота по одноразовой ссылке, человек жмёт в нём «Поделиться
 * номером» — Telegram отдаёт боту номер, привязанный к его аккаунту. Мы
 * опрашиваем /telegram/status и, как только бэкенд пометил телефон
 * подтверждённым, обновляем сессию, чтобы phone_confirmed_at появился у клиента.
 */
export function PhoneVerifyModal({
  open,
  onClose,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}) {
  const [waiting, setWaiting] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<number | null>(null);

  function stopPoll() {
    if (poll.current) {
      window.clearInterval(poll.current);
      poll.current = null;
    }
  }

  // Сброс при закрытии и уборка таймера при размонтировании.
  useEffect(() => {
    if (!open) {
      stopPoll();
      setWaiting(false);
      setUrl(null);
      setError(null);
    }
  }, [open]);
  useEffect(() => () => stopPoll(), []);

  async function begin() {
    setError(null);
    try {
      const res = await apiFetch<{ token: string; url: string }>('/telegram/start', { method: 'POST' });
      setUrl(res.url);
      setWaiting(true);
      window.open(res.url, '_blank', 'noopener');
      stopPoll();
      poll.current = window.setInterval(async () => {
        try {
          const { status } = await apiFetch<{ status: string }>(`/telegram/status?token=${res.token}`);
          if (status === 'done') {
            stopPoll();
            await supabase.auth.refreshSession();
            onVerified();
          } else if (status === 'expired' || status === 'error') {
            stopPoll();
            setWaiting(false);
            setError('Подтверждение не завершилось. Попробуйте ещё раз.');
          }
        } catch {
          // Разрыв сети — просто ждём следующего тика.
        }
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось начать подтверждение');
    }
  }

  return (
    <CenterDialog open={open} onClose={onClose} title="Подтвердите телефон">
      <div>
        <p className="mb-4 text-[14px] leading-relaxed text-[var(--text-muted)]">
          Публикация постов и комментариев доступна после подтверждения номера — это защита от спама и
          накрутки. Подтвердить можно через Telegram, без SMS.
        </p>

        {waiting ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--accent)]" />
            <p className="text-[13.5px] text-[var(--text-muted)]">
              Откройте бота и нажмите «Поделиться номером». Как подтвердите — экран закроется сам.
            </p>
            {url && (
              <button
                onClick={() => window.open(url, '_blank', 'noopener')}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-[13px] font-medium text-[var(--text)]"
              >
                Открыть Telegram ещё раз
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={begin}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-contrast)]"
          >
            Подтвердить через Telegram
          </button>
        )}

        {error && <p className="mt-3 text-sm" style={{ color: 'var(--down)' }}>{error}</p>}
      </div>
    </CenterDialog>
  );
}
