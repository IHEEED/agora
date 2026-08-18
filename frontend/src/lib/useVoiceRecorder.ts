'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Запись голосового.
 *
 * MediaRecorder, а не своя обработка звука: браузер уже умеет сжимать поток в
 * opus, и это единственный формат, который на выходе весит килобайты, а не
 * мегабайты. Своё кодирование потребовало бы воркера и вдвое больше кода ради
 * файла худшего качества.
 *
 * Длительность считаем сами и присылаем вместе с файлом. По самому файлу её
 * можно узнать только загрузив его целиком и дождавшись метаданных — то есть
 * полоска голосового появлялась бы уже после того, как сообщение показано, и
 * прыгала бы на глазах.
 *
 * Разрешение спрашиваем в момент нажатия, а не заранее: запрос микрофона на
 * входе в переписку выглядит как «зачем вам мой микрофон», и человек отказывает
 * не разобравшись.
 */
export type Recording = { blob: Blob; seconds: number };

/** Короче секунды — это промах по кнопке, а не сообщение. */
const MIN_SECONDS = 1;

/** Дольше пяти минут голосовое никто не слушает, а весит оно уже заметно. */
const MAX_SECONDS = 300;

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const ticker = useRef<number | undefined>(undefined);
  const stream = useRef<MediaStream | null>(null);

  const stopTracks = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    window.clearInterval(ticker.current);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      chunks.current = [];

      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : undefined;
      const rec = new MediaRecorder(media, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      recorder.current = rec;
      rec.start();

      startedAt.current = Date.now();
      setSeconds(0);
      setRecording(true);
      ticker.current = window.setInterval(() => {
        const passed = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(passed);
        // Сами останавливаемся на пределе: держать палец дольше человек может, а
        // отправлять получасовой файл незачем.
        if (passed >= MAX_SECONDS) rec.stop();
      }, 200);
    } catch {
      // Единственная причина, которая человека касается: он отказал в доступе.
      // Остальные (нет микрофона, занят другим приложением) выглядят так же.
      setError('Нет доступа к микрофону');
      stopTracks();
    }
  }, [stopTracks]);

  /**
   * Остановить и забрать запись. null — если записывать было нечего: слишком
   * коротко или вообще не начиналось.
   */
  const stop = useCallback(async (): Promise<Recording | null> => {
    const rec = recorder.current;
    recorder.current = null;
    setRecording(false);

    if (!rec || rec.state === 'inactive') {
      stopTracks();
      return null;
    }

    const passed = Math.round((Date.now() - startedAt.current) / 1000);
    const done = new Promise<Blob>((resolve) => {
      rec.onstop = () => resolve(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }));
    });
    rec.stop();
    const blob = await done;
    stopTracks();
    setSeconds(0);

    if (passed < MIN_SECONDS || blob.size === 0) return null;
    return { blob, seconds: Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, passed)) };
  }, [stopTracks]);

  /** Отменить: файл не нужен, микрофон отпустить. */
  const cancel = useCallback(() => {
    const rec = recorder.current;
    recorder.current = null;
    setRecording(false);
    setSeconds(0);
    if (rec && rec.state !== 'inactive') {
      rec.onstop = null;
      rec.stop();
    }
    stopTracks();
  }, [stopTracks]);

  return { recording, seconds, error, start, stop, cancel };
}
