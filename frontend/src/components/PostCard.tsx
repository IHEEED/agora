'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Post, postImages } from '@/lib/types';
import { apiFetch } from '@/lib/api';
import { invalidate } from '@/lib/useApiData';
import { CommentSheet } from '@/components/CommentSheet';
import { ShareSheet } from '@/components/ShareSheet';
import { AvatarFollow } from '@/components/AvatarFollow';
import { DefaultAvatar } from '@/components/DefaultAvatar';
import { formatCompactAge } from '@/lib/formatDate';
import { RollingNumber } from '@/components/RollingNumber';
import { VoteBlock } from '@/components/VoteBlock';
import { PollBlock } from '@/components/PollBlock';
import { PostMenuSheet } from '@/components/PostMenuSheet';
import { ImageViewer } from '@/components/ImageViewer';
import { StoryComposer, StoryDraft } from '@/components/StoryComposer';
import { haptic } from '@/lib/haptics';
import { VerifiedMark } from '@/components/VerifiedMark';
import { useSession } from '@/lib/useSession';

/**
 * Просмотры коротко: 1200 → «1,2К».
 *
 * Четырёхзначное число в строке действий спорит по весу с голосами и
 * комментариями, хотя значит меньше их обоих. Точность здесь не нужна —
 * разница между 1234 и 1240 не меняет ничего для читающего.
 */
function compactViews(value: number): string {
  if (value < 1000) return String(value);
  if (value < 1_000_000) {
    const thousands = value / 1000;
    return `${thousands < 10 ? thousands.toFixed(1).replace('.', ',').replace(',0', '') : Math.round(thousands)}К`;
  }
  return `${(value / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')}М`;
}

