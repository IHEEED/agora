'use client';

/**
 * Ужать картинку перед отправкой — без кадрирования, целиком.
 *
 * Снимок с телефона — три-шесть мегабайт и четыре тысячи пикселей по длинной
 * стороне. В ленте картинка занимает от силы девятьсот: три четверти веса едут
 * впустую — за них платит трафиком тот, кто листает, и местом в хранилище мы.
 * Кто кадрирует руками, уже проходит через cropImage; этот путь — для тех, кто
 * выбрал снимок и сразу отправил.
 *
 * Те же пороги, что в cropImage, чтобы результат был единым: 1600 по длинной
 * стороне (с запасом на экран тройной плотности и просмотр во весь экран) и
 * JPEG 0.85 (вес вдвое меньше единицы, разницу на глаз почти не найти).
 */
const MAX_SIDE = 1600;
const QUALITY = 0.85;

export async function compressImage(file: Blob): Promise<Blob> {
  // Анимацию и не-картинки не трогаем: перекодировка GIF убила бы кадры, а
  // SVG/видео тут вообще ни при чём.
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  const src = URL.createObjectURL(file);
  try {
    const image = await loadImage(src);
    const longest = Math.max(image.naturalWidth, image.naturalHeight);
    const scale = Math.min(1, MAX_SIDE / longest);

    const outWidth = Math.round(image.naturalWidth * scale);
    const outHeight = Math.round(image.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = outWidth;
    canvas.height = outHeight;

    const context = canvas.getContext('2d');
    if (!context) return file;

    // Сглаживание повыше: уменьшение без него даёт ступеньки на диагоналях.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    // Белая подложка: прозрачные места PNG в JPEG иначе станут чёрными.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, outWidth, outHeight);
    context.drawImage(image, 0, 0, outWidth, outHeight);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', QUALITY)
    );

    // Если сжатие вдруг не помогло (мелкий уже-JPEG), оставляем исходник —
    // перекодировка не должна раздувать файл.
    return blob && blob.size < file.size ? blob : file;
  } catch {
    // Не смогли прочитать/перекодировать — пусть уедет как есть, чем никак.
    return file;
  } finally {
    URL.revokeObjectURL(src);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось прочитать картинку'));
    image.src = src;
  });
}
