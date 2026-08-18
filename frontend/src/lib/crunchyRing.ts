/**
 * Рваный, «ребристый» контур вместо ровной окружности — фирменная деталь
 * оформления аватаров. Зубцы растут только наружу от базового радиуса,
 * поэтому внутренний край ложится вплотную к аватару, без просвета.
 *
 * Геометрия детерминированная: сервер и клиент рисуют одно и то же,
 * гидратация не расходится.
 */
export function crunchyRingPath(size: number, inset = 6.2, points = 46) {
  const centre = size / 2;
  const base = centre - inset;
  const coords: string[] = [];

  for (let i = 0; i < points; i += 1) {
    const angle = (i / points) * Math.PI * 2 - Math.PI / 2;
    const jag = i % 2 === 0 ? 0.09 : 0;
    const drift = (Math.sin(i * 2.7) * 0.5 + 0.5) * 0.03;
    const r = base * (1 + jag + drift);
    coords.push(
      `${(centre + Math.cos(angle) * r).toFixed(2)} ${(centre + Math.sin(angle) * r).toFixed(2)}`
    );
  }

  return `M${coords.join('L')}Z`;
}
