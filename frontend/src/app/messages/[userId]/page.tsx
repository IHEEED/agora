'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  SubmitEvent,
} from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/useSession';
import { invalidate, useApiData } from '@/lib/useApiData';
import { Message, UserProfile, UserSummary } from '@/lib/types';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { MediaEditor } from '@/components/MediaEditor';
import { MessageActions } from '@/components/MessageActions';
import { BottomSheet } from '@/components/BottomSheet';
import { BanNotice } from '@/components/BanNotice';
import { PersonMenuSheet } from '@/components/PersonMenuSheet';
import { SkeletonList, SkeletonRow } from '@/components/Skeleton';
import { setNavHidden } from '@/lib/navVisibility';
import { markGoingBack } from '@/lib/navDirection';
import { createPortal } from 'react-dom';
import { peelScreen } from '@/lib/peelScreen';
import { releaseBackdrop } from '@/lib/screenBackdrop';
import { haptic } from '@/lib/haptics';
import { useVoiceRecorder } from '@/lib/useVoiceRecorder';
import { VoiceBubble } from '@/components/VoiceBubble';
import { supabase } from '@/lib/supabase';
import { useT, translate } from '@/lib/i18n';

/** Как часто перечитываем переписку, пока она открыта.
    Раньше был 4000 — при плохой сети задержка на запросе могла совпасть
    с exit-анимацией и дать lag. Теперь реже, но и при плохой сети одна
    зависшая очередь не заблокирует экран. */
const POLL_MS = 6000;

/** Тот же бакет, что у картинок записей: правила доступа одни и те же. */
const MEDIA_BUCKET = 'post-media';

/** Сколько уходит удаляемое сообщение. Совпадает с transition в разметке. */
const REMOVE_MS = 240;

/** Сколько держится подсветка письма, к которому привёл закреп. */
const SPOTLIGHT_MS = 1500;

/**
 * Реакции. Двадцать самых ходовых, порядком примерно по частоте: первые шесть
 * закрывают подавляющее большинство случаев и стоят на виду, остальные —
 * ниже, в той же панели с прокруткой.
 *
 * Шесть штук, как было, — набор из мессенджера, где реакции только появились.
 * Когда их мало, человек ставит не то, что чувствует, а ближайшее из
 * имеющегося, и реакция перестаёт что-либо значить.
 */
const QUICK_REACTIONS = [
  '❤️', '👍', '🔥', '😂', '😮', '😢',
  '🙏', '👏', '🎉', '😍', '🤔', '😭',
  '👎', '💯', '🤣', '🥰', '😅', '🤯',
  '🙌', '💔',
];

/** Разделитель по дням — чтобы не гадать, когда именно это было сказано. */
/**
 * «Сегодня» берём через функцию, а не константой.
 *
 * dayLabel вызывается вне компонента, где хука нет, а язык человек меняет на
 * ходу — вычисленная один раз строка осталась бы на языке, который был при
 * загрузке модуля.
 */
const TODAY_LABEL = () => translate('date.today');

function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  if (sameDay) return TODAY_LABEL();

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Переписка с одним человеком.
 *
 * Устроена как в мессенджерах: пузыри с хвостиком у последнего в цепочке,
 * подряд идущие реплики одного человека прижаты друг к другу, у своих —
 * галочки о доставке и прочтении, по нажатию на пузырь открывается меню
 * с реакциями, правкой и удалением.
 *
 * Новые письма забираем опросом раз в несколько секунд: живого канала в
 * приложении нет, а сокет ради одной страницы тянет за собой инфраструктуру,
 * которой больше нигде не пользуются.
 */
