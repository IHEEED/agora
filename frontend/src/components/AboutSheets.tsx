'use client';

import { BottomSheet } from '@/components/BottomSheet';

/**
 * Правила и поддержка.
 *
 * Обе строки стояли в настройках с подписью «Скоро» — то есть приложение
 * признавалось, что правил у него нет, а спросить не у кого. Для закрытой сети
 * по приглашениям это хуже, чем кажется: человек пришёл по чьему-то коду, и
 * первое, что он хочет понять, — куда он попал и что здесь принято.
 *
 * Шторкой, а не отдельным экраном. Правила читают один раз и по диагонали;
 * уводить за ними с экрана настроек значило бы обставлять переходом то, на что
 * тратят двадцать секунд.
 *
 * Текст короткий намеренно. Правила, которые не дочитывают, не работают — а не
 * дочитывают всё, что длиннее экрана. Здесь пять пунктов, и каждый говорит, что
 * будет, а не что «недопустимо».
 */

const RULES = [
  {
    title: 'Спорьте, а не побеждайте',
    body:
      'Минус здесь — не наказание, а участие: он говорит «прочитал и не согласен». Запись с двадцатью плюсами и восемнадцатью минусами интереснее записи с пятью плюсами. Несогласие — нормальная часть разговора, переход на человека — нет.',
  },
  {
    title: 'Отвечайте тому, кто написал',
    body:
      'Цепочку продолжает только автор и только один раз. Это не ограничение доступа, а форма: мысль в три захода читается, мысль в тридцать — нет.',
  },
  {
    title: 'Чужое остаётся чужим',
    body:
      'Пересланное сообщение подписано автором, репост в историю ведёт на источник. Выдавать чужое за своё нечем — и не стоит пытаться обойти.',
  },
  {
    title: 'Приглашение — это ответственность',
    body:
      'Вы приводите человека под свою руку. Кого вы пригласили, видно; за то, как он себя ведёт, спросят и с вас.',
  },
  {
    title: 'Заблокировать можно кого угодно',
    body:
      'Блокировка работает на сервере: заблокированный не напишет вам и не увидит ваших записей. Объяснять её никому не надо, и уведомления о ней не приходит.',
  },
];

export function RulesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Правила" height="auto">
      <div
        className="flex flex-col gap-4"
        style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
      >
        <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Пять пунктов, а не свод. Правила, которые не дочитывают, не работают.
        </p>

        {RULES.map((rule) => (
          <div key={rule.title} className="flex flex-col gap-1">
            <h3 className="text-[15px] font-semibold text-[var(--text)]">{rule.title}</h3>
            <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">{rule.body}</p>
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}

export function SupportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Поддержка" height="auto">
      <div
        className="flex flex-col gap-4"
        style={{ paddingBottom: 'calc(18px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold text-[var(--text)]">Что-то сломалось</h3>
          <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
            Напишите тому, кто вас пригласил, — он знает, к кому идти дальше.
            Полезно приложить снимок экрана и сказать, что вы делали за секунду
            до поломки: почти всегда именно это и объясняет её.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold text-[var(--text)]">Кто-то ведёт себя плохо</h3>
          <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
            Жалоба на запись или на человека уходит модератору и не показывается
            тому, на кого пожаловались. Если человек мешает лично вам — быстрее
            заблокировать: это работает мгновенно и никого не ждёт.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold text-[var(--text)]">Забыли пароль</h3>
          <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
            Восстановление идёт на почту, которой вы заводили аккаунт. Если
            доступа к ней нет, помочь нечем — привязка к почте единственная, и
            обойти её значит открыть чужой аккаунт любому, кто попросит.
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <h3 className="text-[15px] font-semibold text-[var(--text)]">Хотите позвать друга</h3>
          <p className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">
            Код лежит в настройках, в разделе «Аккаунт». Он не одноразовый:
            одним кодом можно привести сколько угодно людей, пока не кончится
            срок.
          </p>
        </div>
      </div>
    </BottomSheet>
  );
}
