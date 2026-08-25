'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, SubmitEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { invalidate, useApiData } from '@/lib/useApiData';
import { MediaEditor } from '@/components/MediaEditor';
import { BottomSheet } from '@/components/BottomSheet';
import { useScreenExit } from '@/lib/screenExit';
import { markGoingBack } from '@/lib/navDirection';
import { releaseBackdrop } from '@/lib/screenBackdrop';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { Community, Post } from '@/lib/types';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { HintDot } from '@/components/HintDot';
import { BanNotice } from '@/components/BanNotice';
import { useT } from '@/lib/i18n';

/** Бакет в Supabase Storage, куда складываются картинки постов. */
const MEDIA_BUCKET = 'post-media';

/**
 * Сколько гаснет уходящий шаг мастера.
 *
 * Число живёт в теме (--step-ms), а не здесь: та же величина нужна анимации
 * въезда следующего шага, и разъехавшись, эти двое дают либо провал между
 * шагами, либо наложение.
 */
function stepMs(): number {
  return (
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--step-ms')) || 85
  );
}

/** Сколько уезжает шторка — берём из темы, чтобы маршрут менялся ровно следом. */
function sheetOutMs(): number {
  return (
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--sheet-out-ms')
    ) || 200
  );
}

/**
 * Снимок в работе: локальное превью появляется сразу, публичный адрес — когда
 * файл доедет. Пока url пуст, снимок показан приглушённым и отправку держит.
 */
type Shot = { key: string; preview: string; url: string | null };

/**
 * Сколько снимков влезает в одну запись.
 *
 * Десять — не техническое ограничение, а редакторское: дальше это уже не
 * запись со снимками, а альбом, который в ленте всё равно никто не долистает.
 */
const MAX_SHOTS = 10;

/** Метка выбора «от своего имени» — идентификатором сообщества быть не может. */
const PERSONAL = '__personal__';

/**
 * Подогнать высоту поля под текст.
 *
 * Сброс в auto перед чтением scrollHeight обязателен: у выросшего поля
 * scrollHeight равен его собственной высоте, и при удалении строк оно бы уже
 * не уменьшалось — только росло.
 */
function grow(field: HTMLTextAreaElement) {
  field.style.height = 'auto';
  field.style.height = `${field.scrollHeight}px`;
}

/**
 * Storage отвечает короткими техническими фразами — переводим их в то,
 * что человеку понятно и что подсказывает, где именно чинить.
 */
function describeUploadError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('row-level security') || lower.includes('unauthorized')) {
    return `Supabase не разрешает запись в «${MEDIA_BUCKET}». Пометка Public открывает только чтение — нужны политики на запись (миграция 003_storage_policies.sql).`;
  }
  if (lower.includes('not found')) {
    return `В Supabase не создан бакет «${MEDIA_BUCKET}» — без него картинки загружать некуда.`;
  }
  if (lower.includes('exceeded') || lower.includes('too large')) {
    return 'Файл слишком большой для загрузки.';
  }
  return message;
}

/**
 * Suspense обязателен: useSearchParams читает адрес во время отрисовки, и без
 * границы ожидания Next не может отдать страницу заранее.
 */
export default function CreatePostPage() {
  return (
    <Suspense fallback={<div className="min-h-[100dvh]" />}>
      <CreatePost />
    </Suspense>
  );
}

