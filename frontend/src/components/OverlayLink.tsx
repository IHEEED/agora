'use client';

import Link from 'next/link';
import { holdBackdrop } from '@/lib/screenBackdrop';

/**
 * Ссылка на экран-накладку: «новая запись».
 *
 * Отличается от обычной одним — перед уходом замораживает то, что сейчас на
 * экране, чтобы шторка выехала поверх ленты, а не поверх пустоты
 * (см. screenBackdrop). Снимок убирает сам экран-накладка, когда уходит.
 *
 * Отдельным компонентом, а не обработчиком по месту: входов в «новую запись»
 * пять — лента, бар, боковая панель, страница клуба и «вслед» под записью, — и
 * забыть его в одном из них значит получить пустоту ровно на одном пути.
 */
export function OverlayLink({
  href,
  children,
  ...rest
}: React.ComponentProps<typeof Link>) {
  return (
    <Link href={href} {...rest} onClick={() => holdBackdrop()}>
      {children}
    </Link>
  );
}
