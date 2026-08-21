import { ImageResponse } from 'next/og';

/**
 * Значок для экрана «Домой» на iPhone.
 *
 * Отдельно от icon.svg, потому что Safari под apple-touch-icon не берёт
 * векторный значок — только растр, и только квадратом. Рисуем разметкой и
 * отдаём картинкой: держать в репозитории бинарный файл, который придётся
 * перерисовывать руками при каждой смене вывески, — лишний повод им разойтись.
 *
 * Без скругления: iOS обрезает значок своей маской сама, и собственные углы
 * оказались бы вписаны в системные — рамка в рамке.
 */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0910',
          color: '#a880ff',
          fontSize: 86,
          fontWeight: 600,
          letterSpacing: 4,
        }}
      >
        :P
      </div>
    ),
    size
  );
}
