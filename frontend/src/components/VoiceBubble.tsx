'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Голосовое сообщение в пузыре.
 *
 * Полоска, а не системный <audio> с его панелью: у той панели свои цвета, своя
 * высота и своя иконка на каждый браузер, и в переписке она выглядит вставленным
 * куском чужого интерфейса. Нужны здесь ровно три вещи — кнопка, длина и место,
 * где сейчас воспроизведение.
 *
 * Столбики нарисованы по псевдослучайной последовательности от длины записи, а
 * не по настоящей громкости: чтобы получить настоящую, файл надо скачать целиком
 * и разобрать в AudioContext — то есть загрузить все голосовые переписки ради
 * картинки, которую никто не сверяет со звуком. Важно, что рисунок постоянный:
 * одно и то же сообщение выглядит одинаково при каждом открытии.
 */
const BARS = 27;

function levels(seed: number): number[] {
  const out: number[] = [];
  let value = seed * 9301 + 49297;
  for (let i = 0; i < BARS; i += 1) {
    value = (value * 9301 + 49297) % 233280;
    // От 0.35 до 1: совсем низких столбиков быть не должно — полоска с
    // провалами читается как испорченная запись.
    out.push(0.35 + (value / 233280) * 0.65);
  }
  return out;
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

export function VoiceBubble({
  src,
  seconds,
  mine,
}: {
  src: string;
  seconds: number;
  mine: boolean;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [passed, setPassed] = useState(0);

  useEffect(() => {
    return () => {
      audio.current?.pause();
      audio.current = null;
    };
  }, []);

  function toggle() {
    if (!audio.current) {
      const element = new Audio(src);
      element.addEventListener('timeupdate', () => setPassed(element.currentTime));
      element.addEventListener('ended', () => {
        setPlaying(false);
        setPassed(0);
      });
      audio.current = element;
    }

    if (playing) {
      audio.current.pause();
      setPlaying(false);
      return;
    }
    void audio.current.play();
    setPlaying(true);
  }

  // Доля прослушанного. Считаем от присланной длительности, а не от duration
  // файла: у opus-потока без длины duration бывает Infinity, и полоска зависала.
  const share = seconds > 0 ? Math.min(1, passed / seconds) : 0;
  const bars = levels(Math.round(seconds) || 1);
  const ink = mine ? 'var(--accent-contrast)' : 'var(--text)';

  return (
    <span className="flex items-center gap-2.5 py-0.5">
      <button
        type="button"
        onClick={(event) => {
          // Пузырь под этой кнопкой открывает меню по удержанию — нажатие на
          // воспроизведение к нему отношения не имеет.
          event.stopPropagation();
          toggle();
        }}
        aria-label={playing ? 'Пауза' : 'Воспроизвести'}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full transition-transform active:scale-90"
        style={{ background: mine ? 'rgba(255,255,255,0.22)' : 'var(--surface)', color: ink }}
      >
        {playing ? (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6.5" y="5" width="4" height="14" rx="1.4" />
            <rect x="13.5" y="5" width="4" height="14" rx="1.4" />
          </svg>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13l11-6.5Z" />
          </svg>
        )}
      </button>

      <span className="flex flex-1 items-center gap-[2px]" aria-hidden>
        {bars.map((height, index) => {
          const heard = index / BARS <= share;
          return (
            <span
              key={index}
              style={{
                flex: 1,
                height: `${Math.round(height * 22)}px`,
                borderRadius: 999,
                background: ink,
                // Непрослушанное приглушено. Полоска не столько показывает
                // прогресс, сколько отвечает на вопрос «я это уже слушал?».
                opacity: heard ? 0.95 : 0.35,
                transition: 'opacity 0.12s linear',
              }}
            />
          );
        })}
      </span>

      <span className="font-num flex-none text-[12px]" style={{ color: ink, opacity: 0.75 }}>
        {clock(playing || passed > 0 ? seconds - passed : seconds)}
      </span>
    </span>
  );
}
