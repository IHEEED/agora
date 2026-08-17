'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, SubmitEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { invalidate, useApiData } from '@/lib/useApiData';
import { BottomSheet } from '@/components/BottomSheet';
import { useScreenExit } from '@/lib/screenExit';
import { markGoingBack } from '@/lib/navDirection';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import { Community, Post } from '@/lib/types';
import { isPhoneNotVerifiedError, usePhoneGate } from '@/components/PhoneGateContext';
import { CommunityAvatar } from '@/components/CommunityAvatar';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { HintDot } from '@/components/HintDot';
import { useT } from '@/lib/i18n';

/** Бакет в Supabase Storage, куда складываются картинки постов. */
const MEDIA_BUCKET = 'post-media';

/**
 * Сколько гаснет уходящий шаг мастера.
 *
 * Дольше перехода между экранами и намеренно: экраны сменяются целиком, а тут
 * подменяется содержимое одной и той же шторки — она остаётся на месте, и
 * рывок внутри неподвижной рамки заметен куда сильнее. На ста девяноста
 * миллисекундах шаг не гас, а моргал.
 */
const STEP_MS = 260;

/** Сколько уезжает шторка — берём из темы, чтобы маршрут менялся ровно следом. */
function sheetOutMs(): number {
  return (
    Number.parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--sheet-out-ms')
    ) || 200
  );
}

/** Метка выбора «от своего имени» — идентификатором сообщества быть не может. */
const PERSONAL = '__personal__';

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
    <Suspense fallback={<div className="min-h-screen" />}>
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

  // Закрытие: сначала шторка уезжает вниз, и только потом меняется маршрут.
  // Уход по router.back() снимал разметку в тот же кадр — экран исчезал рывком,
  // хотя приезжал плавно.
  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    // Ждём ровно столько, сколько уезжает шторка. Здесь стояли зашитые 300 мс,
    // и после того как длительности вынесли в переменные, шторка уезжала за
    // свои двести, а маршрут менялся ещё через сотню — эта пауза и читалась
    // как заминка перед лентой.
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
    }, STEP_MS);
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
    }, STEP_MS);
  }

  const [composeLeaving, setComposeLeaving] = useState(false);
  const [communityId, setCommunityId] = useState(presetCommunity ?? '');
  const [title, setTitle] = useState('');

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  // Локальный превью-URL живёт до размонтирования — иначе утечёт объект.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);
    setPreview(URL.createObjectURL(file));

    const extension = file.name.split('.').pop() ?? 'bin';
    const path = `${session?.user.id ?? 'anon'}/${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      setUploading(false);
      setPreview(null);
      setImageUrl(null);
      setError(describeUploadError(uploadError.message));
      return;
    }

    const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  }

  function removeImage() {
    setImageUrl(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
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
          image_url: imageUrl,
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
  const canSubmit = title.trim() && !submitting && !uploading;
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
      height="84vh"
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
          transition: 'opacity 0.26s ease, transform 0.26s var(--enter-ease)',
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
              <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-[var(--text-muted)]">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m20 20-4.3-4.3" />
                </svg>
              </span>
              <input
                type="search"
                enterKeyHint="search"
                placeholder={t('communities.search')}
                value={communityQuery}
                onChange={(e) => setCommunityQuery(e.target.value)}
                className="field-line w-full py-2.5 pl-9 pr-2 text-[15px] text-[var(--text)] outline-none transition-colors focus:border-[var(--accent)]"
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
        transition: 'opacity 0.26s ease, transform 0.26s var(--enter-ease)',
      }}
    >
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
        <textarea
          autoFocus
          required
          rows={5}
          placeholder={t('create.placeholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="resize-none border-none bg-transparent px-1 text-[16px] leading-relaxed text-[var(--text)] outline-none"
        />

        {/* Панель вложений сразу под строкой, а не у нижней кромки шторки:
            внизу она стояла в обнимку с кнопкой «Опубликовать», и до неё
            приходилось тянуться через полэкрана пустоты.

            Кругляшков вокруг знаков больше нет. Три обведённые таблетки в ряд
            читались панелью управления от другой программы: обводка обещала
            кнопку с состоянием, хотя две из трёх просто открывают системный
            выбор файла. Осталось то, что и было содержанием, — знак и слово
            под ним; нажимаемость показывает подсветка при касании. */}
        <div className="-mx-1 flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
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

        {(preview || imageUrl) && (
          <div className="relative overflow-hidden rounded-2xl border border-[var(--border)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- превью локального файла и произвольный Storage-домен */}
            <img
              src={preview ?? imageUrl ?? ''}
              alt=""
              className="max-h-80 w-full object-cover"
              style={{ opacity: uploading ? 0.5 : 1 }}
            />
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center text-[14px] font-medium text-[var(--text)]">
                Загружаем…
              </span>
            )}
            <button
              type="button"
              onClick={removeImage}
              aria-label="Убрать изображение"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
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
