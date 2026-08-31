'use client';

import Link from 'next/link';
import { ScreenTitle } from '@/components/ScreenTitle';
import { BackTitle } from '@/components/BackTitle';
import { useApiData } from '@/lib/useApiData';
import { useMe } from '@/lib/useMe';

/**
 * Статистика сети.
 *
 * Пока людей десятки, единственный способ понять, растёт сеть или просто
 * стоит, — смотреть на эти числа. Позже они станут графиками, но график по
 * трём точкам не рисуют, а рисовать его заранее значит показывать шум и
 * называть это ростом.
 *
 * Числа разделены на две группы. Люди — про то, сколько нас; написанное — про
 * то, живёт ли сеть. Одно без другого обманывает: тысяча зарегистрированных
 * при двадцати записях это не сеть, а список почт.
 */

type Stats = {
  users: number | null;
  phoneVerified: number | null;
  online: number | null;
  posts: number | null;
  comments: number | null;
  newToday: number | null;
};

/**
 * Одно число с подписью.
 *
 * null — это «посчитать не вышло», обычно из-за невыполненной миграции. Ноль
 * на его месте был бы неправдой, и разница здесь важна: ноль записей означает,
 * что сеть молчит, а прочерк — что мы не знаем.
 */
function Stat({ value, label, hint }: { value: number | null; label: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl px-4 py-3.5" style={{ background: 'var(--surface-2)' }}>
      <span className="font-num text-[26px] leading-none text-[var(--text)]">
        {value === null ? '—' : value.toLocaleString('ru-RU')}
      </span>
      <span className="text-[13px] text-[var(--text-muted)]">{label}</span>
      {hint && <span className="text-[11.5px] leading-snug text-[var(--text-muted)]">{hint}</span>}
    </div>
  );
}

export default function StatsPage() {
  const { me, loading: meLoading } = useMe();
  const { data, loading } = useApiData<Stats>(me?.isModerator ? '/moderation/stats' : null);

  if (meLoading) return null;

  if (!me?.isModerator) {
    // То же, что говорит сервер: раздела не существует.
    return (
      <div className="flex flex-1 flex-col items-center">
        <main className="below-header flex w-full max-w-2xl flex-col gap-4 px-4 pb-12">
          <ScreenTitle>Страница не найдена</ScreenTitle>
          <Link href="/" className="text-[14px] text-[var(--accent)]">
            На главную
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="below-header flex w-full max-w-2xl flex-col gap-5 px-4 pb-12">
        <BackTitle>Статистика</BackTitle>

        {loading && <p className="text-[14px] text-[var(--text-muted)]">Загрузка…</p>}

        {data && (
          <>
            <section className="flex flex-col gap-2">
              <h2 className="px-0.5 text-[14px] font-semibold text-[var(--text)]">Люди</h2>
              <div className="grid grid-cols-2 gap-2">
                <Stat value={data.online} label="В сети" hint="за последние пять минут" />
                <Stat value={data.users} label="Зарегистрировано" />
                <Stat value={data.phoneVerified} label="Подтвердили телефон" />
                <Stat value={data.newToday} label="Пришли за сутки" />
              </div>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="px-0.5 text-[14px] font-semibold text-[var(--text)]">Написано</h2>
              <div className="grid grid-cols-2 gap-2">
                <Stat value={data.posts} label="Записей" />
                <Stat value={data.comments} label="Комментариев" />
              </div>
            </section>

            {/* Одно число, ради которого сюда и заходят.
                Записей на человека — то, что отличает живую сеть от списка
                почт: тысяча зарегистрированных при двадцати записях означает,
                что пришли и ушли. */}
            {data.users && data.posts !== null && data.users > 0 && (
              <p className="px-1 text-[13px] leading-relaxed text-[var(--text-muted)]">
                Записей на человека:{' '}
                <span className="font-num text-[var(--text)]">
                  {(data.posts / data.users).toFixed(1).replace('.', ',')}
                </span>
                . Комментариев на запись:{' '}
                <span className="font-num text-[var(--text)]">
                  {data.posts > 0 && data.comments !== null
                    ? (data.comments / data.posts).toFixed(1).replace('.', ',')
                    : '—'}
                </span>
                .
              </p>
            )}

            <p className="px-1 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              Прочерк вместо числа означает, что посчитать не вышло — обычно
              из-за невыполненной миграции. Ноль на его месте был бы неправдой.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
