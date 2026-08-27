'use client';

import { useEffect, useRef, useState } from 'react';
import { StoryEditor } from '@/components/StoryEditor';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { invalidate } from '@/lib/useApiData';
import { useSession } from '@/lib/useSession';
import { haptic } from '@/lib/haptics';

/**
 * Новая история: от нажатия сразу к кадру.
 *
 * Здесь была шторка — выбор снимка, поле подписи, срок жизни, — и только после
 * неё открывался редактор. Два шага там, где нужен один: всё, что спрашивала
 * шторка, спрашивалось о кадре, которого человек в этот момент ещё не видел.
 * Подпись он писал вслепую, срок выбирал наугад, а сам снимок был квадратиком
 * в семьдесят точек.
 *
 * Теперь нажатие открывает выбор файла, а выбранный файл — сразу редактор во
 * весь экран. Ровно так это устроено в Instagram, и по той же причине: история
 * собирается в том кадре, в котором её увидят, а не в его превью.
 *
 * Компонент остался, хотя перестал быть шторкой. Ему по-прежнему принадлежит
 * то, чего редактор про себя не знает: куда положить файл, что отправить на
 * сервер и как сказать полосе, что появился новый кружок.
 */

const MEDIA_BUCKET = 'post-media';

export function NewStorySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { session } = useSession();
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /**
   * Открытие сразу зовёт выбор файла.
   *
   * Эффектом, а не в обработчике родителя: `open` приходит пропсом, и родитель
   * не обязан знать, что внутри есть скрытое поле, которое надо ткнуть.
   */
  useEffect(() => {
    if (!open) return;
    setError(null);
    fileRef.current?.click();
  }, [open]);

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Сбрасываем поле сразу: без этого повторный выбор того же файла не даёт
    // события change, и снимок «не выбирается» со второго раза.
    event.target.value = '';

    // Отказались от выбора — закрываемся молча. Промежуточного экрана между
    // нажатием и отказом быть не должно.
    if (!file) {
      onClose();
      return;
    }

    setPicked(URL.createObjectURL(file));
  }

  function done() {
    if (picked) URL.revokeObjectURL(picked);
    setPicked(null);
    onClose();
  }

  /**
   * Готовая картинка из редактора: снимок с уже впечатанными подписями.
   *
   * Подписи впечатаны, а не описаны отдельно, намеренно — иначе каждый
   * смотрящий пересобирал бы историю у себя, и она выглядела бы у всех
   * по-разному: другой шрифт, другой перенос, другая ширина.
   */
  async function publish(blob: Blob, hours: number) {
    const path = `${session?.user.id ?? 'anon'}/story-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, blob, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);

    try {
      await apiFetch('/stories', {
        method: 'POST',
        body: JSON.stringify({ image_url: data.publicUrl, hours }),
      });
      // Полоса обязана показать новый кружок сразу: история живёт часами, и
      // «опубликовал, но не вижу» — повод отправить её второй раз.
      invalidate('/stories');
      haptic();
      done();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать');
    }
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} className="hidden" />

      <StoryEditor
        open={picked !== null}
        src={picked}
        error={error}
        onCancel={done}
        onApply={(blob, hours) => void publish(blob, hours)}
      />
    </>
  );
}
