import type { Fit } from '@/components/ImageFitter';

/**
 * Обрезать картинку по тому кадру, который человек выбрал руками.
 *
 * ImageFitter показывает картинку фоном: background-size в процентах и
 * background-position в процентах. Это удобно для показа — браузер сам считает
 * положение и не трогает раскладку, — но при отправке нужен настоящий файл, а
 * не пара чисел. Аватарке хватало чисел: она своя, показывается в одном месте и
 * может подгоняться при каждом показе. Снимок в записи или в переписке видят
 * все, и подгонять его у каждого зрителя нечем — обрезать надо один раз, здесь.
 *
 * Поэтому весь фокус в том, чтобы повторить арифметику CSS ровно, а не
 * приблизительно: иначе отправленное разойдётся с тем, что человек видел в
 * окне, — а это худший вид ошибки, потому что заметен он уже после отправки.
 */

/** Правила CSS, которые здесь воспроизводятся. */
function visibleRegion(
  natural: { width: number; height: number },
  box: { width: number; height: number },
  fit: Fit
) {
  // background-size: N% — это ширина картинки в процентах от ширины кадра.
  // Высота тянется за ней, пропорция сохраняется.
  const shownWidth = box.width * fit.zoom;
  const shownHeight = shownWidth * (natural.height / natural.width);

  // background-position: x% y% — точка x% картинки совмещается с точкой x%
  // кадра. Когда картинка больше кадра, разница отрицательная, и смещение
  // уводит её влево-вверх. Ровно это и означает «подвинуть пальцем».
  const offsetX = (box.width - shownWidth) * (fit.x / 100);
  const offsetY = (box.height - shownHeight) * (fit.y / 100);

  // Из экранных пикселей обратно в пиксели исходника.
  const scale = natural.width / shownWidth;

  return {
    x: -offsetX * scale,
    y: -offsetY * scale,
    width: box.width * scale,
    height: box.height * scale,
  };
}

/**
 * Сколько пикселей по длинной стороне оставляем.
 *
 * Снимок с телефона — это три-шесть мегабайт и четыре тысячи пикселей по
 * длинной стороне. В ленте картинка занимает от силы девятьсот, то есть три
 * четверти веса едут впустую: за них платит трафиком тот, кто листает, и местом
 * в хранилище — мы. Тысяча шестьсот с запасом покрывает и экран телефона с
 * тройной плотностью, и просмотр во весь экран.
 */
const MAX_SIDE = 1600;

/**
 * Качество JPEG.
 *
 * 0.85 — то место, где вес падает вдвое против единицы, а разницу на глаз
 * находят, только если знать, куда смотреть. Ниже начинают лезть квадраты на
 * плавных переходах — на небе и на коже заметнее всего.
 */
const QUALITY = 0.85;

/**
 * Обрезать и сжать.
 *
 * @param src    Адрес картинки — обычно blob: из выбранного файла.
 * @param fit    Положение и масштаб, как их выдал ImageFitter.
 * @param box    Размер кадра на экране: та же коробка, в которой крутили.
 * @param aspect Пропорции результата (ширина ÷ высота).
 */
export async function cropImage(
  src: string,
  fit: Fit,
  box: { width: number; height: number },
  aspect: number
): Promise<Blob> {
  const image = await loadImage(src);
  const region = visibleRegion(image, box, fit);

  // Целевой размер: по длинной стороне не больше MAX_SIDE, пропорции заданы
  // выбранной рамкой, а не исходником.
  let outWidth = Math.round(Math.min(region.width, MAX_SIDE * Math.max(1, aspect)));
  let outHeight = Math.round(outWidth / aspect);
  if (Math.max(outWidth, outHeight) > MAX_SIDE) {
    const shrink = MAX_SIDE / Math.max(outWidth, outHeight);
    outWidth = Math.round(outWidth * shrink);
    outHeight = Math.round(outHeight * shrink);
  }

  const canvas = document.createElement('canvas');
  canvas.width = outWidth;
  canvas.height = outHeight;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Не удалось подготовить картинку');

  // Сглаживание повыше: уменьшение вчетверо без него даёт ступеньки на
  // диагоналях, и снимок выглядит так, будто его пересняли с экрана.
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  // Белая подложка: прозрачные места PNG в JPEG становятся чёрными, и логотип
  // с прозрачным фоном превращался бы в чёрный прямоугольник.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, outWidth, outHeight);

  context.drawImage(
    image,
    region.x,
    region.y,
    region.width,
    region.height,
    0,
    0,
    outWidth,
    outHeight
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Не удалось сохранить картинку'))),
      'image/jpeg',
      QUALITY
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Для blob: с той же страницы не нужно, но снимок может прийти и по ссылке
    // — без этого canvas окажется «испорчен» и toBlob бросит.
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось прочитать картинку'));
    image.src = src;
  });
}