export default function ChatPage() {
  const { t } = useT();
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const { session } = useSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Какое сообщение открыто в меню, где оно лежит на экране и что сейчас правим.
  const [menuFor, setMenuFor] = useState<Message | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  // Кому отвечаем. Ссылка на сообщение, а не копия текста: оригинал могут
  // поправить, и цитата обязана поправиться вместе с ним.
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  // Режим выбора: пока он включён, нажатие по пузырю не открывает меню, а
  // отмечает сообщение. Так же ведут себя списки в почте и мессенджерах.
  const [selected, setSelected] = useState<string[] | null>(null);
  // Что пересылаем. Список получателей открывается шторкой.
  const [forwarding, setForwarding] = useState<Message[] | null>(null);
  // Меню собеседника: жалоба, блокировка, очистка переписки.
  const [personMenu, setPersonMenu] = useState(false);
  // Какие сообщения сейчас уходят: они ещё в разметке, но уже схлопываются.
  const [removing, setRemoving] = useState<string[]>([]);
  /** Сообщение, которое сейчас тянут влево, и на сколько оно уехало. */
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null);
  /** Сообщение, к которому только что перемотали по закрепу. Гаснет само. */
  const [spotlight, setSpotlight] = useState<string | null>(null);
  /** Какой из закреплённых показывать следующим: нажатия идут по кругу. */
  const pinCursor = useRef(0);
  const swipeFrom = useRef<{ x: number; y: number; id: string; own: boolean } | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((id) => window.clearTimeout(id));
  }, []);

  const person = useApiData<UserProfile>(`/users/${userId}`).data;
  // Кому можно переслать. Запрос уходит только когда шторку открыли.
  const people = useApiData<UserSummary[]>(forwarding ? '/users' : null);
  const me = session?.user.id;

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Переписка идёт через общий кеш, а не прямым запросом.
   *
   * Раньше экран заводил свой useEffect с apiFetch, и открытие чата всегда
   * начиналось с пустоты: сообщения, прочитанные минуту назад, запрашивались
   * заново, и до ответа сервера смотреть было не на что. Кеш отдаёт последний
   * известный список сразу, а свежий приходит фоном и молча подменяет его —
   * ровно так же, как это давно устроено в ленте.
   */
  const thread = useApiData<Message[]>(`/messages/${userId}`);

  // Локальная копия нужна, потому что список правится на месте: реакция,
  // удаление и отправка обязаны быть видны до ответа сервера. Кеш при этом
  // остаётся источником — из него приходят и первый снимок, и обновления.
  //
  // Подхватываем прямо в рендере, а не эффектом: это тот случай «состояние
  // зависит от пропса», для которого React рекомендует сравнение с прошлым
  // значением. Эффект дал бы лишний кадр со старым списком — ровно то
  // мелькание, ради устранения которого кеш сюда и заводился.
  const [lastThread, setLastThread] = useState(thread.data);
  if (thread.data && lastThread !== thread.data) {
    setLastThread(thread.data);
    setMessages(thread.data);
  }

  const [lastThreadError, setLastThreadError] = useState(thread.error);
  if (thread.error && lastThreadError !== thread.error) {
    setLastThreadError(thread.error);
    setError(thread.error);
  }

  /**
   * Какая реплика только что отправлена и с какой высоты ей вылетать.
   *
   * Помечаем одну, а не все: анимация принадлежит действию человека, а не факту
   * появления сообщения в списке. Список обновляется опросом каждые несколько
   * секунд, и без этой пометки вся переписка заново вылетала бы из строки ввода
   * при каждом обновлении.
   */
  const [justSent, setJustSent] = useState<string | null>(null);
  const [sendDistance, setSendDistance] = useState(56);

  /**
   * Вложения: снимок и голосовое.
   *
   * Оба уходят в то же хранилище, что и картинки записей, только в свою папку.
   * Отдельного бакета им не надо: правила доступа те же, а лишний бакет — лишнее
   * место, где эти правила могут разойтись.
   *
   * Снимок загружается сразу при выборе, а не при отправке: пока человек
   * дописывает подпись, файл уже едет, и «отправить» срабатывает мгновенно.
   */
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<{ preview: string; url: string | null } | null>(null);
  /** Снимок, который сейчас кадрируют. Пусто — окно подгонки закрыто. */
  const [cropping, setCropping] = useState<string | null>(null);
  const voice = useVoiceRecorder();

  async function upload(file: Blob, extension: string): Promise<string | null> {
    /**
     * Первая папка — id владельца, и только потом chat.
     *
     * Политика бакета (миграция 003) сверяет первый сегмент пути с id того, кто
     * пришёл: файлы лежат как `<user_id>/<что угодно>`. Здесь стояло
     * `chat/<user_id>/…`, то есть первым сегментом было слово chat, и Supabase
     * отвечал «нарушение политики» на каждое вложение. Ошибка выглядела как
     * «политики не настроены», хотя настроены они были правильно — путь не
     * подходил под них.
     */
    const path = `${me ?? 'anon'}/chat/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadError) {
      setError(
        /row-level security|unauthorized/i.test(uploadError.message)
          ? `Supabase не разрешает запись в «${MEDIA_BUCKET}» — нужны политики (миграция 003).`
          : uploadError.message
      );
      return null;
    }
    return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
  }

  /**
   * Выбранный файл сначала показываем в кадре, и только потом отправляем.
   *
   * Раньше снимок уходил на сервер прямо из проводника — то есть ровно таким,
   * каким его сняла камера: с лишним небом сверху, повёрнутым, на четыре
   * мегабайта. Поправить было нечем, оставалось удалить и переснять.
   */
  function pickPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Сбрасываем поле сразу: без этого повторный выбор того же файла не даёт
    // события change, и снимок «не выбирается» со второго раза.
    event.target.value = '';
    if (!file) return;

    setError(null);
    setCropping(URL.createObjectURL(file));
  }

  /** Кадр выбран — грузим уже обрезанное и сжатое. */
  async function uploadCropped(blob: Blob) {
    const source = cropping;
    setCropping(null);

    const preview = URL.createObjectURL(blob);
    setPhoto({ preview, url: null });
    // Исходник больше не нужен: дальше живёт только обрезанное.
    if (source) URL.revokeObjectURL(source);

    const url = await upload(new File([blob], 'photo.jpg', { type: blob.type }), 'jpg');
    if (!url) {
      URL.revokeObjectURL(preview);
      setPhoto(null);
      return;
    }
    setPhoto({ preview, url });
  }

  function dropPhoto() {
    if (photo) URL.revokeObjectURL(photo.preview);
    setPhoto(null);
  }

  function startVoice() {
    haptic('open');
    void voice.start();
  }

  /** Остановить запись и отправить её как реплику. */
  async function sendVoice() {
    const recorded = await voice.stop();
    // Промах по кнопке: записи короче секунды не отправляем, но и не ругаемся —
    // человек и так понял, что не получилось.
    if (!recorded) return;

    haptic();
    setSending(true);
    try {
      const url = await upload(recorded.blob, 'webm');
      if (!url) return;
      const created = await apiFetch<Message>('/messages', {
        method: 'POST',
        body: JSON.stringify({
          recipient_id: userId,
          audio_url: url,
          audio_seconds: recorded.seconds,
          reply_to_id: replyTo?.id ?? null,
        }),
      });
      setMessages((prev) => [...prev, created]);
      setReplyTo(null);
      setJustSent(created.id);
      setSendDistance(distanceToComposer());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  }

  /**
   * Идёт ли сейчас прокрутка. От этого зависит видимость дат.
   *
   * Дата отвечает на вопрос «где я», а он возникает только при листании. Пока
   * человек читает, она висит поперёк переписки и мешает — Telegram по этой же
   * причине показывает её только в движении.
   *
   * Гасим по таймеру, а не по scrollend: тот не поддерживается Safari, а на
   * инерционной прокрутке он же приходит с задержкой в полсекунды после
   * фактической остановки.
   */
  const [scrolling, setScrolling] = useState(false);
  const scrollStop = useRef<number | undefined>(undefined);

  useEffect(() => {
    function onScroll() {
      setScrolling(true);
      window.clearTimeout(scrollStop.current);
      scrollStop.current = window.setTimeout(() => setScrolling(false), 900);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(scrollStop.current);
    };
  }, []);

  /** Сколько пикселей от низа списка до строки ввода. */
  function distanceToComposer() {
    const anchor = bottomRef.current;
    if (!anchor) return 56;
    const gap = window.innerHeight - anchor.getBoundingClientRect().bottom;
    // Ограничиваем: на пустой переписке до строки ввода полэкрана, и реплика
    // летела бы через весь чат, как выстрел.
    return Math.max(40, Math.min(160, gap));
  }

  const load = useCallback(() => {
    // Сбросом кеша, а не своим запросом: иначе в сеть уходили бы два запроса
    // за одним и тем же — от опроса и от useApiData.
    invalidate(`/messages/${userId}`);
  }, [userId]);

  useEffect(() => {
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  // Входящие считаются прочитанными фактом открытия переписки — так же, как
  // в любом мессенджере.
  useEffect(() => {
    apiFetch(`/messages/${userId}/read`, { method: 'POST' }).catch(() => undefined);
  }, [userId, messages.length]);

  // Бар уезжает вниз: на этом экране его место занимает строка ввода.
  // Атрибут на корне нужен ещё и стилям: под переписку поднимается снимок
  // предыдущего экрана, и она обязана его закрывать (см. globals.css).
  useEffect(() => {
    const root = document.documentElement;
    setNavHidden(true);
    root.dataset.inChat = '1';
    return () => {
      setNavHidden(false);
      delete root.dataset.inChat;
    };
  }, []);

  // Замороженный список переписок под чатом. Без него тянуть экран пальцем
  // некуда: за ним пустой фон, и жест выглядит не «сдвинул верхний лист», а
  // «отломал кусок экрана». Снимок снят в момент нажатия на переписку
  // (см. screenBackdrop), отпускаем его, когда уходим с маршрута.
  //
  // Проверка маршрута обязательна: React в разработке прогоняет эффекты
  // дважды, и первый же cleanup снял бы снимок, пока чат никуда не уходит.
  useEffect(
    () => () => {
      if (!window.location.pathname.startsWith('/messages/')) releaseBackdrop();
    },
    []
  );

  /**
   * Выход свайпом от левого края — тем же жестом, что и в системной навигации.
   * Экран едет за пальцем, и если утащить его дальше трети ширины, переписка
   * закрывается; иначе возвращается на место.
   *
   * Жест ловим только у самой кромки: начнись он посреди экрана — и любое
   * горизонтальное движение по списку сообщений закрывало бы чат.
   */
  /**
   * Удержание пузыря открывает меню действий. Полсекунды — привычный порог:
   * короче, и меню выскакивает при обычном касании во время прокрутки.
   * Любое движение пальцем отменяет удержание по той же причине.
   */
  const HOLD_MS = 480;
  const holdTimer = useRef<number | undefined>(undefined);

  function openMenu(message: Message, rect: DOMRect) {
    setMenuAnchor(rect);
    setMenuFor(message);
  }

  function holdStart(event: React.PointerEvent<HTMLButtonElement>, message: Message) {
    const rect = event.currentTarget.getBoundingClientRect();
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => openMenu(message, rect), HOLD_MS);
  }

  function holdCancel() {
    window.clearTimeout(holdTimer.current);
  }

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const EDGE_ZONE = 28;
  const dragFrom = useRef<number | null>(null);
  const [dragX, setDragX] = useState(0);
  // Отдельный флаг вместо чтения ref в разметке: ref для отрисовки не годится,
  // React о его изменении не знает.
  const [dragging, setDragging] = useState(false);
  /** Узел экрана: с него снимается копия, которая и уезжает вправо. */
  const screenRef = useRef<HTMLDivElement>(null);

  // Портал строки ввода возможен только в браузере: на сервере document нет.
  // Через useSyncExternalStore, как в BottomSheet: серверный снимок false,
  // клиентский true — и разметка сходится без лишнего кадра.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  /**
   * Уход из переписки — снятием слоя.
   *
   * Маршрут меняется сразу, в тот же кадр: список переписок под уходящим
   * экраном настоящий и уже на месте. Вправо уезжает снимок (см. peelScreen).
   *
   * Прежде экран сначала отыгрывал уход, и только через --exit-ms менялся
   * маршрут. Пока движение шло, за ним не было ничего — обои с узором просто
   * обрывались, — а список появлялся уже после. Это и называлось «обои очень
   * резко уезжают».
   */
  const leaveGuard = useRef(false);

  const leave = useCallback((fromX = 0) => {
    // Guard от повторного нажатия: без него router.back() уходил на две записи
    // истории назад — отсюда весь набор «выход кидает не туда».
    if (leaveGuard.current) return;
    leaveGuard.current = true;
    markGoingBack();
    peelScreen(screenRef.current, fromX);
    // Замороженный список больше не нужен: сверху уже лежит снимок переписки, и
    // держать под ним копию списка рядом с настоящим значит показывать два
    // одинаковых экрана разом.
    releaseBackdrop(true);
    router.back();
  }, [router]);

  /** Для onClick: обработчик получил бы событие вместо сдвига. */
  const onLeave = useCallback(() => leave(0), [leave]);

  function onPointerDown(event: React.PointerEvent) {
    if (event.clientX > EDGE_ZONE || leaveGuard.current) return;
    dragFrom.current = event.clientX;
    // Перехватываем указатель: иначе курсор, ушедший за пределы экрана,
    // перестаёт слать события и переписка застревает на полпути.
    event.currentTarget.setPointerCapture?.(event.pointerId);
    document.documentElement.dataset.chatDragging = '1';
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (dragFrom.current === null) return;
    setDragX(Math.max(0, event.clientX - dragFrom.current));
  }

  function onPointerUp() {
    if (dragFrom.current === null) return;
    const far = dragX > window.innerWidth / 3;
    dragFrom.current = null;
    setDragging(false);
    if (far) {
      haptic('unlock');
      // Слой продолжает движение с того сдвига, на котором отпустили.
      leave(dragX);
    }
    setDragX(0);
  }

  /**
   * Довести до конца переписки.
   *
   * Отдельной функцией, потому что зовут её из двух разных мест с разными
   * намерениями: при открытии — мгновенно (никто не должен видеть, как экран
   * проматывается сквозь всю историю), при отправке — плавно, чтобы было видно,
   * что тебя увезли вниз, а не подменили кадр.
   */
  function scrollToEnd(smooth = false) {
    bottomRef.current?.scrollIntoView({ block: 'end', behavior: smooth ? 'smooth' : 'auto' });
  }

  /** Стоим ли у конца переписки. Запас — на высоту пары строк. */
  function atEnd() {
    return window.innerHeight + window.scrollY >= document.body.scrollHeight - 140;
  }

  // Переписку открываем на последнем письме — прокручивать снизу вверх
  // никто не станет.
  useLayoutEffect(() => {
    scrollToEnd();
    // Только на смене собеседника. Раньше здесь стояла длина списка, и любое
    // пришедшее письмо утаскивало вниз человека, читающего старое, — прямо
    // из-под пальца. Своя отправка увозит вниз сама (см. send), а чужая теперь
    // увозит, только если ты и так стоял у конца (см. эффект ниже).
  }, [userId]);

  /**
   * Пришло чужое — догоняем, но только если и так стояли внизу.
   *
   * Проверку делаем ДО того, как браузер отрисует новое письмо: к моменту
   * эффекта высота страницы уже выросла, и «стоим внизу» стало бы ложью для
   * всех. useLayoutEffect с замером в теле работает по той же причине, по
   * которой не годится useEffect: между ними успевает пройти кадр.
   */
  const wasAtEnd = useRef(true);
  useLayoutEffect(() => {
    if (wasAtEnd.current) scrollToEnd();
  }, [messages.length]);

  useEffect(() => {
    function mark() {
      wasAtEnd.current = atEnd();
    }
    mark();
    window.addEventListener('scroll', mark, { passive: true });
    return () => window.removeEventListener('scroll', mark);
  }, []);

  /**
   * Перемотать к закреплённому и подсветить его.
   *
   * По кругу: закреплённых бывает несколько, а полоска показывает один. В
   * Telegram повторное нажатие ведёт к следующему, и это единственный способ
   * добраться до остальных, не открывая отдельный список.
   *
   * Подсветка обязательна. Без неё экран просто оказывается где-то в середине
   * истории, и какое из письма то самое — непонятно: прокрутка привела, но не
   * показала пальцем.
   */
  function goToPinned() {
    if (pinned.length === 0) return;
    const target = pinned[pinCursor.current % pinned.length];
    pinCursor.current += 1;
    document
      .getElementById(`msg-${target.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setSpotlight(target.id);
    window.setTimeout(() => {
      setSpotlight((current) => (current === target.id ? null : current));
    }, SPOTLIGHT_MS);
  }

  async function send(e: SubmitEvent) {
    e.preventDefault();
    const text = body.trim();
    // Снимок без подписи — обычная реплика, а не пустая.
    if ((!text && !photo?.url) || sending) return;

    // Своя отправка всегда увозит к концу, где реплика и появится, — даже если
    // человек читал старое. Отправить письмо и остаться смотреть на позапрошлый
    // разговор нельзя: отправленное надо увидеть.
    wasAtEnd.current = true;

    setSending(true);
    setError(null);
    try {
      if (editing) {
        const updated = await apiFetch<Message>(`/messages/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ body: text }),
        });
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
        setEditing(null);
        setBody('');
      } else {
        /**
         * Реплика появляется сразу, не дожидаясь сервера.
         *
         * До сих пор пузырь ждал ответа: отправил — и смотришь на пустую
         * строку, пока запрос ходит туда-обратно. При хорошей связи это триста
         * миллисекунд, при плохой — секунды, и всё это время непонятно,
         * отправилось ли вообще.
         *
         * Мессенджер — то место, где ждать нельзя в принципе: человек печатает
         * быстрее, чем летают пакеты, и следующую фразу он набирает уже сейчас.
         * Поэтому показываем реплику мгновенно с временным номером, а когда
         * сервер ответит — подменяем её настоящей.
         *
         * Не прошло — убираем и возвращаем текст в строку: потерять набранное
         * хуже, чем увидеть ошибку.
         */
        const draftId = `draft-${Date.now()}`;
        const draft: Message = {
          id: draftId,
          sender_id: me ?? '',
          recipient_id: userId,
          body: text,
          created_at: new Date().toISOString(),
          read_at: null,
          image_url: photo?.url ?? null,
          replyTo: replyTo
            ? { id: replyTo.id, body: replyTo.body, mine: replyTo.sender_id === me }
            : null,
        };

        setMessages((prev) => [...prev, draft]);
        setJustSent(draftId);
        setSendDistance(distanceToComposer());
        // Плавно, а не рывком: отправка — единственный момент, когда экран
        // едет сам, и человек должен увидеть, что его увезли вниз, а не
        // обнаружить себя в другом месте переписки. Кадром позже, чтобы
        // реплика успела занять высоту, иначе «конец» окажется выше её.
        requestAnimationFrame(() => scrollToEnd(true));
        setReplyTo(null);
        setBody('');
        dropPhoto();

        try {
          const created = await apiFetch<Message>('/messages', {
            method: 'POST',
            body: JSON.stringify({
              recipient_id: userId,
              body: text,
              image_url: draft.image_url,
              reply_to_id: draft.replyTo?.id ?? null,
            }),
          });
          // Подменяем черновик настоящим: у него свой номер, от которого
          // зависят реакции, правка и удаление.
          setMessages((prev) =>
            prev.map((m) => (m.id === draftId ? { ...created, replyTo: draft.replyTo } : m))
          );
          setJustSent(created.id);
        } catch (err) {
          setMessages((prev) => prev.filter((m) => m.id !== draftId));
          setBody(text);
          throw err;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setSending(false);
    }
  }

  async function react(message: Message, emoji: string) {
    setMenuFor(null);
    // Показываем сразу, не дожидаясь сети: действие безобидное, а ждать
    // полсекунды ради смайлика незачем.
    const mine = message.reactions?.find((r) => r.userId === me);
    const next = (message.reactions ?? []).filter((r) => r.userId !== me);
    if (mine?.emoji !== emoji && me) next.push({ emoji, userId: me });
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, reactions: next } : m)));

    try {
      await apiFetch(`/messages/${message.id}/reaction`, {
        method: 'PUT',
        body: JSON.stringify({ emoji }),
      });
    } catch {
      load();
    }
  }

  /**
   * Удаление с уходом, а не подменой кадра.
   *
   * Пузырь сжимается и гаснет на месте, одновременно схлопываясь по высоте,
   * чтобы соседи подтянулись плавно, а не прыгнули. Из массива сообщение
   * убираем только после анимации: пока оно там, есть чему схлопываться.
   *
   * Запрос уходит сразу, не дожидаясь анимации, — она про то, как это
   * выглядит, а не про то, когда случается.
   */
  function removeWithFade(id: string) {
    /**
     * Высоту нужно замерить до ухода, иначе схлопывания не будет вовсе.
     *
     * max-height у пузыря не задан — то есть none, — а из none в ноль браузер
     * не интерполирует: это не длина, а «нет ограничения». Высота обрывалась
     * в тот же кадр, пока прозрачность и сжатие честно шли свои 240 мс, и
     * удаление выглядело рваным: соседи прыгали вверх сразу, а пузырь ещё
     * гаснул в воздухе.
     *
     * Поэтому подставляем собственную высоту числом и заставляем браузер её
     * посчитать (чтение offsetHeight), и только после этого разрешаем React
     * поставить ноль. Теперь у перехода есть от чего считать.
     */
    const node = document.querySelector<HTMLElement>(`[data-message='${id}']`);
    if (node) {
      node.style.maxHeight = `${node.offsetHeight}px`;
      void node.offsetHeight;
    }
    setRemoving((prev) => [...prev, id]);
    timers.current.push(
      window.setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
        setRemoving((prev) => prev.filter((x) => x !== id));
      }, REMOVE_MS)
    );
  }

  async function remove(message: Message) {
    setMenuFor(null);
    removeWithFade(message.id);
    try {
      await apiFetch(`/messages/${message.id}`, { method: 'DELETE' });
    } catch {
      load();
    }
  }

  function startEditing(message: Message) {
    setMenuFor(null);
    setEditing(message);
    setBody(message.body ?? '');
    // Фокус через кадр: шторка ещё закрывается и забирает его себе.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /**
   * Потянуть реплику влево — ответить на неё.
   *
   * Так это работает в Telegram и в WhatsApp, и это единственный жест, который
   * человек пробует на сообщении сам, без подсказки. Влево, а не вправо: вправо
   * тянется весь экран на выход из переписки, и два жеста в одну сторону
   * означали бы, что каждый раз надо угадать, кто из них сработает.
   *
   * Порог мягкий, а ход — вязкий: пузырь отдаёт всё меньше на каждый пиксель
   * пальца и упирается на SWIPE_MAX. Упор нужен, чтобы жест ощущался как
   * натяжение пружины с концом, а не как перетаскивание предмета по столу:
   * у первого понятно, когда отпускать, у второго — нет.
   */
  const SWIPE_TRIGGER = 52;
  const SWIPE_MAX = 78;

  function swipeStart(event: React.PointerEvent, message: Message) {
    // Мышью не тянем: там для ответа есть меню по правой кнопке, а случайное
    // протаскивание при выделении текста сработало бы ответом.
    if (event.pointerType === 'mouse' || selected) return;
    swipeFrom.current = { x: event.clientX, y: event.clientY, id: message.id, own: false };
  }

  function swipeMove(event: React.PointerEvent) {
    const from = swipeFrom.current;
    if (!from) return;

    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;

    if (!from.own) {
      // Пока не решили, чей жест, — не мешаем ни прокрутке, ни выходу. Решаем
      // по первым же десяти пикселям и только если движение явно горизонтальное
      // и явно влево: у вертикали приоритет, иначе пузыри будут дёргаться при
      // каждом пролистывании переписки.
      if (Math.abs(dy) > Math.abs(dx) || dx > -10) {
        if (Math.abs(dy) > 10) swipeFrom.current = null;
        return;
      }
      from.own = true;
      // Забираем указатель себе: дальше жест наш, и выход из переписки его уже
      // не перехватит.
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    }

    // Вязкость: корень от пройденного, а не сам путь.
    const pulled = Math.min(SWIPE_MAX, Math.sqrt(-dx) * 9);
    setSwipe({ id: from.id, dx: -pulled });

    // Дошли до порога — короткий отклик, как у переключателя. Один раз, на
    // пересечении: держать палец за порогом и получать дрожь непрерывно —
    // ощущение сломанного, а не сработавшего.
    if (pulled >= SWIPE_TRIGGER && (swipe?.dx ?? 0) > -SWIPE_TRIGGER) haptic();
  }

  function swipeEnd() {
    const from = swipeFrom.current;
    swipeFrom.current = null;
    const pulled = -(swipe?.dx ?? 0);
    setSwipe(null);
    if (!from?.own || pulled < SWIPE_TRIGGER) return;

    const message = messages.find((m) => m.id === from.id);
    if (message) startReply(message);
  }

  function startReply(message: Message) {
    setMenuFor(null);
    setReplyTo(message);
    setEditing(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  /** Закрепить или снять закрепление. Общее на переписку, не личное. */
  async function togglePin(message: Message) {
    setMenuFor(null);
    const pinned = !message.pinned_at;
    const stamp = pinned ? new Date().toISOString() : null;
    setMessages((prev) =>
      prev.map((m) => (m.id === message.id ? { ...m, pinned_at: stamp } : m))
    );

    try {
      await apiFetch(`/messages/${message.id}/pin`, {
        method: 'PUT',
        body: JSON.stringify({ pinned }),
      });
    } catch {
      load();
    }
  }

  /** Включить режим выбора, сразу отметив то сообщение, с которого начали. */
  function startSelecting(message: Message) {
    setMenuFor(null);
    setSelected([message.id]);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      if (!prev) return prev;
      return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
    });
  }

  /** Разослать выбранное другому человеку. Копией, а не ссылкой: переписки
      независимы, и удаление оригинала не должно стирать пересланное. */
  async function forwardTo(recipientId: string) {
    const list = forwarding ?? [];
    setForwarding(null);
    setSelected(null);
    try {
      // По очереди, а не разом: сервер принимает по одному сообщению, а
      // порядок пересланного должен совпасть с порядком в переписке.
      for (const message of list) {
        await apiFetch('/messages', {
          method: 'POST',
          body: JSON.stringify({ recipient_id: recipientId, body: message.body }),
        });
      }
      // Переслал самому себе — пусть увидит их сразу.
      if (recipientId === userId) load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось переслать');
    }
  }

  /** Очистить переписку: сервер удалит только наши письма, чужие останутся. */
  async function clearChat() {
    try {
      await apiFetch(`/messages/thread/${userId}`, { method: 'DELETE' });
      setMessages((prev) => prev.filter((m) => m.sender_id !== me));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось очистить переписку');
    }
  }

  async function removeSelected() {
    const ids = selected ?? [];
    setSelected(null);
    ids.forEach(removeWithFade);
    try {
      await Promise.all(
        ids.map((id) => apiFetch(`/messages/${id}`, { method: 'DELETE' }))
      );
    } catch {
      load();
    }
  }

  // Закреплённые — в порядке закрепления: последнее закреплённое показывается
  // в полоске под шапкой, остальные считаются счётчиком рядом.
  const pinned = messages
    .filter((message) => message.pinned_at)
    .sort((a, b) => String(a.pinned_at).localeCompare(String(b.pinned_at)));

  // Дату ставим перед первым письмом дня, а подряд идущие реплики одного
  // человека склеиваем: хвостик рисуется только у последней в цепочке.
  const rows = messages.map((message, index) => {
    const previous = messages[index - 1];
    const next = messages[index + 1];
    const day = dayLabel(message.created_at);
    return {
      message,
      day,
      showDay: index === 0 || day !== dayLabel(previous.created_at),
      groupStart: !previous || previous.sender_id !== message.sender_id,
      groupEnd: !next || next.sender_id !== message.sender_id || day !== dayLabel(next.created_at),
    };
  });

  return (
    <div
      ref={screenRef}
      className="flex flex-1 flex-col items-center"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        // Только протаскивание пальцем. Сам уход отыгрывает снятый слой, а не
        // этот узел: к моменту, когда что-то поедет, его здесь уже нет.
        //
        // В покое transform именно none, а не translateX(0): любой transform
        // создаёт слой, из которого дочернему пузырю не подняться над
        // размытием меню — сообщение оставалось замыленным вместе с фоном.
        transform: dragX ? `translateX(${dragX}px)` : 'none',
        // Пока тянут пальцем — без перехода, иначе экран отстаёт от руки.
        transition: dragging ? 'none' : 'transform var(--enter-ms) var(--enter-ease)',
        // Вертикаль остаётся браузеру, горизонталь забираем себе: иначе жест от
        // кромки уходит в системный «назад» и переписка за пальцем не идёт.
        touchAction: 'pan-y',
      }}
    >
      <main className="below-header relative flex w-full max-w-2xl flex-1 flex-col px-2.5 pb-28">
        {/* Забаненному объясняем это здесь, а не отказом на отправке. */}
        <BanNotice />
        {/* Шапка переписки в двух видах. Пока ничего не выбрано — собеседник и
            выход; как только включён режим выбора, она превращается в панель
            действий над отмеченным. Так же ведут себя списки в почте: панель
            занимает место заголовка, а не появляется третьей полосой. */}
        {selected ? (
          <div className="chat-header mb-2 flex items-center gap-1.5 px-1">
            <button
              onClick={() => setSelected(null)}
              aria-label="Отменить выбор"
              className="chat-island flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--text)] transition-transform active:scale-90"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            <span className="chat-island mr-auto min-w-0 rounded-full px-4 py-2 text-[15px] font-semibold text-[var(--text)]">
              <span className="font-num">{selected.length}</span>
            </span>

            <button
              onClick={() =>
                setForwarding(messages.filter((m) => selected.includes(m.id)))
              }
              disabled={selected.length === 0}
              aria-label="Переслать"
              className="chat-island flex h-10 w-10 flex-none items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-30"
              style={{ color: 'var(--accent)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 5.5 20 12l-7 6.5V15c-4 0-7 1.2-9 4 .6-4.8 3.6-8.4 9-9Z" />
              </svg>
            </button>
            <button
              onClick={removeSelected}
              disabled={
                selected.length === 0 ||
                // Удалять можно только свои: сервер всё равно откажет, и
                // предлагать заведомо провальное действие нечестно.
                messages.some((m) => selected.includes(m.id) && m.sender_id !== me)
              }
              aria-label="Удалить"
              className="chat-island flex h-10 w-10 flex-none items-center justify-center rounded-full transition-transform active:scale-90 disabled:opacity-30"
              style={{ color: 'var(--down)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2h9.4L17.5 7" />
              </svg>
            </button>
          </div>
        ) : (
          /* Островки, а не строка во всю ширину.
             На обоях полоса заголовка выглядела наклеенной поверх узора: у неё
             нет своих границ, и она либо сливается с фоном, либо закрывает его
             прямоугольником. Отдельные скруглённые блоки решают то же самое
             честнее — каждый несёт ровно своё содержимое и стоит на обоях, а не
             вместо них. Так устроена шапка чата в Telegram, и по той же причине. */
          <div className="chat-header mb-2 flex items-center gap-1.5 px-1">
            <button
              onClick={onLeave}
              aria-label="Назад"
              className="chat-island flex h-10 w-10 flex-none items-center justify-center rounded-full text-[var(--text)] transition-transform active:scale-90"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 5l-7 7 7 7" />
              </svg>
            </button>
            <Link
              href={`/u/${userId}`}
              // mr-auto, а не flex-1: островок обязан быть по размеру имени.
              // Растянутый во всю ширину, он превращается обратно в полосу —
              // ту самую, от которой островки и уводят.
              className="chat-island mr-auto flex min-w-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-3.5"
            >
              <DefaultAvatar name={person?.username ?? '?'} size={34} src={person?.avatar_url} />
              <span className="min-w-0 truncate text-[15.5px] font-semibold text-[var(--text)]">
                {person?.username ?? '…'}
              </span>
            </Link>

            <button
              onClick={() => setPersonMenu(true)}
              aria-label="Действия"
              className="chat-island flex h-10 w-10 flex-none items-center justify-center rounded-full transition-colors"
              style={{ color: 'var(--control)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="5" cy="12" r="1.8" />
                <circle cx="12" cy="12" r="1.8" />
                <circle cx="19" cy="12" r="1.8" />
              </svg>
            </button>
          </div>
        )}

        {/* Закреплённое — полоской под шапкой, как в мессенджерах: оно должно
            быть на виду, не занимая места в самой переписке. */}
        {pinned.length > 0 && !selected && (
          <button
            type="button"
            onClick={goToPinned}
            className="chat-island chat-pinned mb-2 flex items-center gap-2.5 rounded-2xl px-3 py-2 text-left transition-transform active:scale-[0.99]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
              <path d="M9 4h6l-1 6 4 3v2H6v-2l4-3Z" />
              <path d="M12 15v5" />
            </svg>
            <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)]">
              {pinned[pinned.length - 1].body}
            </span>
            {pinned.length > 1 && (
              <span className="font-num flex-none text-[12px] text-[var(--text-muted)]">
                {pinned.length}
              </span>
            )}
          </button>
        )}

        {/* Ни карточки, ни стекла: в переписке фон — это фон, а не лист бумаги
            во весь экран. Белый прямоугольник под пузырями только отбирал у них
            контраст. */}
        <section className="flex flex-1 flex-col gap-0.5 px-1 py-2">
          {messages.length === 0 && (
            <p className="py-12 text-center text-[14.5px] leading-relaxed text-[var(--text-muted)]">
              Здесь пока пусто.
              <br />
              Напишите первое сообщение.
            </p>
          )}

          {rows.map(({ message, day, showDay, groupStart, groupEnd }) => {
            const mine = message.sender_id === me;
            const reactions = message.reactions ?? [];
            const going = removing.includes(message.id);

            return (
              // Уходящее сообщение схлопывается по высоте через grid-rows —
              // единственный способ анимировать высоту содержимого, размер
              // которого заранее неизвестен. Сам пузырь при этом сжимается и
              // гаснет (ниже), поэтому схлопывания зазора глазу не видно.
              <div
                key={message.id}
                className="grid"
                style={{
                  gridTemplateRows: going ? '0fr' : '1fr',
                  transition: `grid-template-rows ${REMOVE_MS}ms var(--exit-ease)`,
                }}
              >
                <div className="flex min-h-0 flex-col overflow-hidden">
                {showDay && (
                  /* Дата растворяется в покое и проявляется при прокрутке.
                     Она нужна ровно в тот момент, когда листаешь и теряешь,
                     где находишься; при чтении она отвлекает — это подпись к
                     месту, а не к сообщению. Так это устроено в Telegram.

                     Класс переключает прозрачность, состояние даёт прокрутка
                     (см. scrolling ниже). */
                  <span
                    className={`chat-day my-3 self-center rounded-full px-3 py-1 text-[11.5px] font-medium${
                      scrolling ? ' chat-day-shown' : ''
                    }`}
                    style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
                  >
                    {day}
                  </span>
                )}

                <button
                  type="button"
                  id={`msg-${message.id}`}
                  onPointerDown={(event) => {
                    // В режиме выбора удержание не нужно: нажатие и так что-то
                    // делает, а меню поверх выбора — два способа управления
                    // одним и тем же.
                    if (!selected) holdStart(event, message);
                    swipeStart(event, message);
                  }}
                  onPointerUp={() => {
                    holdCancel();
                    swipeEnd();
                  }}
                  onPointerCancel={() => {
                    holdCancel();
                    swipeEnd();
                  }}
                  onPointerLeave={holdCancel}
                  onPointerMove={(event) => {
                    holdCancel();
                    swipeMove(event);
                  }}
                  onClick={() => selected && toggleSelected(message.id)}
                  onContextMenu={(event) => {
                    // Правая кнопка — то же самое удержание, только на настольном
                    // экране, где держать нечем.
                    event.preventDefault();
                    if (!selected) openMenu(message, event.currentTarget.getBoundingClientRect());
                  }}
                  // По этой метке удаление находит пузырь, чтобы замерить его
                  // высоту перед уходом (см. removeWithFade).
                  data-message={message.id}
                  className={`chat-bubble max-w-[80%] px-4 py-2 text-left ${
                    mine ? 'chat-bubble-mine' : 'chat-bubble-theirs'
                  }`}
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    // Пузырю с цитатой нужна ширина: внутри него ещё одна
                    // карточка со своими полями и кромкой, и на узком месте от
                    // цитаты остаётся вертикальная полоска из двух букв.
                    minWidth: message.replyTo || message.audio_url ? 200 : undefined,
                    // Открытое сообщение остаётся поверх размытия — меню
                    // относится к нему, и оно должно читаться.
                    zIndex: menuFor?.id === message.id ? 72 : undefined,
                    position: menuFor?.id === message.id ? 'relative' : undefined,
                    // Обе стороны — общим градиентом на всю переписку
                    // (см. chat-bubble-mine и chat-bubble-theirs).
                    color: mine ? 'var(--accent-contrast)' : 'var(--text)',
                    marginTop: groupStart ? 6 : 0,
                    // Откуда вылетает реплика. Только у последней своей и
                    // только один раз: анимировать разом всю переписку при
                    // каждом обновлении списка значило бы устраивать салют на
                    // ровном месте. Расстояние — от пузыря до строки ввода,
                    // поэтому чем выше он оказался, тем длиннее путь.
                    ...(justSent === message.id
                      ? ({ '--send-from': `${sendDistance}px` } as React.CSSProperties)
                      : { animation: 'none' }),
                    // Уход: сжимается к своему краю и гаснет. transformOrigin
                    // по стороне пузыря — иначе своё сообщение уползало бы к
                    // середине экрана, откуда оно не приходило.
                    transformOrigin: mine ? 'right center' : 'left center',
                    transform: going
                      ? 'scale(0.85)'
                      : swipe?.id === message.id
                        ? `translateX(${swipe.dx}px)`
                        : undefined,
                    opacity: going ? 0 : 1,
                    // Уходящее сообщение не тянет за собой соседей: высота
                    // схлопывается вместе с ним, а не пропадает разом. Без
                    // этого при удалении вся переписка подпрыгивала на высоту
                    // пузыря — глаз в этот момент смотрит на удаляемое, и
                    // прыжок происходит ровно там, куда он смотрит.
                    maxHeight: going ? 0 : undefined,
                    marginBottom: going ? 0 : undefined,
                    paddingTop: going ? 0 : undefined,
                    paddingBottom: going ? 0 : undefined,
                    overflow: going ? 'hidden' : undefined,
                    // Пока палец на пузыре — никакого перехода: он обязан
                    // стоять там, где палец, иначе жест ощущается как связь по
                    // переписке, а не как предмет в руке. Отпустили — тот же
                    // переход возвращает его на место сам.
                    transition: going
                      ? `transform ${REMOVE_MS}ms var(--exit-ease),` +
                        ` opacity ${Math.round(REMOVE_MS * 0.7)}ms linear,` +
                        ` max-height ${REMOVE_MS}ms var(--exit-ease),` +
                        ` padding ${REMOVE_MS}ms var(--exit-ease),` +
                        ` margin ${REMOVE_MS}ms var(--exit-ease)`
                      : swipe?.id === message.id
                        ? 'none'
                        : 'transform 260ms var(--enter-ease)',
                    // Горизонталь достаётся жесту, вертикаль остаётся прокрутке
                    // переписки: без этого браузер забирает себе оба движения и
                    // тянуть пузырь не даёт вовсе.
                    touchAction: 'pan-y',
                    pointerEvents: going ? 'none' : undefined,
                    // Отмеченное обводится акцентом снаружи, а не заливается:
                    // заливка спорила бы с собственным цветом пузыря.
                    boxShadow: selected?.includes(message.id)
                      ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)'
                      : spotlight === message.id
                        ? '0 0 0 2px var(--bg), 0 0 0 4px var(--accent)'
                        : undefined,
                    // Прижатая сторона внутри цепочки — единственное место, где
                    // овал размыкается: у идущих подряд реплик одного человека
                    // соседние углы притуплены, и столбик читается как одна
                    // мысль, а не частокол отдельных.
                    borderTopRightRadius: mine && !groupStart ? 8 : undefined,
                    borderBottomRightRadius: mine && !groupEnd ? 8 : undefined,
                    borderTopLeftRadius: !mine && !groupStart ? 8 : undefined,
                    borderBottomLeftRadius: !mine && !groupEnd ? 8 : undefined,
                  }}
                >
                  {/* Цитата над ответом — отдельная карточка внутри пузыря.
                      Прежде она была вжата в самый угол: полоска в два
                      пикселя, кегль вдвое мельче реплики, отступы почти в ноль
                      — и читалась не цитатой, а служебной сноской, набранной
                      мелким шрифтом от нехватки места.

                      Цитата — половина смысла ответа: без неё непонятно, на
                      что отвечают. Поэтому она получила свою скруглённую
                      подложку, полноценные поля и кегль всего на полтора
                      пункта мельче основного текста. Полоска слева осталась,
                      но толще — теперь это кромка карточки, а не черта на
                      полях. */}
                  {message.replyTo && (
                    <span
                      className="-mx-2 mb-1.5 flex flex-col gap-0.5 overflow-hidden rounded-xl py-2 pl-3 pr-3"
                      style={{
                        borderLeft: '3px solid currentColor',
                        background: mine
                          ? 'color-mix(in srgb, var(--accent-contrast) 18%, transparent)'
                          : 'color-mix(in srgb, var(--text) 9%, transparent)',
                      }}
                    >
                      <span className="text-[12.5px] font-semibold" style={{ opacity: 0.9 }}>
                        {message.replyTo.mine ? 'Вы' : (person?.username ?? '…')}
                      </span>
                      <span className="line-clamp-3 text-[13.5px] leading-snug" style={{ opacity: 0.8 }}>
                        {message.replyTo.body}
                      </span>
                    </span>
                  )}

                  {/* Снимок внутри пузыря, во всю его ширину. Отдельной
                      карточкой рядом он был бы вторым сообщением — а это одна
                      реплика, у которой есть картинка и, может быть, подпись. */}
                  {message.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- произвольный источник
                    <img
                      src={message.image_url}
                      alt=""
                      loading="lazy"
                      className="-mx-2 mb-1 max-h-[320px] w-[calc(100%+16px)] rounded-2xl object-cover"
                    />
                  )}

                  {message.audio_url && (
                    <VoiceBubble
                      src={message.audio_url}
                      seconds={message.audio_seconds ?? 0}
                      mine={mine}
                    />
                  )}

                  {message.body && (
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">
                      {message.body}
                    </p>
                  )}

                  {/* Время и галочки внутри пузыря, в одну строку с последним
                      словом. Снаружи они читались подписью к переписке, а не к
                      реплике: столбик отметок вдоль края, не принадлежащий
                      ничему. Внутри — часть сообщения, чем они и являются.

                      Прижаты вправо и приподняты на строку текста: так делает
                      Telegram, и это единственный способ не отдавать им
                      отдельную строку в каждом пузыре. */}
                  <span
                    className="float-right ml-2 mt-1 flex translate-y-[3px] items-center gap-1 text-[10.5px]"
                    style={{ opacity: 0.75 }}
                  >
                    {message.pinned_at && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-label="Закреплено">
                        <path d="M9 4h6l-1 6 4 3v2H6v-2l4-3Z" />
                        <path d="M12 15v5" />
                      </svg>
                    )}
                    {message.edited_at && <span>изменено</span>}
                    <span className="font-num">{timeLabel(message.created_at)}</span>
                    {mine && (
                      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M1 6.2 4 9.2 9.6 2.2" />
                        {message.read_at && <path d="M6.4 9.2 12 2.2" />}
                      </svg>
                    )}
                  </span>

                </button>

                {reactions.length > 0 && (
                  <span
                    // key по составу реакций: без него React считает метку той
                    // же самой при смене эмодзи, анимация не перезапускается, и
                    // замена реакции проходит беззвучно — как будто не нажал.
                    key={reactions.map((r) => r.emoji).join('')}
                    className="reaction-badge -mt-2 flex w-fit items-center gap-1 rounded-full px-2 py-0.5"
                    style={{
                      alignSelf: mine ? 'flex-end' : 'flex-start',
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      ['--reaction-origin' as string]: mine ? 'right' : 'left',
                    }}
                  >
                    {reactions.map((reaction) => (
                      <span key={reaction.userId} className="emoji text-[13px]">
                        {reaction.emoji}
                      </span>
                    ))}
                  </span>
                )}



                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </section>

        {error && (
          <p className="px-2 pt-2 text-[13px]" style={{ color: 'var(--down)' }}>
            {error}
          </p>
        )}
      </main>

      {/* Строка ввода прижата к кромке — там же, где обычно стоит бар.
          Уходит порталом в body, а не живёт внутри экрана. Причина в анимации
          входа: вложенный экран въезжает справа, то есть корень страницы на
          время анимации несёт transform, — а transform превращает любой
          fixed внутри себя в absolute относительно себя. Строка при этом
          вставала по нижней кромке анимируемого блока (на высоту таб-бара
          выше настоящей) и в конце прыгала вниз. Портал выносит её из-под
          transform целиком.

          Сдвиг пальцем строка при этом отыгрывает сама: жест тащит экран, и
          она обязана ехать вместе с ним, а не стоять на месте. */}
      {mounted &&
        createPortal(
      <form
        onSubmit={send}
        // Метка для снимка экрана: строка живёт порталом в body, но уехать
        // обязана вместе с перепиской, а не остаться поверх списка (см. peelScreen).
        data-screen-fixed
        className="fixed inset-x-0 bottom-0 z-40 flex flex-col items-center px-3 md:pl-20"
        style={{
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          transform: dragX ? `translateX(${dragX}px)` : 'none',
          transition: dragging ? 'none' : 'transform var(--enter-ms) var(--enter-ease)',
        }}
      >
        {/* Полоска над строкой ввода — одна на правку и на ответ: и то и другое
            отвечает на вопрос «что сейчас происходит с этим полем», и две
            полосы подряд означали бы, что можно править и отвечать разом. */}
        <div
          className="grid w-full max-w-2xl"
          style={{
            gridTemplateRows: editing || replyTo ? '1fr' : '0fr',
            opacity: editing || replyTo ? 1 : 0,
            transition:
              'grid-template-rows 0.26s var(--enter-ease), opacity 0.2s ease',
          }}
        >
          <div className="overflow-hidden">
            <div
              className="mb-1.5 flex items-center gap-2 rounded-2xl px-3 py-2"
              style={{ background: 'var(--surface-2)' }}
            >
              {editing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
                  <path d="M11 5.5 4 12l7 6.5V15c4 0 7 1.2 9 4-.6-4.8-3.6-8.4-9-9Z" />
                </svg>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[11.5px] font-semibold" style={{ color: 'var(--accent)' }}>
                  {editing ? 'Правка' : `Ответ ${person?.username ?? ''}`.trim()}
                </span>
                <span className="min-w-0 truncate text-[13px] text-[var(--text-muted)]">
                  {(editing ?? replyTo)?.body}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setReplyTo(null);
                  if (editing) setBody('');
                }}
                aria-label={editing ? 'Отменить правку' : 'Отменить ответ'}
                className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[var(--text-muted)] transition-transform active:scale-90"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Выбранный снимок — над строкой, до отправки. Показать его надо
            обязательно: файл выбирают в системном окне, и без подтверждения
            непонятно, тот ли это снимок и вообще выбрался ли он. */}
        {photo && (
          <div
            className="mb-1.5 flex w-full max-w-2xl items-center gap-2.5 rounded-2xl p-2"
            style={{ background: 'var(--surface-2)' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- локальное превью */}
            <img
              src={photo.preview}
              alt=""
              className="h-14 w-14 flex-none rounded-xl object-cover"
              style={{ opacity: photo.url ? 1 : 0.5 }}
            />
            <span className="min-w-0 flex-1 text-[13px] text-[var(--text-muted)]">
              {photo.url ? 'Снимок готов к отправке' : 'Загружаем…'}
            </span>
            <button
              type="button"
              onClick={dropPhoto}
              aria-label="Убрать снимок"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--text-muted)]"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        )}

        <div className="glass flex w-full max-w-2xl items-center gap-1 rounded-full py-1 pl-1.5 pr-1.5">
          {/* Запись занимает всю строку, а не встаёт рядом с полем: печатать
              голосом всё равно нечем, а до «отмены» на телефоне надо дотянуться
              большим пальцем — в углу она была бы недосягаема. */}
          {voice.recording ? (
            <>
              <span className="flex h-9 w-9 flex-none items-center justify-center">
                <span className="voice-dot" />
              </span>
              <span className="font-num flex-1 text-[15px] text-[var(--text)]">
                {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
              </span>
              <button
                type="button"
                onClick={() => voice.cancel()}
                className="flex-none rounded-full px-3 py-2 text-[14px] font-medium text-[var(--text-muted)]"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={sendVoice}
                aria-label="Отправить голосовое"
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
                style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h13M12 6l6 6-6 6" />
                </svg>
              </button>
            </>
          ) : (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={pickPhoto}
                className="hidden"
                id="chat-photo"
              />
              <label
                htmlFor="chat-photo"
                aria-label="Снимок"
                className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-[var(--control)] transition-transform active:scale-90"
              >
                <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4.5" width="18" height="15" rx="3" />
                  <circle cx="8.5" cy="10" r="1.6" />
                  <path d="m4 17 5-4.5 4.5 4 3-2.5L20 18" />
                </svg>
              </label>

              <input
                ref={inputRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Сообщение"
                enterKeyHint="send"
                className="min-w-0 flex-1 border-none bg-transparent py-2.5 text-[15px] text-[var(--text)] outline-none"
              />

              {/* Микрофон стоит на месте отправки и меняется с ней: пока писать
                  нечего — предлагаем голос, появился текст — отправку. Две
                  кнопки рядом заставляли бы выбирать там, где выбор очевиден. */}
              {!body.trim() && !photo && !editing ? (
                <button
                  type="button"
                  onClick={startVoice}
                  aria-label="Записать голосовое"
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[var(--control)] transition-transform active:scale-90"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
                  </svg>
                </button>
              ) : (
          <button
            type="submit"
            disabled={(!body.trim() && !photo?.url) || sending}
            aria-label={editing ? 'Сохранить' : 'Отправить'}
            className="flex h-9 w-9 flex-none items-center justify-center rounded-full"
            style={{
              background: 'var(--accent)',
              color: 'var(--accent-contrast)',
              transition:
                'transform 0.24s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
            }}
          >

            {editing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12.5 4.5 4.5L19 7.5" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h13M12 6l6 6-6 6" />
              </svg>
            )}
          </button>
              )}
            </>
          )}
        </div>

        {voice.error && (
          <p className="pt-1 text-[12.5px]" style={{ color: 'var(--down)' }}>
            {voice.error}
          </p>
        )}
      </form>,

          document.body
        )}

      {/* Подгонка снимка перед отправкой. Отменили — исходник отпускаем:
          blob-адреса живут до перезагрузки страницы и сами не убираются. */}
      <MediaEditor
        open={cropping !== null}
        src={cropping}
        onCancel={() => {
          if (cropping) URL.revokeObjectURL(cropping);
          setCropping(null);
        }}
        onApply={(blob) => void uploadCropped(blob)}
      />

      <MessageActions
        open={menuFor !== null}
        anchor={menuAnchor}
        reactions={QUICK_REACTIONS}
        activeReaction={menuFor?.reactions?.find((r) => r.userId === me)?.emoji}
        onReact={(emoji) => menuFor && react(menuFor, emoji)}
        onClose={() => setMenuFor(null)}
        actions={[
          {
            key: 'reply',
            label: t('msg.reply'),
            icon: <path d="M11 5.5 4 12l7 6.5V15c4 0 7 1.2 9 4-.6-4.8-3.6-8.4-9-9Z" />,
            onSelect: () => menuFor && startReply(menuFor),
          },
          {
            key: 'forward',
            label: t('msg.forward'),
            icon: <path d="M13 5.5 20 12l-7 6.5V15c-4 0-7 1.2-9 4 .6-4.8 3.6-8.4 9-9Z" />,
            onSelect: () => {
              if (menuFor) setForwarding([menuFor]);
              setMenuFor(null);
            },
          },
          {
            key: 'pin',
            label: menuFor?.pinned_at ? 'Открепить' : 'Закрепить',
            icon: (
              <>
                <path d="M9 4h6l-1 6 4 3v2H6v-2l4-3Z" />
                <path d="M12 15v5" />
              </>
            ),
            onSelect: () => menuFor && togglePin(menuFor),
          },
          {
            key: 'select',
            label: t('msg.select'),
            icon: (
              <>
                <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
                <path d="m8 12 3 3 5-6" />
              </>
            ),
            onSelect: () => menuFor && startSelecting(menuFor),
          },
          {
            key: 'copy',
            label: t('msg.copy'),
            icon: (
              <>
                <rect x="9" y="9" width="11" height="11" rx="2.5" />
                <path d="M15 5.5A2.5 2.5 0 0 0 12.5 3h-7A2.5 2.5 0 0 0 3 5.5v7A2.5 2.5 0 0 0 5.5 15" />
              </>
            ),
            onSelect: () => {
              if (menuFor?.body) navigator.clipboard?.writeText(menuFor.body).catch(() => undefined);
              setMenuFor(null);
            },
          },
          ...(menuFor?.sender_id === me
            ? [
                {
                  key: 'edit',
                  label: t('msg.edit'),
                  icon: (
                    <>
                      <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z" />
                      <path d="m14.5 7.5 2 2" />
                    </>
                  ),
                  onSelect: () => menuFor && startEditing(menuFor),
                },
                {
                  key: 'delete',
                  label: t('msg.delete'),
                  danger: true,
                  icon: (
                    <>
                      <path d="M5 7h14M10 7V5h4v2M6.5 7l.8 12.2h9.4L17.5 7" />
                      <path d="M10.5 11v5M13.5 11v5" />
                    </>
                  ),
                  onSelect: () => menuFor && remove(menuFor),
                },
              ]
            : []),
        ]}
      />

      {/* Кому переслать. Список тянем только когда шторку открыли: он нужен
          раз в сотню открытий переписки. */}
      <BottomSheet
        open={forwarding !== null}
        onClose={() => setForwarding(null)}
        title={
          forwarding && forwarding.length > 1
            ? `Переслать ${forwarding.length}`
            : 'Переслать'
        }
      >
        <div className="flex flex-col divide-y divide-[var(--border)]">
          {(people.data ?? []).map((person) => (
            <button
              key={person.id}
              type="button"
              onClick={() => forwardTo(person.id)}
              className="flex items-center gap-3 py-3 text-left transition-colors active:bg-[var(--surface-2)]"
            >
              <DefaultAvatar name={person.username} size={44} src={person.avatar_url} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-[var(--text)]">
                {person.username}
              </span>
            </button>
          ))}
          {people.loading && (
            <SkeletonList count={5}>
              <SkeletonRow />
            </SkeletonList>
          )}
        </div>
      </BottomSheet>

      <PersonMenuSheet
        open={personMenu}
        onClose={() => setPersonMenu(false)}
        userId={userId}
        username={person?.username ?? '—'}
        url={typeof window === 'undefined' ? '' : `${window.location.origin}/u/${userId}`}
        onClearChat={clearChat}
      />
    </div>
  );
}