export function PostCard({
  post,
  linkToDetail = true,
  /** Автор, на которого можно подписаться прямо из ленты. */
  canFollow = false,
}: {
  post: Post;
  linkToDetail?: boolean;
  canFollow?: boolean;
}) {
  const [reposted, setReposted] = useState(Boolean(post.myRepost));
  const [repostCount, setRepostCount] = useState(post.repostCount ?? 0);
  const [repostSpin, setRepostSpin] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Счётчик живёт локально: отправленный из шторки комментарий должен
  // сразу отразиться на кнопке, не дожидаясь перезагрузки ленты.
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Удалённая запись убирается из ленты сразу: ждать перезагрузки списка,
  // глядя на то, что уже удалил, — странно.
  const [removed, setRemoved] = useState(false);
  // Какая картинка открыта во весь экран. −1 — закрыто; индексом, а не флагом,
  // потому что просмотрщик листает, и «какая именно» — это состояние.
  const [viewing, setViewing] = useState(-1);
  // Что сейчас в редакторе истории. null — редактор закрыт.
  const [storyDraft, setStoryDraft] = useState<StoryDraft | null>(null);
  const images = postImages(post);
  // Какой снимок сейчас в кадре. Значение выводится из прокрутки, а не задаёт
  // её: строку двигает браузер, наше дело — прочитать, где она остановилась, и
  // подсветить нужную точку.
  const [shown, setShown] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);


  function onStripScroll() {
    const strip = stripRef.current;
    if (!strip) return;
    // Округляем к ближайшему кадру: пока строка едет, точка должна переключаться
    // на середине пути, а не в момент полной остановки.
    const next = Math.round(strip.scrollLeft / strip.clientWidth);
    if (next !== shown) setShown(next);
  }
  const { session } = useSession();

  async function remove() {
    setRemoved(true);
    try {
      await apiFetch(`/posts/${post.id}`, { method: 'DELETE' });
      invalidate('/posts');
    } catch {
      setRemoved(false);
    }
  }

  async function handleRepost() {
    haptic();
    // Считаем от текущего значения, а не изнутри апдейтера setReposted:
    // React прогоняет апдейтеры дважды (StrictMode в разработке), и вложенный
    // setRepostCount срабатывал два раза — счётчик прыгал через один.
    const next = !reposted;
    setReposted(next);
    setRepostCount((count) => (next ? count + 1 : count - 1));
    setRepostSpin((k) => k + 1);

    try {
      await apiFetch(`/posts/${post.id}/repost`, { method: next ? 'POST' : 'DELETE' });
    } catch {
      // Не прошло — возвращаем как было, иначе счётчик врёт до перезагрузки.
      setReposted(!next);
      setRepostCount((count) => (next ? count - 1 : count + 1));
    }
  }


  if (removed) return null;

  const isMine = Boolean(post.author.id) && post.author.id === session?.user.id;
  const hasChain = (post.chain?.length ?? 0) > 0;

  return (
    // Ни рамки, ни фона: пост отделяется от соседа полоской, которую рисует
    // список. Горизонтальных полей тоже нет — текст идёт во всю ширину колонки.
    <article className="flex flex-col gap-2 py-4">
      {/* Метка закрепа — строкой над записью, а не значком в углу.
          Она объясняет, почему эта запись стоит первой, хотя не самая свежая и
          не самая обсуждаемая. Без объяснения лента выглядит сломанной. */}
      {post.pinned_global && (
        <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--accent)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 17v5" />
            <path d="M9 3h6l-1 6 3 3v2H7v-2l3-3z" />
          </svg>
          <span className="font-medium">Закреплено</span>
        </div>
      )}

      <div className="relative flex items-center gap-2.5 text-[14px]">
        {/* Подписка значком на аватарке, а не отдельной кнопкой у правого края.
            Там она стояла между ником и тремя точками и на длинных никах
            зажималась в щель; здесь она пришита к тому, на кого подписываются.
            Аватарка ради этого подросла с 30 до 38: на тридцати значок был бы
            мельче пальца. */}
        {canFollow && post.author.id ? (
          <AvatarFollow
            userId={post.author.id}
            username={post.author.username}
            avatar={post.author.avatar_url}
            initiallyFollowing={post.author.isFollowing}
            size={38}
          />
        ) : (
          <DefaultAvatar name={post.author.username} size={38} src={post.author.avatar_url} />
        )}

        {/* min-w-0 на контейнере и truncate на нике: без первого флекс не даёт
            элементу сжаться ниже содержимого, и длинный ник выдавливал кнопку
            подписки за край вместо того, чтобы обрезаться. */}
        <div className="flex min-w-0 flex-1 items-center gap-x-1.5 overflow-hidden">
          {/* Ник ведёт в профиль автора — самый ожидаемый жест в любой ленте. */}
          <Link
            href={post.author.id ? `/u/${post.author.id}` : '#'}
            className="min-w-0 truncate font-semibold text-[var(--text)] hover:underline"
          >
            {post.author.username}
          </Link>
          <VerifiedMark verified={post.author.verified_at} />

          {/* Возраст сразу за ником, а не у правого края: там он читался
              отдельной колонкой и отрывался от того, к чему относится. */}
          <span className="text-[13px] text-[var(--text-muted)]">
            {formatCompactAge(post.created_at)}
          </span>

          {/* Просмотры — наверх, к возрасту, и мельче всего в строке.
              Внизу они стояли в ряду действий: голоса, комментарии, репост,
              «поделиться» — и просмотры пятым, того же роста. Но это не
              действие, а показание прибора: нажимать не на что. Стоя среди
              кнопок, оно обещало нажатие и занимало место того, кто его
              заслуживает.

              Наверху же оно попадает в свою компанию — к возрасту записи, где
              собрано всё, что про запись известно, а не всё, что с ней можно
              сделать.

              Ноль не рисуем вовсе. У свежей записи просмотров нет по
              определению, и «0 просмотров» читается приговором, а не
              показанием. */}
          {post.views > 0 && (
            <span
              className="flex flex-none items-center gap-0.5 text-[var(--text-muted)]"
              title={`${post.views} просмотров`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span className="font-num text-[12px]">{compactViews(post.views)}</span>
            </span>
          )}

          {/* Пост от имени сообщества: стрелка и название акцентом. Без флага
              подпись остаётся обычной, хотя сообщество у записи есть всегда. */}
          {post.post_as_community && post.community && (
            <>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="m9 6 6 6-6 6" />
              </svg>
              <Link
                href={`/c/${post.community.id}`}
                className="truncate font-semibold hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {post.community.name}
              </Link>
            </>
          )}

        </div>

        {/* Три точки — общее место для всего, что делают с чужой записью и
            что не заслуживает своей кнопки в строке действий. */}
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Ещё"
          className="-mr-2 flex h-8 w-8 flex-none items-center justify-center rounded-full transition-colors hover:bg-[var(--surface-2)]"
          style={{ color: 'var(--control)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <circle cx="5" cy="12" r="1.7" />
            <circle cx="12" cy="12" r="1.7" />
            <circle cx="19" cy="12" r="1.7" />
          </svg>
        </button>
      </div>

      {/* Первая строка — газетной антиквой, остальное — обычным текстом.
          Раньше и то и другое шло одним кеглем и одной гарнитурой: решение
          было в том, чтобы не навязывать структуру, которой в мыслях нет. Но
          гарнитура структуры и не навязывает — она задаёт голос. Антиква
          отделяет мысль от её изложения тем же способом, каким это делает
          газетная полоса, и не заставляет писать заголовок: у записи в одну
          строку просто вся строка набрана крупно.

          Кегль при этом почти не растёт — работает контраст форм, а не
          размера, иначе лента снова распалась бы на «крупное» и «мелкое». */}
      <div className="relative flex flex-col gap-1.5 text-[var(--text)]">
        <p className="display-type whitespace-pre-line text-[16px] leading-snug">
          {post.title}
        </p>
        {post.body && (
          <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{post.body}</p>
        )}
      </div>

      {hasChain && <ChainTail chain={post.chain!} total={post.chain!.length + 1} />}

      {/* Картинка открывается во весь экран. В колонке шириной в телефон её
          обрезает по 340 пикселям высоты, и всё, что мельче лица крупным
          планом, разглядеть было нельзя. Кнопка, а не div с обработчиком:
          открывать можно и с клавиатуры.

          images массивом, хотя пока у записи одна: просмотрщик умеет листать, и
          когда у записи будет несколько снимков, менять здесь придётся один
          список, а не механику. */}
      {images.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--border)]">
          {/* Одна прокручиваемая строка, а не блоки со стрелками.
              Стрелки были работой вместо жеста: снимки листают пальцем, и
              каждая кнопка на этом пути — лишний прицел. Прокрутка при этом не
              наша, а браузерная: у неё уже есть инерция, резина у краёв и
              подхват трекпадом, и любая своя реализация оказалась бы хуже по
              всем трём пунктам сразу.

              scroll-snap держит кадр на месте: без него строка останавливается
              где придётся и показывает половину одного снимка и половину
              другого. */}
          <div
            ref={stripRef}
            onScroll={onStripScroll}
            className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
            style={{ scrollBehavior: 'auto', overscrollBehaviorX: 'contain' }}
          >
            {images.map((src, position) => (
              <button
                key={`${src}-${position}`}
                data-strip-image={position}
                type="button"
                onClick={() => setViewing(position)}
                // snap-always: одно движение — один кадр, как бы резко ни
                // смахнули. Без него инерция уносит строку через два-три
                // снимка, и человек, листнувший «на один», оказывается в конце
                // альбома и не понимает, что пропустил. Свойство для этого и
                // придумано: оно запрещает прокрутке проехать мимо точки
                // притяжения, а не просто притягивает к ближайшей.
                className="block w-full flex-none snap-center snap-always transition-transform active:scale-[0.995]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- источник картинок произвольный, next/image требует настройки доменов */}
                <img
                  src={src}
                  alt=""
                  loading={position === 0 ? 'lazy' : 'eager'}
                  draggable={false}
                  className="w-full object-cover"
                  style={{ height: 340 }}
                />
              </button>
            ))}
          </div>

          {images.length > 1 && (
            <>
              <span
                className="font-num pointer-events-none absolute right-3 top-3 rounded-full px-2 py-0.5 text-[12px] font-medium text-white"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
              >
                {shown + 1}/{images.length}
              </span>

              <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center gap-1.5">
                {images.map((src, position) => (
                  <span
                    key={`dot-${src}-${position}`}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: position === shown ? 16 : 6,
                      background:
                        position === shown ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)',
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <StoryComposer draft={storyDraft} onClose={() => setStoryDraft(null)} />

      <ImageViewer
        images={images}
        index={viewing}
        onIndex={setViewing}
        // Откуда картинка приехала — чтобы при закрытии она туда и села.
        // Кадр берём в момент запроса, а не запоминаем при открытии: за время
        // просмотра лента могла доехать (догрузились записи выше), и старый
        // прямоугольник отправил бы снимок мимо собственного места.
        originFor={(position) =>
          stripRef.current
            ?.querySelector<HTMLElement>(`[data-strip-image='${position}'] img`)
            ?.getBoundingClientRect() ?? null
        }
        onClose={() => {
          // Возвращаемся в ленту на том снимке, до которого долистали во весь
          // экран: закрыть просмотр и обнаружить первый кадр — потерять место.
          // Прокруткой без анимации: это не переход, а восстановление положения.
          const strip = stripRef.current;
          if (viewing >= 0 && strip) {
            strip.scrollTo({ left: viewing * strip.clientWidth, behavior: 'instant' as ScrollBehavior });
          }
          setViewing(-1);
        }}
      />

      {post.pollOptions?.length > 0 && (
        <PollBlock postId={post.id} options={post.pollOptions} myVote={post.myPollVote} />
      )}

      {/* Две группы, а не пять кнопок в ряд. Слева то, что относится к самой
          записи — голос и обсуждение; справа то, что уносит её дальше — репост
          и «поделиться». Внутри группы кнопки стоят вплотную, между группами
          пусто: так видно, что это два разных действия, а не пять равных. */}
      <div className="relative mt-1 flex items-center justify-between">
        <div className="-ml-1 flex items-center">
          <VoteBlock id={post.id} score={post.score} myVote={post.myVote} />

          {linkToDetail && (
            // Комментарии открываются шторкой поверх ленты, а не отдельной
            // страницей: так не теряется место, до которого дочитали.
            <button
              onClick={() => setCommentsOpen(true)}
              aria-label="Комментарии"
              aria-expanded={commentsOpen}
              className="flex items-center gap-1.5 rounded-full px-2.5 py-2.5 transition-transform duration-100 active:scale-[0.86]"
              style={{ color: 'var(--control)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5c-1 0-2-.2-2.9-.6L4.5 20l1.2-4.4A7.5 7.5 0 1 1 20 11.5Z" />
              </svg>
              <span className="font-num text-[15px]">{commentCount}</span>
            </button>
          )}
        </div>

        <div className="-mr-1 flex items-center">
          <button
            onClick={handleRepost}
            aria-label="Репост"
            aria-pressed={reposted}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-2.5 transition-transform duration-100 active:scale-[0.86]"
            // Только цвет иконки, без заливки и обводки — как у стрелок.
            style={{ color: reposted ? 'var(--repost)' : 'var(--control)' }}
          >
            <span key={repostSpin} className={repostSpin > 0 ? 'animate-repost' : undefined} style={{ display: 'inline-flex' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 7h9a3 3 0 0 1 3 3v2" />
                <path d="m12 5-3 2 3 2" />
                <path d="M18 17H9a3 3 0 0 1-3-3v-2" />
                <path d="m12 19 3-2-3-2" />
              </svg>
            </span>
            <RollingNumber value={repostCount} className="font-num text-[15px]" />
          </button>

          <button
            onClick={() => setShareOpen(true)}
            aria-label="Поделиться"
            className="flex h-9 w-9 items-center justify-center transition-colors hover:text-[var(--text)]"
            style={{ color: 'var(--control)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
              <path d="M16 6l-4-4-4 4" />
              <path d="M12 2v14" />
            </svg>
          </button>
        </div>
      </div>

      {linkToDetail && (
        <CommentSheet
          postId={post.id}
          open={commentsOpen}
          onClose={() => setCommentsOpen(false)}
          onCountChange={setCommentCount}
        />
      )}

      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        url={typeof window === 'undefined' ? '' : `${window.location.origin}/posts/${post.id}`}
        text={post.title}
      />

      <PostMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        url={typeof window === 'undefined' ? '' : `${window.location.origin}/posts/${post.id}`}
        postId={post.id}
        // Репост в историю идёт через редактор: между решением и публикацией
        // должен быть шаг, на котором видно, что именно уйдёт.
        onStory={() =>
          setStoryDraft({
            postId: post.id,
            title: post.title,
            body: post.body,
            images,
          })
        }
        isMine={isMine}
        onDelete={remove}
        // Продолжить можно только своё и только то, у чего продолжения ещё нет:
        // цепочка — одна мысль одного человека, и ветвиться ей нечем.
        continueHref={
          isMine && !hasChain ? `/create?after=${post.id}` : undefined
        }
      />
    </article>
  );
}

/**
 * Продолжения записи — то, что написано вслед за ней.
 *
 * Рисуются внутри начала цепочки, а не отдельными постами в ленте: это одна
 * мысль, разложенная на несколько заходов, и раскидывать её куски между чужими
 * записями значит её потерять. Слева — линия принадлежности, та же, что у
 * ветки ответов в комментариях: она показывает, что записи связаны, не занимая
 * места подписью у каждой.
 */
function ChainTail({ chain, total }: { chain: Post[]; total: number }) {
  return (
    <div className="mt-1 flex flex-col gap-3 pl-[19px]" style={{ position: 'relative' }}>
      {/* Ствол на всю высоту хвоста. Волосяной и приглушённый — служебная
          разметка не должна перебивать текст, который она размечает. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: -4,
          bottom: 8,
          width: 1.5,
          borderRadius: 999,
          background: 'color-mix(in srgb, var(--border) 75%, transparent)',
        }}
      />

      {chain.map((part, index) => (
        <div key={part.id} className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-[var(--text-muted)]">
            Вслед · <span className="font-num">{index + 2}</span> из{' '}
            <span className="font-num">{total}</span>
          </span>
          <p className="display-type whitespace-pre-line text-[15px] leading-snug text-[var(--text)]">
            {part.title}
          </p>
          {part.body && (
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-[var(--text)]">
              {part.body}
            </p>
          )}
          {part.image_url && (
            // eslint-disable-next-line @next/next/no-img-element -- источник произвольный, next/image требует настройки доменов
            <img
              src={part.image_url}
              alt=""
              loading="lazy"
              className="w-full rounded-xl border border-[var(--border)] object-cover"
              style={{ maxHeight: 260 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
