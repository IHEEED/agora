'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { PhoneVerifyModal } from '@/components/PhoneVerifyModal';

type PhoneGateContextValue = {
  /** Открывает модалку подтверждения телефона. */
  requestVerification: () => void;
};

const PhoneGateContext = createContext<PhoneGateContextValue | null>(null);

/**
 * Единая точка входа для гейта «подтверди телефон, чтобы писать».
 * Бэкенд возвращает `PHONE_NOT_VERIFIED` на POST /posts и /comments —
 * обработчики форм ловят эту ошибку и зовут requestVerification().
 */
export function usePhoneGate() {
  const ctx = useContext(PhoneGateContext);
  if (!ctx) throw new Error('usePhoneGate must be used inside PhoneGateProvider');
  return ctx;
}

/** true, если ошибка apiFetch — это отказ из-за неподтверждённого телефона. */
export function isPhoneNotVerifiedError(err: unknown): boolean {
  return err instanceof Error && err.message === 'PHONE_NOT_VERIFIED';
}

export function PhoneGateProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const requestVerification = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <PhoneGateContext.Provider value={{ requestVerification }}>
      {children}
      <PhoneVerifyModal open={open} onClose={close} onVerified={close} />
    </PhoneGateContext.Provider>
  );
}
