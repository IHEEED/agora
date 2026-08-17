/**
 * Заглушки на время загрузки.
 *
 * Раньше на месте ещё не пришедших данных стояло слово «Загрузка…». Разница не
 * в красоте: строка занимает одну высоту, а список, который придёт ей на
 * замену, — совсем другую, и в момент подмены весь экран подпрыгивает. Если
 * при этом играет анимация появления, она проигрывается на прыгающей
 * раскладке — именно это и выглядело рвано.
 *
 * Заглушка занимает столько же места, сколько займут данные, поэтому подмена
 * ничего не двигает: меняется только содержимое, а геометрия остаётся.
 *
 * Мерцание — не украшение, а признак «это ещё не данные»: неподвижный серый
 * прямоугольник читается пустой карточкой, которая так и останется пустой.
 */
export function SkeletonLine({
  width = '100%',
  height = 12,
}: {
  width?: number | string;
  height?: number;
}) {
  return (
    <span
      aria-hidden
      className="skeleton block"
      style={{ width, height, borderRadius: height / 2 }}
    />
  );
}

export function SkeletonCircle({ size = 40 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="skeleton block flex-none"
      style={{ width: size, height: size, borderRadius: '9999px' }}
    />
  );
}

/** Заглушка одной записи в ленте — по геометрии настоящей карточки. */
export function SkeletonPost() {
  return (
    <article className="flex flex-col gap-2.5 py-4" aria-hidden>
      <div className="flex items-center gap-2.5">
        <SkeletonCircle size={38} />
        <SkeletonLine width={120} height={11} />
      </div>
      <SkeletonLine width="82%" height={15} />
      <div className="flex flex-col gap-1.5">
        <SkeletonLine height={11} />
        <SkeletonLine width="64%" height={11} />
      </div>
    </article>
  );
}

/** Заглушка строки списка: человек, клуб, переписка. */
export function SkeletonRow({ avatar = 44 }: { avatar?: number }) {
  return (
    <div className="flex items-center gap-3 py-3" aria-hidden>
      <SkeletonCircle size={avatar} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SkeletonLine width="42%" height={11} />
        <SkeletonLine width="70%" height={10} />
      </div>
    </div>
  );
}

/** Заглушка комментария. Отступ слева тот же, что у настоящего. */
export function SkeletonComment() {
  return (
    <div className="flex gap-2.5" aria-hidden>
      <SkeletonCircle size={30} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <SkeletonLine width="34%" height={10} />
        <SkeletonLine height={10} />
        <SkeletonLine width="56%" height={10} />
      </div>
    </div>
  );
}

/**
 * Несколько заглушек подряд. Разной ширины: одинаковые складываются в таблицу,
 * а список текста так не выглядит.
 */
export function SkeletonList({
  count = 4,
  children,
}: {
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }, (_, index) => (
        // Задержка волной: заглушки мерцают не разом, и список читается живым,
        // а не одним пульсирующим блоком.
        <div key={index} style={{ animationDelay: `${index * 90}ms` }} className="skeleton-wave">
          {children}
        </div>
      ))}
    </div>
  );
}
