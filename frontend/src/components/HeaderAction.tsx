'use client';

import { usePathname, useRouter } from 'next/navigation';

/**
 * Правая часть шапки, зависит от экрана:
 *  • профиль — шестерня (поиск оттуда никому не нужен);
 *  • настройки и создание поста — крестик, закрывающий экран;
 *  • поиск — лупа уезжает вправо синхронно с нижним баром;
 *  • везде ещё — лупа.
 *
 * Все три глифа лежат слоями в одной кнопке и переключаются прозрачностью.
 * Раньше каждый экран возвращал свою ветку JSX: React менял поддерево целиком,
 * анимировать было нечего, и превращение приходилось подпирать флагом через
 * requestAnimationFrame — работало только в одну сторону. Общий узел даёт
 * плавный переход в обе: и лупа → крестик, и крестик → шестерня.
 */
type Glyph = 'search' | 'gear' | 'cross';

const GLYPH_ORDER: ReadonlyArray<Glyph> = ['search', 'gear', 'cross'];

function SearchGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.3-4.3" />
    </svg>
  );
}

function GearGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 14.6a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </svg>
  );
}

function CrossGlyph() {
  return (
    <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

const GLYPH_NODE: Record<Glyph, () => React.ReactElement> = {
  search: SearchGlyph,
  gear: GearGlyph,
  cross: CrossGlyph,
};

const LABEL: Record<Glyph, string> = {
  search: 'Поиск',
  gear: 'Настройки',
  cross: 'Закрыть',
};

export function HeaderAction() {
  const pathname = usePathname();
  const router = useRouter();

  // На поиске кнопка не уезжает, а превращается в крестик: уезжающая лупа
  // оставляла угол пустым, и закрывать экран приходилось вторым крестиком
  // рядом со строкой — двумя кнопками для одного действия.
  const closes =
    pathname === '/settings' || pathname === '/create' || pathname === '/search';

  const glyph: Glyph = closes ? 'cross' : pathname === '/profile' ? 'gear' : 'search';

  function handleClick() {
    if (closes) return router.back();
    router.push(glyph === 'gear' ? '/settings' : '/search');
  }

  const morph = 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)';

  return (
    <button
      onClick={handleClick}
      aria-label={LABEL[glyph]}
      className="relative flex h-[52px] w-[52px] items-center justify-center rounded-full border transition-colors"
      style={{
        background: 'var(--accent-soft)',
        borderColor: 'var(--glass-border)',
        color: 'var(--accent)',
      }}
    >
      {GLYPH_ORDER.map((name) => {
        const Node = GLYPH_NODE[name];
        const active = glyph === name;
        return (
          <span
            key={name}
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
            style={{
              opacity: active ? 1 : 0,
              // Уходящий глиф закручивается в одну сторону, приходящий
              // раскручивается из другой — получается единое движение.
              transform: active ? 'none' : 'rotate(-90deg) scale(0.5)',
              transition: morph,
            }}
          >
            <Node />
          </span>
        );
      })}
    </button>
  );
}