function CreatePost() {
  const router = useRouter();
  const { session } = useSession();
  const { requestVerification } = usePhoneGate();
  const { t } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Пришли со страницы сообщества — оно уже выбрано, и спрашивать «куда
  // опубликовать» значит переспрашивать очевидное: человек стоял на его
  // странице и нажал «Опубликовать пост» именно там.
  const params = useSearchParams();
  const presetCommunity = params.get('community');
  // Пришли по «Написать вслед» — запись продолжает указанную. Выбор клуба тогда
  // тоже не нужен: продолжение живёт там же, где начало, и спрашивать об этом
  // значило бы предлагать разорвать цепочку между двумя лентами.
  const continuesPostId = params.get('after');

  // Два шага: сначала выбор сообщества, потом сам текст.
  const [step, setStep] = useState<'community' | 'compose'>(
    presetCommunity || continuesPostId ? 'compose' : 'community'
  );
  const [communityQuery, setCommunityQuery] = useState('');
  const [asCommunity, setAsCommunity] = useState(Boolean(presetCommunity));

  // Открываем шторку через кадр после монтирования: если выставить open сразу,
  // разметка приедет на место в том же кадре и анимации нечего проигрывать.
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSheetOpen(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Под шторкой стоит замороженная лента — снимок, снятый в момент нажатия
  // (см. screenBackdrop). Убираем его, когда этот экран уходит: дальше на его
  // месте окажется живая лента, и две одинаковые копии друг на друге ни к чему.
  //
  // Проверка маршрута обязательна. React в разработке прогоняет эффекты дважды
  // — setup, cleanup, setup, — и первый же cleanup снимал снимок, пока экран
  // никуда не уходил: шторка выезжала поверх пустоты, ровно как до всей этой
  // затеи. Настоящий уход отличается от учебного тем, что маршрут к этому
  // моменту уже сменился.
  useEffect(
    () => () => {
      if (window.location.pathname !== '/create') releaseBackdrop();
    },
    []
  );

  // Закрытие: сначала шторка уезжает вниз, и только потом меняется маршрут.
  // Уход по router.back() снимал разметку в тот же кадр — экран исчезал рывком,
  // хотя приезжал плавно.
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    // Ждём ровно столько, сколько уезжает шторка, — не больше. Здесь стояли
    // зашитые 300 мс, и когда длительности вынесли в переменные, шторка
    // уезжала за свои двести, а маршрут менялся ещё через сотню: эта пауза и
    // читалась как заминка перед лентой.
    //
    // Помечаем направление: лента под шторкой всё это время была на месте, и
    // проигрывать ей появление незачем.
    markGoingBack();
    window.setTimeout(() => router.back(), sheetOutMs());
  }, [router]);

  // Крестик в шапке закрывает этот экран его же способом, а не своим.
  useScreenExit(closeSheet);
  // id выбранной карточки на время ухода экрана — она подсвечивается,
  // пока остальные гаснут, поэтому нажатие не выглядит проглоченным.
  const [leavingTo, setLeavingTo] = useState<string | null>(null);
  const stepTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimeout.current) clearTimeout(stepTimeout.current);
    };
  }, []);

  function pickCommunity(id: string | null) {
    if (leavingTo) return;
    // Личный пост помечаем отдельным значением: null означал бы «ничего
    // не выбрано», и подсветка карточки не сработала бы.
    setLeavingTo(id ?? PERSONAL);
    // Экран выбора успевает погаснуть до подмены — без паузы шаги менялись
    // встык, одним кадром, и переход выглядел рубленым.
    stepTimeout.current = setTimeout(() => {
      setCommunityId(id ?? '');
      // Выбрал сообщество — значит пишет от его имени: отдельного вопроса об
      // этом на следующем шаге больше нет.
      setAsCommunity(id !== null);
      setStep('compose');
      setLeavingTo(null);
    }, stepMs());
  }

  // Вернулись ли к выбору с шага написания. На первом открытии выбор уже едет
  // вместе со шторкой, и собственная анимация ему не нужна — а вот при возврате
  // шторка стоит на месте, и без неё экран возникал в один кадр.
  const [pickerReturn, setPickerReturn] = useState(false);

  /** Назад к выбору — с той же паузой на затухание, что и вперёд. */
  function backToPicker() {
    if (composeLeaving) return;
    setComposeLeaving(true);
    stepTimeout.current = setTimeout(() => {
      setStep('community');
      setPickerReturn(true);
      setComposeLeaving(false);
    }, stepMs());
  }

  const [composeLeaving, setComposeLeaving] = useState(false);
  const [communityId, setCommunityId] = useState(presetCommunity ?? '');
  /**
   * Заголовок и текст — снова два поля.
   *
   * Одно поле, у которого первая строка молча становилась заголовком, экономило
   * место и врало: набранное выглядело сплошным текстом, а в ленте первая
   * строка вдруг оказывалась набрана газетной антиквой вдвое крупнее. Человек
   * узнавал о существовании заголовка после публикации — и обычно не тем, каким
   * хотел бы.
   *
   * Заголовок при этом остаётся необязательным: без него запись уходит как
   * есть, первой строкой текста. Обязательным его делать нельзя — короткая
   * реплика в три слова заголовка не имеет и не должна его выдумывать.
   */
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  /**
   * Снимки записи. Список, а не одно поле.
   *
   * Каждый снимок живёт двумя состояниями: сначала локальный preview (blob), он
   * появляется мгновенно, затем — публичный адрес из хранилища. Держать их
   * порознь нельзя: порядок снимков задаёт человек, и сопоставлять два списка
   * по индексу пришлось бы при каждой отмене загрузки.
   */
  const [shots, setShots] = useState<Shot[]>([]);
  /** Снимок, который сейчас кадрируют. Пусто — окно закрыто. */
  const [cropping, setCropping] = useState<Shot | null>(null);
  const uploading = shots.some((shot) => shot.url === null);


  // null — опроса нет. Массив появляется по кнопке и стартует с двух пустых строк.
  const [pollOptions, setPollOptions] = useState<string[] | null>(null);
  // Ключи строк живут отдельно от значений: по индексу React переиспользует узлы,
  // и при удалении средней строки анимация проигрывалась бы на соседней.
  const [pollKeys, setPollKeys] = useState<number[]>([]);
  const nextPollKey = useRef(0);
  // Строка не исчезает мгновенно: сначала схлопывается, потом уходит из массива.
  const [removingOption, setRemovingOption] = useState<number | null>(null);
  const [enteringKey, setEnteringKey] = useState<number | null>(null);
  const removeTimer = useRef<number | undefined>(undefined);
  // Блок опроса при закрытии остаётся в разметке, пока схлопывается: убери его
  // сразу — и схлопывать будет нечего, блок пропадал в один кадр.
  const [pollClosing, setPollClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  const pollShown = pollOptions !== null && !pollClosing;

  useEffect(
    () => () => {
      window.clearTimeout(removeTimer.current);
      window.clearTimeout(closeTimer.current);
    },
    []
  );

  function togglePoll() {
    if (pollShown) {
      setPollClosing(true);
      closeTimer.current = window.setTimeout(() => {
        setPollOptions(null);
        setPollKeys([]);
        setRemovingOption(null);
        setPollClosing(false);
      }, 320);
      return;
    }
    // Вернули опрос, пока он ещё схлопывался — просто разворачиваем обратно
    // с теми же вариантами, ничего не теряя.
    window.clearTimeout(closeTimer.current);
    setPollClosing(false);
    if (pollOptions) return;
    setPollOptions(['', '']);
    setPollKeys([nextPollKey.current++, nextPollKey.current++]);
  }

  function addOption() {
    const key = nextPollKey.current++;
    setPollOptions((prev) => [...prev!, '']);
    setPollKeys((prev) => [...prev, key]);
    setEnteringKey(key);
  }

  function removeOption(index: number) {
    // Пока одна строка схлопывается, индексы остальных не должны разъезжаться.
    if (removingOption !== null) return;
    setRemovingOption(index);
    removeTimer.current = window.setTimeout(() => {
      setPollOptions((prev) => prev!.filter((_, i) => i !== index));
      setPollKeys((prev) => prev.filter((_, i) => i !== index));
      setRemovingOption(null);
    }, 240);
  }

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Из общего кеша: список сообществ почти всегда уже загружен соседним
  // экраном, и выбор открывается сразу.
  const communitiesResult = useApiData<Community[]>('/communities');
  const communities = useMemo(() => communitiesResult.data ?? [], [communitiesResult.data]);

  // Локальные превью живут до размонтирования — иначе утекут объекты.
  useEffect(() => {
    const snapshot = shots;
    return () => {
      // Освобождаем blob-адреса: без этого каждый выбранный файл остаётся в
      // памяти вкладки до её закрытия. Зависимость от списка обязательна —
      // эффект с пустой освободил бы только тот набор, что был при первой
      // отрисовке, то есть пустой.
      for (const shot of snapshot) URL.revokeObjectURL(shot.preview);
    };
  }, [shots]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])].slice(0, MAX_SHOTS - shots.length);
    // Поле сбрасываем сразу: без этого повторный выбор того же файла не даёт
    // события change, и второй снимок «не добавляется».
    event.target.value = '';
    if (files.length === 0) return;

    setError(null);

    // Все превью появляются разом, до единой загрузки: человек видит, что
    // выбор принят, и может продолжать писать, пока снимки едут на сервер.
    const added: Shot[] = files.map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      preview: URL.createObjectURL(file),
      url: null,
    }));
    setShots((current) => [...current, ...added]);

    await Promise.all(
      files.map(async (file, position) => {
        const shot = added[position];
        const extension = file.name.split('.').pop() ?? 'bin';
        const path = `${session?.user.id ?? 'anon'}/${shot.key}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          // Убираем только упавший снимок, остальные продолжают ехать: одна
          // неудача не повод отменять весь выбор.
          setShots((current) => current.filter((item) => item.key !== shot.key));
          URL.revokeObjectURL(shot.preview);
          setError(describeUploadError(uploadError.message));
          return;
        }

        const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
        setShots((current) =>
          current.map((item) => (item.key === shot.key ? { ...item, url: data.publicUrl } : item))
        );
      })
    );
  }

  /**
   * Заменить снимок подрезанным.
   *
   * Старый файл в хранилище не удаляем: запись ещё не опубликована, и адрес
   * нигде не записан — он просто останется висеть. Это плата за простоту, и
   * платить её лучше здесь, чем ловить состояние «удалили, а замена не
   * загрузилась» и оставлять человека без снимка вообще.
   */
  async function replaceShot(key: string, blob: Blob) {
    const preview = URL.createObjectURL(blob);
    setCropping(null);
    setShots((current) =>
      current.map((shot) => (shot.key === key ? { ...shot, preview, url: null } : shot))
    );

    const path = `${session?.user.id ?? 'anon'}/${key}-crop.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, blob, { cacheControl: '3600', upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    setShots((current) =>
      current.map((shot) => (shot.key === key ? { ...shot, url: data.publicUrl } : shot))
    );
  }

  function removeShot(key: string) {
    setShots((current) => {
      const gone = current.find((shot) => shot.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return current.filter((shot) => shot.key !== key);
    });
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const post = await apiFetch<Post>('/posts', {
        method: 'POST',
        body: JSON.stringify({
          // Первая строка — заголовок, остальное — текст. Поле теперь одно,
          // а модель на бэкенде по-прежнему из двух частей.
          title: title.split('\n')[0].slice(0, 300),
          body: title.split('\n').slice(1).join('\n').trim() || null,
          // Пустая строка означает личный пост — на бэкенд уходит null.
          community_id: communityId || null,
          // Обложка и полный список. Обложку шлём отдельно, потому что на неё
          // смотрят предпросмотр ссылки и мобильный клиент, который обновляется
          // не одновременно с вебом.
          image_url: ready[0] ?? null,
          image_urls: ready,
          // Опрос, который уже схлопывается, отправлять не надо: для пользователя
          // он снят, даже если строки ещё живут в разметке.
          poll_options: pollShown
            ? pollOptions!.map((option) => option.trim()).filter(Boolean)
            : [],
          post_as_community: asCommunity,
          continues_post_id: continuesPostId,
        }),
      });
      // Лента закеширована — без сброса свежий пост в ней не появится.
      invalidate('/posts');
      // Сначала шторка уезжает вниз, и только потом меняется маршрут. Раньше
      // push случался в тот же кадр, что и ответ сервера: экран написания
      // пропадал разом, не отыграв закрытия, — при том что открывался он
      // движением. Отправка — единственное место, где он исчезал рывком.
      setSheetOpen(false);
      window.setTimeout(() => router.push(`/posts/${post.id}`), sheetOutMs());
      // Кнопку не отпускаем — те двести миллисекунд, пока шторка уезжает, она
      // ещё на экране и нажимается, а пост уже отправлен. Поэтому и снимаем
      // блокировку только на ошибках, а не в finally.
    } catch (err) {
      setSubmitting(false);
      if (isPhoneNotVerifiedError(err)) {
        requestVerification();
        return;
      }
      setError(err instanceof Error ? err.message : 'Не удалось опубликовать пост');
    }
  }

  // Сообщество больше не обязательно: без него пост личный.
  const canSubmit = (title.trim() || body.trim()) && !submitting && !uploading;
  /** Загруженные снимки в том порядке, в каком их выбрали. */
  const ready = shots.map((shot) => shot.url).filter((url): url is string => Boolean(url));
  const chosenCommunity = communities.find((c) => c.id === communityId);

  // Шаг 1 — куда публиковать. Отдельным экраном, как в Reddit: выбор сообщества
  // задаёт контекст всему посту, и решать его на бегу в выпадашке неудобно.
  // Экран создания живёт отдельным маршрутом (на него можно прийти по ссылке),
  // но выглядит и ведёт себя как шторка: выезжает снизу, тянется вниз пальцем,
  // закрывается по затемнению. Открываем через кадр после монтирования —
  // иначе анимации нечего проигрывать, разметка сразу приедет на место.
  const sheet = (title: string, children: React.ReactNode, footer?: React.ReactNode) => (
    <BottomSheet
      open={sheetOpen}
      onClose={closeSheet}
      title={title}
      height="84dvh"
      footer={footer}
    >
      {children}
    </BottomSheet>
  );

  if (step === 'community') {
    const normalized = communityQuery.trim().toLowerCase();
    const visible = normalized
      ? communities.filter(
          (c) =>
            c.name.toLowerCase().includes(normalized) ||
            c.description?.toLowerCase().includes(normalized)
        )
      : communities;

    return sheet(
      t('create.pickCommunity'),
      <div
        className={`${pickerReturn ? 'step-enter-back' : ''} flex flex-col gap-4 py-3`}
        style={{
          opacity: leavingTo ? 0 : 1,
          transform: leavingTo ? 'translateY(-10px) scale(0.985)' : 'none',
          transition: 'opacity var(--step-ms) ease, transform var(--step-ms) var(--enter-ease)',
        }}
      >
          <p className="text-[14px] text-[var(--text-muted)]">
            {t('create.pickHint')}
          </p>

          {/* Первым — «от своего имени»: пост не обязан жить в сообществе,
              и личная запись должна быть таким же полноправным выбором,
              а не тем, что находишь, пролистав весь список. */}
          <button
            onClick={() => pickCommunity(null)}
            className="glass flex items-center gap-3.5 rounded-2xl p-4 text-left"
            style={{
              transform: leavingTo === PERSONAL ? 'scale(1.015)' : 'none',
              boxShadow: leavingTo === PERSONAL ? '0 0 0 1px var(--accent)' : undefined,
              transition: 'transform 0.19s cubic-bezier(0.32, 1.3, 0.5, 1), box-shadow 0.19s ease',
            }}
          >
            <DefaultAvatar name={(session?.user.email ?? '?').split('@')[0]} size={48} />
            <div className="relative flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium text-[var(--text)]">
                {t('create.personal')}
              </span>
              <span className="line-clamp-2 text-[13px] text-[var(--text-muted)]">
                {t('create.personalHint')}
              </span>
            </div>
          </button>

          <div className="flex items-center gap-3 pt-1">
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
            <span className="text-[12.5px] text-[var(--text-muted)]">
              {t('create.orInCommunity')}
            </span>
            <span className="h-px flex-1" style={{ background: 'var(--border)' }} />
          </div>

          {/* Частое заблуждение: люди думают, что писать в сообщество можно
              только будучи его администратором. Говорим прямо. */}
          <p className="text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            {t('create.communityHint')}
          </p>

          {/* Поиск выше списка: сообществ со временем станет много, и листать
              их до нужного ради одного поста — самый частый путь. */}
          {communities.length > 0 && (
            <div className="relative">
              {/* z-10: поле ниже стеклянное, его backdrop-filter размывает
                  всё, что нарисовано под ним, включая эту лупу. */}
              <span className="pointer-events-none absolute left-4 top-1/2 z-10 flex -translate-y-1/2 items-center gap-1.5 text-[var(--text-muted)]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m20 20-4.3-4.3" />
                </svg>
                {/* Слово рядом с лупой, а не подсказкой внутри поля.
                    Подсказка исчезает на первом же введённом знаке — и поле,
                    оставшись с одной лупой, перестаёт объяснять, что оно делает.
                    Особенно на середине набора, когда результатов ещё нет и
                    смотреть не на что. Эта надпись стоит всегда. */}
                <span className="text-[15px]">{t('common.searchLabel')}</span>
              </span>
              <input
                type="search"
                enterKeyHint="search"
                placeholder=""
                value={communityQuery}
                onChange={(e) => setCommunityQuery(e.target.value)}
                className="field-line w-full py-2.5 pl-[84px] pr-2 text-[15px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
              />
            </div>
          )}

          {error && <p style={{ color: 'var(--down)' }}>{error}</p>}

          {communities.length === 0 ? (
            <div className="glass flex flex-col items-center gap-3 rounded-2xl p-6 text-center">
              <p className="text-[14px] text-[var(--text-muted)]">
                Сначала нужно создать сообщество — пост всегда публикуется в одном из них.
              </p>
              <Link
                href="/communities"
                className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-[14px] font-medium text-[var(--accent-contrast)]"
              >
                К сообществам
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {visible.map((community) => {
                const chosen = leavingTo === community.id;
                return (
                  <button
                    key={community.id}
                    onClick={() => pickCommunity(community.id)}
                    className="glass flex items-center gap-3.5 rounded-2xl p-4 text-left"
                    style={{
                      // Выбранная карточка на миг подаётся вперёд и загорается
                      // акцентом, остальные просто уходят вместе с экраном.
                      transform: chosen ? 'scale(1.015)' : 'none',
                      borderColor: chosen ? 'var(--accent)' : undefined,
                      boxShadow: chosen ? '0 0 0 1px var(--accent)' : undefined,
                      transition: 'transform 0.19s cubic-bezier(0.32, 1.3, 0.5, 1), box-shadow 0.19s ease',
                    }}
                  >
                    <CommunityAvatar name={community.name} size={48} />
                    <div className="relative flex min-w-0 flex-col gap-0.5">
                      <span className="truncate font-medium text-[var(--text)]">{community.name}</span>
                      {community.description && (
                        <span className="line-clamp-2 text-[13px] text-[var(--text-muted)]">
                          {community.description}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}

              {visible.length === 0 && (
                <p className="glass rounded-2xl p-6 text-center text-[var(--text-muted)]">
                  {t('communities.nothing')}
                </p>
              )}
            </div>
          )}
      </div>
    );
  }

  return sheet(
    t('create.title'),
    <form
      id="create-post"
      onSubmit={handleSubmit}
      className="step-enter flex flex-col gap-4 py-3"
      style={{
        opacity: composeLeaving ? 0 : 1,
        transform: composeLeaving ? 'translateY(10px) scale(0.985)' : 'none',
        transition: 'opacity var(--step-ms) ease, transform var(--step-ms) var(--enter-ease)',
      }}
    >
        {/* Первым, до всего остального: если писать нельзя, об этом надо
            узнать до того, как текст набран, а не на кнопке «Опубликовать».
            Ничего не рисует, пока бана нет. */}
        <BanNotice />

        {/* Возврат к выбору тоже с паузой: экран написания успевает погаснуть,
            и шаги не меняются встык, одним кадром. */}
        <button
          type="button"
          onClick={backToPicker}
          className="flex w-fit items-center gap-2 rounded-full px-2 py-1.5 text-[15px] text-[var(--text-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {chosenCommunity?.name ?? t('create.personal')}
        </button>

        {/* Пишем вслед — говорим об этом прямо. Без подписи экран ничем не
            отличался бы от обычной новой записи, а уйдёт она не в ленту сама
            по себе, а под ту, которую продолжает. */}
        {continuesPostId && (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
            style={{ background: 'var(--accent-soft)' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="flex-none">
              <path d="M6 4v10a3 3 0 0 0 3 3h9" />
              <path d="m14 13 4 4-4 4" />
            </svg>
            <span className="min-w-0 text-[13.5px] leading-snug text-[var(--text)]">
              Запись уйдёт{' '}
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                вслед
              </span>{' '}
              за предыдущей и появится под ней.{' '}
              <HintDot label="Что такое «вслед»">
                «Вслед» — продолжение вашей же записи. Она не появится в ленте
                отдельным постом: её видно под той, которую она продолжает, с
                подписью «Вслед · 2 из 3». Так одна мысль, которой не хватило
                одного захода, остаётся одной мыслью, а не рассыпается по ленте
                между чужими записями. Продолжить можно только свою запись и
                только один раз — цепочка идёт в одну линию.
              </HintDot>
            </span>
          </div>
        )}

        {/* Сообщество уже выбрано шагом раньше — второй раз спрашивать «от чьего
            имени» незачем: человек ответил на этот вопрос, когда выбирал, куда
            пишет. Осталось напомнить, чьей подписью уйдёт запись. */}
        {chosenCommunity && (
          <div
            className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
            style={{ background: 'var(--accent-soft)' }}
          >
            <CommunityAvatar name={chosenCommunity.name} size={30} />
            <span className="min-w-0 text-[13.5px] leading-snug text-[var(--text)]">
              {t('create.asCommunityNote')}{' '}
              <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                {chosenCommunity.name}
              </span>
            </span>
          </div>
        )}

        {/* Одно поле вместо «заголовка» и «текста». Деление на два блока
            навязывало структуру, которой в мыслях обычно нет, и половина
            высоты шторки уходила на пустые рамки. Первая строка становится
            заголовком сама — её и отправляем как title. */}
        {/* Поле растёт под текст, а не стоит в пять строк с самого начала.
            Пустые строки были не запасом, а расстоянием: панель вложений
            отъезжала от строки на четыре пустых, и до неё приходилось тянуться
            через пустоту, которую ничего не заполняло. Теперь поле начинается с
            двух строк и добирает высоту по мере набора — вложения всё время
            стоят прямо под последней написанной строкой. */}
        {/* Заголовок — той же антиквой, какой он выйдет в ленте. Поле, которое
            показывает результат, а не обещает его: набирая, человек сразу
            видит, что это именно заголовок, и незачем объяснять это подписью. */}
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={300}
          placeholder={t('create.titlePlaceholder')}
          className="display-type border-none bg-transparent px-1 text-[21px] leading-snug text-[var(--text)] outline-none placeholder:font-normal"
        />

        <textarea
          rows={2}
          ref={textRef}
          placeholder={t('create.placeholder')}
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            grow(e.currentTarget);
          }}
          className="-mt-2 resize-none overflow-hidden border-none bg-transparent px-1 text-[16px] leading-relaxed text-[var(--text)] outline-none"
        />

        {/* Панель вложений сразу под строкой, а не у нижней кромки шторки:
            внизу она стояла в обнимку с кнопкой «Опубликовать», и до неё
            приходилось тянуться через полэкрана пустоты.

            Кругляшков вокруг знаков больше нет. Три обведённые таблетки в ряд
            читались панелью управления от другой программы: обводка обещала
            кнопку с состоянием, хотя две из трёх просто открывают системный
            выбор файла. Осталось то, что и было содержанием, — знак и слово
            под ним; нажимаемость показывает подсветка при касании.

            Отрицательный верхний отступ съедает общий gap формы: панель обязана
            принадлежать полю ввода, а не висеть отдельным блоком под ним. На
            расстоянии в шестнадцать пикселей она читалась как следующий раздел
            шторки, хотя это продолжение той же строки — то, чем её дополняют. */}
        <div className="-mx-1 -mt-3 flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            // Несколько снимков за раз: выбирать их по одному, закрывая и
            // открывая системное окно, — работа, которой человек не просил.
            multiple
            onChange={handleFile}
            className="hidden"
            id="post-media"
          />
          <label
            htmlFor="post-media"
            aria-label={t('create.image')}
            title="Изображение"
            className="flex cursor-pointer items-center justify-center rounded-xl p-2.5 text-[var(--text-muted)] transition-colors active:bg-[var(--surface-2)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="15" rx="3" />
              <circle cx="8.5" cy="10" r="1.6" />
              <path d="m4 17 5-4.5 4.5 4 3-2.5L20 18" />
            </svg>
          </label>

          {/* capture просит систему открыть камеру, а не галерею. */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            className="hidden"
            id="post-camera"
          />
          <label
            htmlFor="post-camera"
            aria-label={t('create.camera')}
            title="Камера"
            className="flex cursor-pointer items-center justify-center rounded-xl p-2.5 text-[var(--text-muted)] transition-colors active:bg-[var(--surface-2)]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5a2 2 0 0 1 2-2h2l1.4-2h7.2L17 6.5h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
              <circle cx="12" cy="12.5" r="3.4" />
            </svg>
          </label>

          <button
            type="button"
            onClick={togglePoll}
            aria-label={t('create.poll')}
            aria-pressed={pollShown}
            title="Опрос"
            // Единственная из трёх, у которой есть состояние: опрос включён или
            // нет. Показываем его заливкой и цветом, а не обводкой — обводка
            // тут же вернула бы кнопке вид отдельного прибора.
            className="flex items-center justify-center rounded-xl p-2.5 transition-colors"
            style={{
              color: pollShown ? 'var(--accent)' : 'var(--text-muted)',
              background: pollShown ? 'var(--accent-soft)' : 'transparent',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="4" rx="2" />
              <rect x="3" y="12" width="12" height="4" rx="2" />
              <rect x="3" y="19" width="7" height="1.2" rx="0.6" />
            </svg>
          </button>
        </div>

        {/* Выбранные снимки — лентой, а не одним кадром на всю ширину.
            Пока снимок один, лента и есть один кадр; как только их больше,
            сразу видно порядок, число и то, что любой можно убрать. Полоса
            прокручивается вбок: вертикальный список из пяти картинок занял бы
            всю шторку и вытеснил поле, ради которого её открыли. */}
        {shots.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {shots.map((shot) => (
              <div
                key={shot.key}
                className="relative flex-none overflow-hidden rounded-2xl border border-[var(--border)]"
                style={{ width: shots.length === 1 ? '100%' : 132, height: shots.length === 1 ? 280 : 132 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- превью локального файла и произвольный Storage-домен */}
                <img
                  src={shot.url ?? shot.preview}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{ opacity: shot.url ? 1 : 0.45 }}
                />
                {!shot.url && (
                  <span className="absolute inset-0 flex items-center justify-center text-[12.5px] font-medium text-[var(--text)]">
                    Загружаем…
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeShot(shot.key)}
                  aria-label="Убрать снимок"
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-transform active:scale-90"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>

                {/* Кадрирование — кнопкой на снимке, а не окном при выборе.
                    Выбирают здесь сразу несколько файлов, и окно на каждом
                    превратило бы добавление четырёх снимков в четыре
                    обязательных решения подряд. Кнопка оставляет выбор за
                    человеком: подрезать нужно обычно один из четырёх, и
                    остальные три не должны за него платить. */}
                <button
                  type="button"
                  onClick={() => setCropping(shot)}
                  aria-label="Подогнать кадр"
                  className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white transition-transform active:scale-90"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
                    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Блок опроса разворачивается и схлопывается по высоте, а не
            выдёргивается из разметки: без этого форма прыгала на всю высоту
            блока в один кадр. grid-rows от 0fr к 1fr — единственный способ
            анимировать высоту содержимого, которое заранее неизвестно. */}
        <div
          className="grid"
          style={{
            gridTemplateRows: pollShown ? '1fr' : '0fr',
            opacity: pollShown ? 1 : 0,
            transition:
              'grid-template-rows 0.32s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.24s ease',
          }}
        >
          <div className="overflow-hidden">
        {pollOptions && (
          <div className="flex flex-col gap-2 rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-[var(--text)]">{t('create.poll')}</span>
              <button
                type="button"
                onClick={togglePoll}
                className="text-[13px] text-[var(--text-muted)] hover:underline"
              >
                {t('create.pollRemove')}
              </button>
            </div>

            {/* Строки появляются и уходят схлопыванием по высоте: раньше они
                возникали и пропадали одним кадром, и весь блок дёргался.
                key по устойчивому идентификатору, а не по индексу — иначе при
                удалении средней строки React переиспользует узлы и анимация
                проигрывается не на той. */}
            {pollOptions.map((option, index) => (
              <div
                key={pollKeys[index] ?? index}
                className={`grid${enteringKey === pollKeys[index] ? ' poll-option-enter' : ''}`}
                onAnimationEnd={() => setEnteringKey(null)}
                style={{
                  gridTemplateRows: removingOption === index ? '0fr' : '1fr',
                  opacity: removingOption === index ? 0 : 1,
                  transition:
                    'grid-template-rows 0.26s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
                }}
              >
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 pb-2">
                    <input
                      value={option}
                      placeholder={`${t('create.pollOption')} ${index + 1}`}
                      onChange={(e) =>
                        setPollOptions((prev) =>
                          prev!.map((value, i) => (i === index ? e.target.value : value))
                        )
                      }
                      className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-[14px] text-[var(--text)] outline-none focus:border-[var(--accent)]"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        aria-label={`Убрать вариант ${index + 1}`}
                        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M6 6l12 12M18 6 6 18" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {pollOptions.length < 6 && (
              <button
                type="button"
                onClick={addOption}
                className="self-start text-[13px] font-medium"
                style={{ color: 'var(--accent)' }}
              >
                {t('create.pollAdd')}
              </button>
            )}
          </div>
        )}
          </div>
        </div>

        {error && <p className="text-[14px]" style={{ color: 'var(--down)' }}>{error}</p>}

        {/* Подгонка кадра. Работает по превью, а не по адресу в хранилище:
            превью — это локальный файл, а по чужому адресу canvas отказался бы
            отдавать пиксели, если на бакете нет разрешающего заголовка. */}
        <MediaEditor
          open={cropping !== null}
          src={cropping?.preview ?? null}
          onCancel={() => setCropping(null)}
          onApply={(blob) => cropping && void replaceShot(cropping.key, blob)}
        />
    </form>,
    <button
      type="submit"
      form="create-post"
      disabled={!canSubmit}
      className="rounded-full bg-[var(--accent)] py-3 text-[15px] font-medium text-[var(--accent-contrast)] transition-opacity disabled:opacity-40"
    >
      {submitting ? t('create.publishing') : t('create.publish')}
    </button>
  );
}
