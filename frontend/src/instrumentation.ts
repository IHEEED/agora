import * as Sentry from '@sentry/nextjs';

/**
 * Мониторинг ошибок на сервере Next (SSR, серверные экшены, роут-хендлеры).
 *
 * Включается серверным SENTRY_DSN (или тем же NEXT_PUBLIC_, если отдельного
 * нет). Без ключа init не зовём — тихий no-op. Next сам вызывает register()
 * один раз при старте среды выполнения.
 */
export function register() {
  const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0,
    });
  }
}

// Ошибки при обработке запроса (в т.ч. в серверных компонентах) — в мониторинг.
// Без активного клиента это тихий no-op.
export const onRequestError = Sentry.captureRequestError;
