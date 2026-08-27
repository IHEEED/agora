'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { haptic } from '@/lib/haptics';

/**
 * Конструктор истории: снимок во весь экран и подписи поверх него.
 *
 * До этого история собиралась в шторке: снимок в рамке 9:16 высотой в половину
 * экрана и поле подписи под ним. Подпись при этом жила отдельно от кадра —
 * рядом, а не на нём, — и человек не мог ни поставить её на нужное место, ни
 * сделать крупнее. То есть историю нельзя было сочинить, только приложить.
 *
 * Три решения, на которых всё держится.
 *
 * ПЕРВОЕ: редактор во весь экран, а не в шторке. Историю смотрят во весь экран,
 * и собирать её надо в том же кадре — иначе подпись, поставленная в углу
 * маленького превью, окажется на настоящем экране в другом месте.
 *
 * ВТОРОЕ: положение хранится долями, а не пикселями. Экраны разной ширины, и
 * подпись, поставленная на 180 точек от края, на узком телефоне уедет за кадр.
 * Доля от ширины кадра переносится куда угодно.
 *
 * ТРЕТЬЕ: на сервер уезжает готовая картинка, а не снимок с описанием подписей.
 * Иначе каждый смотрящий пересобирал бы историю у себя, и она выглядела бы у
 * всех по-разному — другой шрифт, другой перенос строки, другая ширина. Склейка
 * происходит один раз, здесь (см. flatten).
 */

/** Сколько знаков помещается в одну подпись. */
const MAX_LENGTH = 120;

/**
 * Цвета подписи.
 *
 * Шесть, а не палитра: выбор из палитры — это работа, а человек хотел
 * подписать снимок. Белый и чёрный решают девять случаев из десяти, остальные
 * четыре — на случай, когда снимок под ними обоими нечитаем.
 */
const COLORS = ['#ffffff', '#111111', '#ff4d4d', '#ffd23f', '#4dd07a', '#4d9fff'];

type TextLayer = {
  id: string;
  text: string;
  /** Доли от ширины и высоты кадра: 0.5 — середина. */
  x: number;
  y: number;
  /** Кегль долей от ширины кадра: 0.08 — восемь процентов ширины. */
  size: number;
  color: string;
  /** Подложка под текстом — для снимков, на которых не читается ничего. */
  boxed: boolean;
};

function newLayer(): TextLayer {
  return {
    id: Math.random().toString(36).slice(2),
    text: '',
    x: 0.5,
    y: 0.5,
    size: 0.075,
    color: '#ffffff',
    boxed: false,
  };
}

