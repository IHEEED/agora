'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { haptic } from '@/lib/haptics';
import { useT } from '@/lib/i18n';

/**
 * Облачко над аватаркой: одна мысль на сутки.
 *
 * Жанр между историей и статусом, и обе границы важны. От истории — тем, что не
 * занимает экран: её видно мимоходом, боковым зрением, пока листаешь список
 * переписок. От статуса — тем, что кончается: статус висит годами и к третьему
 * дню перестаёт что-либо значить, а мысль на сутки читают, пока она свежая.
 *
 * Форма именно облачка, а не подписи под именем, — потому что это прямая речь.
 * Хвостик вниз, к лицу, говорит «это сказал вот он» без единого слова
 * объяснения; подпись под именем читалась бы описанием человека, что совсем не
 * то же самое.
 */

/** Сколько знаков влезает. То же число стоит ограничением в схеме (017). */
const MAX_LENGTH = 60;

/**
 * Подсказки в пустом поле.
 *
 * Пустое поле с надписью «О чём думаете?» — вопрос, на который никто не отвечает
 * честно: он слишком большой. Подсказка работает иначе — она не спрашивает, а
 * показывает, каким бывает ответ, и разрешает быть несерьёзным. Отсюда тон:
 * ничего возвышенного, ничего про «поделитесь мыслями».
 *
 * Меняются при каждом открытии, а не крутятся сами: бегущая строка в поле ввода
 * заставляет читать её вместо того, чтобы писать своё.
 */
const HINTS = [
  'сплю с открытыми глазами',
  'ищу того, кто объяснит',
  'третий кофе, полёт нормальный',
  'в активном поиске смысла',
  'не пишите, я занят (не занят)',
  'принимаю рекомендации сериалов',
  'сегодня без мнений',
  'работаю над собой, но не сегодня',
  'кто-нибудь, отвлеките меня',
  'скучаю по лету',
  'открыт к спорам до 23:00',
  'сова, но по расписанию жаворонка',
  'закрыл вкладки, открыл заново',
  'на связи, но неохотно',
  'думаю о том же, о чём и вы',
  'вернусь, когда придумаю статус',
];

export function ThoughtCloud({
  text,
  mine = false,
  onChange,
}: {
  /** Что написано. Пусто — облачка нет (или, у себя, есть приглашение). */
  text?: string | null;
  /** Своё облачко можно править прямо здесь. */
  mine?: boolean;
  onChange?: (next: string | null) => void;
}) {
  const { t } = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text ?? '');
  // Подсказку выбираем один раз на открытие: меняющаяся на ходу заставляет
  // читать её вместо того, чтобы писать своё.
  const [hint] = useState(() => HINTS[Math.floor(Math.random() * HINTS.length)]);

  // Чужое пустое облачко не рисуем вовсе: пузырь с прочерком — это шум в
  // списке, где и так двадцать строк.
  if (!mine && !text) return null;

  async function save(next: string) {
    const value = next.trim().slice(0, MAX_LENGTH);
    setEditing(false);
    onChange?.(value || null);
    haptic();
    try {
      await apiFetch('/notes', { method: 'PUT', body: JSON.stringify({ body: value }) });
    } catch {
      // Мысль на сутки — не то, из-за чего стоит показывать ошибку поверх
      // экрана. Не сохранилось — исчезнет при следующей загрузке.
    }
  }

  if (editing) {
    return (
      <span className="thought-cloud thought-cloud-editing">
        <input
          autoFocus
          value={draft}
          maxLength={MAX_LENGTH}
          placeholder={hint}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save(draft)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void save(draft);
            }
            if (event.key === 'Escape') {
              setDraft(text ?? '');
              setEditing(false);
            }
          }}
          enterKeyHint="done"
          aria-label={t('note.label')}
          className="w-full bg-transparent text-center outline-none placeholder:text-[var(--text-muted)]"
        />
      </span>
    );
  }

  return (
    <span
      className="thought-cloud"
      role={mine ? 'button' : undefined}
      tabIndex={mine ? 0 : undefined}
      onClick={
        mine
          ? (event) => {
              // Облачко живёт поверх аватарки, а аватарка — внутри ссылки на
              // переписку. Без этого нажатие на облачко открывало бы чат.
              event.preventDefault();
              event.stopPropagation();
              setDraft(text ?? '');
              setEditing(true);
            }
          : undefined
      }
      style={mine && !text ? { color: 'var(--text-muted)' } : undefined}
    >
      {text || t('note.empty')}
    </span>
  );
}
