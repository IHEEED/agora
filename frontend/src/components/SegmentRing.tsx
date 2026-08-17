'use client';

import { useId } from 'react';

/**
 * Кольцо, разрезанное на дуги по числу историй — как индикатор непрочитанного
 * в Telegram: сразу видно, сколько их, а не просто «что-то есть».
 *
 * Общее для ленты и профиля: раньше эти два места рисовали разные обрамления
 * (рваный многоугольник в профиле, кольцо в ленте), и один и тот же человек
 * выглядел по-разному на соседних экранах.
 */
export function SegmentRing({
  size,
  segments,
  viewed = false,
  strokeWidth,
  gap,
}: {
  size: number;
  segments: number;
  viewed?: boolean;
  strokeWidth?: number;
  gap?: number;
}) {
  // Уникальный id градиента: несколько колец на экране с одинаковым id
  // делят одно определение, и это ломается, как только оттенки разойдутся.
  const gradientId = useId();

  const stroke = strokeWidth ?? size * 0.04;
  const radius = (size - stroke) / 2 - 0.5;
  const circumference = 2 * Math.PI * radius;

  // Одна история — сплошное кольцо: дуга с единственным зазором выглядит обрывом.
  const count = Math.min(Math.max(segments, 1), 7);
  const spacing = count === 1 ? 0 : (gap ?? size * 0.08);
  const arc = circumference / count - spacing;

  return (
    <svg
      className={viewed ? undefined : 'story-ring-spin'}
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ position: 'absolute', inset: 0 }}
      aria-hidden
    >
      <defs>
        {/* Свой градиент, один на все оформления.
            Оттенки брались от акцента — и кольцо меняло смысл вместе со
            стилем: на «Ателье» оно выходило чёрным (непросмотренная история
            выглядела просмотренной), на «Саду» зелёным и путалось с одобрением,
            на «Гламуре» сливалось с розовой кнопкой подписки.

            Кольцо сториз — не часть палитры, а знак: «здесь есть новое». Знак
            обязан выглядеть одинаково всегда, иначе его приходится узнавать
            заново на каждой теме. Тёплая гамма от малинового к янтарному
            различима на всех шести фонах и не совпадает ни с одним акцентом. */}
        <linearGradient id={gradientId} x1="0.1" y1="1" x2="0.9" y2="0">
          <stop offset="0%" stopColor="#7a3fd0" />
          <stop offset="30%" stopColor="#d6296f" />
          <stop offset="65%" stopColor="#f2593a" />
          <stop offset="100%" stopColor="#fcbf3f" />
        </linearGradient>
      </defs>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={viewed ? 'var(--border)' : `url(#${gradientId})`}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${arc} ${spacing}`}
        // Старт с верхней точки: разрез между дугами не должен приходиться
        // на правый край, куда взгляд попадает первым.
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/**
 * Сколько дуг рисовать. Историй в базе пока нет вовсе, поэтому число выводим
 * из имени — оно стабильно между рендерами и не разъезжается между сервером
 * и клиентом. Как появится таблица, сюда придёт настоящий счётчик.
 */
export function segmentsFor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return 2 + (sum % 4);
}
