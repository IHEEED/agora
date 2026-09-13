import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';

// Свой dotenv: этот модуль грузится раньше index.ts (до его dotenv.config), а
// DSN нужен уже здесь. Повторный вызов в index.ts безвреден.
dotenv.config();

/**
 * Мониторинг ошибок — включается наличием SENTRY_DSN.
 *
 * Без ключа init не зовём вовсе: Sentry становится тихим no-op, и локальная
 * разработка не шлёт никуда ни events, ни телеметрию. На проде задаём
 * SENTRY_DSN в переменных Railway — и сервер начинает сообщать о сбоях.
 *
 * Модуль импортируется первым в index.ts (до express и роутов), чтобы
 * автоинструментация Sentry успела обернуть http и необработанные отказы.
 */
export const sentryEnabled = Boolean(process.env.SENTRY_DSN);

if (sentryEnabled) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV ?? 'development',
    // Доля запросов под трассировку производительности. По умолчанию 0 —
    // трассировку не гоняем, шлём только ошибки; включается переменной при нужде.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
  });
}

export { Sentry };
