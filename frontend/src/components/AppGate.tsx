'use client';

import { usePathname } from 'next/navigation';

import { useSession } from '@/lib/useSession';
import { AuthScreen } from '@/components/AuthScreen';
import { Onboarding } from '@/components/Onboarding';
import { PhoneGateProvider } from '@/components/PhoneGateContext';

/**
 * Без сессии пользователь не видит ни шапки, ни навигации, ни контента —
 * только экран входа/регистрации. Обычный `if (!session) redirect('/login')`
 * здесь не подходит: с ним header/nav успевали бы мигнуть на экране раньше
 * редиректа, а сейчас всё дерево приложения просто не монтируется.
 */
export function AppGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const pathname = usePathname();

  /**
   * Смена пароля проходит мимо ворот.
   *
   * Сюда приходят по ссылке из письма, и в этот момент сессии ещё нет: Supabase
   * разбирает одноразовый ключ из адреса асинхронно. Ворота успевали показать
   * экран входа — то есть человек, нажавший «сменить пароль», попадал ровно на
   * ту форму, пароль от которой и забыл.
   *
   * Обвязку при этом страница прячет сама (см. data-bare в globals.css):
   * отдать её отсюда нельзя — в children лежит и шапка, и бар, а не только
   * содержимое экрана.
   */
  const recovering = pathname === '/reset';

  if (loading && !recovering) {
    return <div className="min-h-[100dvh] bg-[var(--bg)]" />;
  }

  if (!session && !recovering) {
    return <AuthScreen />;
  }

  // Приветствие рисуется поверх приложения, а не вместо него: под ним уже
  // загружается лента, и закрыв последнюю страницу, человек попадает не на
  // пустой экран с крутилкой, а в готовую ленту.
  return (
    <PhoneGateProvider>
      <Onboarding />
      {children}
    </PhoneGateProvider>
  );
}
