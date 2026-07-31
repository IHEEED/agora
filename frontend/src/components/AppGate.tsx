'use client';

import { useSession } from '@/lib/useSession';
import { AuthScreen } from '@/components/AuthScreen';
import { PhoneGateProvider } from '@/components/PhoneGateContext';

/**
 * Без сессии пользователь не видит ни шапки, ни навигации, ни контента —
 * только экран входа/регистрации. Обычный `if (!session) redirect('/login')`
 * здесь не подходит: с ним header/nav успевали бы мигнуть на экране раньше
 * редиректа, а сейчас всё дерево приложения просто не монтируется.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();

  if (loading) {
    return <div className="min-h-screen bg-[var(--bg)]" />;
  }

  if (!session) {
    return <AuthScreen />;
  }

  return <PhoneGateProvider>{children}</PhoneGateProvider>;
}