export function StoryEditor({
  open,
  src,
  onCancel,
  onApply,
  sending = false,
}: {
  open: boolean;
  /** Адрес выбранного снимка — обычно blob:. */
  src: string | null;
  onCancel: () => void;
  /** Готовая картинка со впечатанными подписями. */
  onApply: (blob: Blob) => void;
  sending?: boolean;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<TextLayer[]>([]);

  /**
   * Куда сдвинут снимок внутри кадра, в долях от свободного хода.
   *
   * Снимок обрезан по большей стороне, и та сторона, что не влезла, даёт
   * запас: у вертикального кадра это высота, у горизонтального — ширина. Сдвиг
   * ходит по этому запасу и дальше не идёт — за краем пустота, тянуть туда
   * нечего.
   *
   * В долях, а не в пикселях, потому что кадр на экране и кадр в готовой
   * картинке разного размера: на телефоне около трёхсот шестидесяти точек, в
   * файле тысяча восемьдесят. Доля переносится между ними без пересчёта.
   */
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panFrom = useRef<{ x: number; y: number; fromX: number; fromY: number } | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Слои сбрасываем на открытии, а не при закрытии: закрытие бывает по
  // системному жесту, и тогда чужие подписи всплыли бы в следующей истории.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setLayers([]);
      setActive(null);
      setEditing(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /**
   * Портал ставим только на клиенте: document.body на сервере не существует.
   *
   * Через useSyncExternalStore, а не эффектом с setState: эффект, который
   * сразу же меняет состояние, гоняет лишний проход отрисовки на каждом
   * монтировании — тот же приём, что в BottomSheet.
   */
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  /**
   * Ширина кадра в точках.
   *
   * Кегль подписи хранится долей от ширины, а показать его надо в точках —
   * значит ширину надо знать. Меряем наблюдателем, а не один раз: телефон
   * поворачивают, и подпись, посчитанная в вертикальном кадре, в
   * горизонтальном оказалась бы вдвое мельче нужного.
   *
   * Через cqw это не решается: единица считается от контейнера, а сделать
   * контейнером сам текст нельзя — получится ссылка на себя.
   */
  const [frameWidth, setFrameWidth] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!open || !frame) return;

    const observer = new ResizeObserver(([entry]) => {
      setFrameWidth(entry.contentRect.width);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, [open, src]);

  function update(id: string, patch: Partial<TextLayer>) {
    setLayers((prev) => prev.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)));
  }

  function addText() {
    haptic();
    const layer = newLayer();
    setLayers((prev) => [...prev, layer]);
    setActive(layer.id);
    setEditing(layer.id);
  }

  /**
   * Перетаскивание подписи.
   *
   * Пальцем один к одному: подпись обязана стоять там, где палец, иначе она
   * ощущается связью по переписке, а не предметом под рукой. Считаем в долях
   * прямо на ходу — переводить туда-сюда между системами координат негде
   * ошибиться, если делать это в одном месте.
   */
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);

  function onLayerPointerDown(event: React.PointerEvent, layer: TextLayer) {
    if (editing) return;
    const frame = frameRef.current;
    if (!frame) return;

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setActive(layer.id);

    const box = frame.getBoundingClientRect();
    // Запоминаем, за какое место схватили: без этого подпись прыгает центром
    // под палец, и иллюзия «взял и передвинул» ломается в первый же миг.
    drag.current = {
      id: layer.id,
      dx: (event.clientX - box.left) / box.width - layer.x,
      dy: (event.clientY - box.top) / box.height - layer.y,
    };
  }

  function onLayerPointerMove(event: React.PointerEvent) {
    const state = drag.current;
    const frame = frameRef.current;
    if (!state || !frame) return;

    const box = frame.getBoundingClientRect();
    update(state.id, {
      // За края не пускаем: подпись, уехавшая за кадр, на готовой картинке
      // просто исчезнет, и человек не поймёт, куда она делась.
      x: Math.min(0.96, Math.max(0.04, (event.clientX - box.left) / box.width - state.dx)),
      y: Math.min(0.96, Math.max(0.04, (event.clientY - box.top) / box.height - state.dy)),
    });
  }

  function onLayerPointerUp() {
    drag.current = null;
  }

  /**
   * Склейка: снимок и подписи в одну картинку.
   *
   * Рисуем в разрешении самого снимка, а не экрана: история, собранная на
   * телефоне и открытая на ноутбуке, иначе была бы мыльной. Все размеры
   * пересчитываются из долей, поэтому картинка выходит ровно такой, какой её
   * видел собиравший.
   */
  async function flatten(): Promise<Blob | null> {
    if (!src) return null;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Не удалось прочитать снимок'));
      image.src = src;
    });

    /**
     * Кадр 9:16, снимок в него вписан обрезкой.
     *
     * Так же он показан в редакторе (object-cover), и это обязано совпадать:
     * доли, по которым стоят подписи, отсчитываются от кадра. Рисуй мы снимок
     * целиком, кадр и картинка разошлись бы по пропорциям, и подпись,
     * поставленная у верхнего края, оказалась бы в готовой истории где угодно.
     *
     * Тысяча восемьдесят на тысячу девятьсот двадцать — размер, в котором
     * истории показывают везде. Больше не нужно: разница не видна, а вес растёт
     * вчетверо.
     */
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1920;

    const context = canvas.getContext('2d');
    if (!context) return null;

    // Обрезка «по большей стороне»: снимок закрывает кадр целиком, лишнее
    // уходит за края поровну с двух сторон.
    const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;

    /**
     * Сдвиг повторяем ровно так же, как его показывает object-position.
     *
     * У браузера позиция задана в процентах и означает «какая точка снимка
     * совмещается с той же точкой кадра»; в пикселях это доля от того, что не
     * влезло. Наш pan ходит от -1 до 1 вокруг центра, отсюда половина запаса.
     *
     * Любое расхождение здесь — расхождение между тем, что человек видел, и
     * тем, что отправил. Худший вид ошибки: заметен уже после отправки.
     */
    const slackX = canvas.width - drawWidth;
    const slackY = canvas.height - drawHeight;

    context.drawImage(
      image,
      slackX / 2 + (pan.x * slackX) / 2,
      slackY / 2 + (pan.y * slackY) / 2,
      drawWidth,
      drawHeight
    );
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (const layer of layers) {
      const text = layer.text.trim();
      if (!text) continue;

      const fontSize = layer.size * canvas.width;
      context.font = `600 ${fontSize}px system-ui, sans-serif`;

      const x = layer.x * canvas.width;
      const y = layer.y * canvas.height;

      if (layer.boxed) {
        const width = context.measureText(text).width;
        context.fillStyle = layer.color === '#111111' ? '#ffffff' : '#111111';
        const padding = fontSize * 0.28;
        context.globalAlpha = 0.55;
        context.fillRect(
          x - width / 2 - padding,
          y - fontSize * 0.7,
          width + padding * 2,
          fontSize * 1.4
        );
        context.globalAlpha = 1;
      } else {
        // Тень вместо подложки: на пёстром снимке белый текст без неё
        // рассыпается, а сплошная плашка закрывает то, ради чего снимок и
        // сделан.
        context.shadowColor = 'rgba(0, 0, 0, 0.45)';
        context.shadowBlur = fontSize * 0.25;
        context.shadowOffsetY = fontSize * 0.04;
      }

      context.fillStyle = layer.color;
      context.fillText(text, x, y);
      context.shadowColor = 'transparent';
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;
    }

    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9));
  }

  async function apply() {
    if (busy || sending) return;
    setBusy(true);
    haptic('unlock');
    try {
      const blob = await flatten();
      if (blob) onApply(blob);
    } finally {
      setBusy(false);
    }
  }

  if (!mounted || !open || !src) return null;

  const activeLayer = layers.find((layer) => layer.id === active) ?? null;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex flex-col" style={{ background: '#000' }}>
      {/* Кадр 9:16 по центру — ровно те пропорции, в которых историю увидят.
          Собирать её в других значило бы двигать подписи вслепую. */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <div
          ref={frameRef}
          className="relative h-full w-full"
          onPointerDown={(event) => {
            // Нажатие мимо подписи снимает выделение: пока подпись выбрана,
            // панель внизу относится к ней, и непонятно, к чему относится
            // «удалить», если выбрано ничего.
            if (!editing) setActive(null);

            // И начинает сдвиг снимка. Один и тот же жест: пока подпись не
            // выбрана, тянуть можно только фон, и разбираться, что именно
            // тянут, не приходится.
            if (editing) return;
            panFrom.current = {
              x: event.clientX,
              y: event.clientY,
              fromX: pan.x,
              fromY: pan.y,
            };
            (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
          }}
          onPointerMove={(event) => {
            const start = panFrom.current;
            const frame = frameRef.current;
            if (!start || !frame) return;

            const box = frame.getBoundingClientRect();
            // Палец прошёл долю кадра — снимок проходит ту же долю запаса.
            // Множитель два, потому что доля ходит от -1 до 1, то есть её
            // полный размах вдвое больше половины кадра.
            // Знак минус — не описка.
            //
            // object-position говорит, какая точка СНИМКА совмещается с той же
            // точкой кадра. Увеличить процент значит подтянуть к окну более
            // правую часть снимка, то есть сдвинуть картинку влево. Палец же
            // тянет саму картинку: ведёшь вправо — она должна идти вправо.
            // Направления противоположны по построению, и без этого минуса
            // снимок ехал ровно навстречу руке.
            const nextX = start.fromX - ((event.clientX - start.x) / box.width) * 2;
            const nextY = start.fromY - ((event.clientY - start.y) / box.height) * 2;

            setPan({
              x: Math.max(-1, Math.min(1, nextX)),
              y: Math.max(-1, Math.min(1, nextY)),
            });
          }}
          onPointerUp={() => {
            panFrom.current = null;
          }}
          onPointerCancel={() => {
            panFrom.current = null;
          }}
          // Жест целиком наш: без этого браузер забирает вертикаль себе и
          // снимок за пальцем вверх-вниз не идёт.
          style={{ maxWidth: 'calc(100dvh * 9 / 16)', touchAction: 'none' }}
        >
          {/* object-cover, а не contain: ровно так снимок ляжет в готовую
              историю (см. flatten). Показывать вписанным, а склеивать
              обрезанным — значит собирать подписи по одному кадру, а получать
              другой.

              Обычный <img>, а не next/image: адрес здесь blob: из файла,
              который человек только что выбрал, — оптимизатору его не отдать,
              да и незачем. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
            // object-position, а не transform: object-cover уже посчитал, как
            // снимок ложится в кадр, и позиция двигает его внутри этого
            // расчёта. transform поверх сдвинул бы снимок вместе с обрезкой и
            // открыл пустоту у края.
            style={{ objectPosition: `${50 + pan.x * 50}% ${50 + pan.y * 50}%` }}
          />

          {layers.map((layer) => (
            <div
              key={layer.id}
              onPointerDown={(event) => onLayerPointerDown(event, layer)}
              onPointerMove={onLayerPointerMove}
              onPointerUp={onLayerPointerUp}
              onPointerCancel={onLayerPointerUp}
              onDoubleClick={() => setEditing(layer.id)}
              className="absolute touch-none select-none px-2 text-center font-semibold leading-tight"
              style={{
                left: `${layer.x * 100}%`,
                top: `${layer.y * 100}%`,
                transform: 'translate(-50%, -50%)',
                fontSize: frameWidth ? layer.size * frameWidth : undefined,
                color: layer.color,
                maxWidth: '92%',
                background: layer.boxed
                  ? layer.color === '#111111'
                    ? 'rgba(255,255,255,0.55)'
                    : 'rgba(0,0,0,0.55)'
                  : 'transparent',
                borderRadius: layer.boxed ? 8 : 0,
                textShadow: layer.boxed ? 'none' : '0 1px 8px rgba(0,0,0,0.45)',
                outline: active === layer.id && !editing ? '1px dashed rgba(255,255,255,0.6)' : 'none',
                outlineOffset: 6,
                cursor: 'grab',
              }}
            >
              {layer.text || 'Текст'}
            </div>
          ))}
        </div>
      </div>

      {/* ── Правка выбранной подписи ─────────────────────────────────────── */}
      {editing && (
        <div className="absolute inset-0 flex items-center justify-center px-8" style={{ background: 'rgba(0,0,0,0.72)' }}>
          <textarea
            autoFocus
            value={layers.find((layer) => layer.id === editing)?.text ?? ''}
            onChange={(event) => update(editing, { text: event.target.value.slice(0, MAX_LENGTH) })}
            onBlur={() => setEditing(null)}
            rows={3}
            placeholder="Что рассказать…"
            className="w-full resize-none bg-transparent text-center text-[28px] font-semibold text-white outline-none placeholder:text-white/40"
          />
        </div>
      )}

      {/* ── Панель ───────────────────────────────────────────────────────── */}
      <div
        className="flex flex-col gap-3 px-4 pt-3"
        style={{ paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', background: '#000' }}
      >
        {/* Цвет и подложка относятся к выбранной подписи, поэтому и появляются
            только когда она выбрана: панель, половина которой всегда выключена,
            — худший вид интерфейса. */}
        {activeLayer && !editing && (
          <div className="flex items-center gap-2 overflow-x-auto">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => update(activeLayer.id, { color })}
                aria-label={`Цвет ${color}`}
                className="h-7 w-7 flex-none rounded-full"
                style={{
                  background: color,
                  outline: activeLayer.color === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.35)',
                  outlineOffset: 2,
                }}
              />
            ))}

            {/* Значок, а не слово.
                «Подложка» — термин вёрстки, и человеку он ничего не говорит:
                понять, что кнопка делает, можно было только нажав. Буква A в
                рамке показывает результат прямо на себе, и её же ставит
                Telegram в том же месте и с тем же смыслом. Нажатие меняет саму
                кнопку — то есть подсказка и есть состояние. */}
            <button
              type="button"
              onClick={() => update(activeLayer.id, { boxed: !activeLayer.boxed })}
              aria-label="Подложка под текстом"
              aria-pressed={activeLayer.boxed}
              className="ml-1 flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors"
              style={{
                background: activeLayer.boxed ? '#fff' : 'rgba(255,255,255,0.16)',
                color: activeLayer.boxed ? '#111' : '#fff',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                {/* Рамка — та самая подложка, буква внутри — текст на ней.
                    В выключенном виде рамка пунктирная: место под неё есть, а
                    самой её нет. */}
                <rect
                  x="3.5"
                  y="3.5"
                  width="17"
                  height="17"
                  rx="4.5"
                  strokeWidth="1.6"
                  strokeDasharray={activeLayer.boxed ? undefined : '3 2.5'}
                />
                <path d="M8.6 16.2 12 7.8l3.4 8.4M9.9 13.6h4.2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                setLayers((prev) => prev.filter((layer) => layer.id !== activeLayer.id));
                setActive(null);
              }}
              className="flex-none rounded-full px-3 py-1.5 text-[12.5px] font-medium"
              style={{ background: 'rgba(255,255,255,0.16)', color: '#ff6b6b' }}
            >
              Удалить
            </button>
          </div>
        )}

        {/* Размер — ползунком, а не сведением пальцев.
            Двумя пальцами по подписи промахиваешься чаще, чем попадаешь: она
            размером с два слова, и второй палец почти всегда оказывается на
            снимке, а не на ней. */}
        {activeLayer && !editing && (
          <input
            type="range"
            min={0.04}
            max={0.16}
            step={0.005}
            value={activeLayer.size}
            onChange={(event) => update(activeLayer.id, { size: Number(event.target.value) })}
            aria-label="Размер подписи"
            className="w-full accent-white"
          />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-4 py-2.5 text-[14px] font-medium"
            style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
          >
            Отмена
          </button>

          <button
            type="button"
            onClick={addText}
            className="flex flex-1 items-center justify-center gap-2 rounded-full py-2.5 text-[14px] font-medium"
            style={{ background: 'rgba(255,255,255,0.16)', color: '#fff' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 6.5V5h14v1.5M12 5v14M9 19h6" />
            </svg>
            Текст
          </button>

          <button
            type="button"
            onClick={apply}
            disabled={busy || sending}
            className="rounded-full px-5 py-2.5 text-[14px] font-semibold disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
          >
            {busy || sending ? 'Секунду…' : 'В историю'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
