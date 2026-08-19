'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { invalidate } from '@/lib/useApiData';
import { BottomSheet } from '@/components/BottomSheet';
import { haptic } from '@/lib/haptics';

/**
 * Редактор истории: что именно уйдёт и кнопка «Отправить».
 *
 * Между «мне это подходит» и «пусть это сутки висит у меня под именем» есть шаг,
 * и он должен быть виден. Кнопка, публикующая по одному нажатию, превращает
 * решение в рефлекс: человек узнаёт, что запись ушла в его истории, уже после
 * того, как она ушла, — и первое, что он потом ищет, это как её убрать.
 *
 * Поэтому редактор, а не подтверждение «вы уверены?». Разница в том, что здесь
 * можно что-то сделать: посмотреть кадр целиком, добавить свою подпись и только
 * потом отправить. Подтверждение спрашивает, редактор даёт работать.
 */
export type StoryDraft = {
  /** Запись, которая уходит в историю. */
  postId: string;
  title: string | null;
  body: string | null;
  images: string[];
};

export function StoryComposer({
  draft,
  onClose,
}: {
  draft: StoryDraft | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Сбрасываем при смене кадра сравнением с прошлым, а не эффектом: иначе между
  // открытием и сбросом проходит отрисовка с чужой подписью.
  const [lastId, setLastId] = useState(draft?.postId ?? null);
  if ((draft?.postId ?? null) !== lastId) {
    setLastId(draft?.postId ?? null);
    setNote('');
    setError(null);
    setDone(false);
  }

  async function send() {
    if (!draft || sending) return;
    haptic();
    setSending(true);
    setError(null);
    try {
      await apiFetch('/stories', {
        method: 'POST',
        body: JSON.stringify({
          post_id: draft.postId,
          // Подпись необязательна: чаще всего запись говорит сама за себя, и
          // требовать к ней комментарий значило бы придумывать его на ходу.
          body: note.trim() || null,
        }),
      });
      invalidate('/stories');
      setDone(true);
      haptic('unlock');
      // Даём увидеть результат и закрываем сами: держать открытым экран, на
      // котором больше нечего делать, — заставлять искать выход.
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  }

  return (
    <BottomSheet
      open={draft !== null}
      onClose={onClose}
      title={done ? 'Готово' : 'В свою историю'}
      height="auto"
    >
      <div
        className="flex flex-col gap-3 py-1"
        style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
      >
        {/* Кадр целиком, как он появится в истории. Показать обязательно: репост
            вслепую — это и есть та публикация, которую потом ищут, чтобы убрать. */}
        {draft && (
          <div
            className="relative flex h-52 flex-col justify-end overflow-hidden rounded-2xl"
            style={{
              background: draft.images[0]
                ? undefined
                : `linear-gradient(160deg,
                    color-mix(in srgb, var(--accent) 82%, #000000),
                    color-mix(in srgb, var(--accent) 34%, #000000) 58%, #0b0a09)`,
            }}
          >
            {draft.images[0] && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- произвольный источник */}
                <img
                  src={draft.images[0]}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <span
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 40%, transparent 72%)',
                  }}
                />
              </>
            )}
            <span className="relative p-4">
              <span className="display-type block text-[19px] leading-tight text-white">
                {draft.title ?? draft.body}
              </span>
            </span>
          </div>
        )}

        {done ? (
          <p className="py-2 text-center text-[14px] text-[var(--text-muted)]">
            История опубликована и будет видна сутки.
          </p>
        ) : (
          <>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              placeholder="Добавить подпись — необязательно"
              className="field-line w-full py-2.5 text-[15px] text-[var(--text)] outline-none"
            />

            {error && (
              <p className="text-[12.5px]" style={{ color: 'var(--down)' }}>
                {error}
              </p>
            )}

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-full py-2.5 text-[14px] font-medium transition-transform active:scale-[0.98]"
                style={{ background: 'var(--surface-2)', color: 'var(--text)' }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={send}
                disabled={sending}
                className="flex-1 rounded-full py-2.5 text-[14px] font-semibold transition-transform active:scale-[0.98] disabled:opacity-60"
                style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                {sending ? 'Отправляем…' : 'Отправить'}
              </button>
            </div>
          </>
        )}
      </div>
    </BottomSheet>
  );
}
