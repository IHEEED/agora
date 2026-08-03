'use client';

import { useState, SubmitEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomSheet } from '@/components/BottomSheet';

type Step = 'phone' | 'code';

/**
 * supabase-js не всегда кладёт вменяемый текст в error.message (для 500-х
 * от GoTrue это может быть пустая строка или служебный объект) — normalizeAuthError
 * достаёт понятное сообщение из известных случаев и не даёт отрисовать «{}».
 */
function normalizeAuthError(error: { message?: string; code?: string } | null): string {
  if (!error) return 'Не удалось выполнить запрос, попробуйте ещё раз';

  const raw = error.message?.trim();

  if (raw?.toLowerCase().includes('sms provider')) {
    return 'В проекте не настроен SMS-провайдер (Authentication → Providers → Phone в Supabase) — без него коды не отправляются.';
  }

  return raw && raw !== '{}' ? raw : 'Не удалось выполнить запрос, попробуйте ещё раз';
}

/**
 * Подтверждение номера телефона через встроенный SMS OTP Supabase Auth
 * (auth.updateUser({ phone }) → auth.verifyOtp({ type: 'phone_change' })).
 * Требует включённого SMS-провайдера в Supabase (Authentication → Providers →
 * Phone) — своего провайдера (Twilio/Vonage/MessageBird) с его собственным
 * платным аккаунтом. Без него запрос кода вернёт ошибку от Supabase.
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
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setStep('phone');
    setPhone('');
    setCode('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function sendCode(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.updateUser({ phone });

    setLoading(false);
    if (error) {
      setError(normalizeAuthError(error));
      return;
    }
    setStep('code');
  }

  async function confirmCode(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: 'phone_change' });

    setLoading(false);
    if (error) {
      setError(normalizeAuthError(error));
      return;
    }
    reset();
    onVerified();
  }

  // Шторкой снизу, как комментарии и создание поста: всплывающее по центру
  // окно было единственным местом со «старой» механикой появления.
  return (
    <BottomSheet
      open={open}
      onClose={handleClose}
      title="Подтвердите телефон"
      height="64vh"
    >
      <div className="py-3">
        <p className="mb-4 text-[14px] leading-relaxed text-[var(--text-muted)]">
          Публикация постов и комментариев доступна только после подтверждения номера —
          это защита от спама и накрутки голосов.
        </p>

        {step === 'phone' ? (
          <form onSubmit={sendCode} className="flex flex-col gap-3">
            <input
              type="tel"
              required
              autoFocus
              placeholder="+7 900 000-00-00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)]"
            />
            {error && <p className="text-sm" style={{ color: 'var(--down)' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-50"
            >
              {loading ? 'Отправляем код…' : 'Получить код'}
            </button>
          </form>
        ) : (
          <form onSubmit={confirmCode} className="flex flex-col gap-3">
            <p className="text-[13px] text-[var(--text-muted)]">Код отправлен на {phone}</p>
            <input
              type="text"
              inputMode="numeric"
              required
              autoFocus
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] font-num tracking-widest"
            />
            {error && <p className="text-sm" style={{ color: 'var(--down)' }}>{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)]"
              >
                Назад
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent-contrast)] disabled:opacity-50"
              >
                {loading ? 'Проверяем…' : 'Подтвердить'}
              </button>
            </div>
          </form>
        )}
      </div>
    </BottomSheet>
  );
}
