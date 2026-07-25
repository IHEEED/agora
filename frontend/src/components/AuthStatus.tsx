'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';

export function AuthStatus() {
  const { session, loading } = useSession();
  const router = useRouter();

  if (loading) return null;

  if (!session) {
    return (
      <Link href="/login" className="text-sm font-medium text-black hover:underline dark:text-zinc-50">
        Войти
      </Link>
    );
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{session.user.email}</span>
      <button onClick={handleSignOut} className="font-medium text-black hover:underline dark:text-zinc-50">
        Выйти
      </button>
    </div>
  );
}
