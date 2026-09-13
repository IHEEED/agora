import * as Sentry from '@sentry/nextjs';

/**
 * Мониторинг ошибок в браузере — включается наличием NEXT_PUBLIC_SENTRY_DSN.
 *
 * Без ключа init не зовём: Sentry становится тихим no-op, локальная разработка
 * никуда ничего не шлёт. DSN клиентский (NEXT_PUBLIC_), он и так виден в бандле
 * — это нормально, отправку ограничивают настройки проекта в Sentry.
 *
 * Файл подхватывает сам Next (instrumentation-client), обёртка next.config не
 * нужна — она только для загрузки sourcemaps, это отдельный шаг.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_ENV ?? process.env.NODE_ENV,
    // Только ошибки: трассировку производительности и запись сессий не гоняем,
    // пока в них нет нужды (объём и приватность).
    tracesSampleRate: 0,
  });
}

// Инструментация переходов App Router — Next зовёт этот экспорт на навигации.
// Без активного клиента это тихий no-op.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
