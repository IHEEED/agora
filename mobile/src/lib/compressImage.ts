import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Ужать выбранный кадр перед отправкой в Storage.
 *
 * expo-image-picker отдаёт снимок в исходном разрешении: с камеры телефона это
 * четыре тысячи пикселей по длинной стороне и несколько мегабайт. На экране
 * картинка занимает от силы девятьсот — остальное едет впустую, трафиком того,
 * кто листает, и местом в хранилище. Уменьшаем длинную сторону до 1600 (с
 * запасом на экран тройной плотности и просмотр во весь экран) и жмём JPEG.
 *
 * Те же пороги, что у веба (см. frontend cropImage / compressImage), чтобы
 * картинки с обеих платформ весили одинаково.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.8;

export type Compressed = { uri: string; base64: string; mime: string };

/**
 * @param uri  Локальный адрес кадра от image-picker (asset.uri).
 * @param size Размеры кадра, если известны (asset.width/height) — по ним решаем,
 *             нужно ли вообще уменьшать. Без них только перекодируем в JPEG.
 */
export async function compressForUpload(
  uri: string,
  size?: { width?: number | null; height?: number | null }
): Promise<Compressed> {
  const context = ImageManipulator.manipulate(uri);

  const width = size?.width ?? 0;
  const height = size?.height ?? 0;
  const longest = Math.max(width, height);
  // Уменьшаем по длинной стороне, пропорцию манипулятор держит сам. Меньше
  // MAX_SIDE не трогаем размеры — только пережмём качеством ниже.
  if (longest > MAX_SIDE) {
    if (width >= height) context.resize({ width: MAX_SIDE });
    else context.resize({ height: MAX_SIDE });
  }

  const ref = await context.renderAsync();
  const result = await ref.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG, base64: true });
  if (!result.base64) throw new Error('Не получилось подготовить изображение');

  return { uri: result.uri, base64: result.base64, mime: 'image/jpeg' };
}
